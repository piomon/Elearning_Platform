import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { payments, accessGrants, courses } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { paymentLimiter } from "../middlewares/rate-limit";
import { logger } from "../lib/logger";
import { config, isP24Configured } from "../config/env";

const router = Router();

// Prevent open-redirect: only honor a client-supplied returnUrl when it points
// back to our own configured app origin. Anything else falls back to the safe
// default success page.
function safeReturnUrl(returnUrl: unknown): string {
  const fallback = `${config.appUrl}/payment/success`;
  if (typeof returnUrl !== "string" || returnUrl.trim() === "") {
    return fallback;
  }
  try {
    const candidate = new URL(returnUrl, config.appUrl);
    const appOrigin = new URL(config.appUrl).origin;
    if (candidate.origin !== appOrigin) {
      return fallback;
    }
    return candidate.toString();
  } catch {
    return fallback;
  }
}

async function grantCourseAccess(userId: number, courseId: number, paymentId: number) {
  // Atomic and idempotent: concurrent provider callbacks (P24 retries) can race
  // here, so rely on the partial unique index over active grants
  // (access_grants_active_user_course_uniq) instead of select-then-insert.
  await db
    .insert(accessGrants)
    .values({
      userId,
      courseId,
      source: "payment",
      paymentId,
      status: "active",
      validFrom: new Date(),
    })
    .onConflictDoNothing();
}

router.get("/payments/price", async (_req, res) => {
  res.json({ price: config.coursePriceGrosz, currency: config.currency });
});

router.post("/payments/create", paymentLimiter, requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const { courseId, returnUrl } = req.body;
    const cId = Number(courseId);
    if (!Number.isInteger(cId) || cId <= 0) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator kursu" });
      return;
    }

    const [course] = await db.select().from(courses).where(eq(courses.id, cId)).limit(1);
    if (!course || !course.isPublished) {
      res.status(404).json({ error: "Kurs nie znaleziony" });
      return;
    }

    const amount = config.coursePriceGrosz;

    const [payment] = await db
      .insert(payments)
      .values({
        userId: req.user!.id,
        provider: "przelewy24",
        amount,
        currency: config.currency,
        status: "pending",
        courseId: cId,
      })
      .returning();

    if (!isP24Configured()) {
      if (config.isProd) {
        res.status(503).json({ error: "Płatności są chwilowo niedostępne." });
        return;
      }
      const mockUrl = `${config.appUrl}/payment/success?paymentId=${payment.id}&mock=true`;
      res.json({ redirectUrl: mockUrl, paymentId: payment.id });
      return;
    }

    const sessionId = `${payment.id}-${Date.now()}`;
    const signData = JSON.stringify({
      sessionId,
      merchantId: Number(config.p24.merchantId),
      amount,
      currency: config.currency,
      crc: config.p24.crc,
    });
    const sign = crypto.createHash("sha384").update(signData).digest("hex");

    const p24Body = {
      merchantId: Number(config.p24.merchantId),
      posId: Number(config.p24.posId),
      sessionId,
      amount,
      currency: config.currency,
      description: `Dostęp do kursu: ${course.title}`,
      email: req.user!.email,
      country: "PL",
      language: "pl",
      urlReturn: safeReturnUrl(returnUrl),
      urlStatus: `${config.apiUrl}/api/payments/webhook`,
      sign,
    };

    const p24Res = await fetch(`${config.p24.baseUrl}/api/v1/transaction/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.p24.posId}:${config.p24.apiKey}`).toString("base64")}`,
      },
      body: JSON.stringify(p24Body),
    });
    const p24Data = (await p24Res.json()) as { data?: { token?: string } };
    const token = p24Data?.data?.token;

    if (!token) {
      logger.error({ status: p24Res.status }, "P24 register failed");
      res.status(502).json({ error: "Błąd inicjalizacji płatności" });
      return;
    }

    await db
      .update(payments)
      .set({
        providerPaymentId: sessionId,
        providerSessionId: sessionId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));
    res.json({
      redirectUrl: `${config.p24.baseUrl}/trnRequest/${token}`,
      paymentId: payment.id,
    });
  } catch (err) {
    logger.error({ err }, "Create payment error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/payments/webhook", async (req, res) => {
  try {
    const { sessionId, orderId, amount, currency, sign } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "Brak sessionId" });
      return;
    }

    const paymentId = Number(String(sessionId).split("-")[0]);
    if (!paymentId || Number.isNaN(paymentId)) {
      res.status(400).json({ error: "Nieprawidłowe sessionId" });
      return;
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) {
      res.status(404).json({ error: "Płatność nie znaleziona" });
      return;
    }

    // Idempotency: already processed.
    if (payment.status === "completed") {
      res.json({ message: "OK" });
      return;
    }

    // Verify P24 signature when configured.
    if (isP24Configured()) {
      const expectedSign = crypto
        .createHash("sha384")
        .update(
          JSON.stringify({
            sessionId,
            orderId,
            amount,
            currency,
            crc: config.p24.crc,
          }),
        )
        .digest("hex");
      if (expectedSign !== sign) {
        logger.warn({ paymentId }, "Webhook signature mismatch");
        res.status(400).json({ error: "Nieprawidłowy podpis" });
        return;
      }

      // Verify the amount and currency match what we expect for this payment.
      if (Number(amount) !== payment.amount || (currency && currency !== payment.currency)) {
        logger.warn(
          { paymentId, amount, expected: payment.amount },
          "Webhook amount mismatch",
        );
        res.status(400).json({ error: "Niezgodna kwota płatności" });
        return;
      }

      // Confirm the transaction directly with Przelewy24 before completing it.
      // The webhook body alone is not authoritative — P24 requires an explicit
      // verify call, and only a "success" status should grant access.
      const verifySign = crypto
        .createHash("sha384")
        .update(
          JSON.stringify({
            sessionId,
            orderId,
            amount,
            currency,
            crc: config.p24.crc,
          }),
        )
        .digest("hex");

      let verifyStatus: string | undefined;
      try {
        const verifyRes = await fetch(
          `${config.p24.baseUrl}/api/v1/transaction/verify`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${Buffer.from(`${config.p24.posId}:${config.p24.apiKey}`).toString("base64")}`,
            },
            body: JSON.stringify({
              merchantId: Number(config.p24.merchantId),
              posId: Number(config.p24.posId),
              sessionId,
              amount: Number(amount),
              currency: currency ?? payment.currency,
              orderId,
              sign: verifySign,
            }),
          },
        );
        const verifyData = (await verifyRes.json()) as {
          data?: { status?: string };
        };
        verifyStatus = verifyData?.data?.status;
      } catch (verifyErr) {
        logger.error({ verifyErr, paymentId }, "P24 verify request failed");
        res.status(502).json({ error: "Weryfikacja płatności nie powiodła się" });
        return;
      }

      if (verifyStatus !== "success") {
        logger.warn({ paymentId, verifyStatus }, "P24 verify not successful");
        res.status(400).json({ error: "Płatność nie została potwierdzona" });
        return;
      }
    } else if (config.isProd) {
      // Never trust unverified webhooks in production.
      res.status(503).json({ error: "Weryfikacja płatności niedostępna" });
      return;
    }

    if (payment.courseId == null) {
      logger.error({ paymentId }, "Payment has no associated course");
      res.status(500).json({ error: "Płatność bez przypisanego kursu" });
      return;
    }

    await db
      .update(payments)
      .set({
        status: "completed",
        providerOrderId: orderId != null ? String(orderId) : payment.providerOrderId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    await grantCourseAccess(payment.userId, payment.courseId, payment.id);

    res.json({ message: "OK" });
  } catch (err) {
    logger.error({ err }, "Webhook error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/payments/me", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const myPayments = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        provider: payments.provider,
        providerPaymentId: payments.providerPaymentId,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.userId, req.user!.id));
    res.json(myPayments);
  } catch (err) {
    req.log.error({ err }, "Get payments error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// Development/test-only helper to simulate a completed payment without a real
// payment provider. Never registered in production.
if (config.isDev || config.isTest) {
  router.post(
    "/payments/mock-complete/:paymentId",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      try {
        const paymentId = Number(req.params.paymentId);
        const [payment] = await db
          .select()
          .from(payments)
          .where(eq(payments.id, paymentId))
          .limit(1);
        if (!payment || payment.userId !== req.user!.id) {
          res.status(404).json({ error: "Płatność nie znaleziona" });
          return;
        }

        if (payment.courseId == null) {
          res.status(500).json({ error: "Płatność bez przypisanego kursu" });
          return;
        }

        if (payment.status !== "completed") {
          await db
            .update(payments)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(payments.id, paymentId));
        }

        await grantCourseAccess(payment.userId, payment.courseId, payment.id);

        res.json({ message: "Dostęp aktywowany!" });
      } catch (err) {
        req.log.error({ err }, "Mock complete payment error");
        res.status(500).json({ error: "Błąd serwera" });
      }
    },
  );
}

export default router;

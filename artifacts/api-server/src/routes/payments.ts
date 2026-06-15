import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { payments, accessGrants, courses, discountCodes, discountCodeUses } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { paymentLimiter } from "../middlewares/rate-limit";
import { logger } from "../lib/logger";
import { config, isPaynowConfigured } from "../config/env";
import { getPricingSettings } from "../lib/settings";
import { validateDiscountForPurchase } from "../lib/discounts";

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

// Paynow authenticates requests and signs notifications with an HMAC-SHA256 of
// the exact (raw) payload, encoded as base64, using the merchant Signature Key.
function signPaynow(rawBody: string | Buffer): string {
  return crypto
    .createHmac("sha256", config.paynow.signatureKey!)
    .update(rawBody)
    .digest("base64");
}

// A db handle that may be the root connection or a transaction. Lets the same
// helpers run standalone or inside `db.transaction(...)`.
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function grantCourseAccess(
  userId: number,
  courseId: number,
  paymentId: number,
  tx: DbExecutor = db,
) {
  // Atomic and idempotent: concurrent provider callbacks (Paynow retries) can
  // race here, so rely on the partial unique index over active grants
  // (access_grants_active_user_course_uniq) instead of select-then-insert.
  await tx
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

// Record a discount redemption exactly once when a payment completes. Idempotent
// against provider retries: the partial unique index on discount_code_uses
// (payment_id) makes the insert a no-op on the second attempt, and usedCount is
// only bumped when the insert actually created a row — so concurrent webhooks
// can never inflate the counter. Run inside the same transaction as the payment
// completion so a failure here rolls the whole completion back and a retry redoes
// it cleanly.
async function finalizeDiscountUse(
  payment: typeof payments.$inferSelect,
  tx: DbExecutor = db,
) {
  if (!payment.discountCodeId || payment.discountGrosz <= 0) return;
  const inserted = await tx
    .insert(discountCodeUses)
    .values({
      discountCodeId: payment.discountCodeId,
      userId: payment.userId,
      paymentId: payment.id,
      courseId: payment.courseId ?? null,
      amountBeforeGrosz: payment.amount + payment.discountGrosz,
      discountGrosz: payment.discountGrosz,
      amountAfterGrosz: payment.amount,
    })
    .onConflictDoNothing({ target: discountCodeUses.paymentId })
    .returning({ id: discountCodeUses.id });
  if (inserted.length === 0) return;
  await tx
    .update(discountCodes)
    .set({ usedCount: sql`${discountCodes.usedCount} + 1`, updatedAt: new Date() })
    .where(eq(discountCodes.id, payment.discountCodeId));
}

router.get("/payments/price", async (_req, res) => {
  const pricing = await getPricingSettings();
  res.json({
    price: pricing.priceGrosz,
    currency: pricing.currency,
    oldPrice: pricing.oldPriceGrosz,
    promoEnabled: pricing.promoEnabled,
    promoLabel: pricing.promoLabel,
    promoStartsAt: pricing.promoStartsAt,
    promoEndsAt: pricing.promoEndsAt,
    ctaText: pricing.ctaText,
  });
});

// Validate a discount code against the current price for a course and return the
// computed amounts so the checkout page can show the buyer their new total
// before paying. The discount is re-validated server-side at create time too.
router.post("/payments/validate-discount", paymentLimiter, requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const cId = Number(req.body?.courseId);
    if (!Number.isInteger(cId) || cId <= 0) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator kursu" });
      return;
    }
    const [course] = await db.select().from(courses).where(eq(courses.id, cId)).limit(1);
    if (!course || course.status !== "published") {
      res.status(404).json({ error: "Kurs nie znaleziony" });
      return;
    }
    const { priceGrosz: fullPrice, currency } = await getPricingSettings();
    const result = await validateDiscountForPurchase({
      rawCode: req.body?.code,
      userId: req.user!.id,
      courseId: cId,
      amountBeforeGrosz: fullPrice,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({
      code: result.code.code,
      type: result.code.type,
      value: result.code.value,
      amountBeforeGrosz: result.amountBeforeGrosz,
      discountGrosz: result.discountGrosz,
      amountAfterGrosz: result.amountAfterGrosz,
      currency,
    });
  } catch (err) {
    req.log.error({ err }, "Validate discount error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/payments/create", paymentLimiter, requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const { courseId, returnUrl, discountCode } = req.body;
    const cId = Number(courseId);
    if (!Number.isInteger(cId) || cId <= 0) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator kursu" });
      return;
    }

    const [course] = await db.select().from(courses).where(eq(courses.id, cId)).limit(1);
    if (!course || course.status !== "published") {
      res.status(404).json({ error: "Kurs nie znaleziony" });
      return;
    }

    // Amount is taken from the DB pricing singleton (single source of truth) so
    // the charged price always matches what the page shows. Fixed server-side
    // so the buyer can never tamper with it.
    const { priceGrosz: fullPrice, currency } = await getPricingSettings();

    // Apply a discount code when supplied. The discount is re-validated and
    // recomputed server-side here (never trusting any client-sent amount) so the
    // charged price and the amount sent to Paynow always agree.
    let amount = fullPrice;
    let discountCodeId: number | null = null;
    let discountGrosz = 0;
    if (typeof discountCode === "string" && discountCode.trim()) {
      const result = await validateDiscountForPurchase({
        rawCode: discountCode,
        userId: req.user!.id,
        courseId: cId,
        amountBeforeGrosz: fullPrice,
      });
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      amount = result.amountAfterGrosz;
      discountGrosz = result.discountGrosz;
      discountCodeId = result.code.id;
    }

    const [payment] = await db
      .insert(payments)
      .values({
        userId: req.user!.id,
        provider: "paynow",
        amount,
        currency,
        status: "pending",
        courseId: cId,
        discountCodeId,
        discountGrosz,
      })
      .returning();

    // Without Paynow credentials we cannot create a real payment. In production
    // we fail closed; in development/test we fall back to a mock success URL so
    // the post-payment flow can be exercised locally (see mock-complete below).
    if (!isPaynowConfigured()) {
      if (config.isProd) {
        res.status(503).json({ error: "Płatności są chwilowo niedostępne." });
        return;
      }
      const mockUrl = `${config.appUrl}/payment/success?paymentId=${payment.id}&mock=true`;
      res.json({ redirectUrl: mockUrl, paymentId: payment.id });
      return;
    }

    const continueUrl = safeReturnUrl(returnUrl);

    // externalId ties the Paynow payment back to our row; amount is fixed
    // server-side so the buyer can never tamper with the charged price.
    const paynowBody = JSON.stringify({
      amount,
      currency,
      externalId: String(payment.id),
      description: `Dostęp do kursu: ${course.title}`,
      continueUrl,
      buyer: { email: req.user!.email },
    });

    let paynowData:
      | { paymentId?: string; status?: string; redirectUrl?: string }
      | null = null;
    let ok = false;
    let httpStatus = 0;
    try {
      const paynowRes = await fetch(`${config.paynow.apiUrl}/v1/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": config.paynow.apiKey!,
          Signature: signPaynow(paynowBody),
          // Reusing the same key for retries of one payment row makes Paynow
          // return the existing payment instead of creating a duplicate.
          "Idempotency-Key": `paynow-payment-${payment.id}`,
        },
        body: paynowBody,
      });
      httpStatus = paynowRes.status;
      ok = paynowRes.ok;
      paynowData = (await paynowRes.json().catch(() => null)) as
        | { paymentId?: string; status?: string; redirectUrl?: string }
        | null;
    } catch (fetchErr) {
      logger.error({ fetchErr }, "Paynow create request failed");
      res.status(502).json({ error: "Błąd inicjalizacji płatności" });
      return;
    }

    if (!ok || !paynowData?.paymentId || !paynowData?.redirectUrl) {
      logger.error({ status: httpStatus }, "Paynow create failed");
      res.status(502).json({ error: "Błąd inicjalizacji płatności" });
      return;
    }

    await db
      .update(payments)
      .set({
        providerPaymentId: paynowData.paymentId,
        providerSessionId: paynowData.paymentId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    res.json({ redirectUrl: paynowData.redirectUrl, paymentId: payment.id });
  } catch (err) {
    logger.error({ err }, "Create payment error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/payments/webhook", async (req, res) => {
  try {
    // Verify the Paynow signature over the exact raw request body. Without the
    // Signature Key the notification cannot be trusted, so production rejects it
    // outright; only dev/test (mock flow) is allowed to skip verification.
    if (isPaynowConfigured()) {
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      const provided = req.header("Signature") ?? "";
      if (!rawBody || !provided) {
        res.status(400).json({ error: "Brak podpisu" });
        return;
      }
      const expectedBuf = Buffer.from(signPaynow(rawBody));
      const providedBuf = Buffer.from(provided);
      if (
        providedBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(providedBuf, expectedBuf)
      ) {
        logger.warn("Webhook signature mismatch");
        res.status(400).json({ error: "Nieprawidłowy podpis" });
        return;
      }
    } else if (config.isProd) {
      res.status(503).json({ error: "Weryfikacja płatności niedostępna" });
      return;
    }

    const {
      externalId,
      paymentId: providerPaymentId,
      status,
    } = req.body as {
      externalId?: string;
      paymentId?: string;
      status?: string;
    };

    const localId = Number(externalId);
    if (!localId || Number.isNaN(localId)) {
      res.status(400).json({ error: "Nieprawidłowe externalId" });
      return;
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, localId))
      .limit(1);
    if (!payment) {
      res.status(404).json({ error: "Płatność nie znaleziona" });
      return;
    }

    // Idempotency: a confirmed payment is terminal — never regress or re-grant.
    if (payment.status === "completed") {
      res.json({ message: "OK" });
      return;
    }

    // Bind the notification to the Paynow payment we created for this row.
    if (
      providerPaymentId &&
      payment.providerPaymentId &&
      providerPaymentId !== payment.providerPaymentId
    ) {
      logger.warn({ localId }, "Webhook paymentId mismatch");
      res.status(400).json({ error: "Niezgodny identyfikator płatności" });
      return;
    }

    const normalized = String(status ?? "").toUpperCase();

    // Non-terminal states: acknowledge without changing access.
    if (normalized === "NEW" || normalized === "PENDING") {
      res.json({ message: "OK" });
      return;
    }

    if (normalized !== "CONFIRMED") {
      // REJECTED / ERROR / EXPIRED / ABANDONED — record the failure, no access.
      await db
        .update(payments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(payments.id, localId));
      res.json({ message: "OK" });
      return;
    }

    if (payment.courseId == null) {
      logger.error({ localId }, "Payment has no associated course");
      res.status(500).json({ error: "Płatność bez przypisanego kursu" });
      return;
    }

    // Complete the payment, grant access and record the discount use atomically:
    // either all three commit or none do. Combined with the idempotent inserts
    // (onConflictDoNothing) this makes provider retries safe — a failed
    // finalization rolls back the "completed" status so a retry redoes it instead
    // of being short-circuited by the early-return above.
    const courseId = payment.courseId;
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: "completed",
          providerOrderId:
            providerPaymentId != null
              ? String(providerPaymentId)
              : payment.providerOrderId,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, localId));
      await grantCourseAccess(payment.userId, courseId, payment.id, tx);
      await finalizeDiscountUse({ ...payment, status: "completed" }, tx);
    });

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

        const courseId = payment.courseId;
        await db.transaction(async (tx) => {
          if (payment.status !== "completed") {
            await tx
              .update(payments)
              .set({ status: "completed", updatedAt: new Date() })
              .where(eq(payments.id, paymentId));
          }
          await grantCourseAccess(payment.userId, courseId, payment.id, tx);
          await finalizeDiscountUse({ ...payment, status: "completed" }, tx);
        });

        res.json({ message: "Dostęp aktywowany!" });
      } catch (err) {
        req.log.error({ err }, "Mock complete payment error");
        res.status(500).json({ error: "Błąd serwera" });
      }
    },
  );
}

export default router;

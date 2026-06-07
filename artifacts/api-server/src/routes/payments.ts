import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { payments, accessGrants, courses } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const COURSE_PRICE_PLN = 19900;

router.post("/payments/create", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const { courseId, returnUrl } = req.body;
    const cId = courseId ?? 1;

    const [course] = await db.select().from(courses).where(eq(courses.id, cId)).limit(1);
    if (!course) {
      res.status(404).json({ error: "Kurs nie znaleziony" });
      return;
    }

    const [payment] = await db.insert(payments).values({
      userId: req.user!.id,
      provider: "przelewy24",
      amount: COURSE_PRICE_PLN,
      currency: "PLN",
      status: "pending",
      courseId: cId,
    }).returning();

    const p24MerchantId = process.env.P24_MERCHANT_ID;
    const p24PosId = process.env.P24_POS_ID;
    const p24ApiKey = process.env.P24_API_KEY;
    const p24Crc = process.env.P24_CRC;

    if (!p24MerchantId || !p24PosId || !p24ApiKey || !p24Crc) {
      const baseUrl = process.env.APP_URL ?? "http://localhost";
      const mockUrl = `${baseUrl}/payment/success?paymentId=${payment.id}&mock=true`;
      res.json({ redirectUrl: mockUrl, paymentId: payment.id });
      return;
    }

    const sessionId = `${payment.id}-${Date.now()}`;
    const signData = JSON.stringify({
      sessionId,
      merchantId: Number(p24MerchantId),
      amount: COURSE_PRICE_PLN,
      currency: "PLN",
      crc: p24Crc,
    });
    const sign = crypto.createHash("sha384").update(signData).digest("hex");

    const p24Body = {
      merchantId: Number(p24MerchantId),
      posId: Number(p24PosId),
      sessionId,
      amount: COURSE_PRICE_PLN,
      currency: "PLN",
      description: `Dostęp do kursu: ${course.title}`,
      email: req.user!.email,
      country: "PL",
      language: "pl",
      urlReturn: returnUrl ?? `${process.env.APP_URL}/payment/success`,
      urlStatus: `${process.env.APP_URL ?? process.env.API_URL ?? ""}/api/payments/webhook`,
      sign,
    };

    const p24Res = await fetch("https://sandbox.przelewy24.pl/api/v1/transaction/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${p24PosId}:${p24ApiKey}`).toString("base64")}` },
      body: JSON.stringify(p24Body),
    });
    const p24Data = (await p24Res.json()) as { data?: { token?: string } };
    const token = p24Data?.data?.token;

    if (!token) {
      res.status(500).json({ error: "Błąd inicjalizacji płatności" });
      return;
    }

    await db.update(payments).set({ providerPaymentId: sessionId }).where(eq(payments.id, payment.id));
    res.json({ redirectUrl: `https://sandbox.przelewy24.pl/trnRequest/${token}`, paymentId: payment.id });
  } catch (err) {
    logger.error({ err }, "Create payment error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.post("/payments/webhook", async (req, res) => {
  try {
    const { sessionId, orderId, amount, currency, sign } = req.body;
    const p24Crc = process.env.P24_CRC;
    const p24MerchantId = process.env.P24_MERCHANT_ID;

    if (p24Crc && p24MerchantId) {
      const expectedSign = crypto.createHash("sha384").update(JSON.stringify({ sessionId, orderId, amount, currency, crc: p24Crc })).digest("hex");
      if (expectedSign !== sign) {
        res.status(400).json({ error: "Nieprawidłowy podpis" });
        return;
      }
    }

    const paymentIdStr = sessionId?.split("-")?.[0];
    const paymentId = Number(paymentIdStr);
    if (!paymentId || isNaN(paymentId)) {
      res.status(400).json({ error: "Nieprawidłowe sessionId" });
      return;
    }

    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment) {
      res.status(404).json({ error: "Płatność nie znaleziona" });
      return;
    }

    await db.update(payments).set({ status: "completed", providerPaymentId: orderId ?? sessionId, updatedAt: new Date() }).where(eq(payments.id, paymentId));

    const existing = await db.select({ id: accessGrants.id }).from(accessGrants).where(
      and(eq(accessGrants.userId, payment.userId), eq(accessGrants.courseId, payment.courseId ?? 1), eq(accessGrants.status, "active"))
    ).limit(1);

    if (existing.length === 0) {
      await db.insert(accessGrants).values({
        userId: payment.userId,
        courseId: payment.courseId ?? 1,
        source: "payment",
        paymentId: payment.id,
        status: "active",
        validFrom: new Date(),
      });
    }

    res.json({ message: "OK" });
  } catch (err) {
    logger.error({ err }, "Webhook error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

router.get("/payments/me", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const myPayments = await db.select({
      id: payments.id,
      userId: payments.userId,
      provider: payments.provider,
      providerPaymentId: payments.providerPaymentId,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      createdAt: payments.createdAt,
    }).from(payments).where(eq(payments.userId, req.user!.id));
    res.json(myPayments);
  } catch (err) {
    req.log.error({ err }, "Get payments error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export { router as paymentsRouter };

router.post("/payments/mock-complete/:paymentId", requireAuth as any, async (req: AuthRequest, res) => {
  try {
    const paymentId = Number(req.params.paymentId);
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment || payment.userId !== req.user!.id) {
      res.status(404).json({ error: "Płatność nie znaleziona" });
      return;
    }

    await db.update(payments).set({ status: "completed", updatedAt: new Date() }).where(eq(payments.id, paymentId));

    const existing = await db.select({ id: accessGrants.id }).from(accessGrants).where(
      and(eq(accessGrants.userId, payment.userId), eq(accessGrants.status, "active"))
    ).limit(1);

    if (existing.length === 0) {
      await db.insert(accessGrants).values({
        userId: payment.userId,
        courseId: payment.courseId ?? 1,
        source: "payment",
        paymentId: payment.id,
        status: "active",
        validFrom: new Date(),
      });
    }

    res.json({ message: "Dostęp aktywowany!" });
  } catch (err) {
    req.log.error({ err }, "Mock complete payment error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { contactMessages } from "@workspace/db";
import { logger } from "../lib/logger";
import { contactLimiter } from "../middlewares/rate-limit";
import { config, isSmtpConfigured } from "../config/env";

const router = Router();

router.post("/contact", contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, consent } = req.body;
    if (!name || !email || !subject || !message) {
      res.status(400).json({ error: "Wszystkie pola są wymagane" });
      return;
    }
    if (message.length < 10) {
      res.status(400).json({ error: "Wiadomość jest za krótka (minimum 10 znaków)" });
      return;
    }
    if (consent !== true) {
      res.status(400).json({
        error: "Wymagana jest zgoda na przetwarzanie danych osobowych",
      });
      return;
    }

    const [saved] = await db
      .insert(contactMessages)
      .values({
        name,
        email,
        subject,
        message,
        status: "new",
        consent: true,
        consentAt: new Date(),
      })
      .returning({ id: contactMessages.id });

    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    if (isSmtpConfigured()) {
      try {
        const { createTransport } = await import("nodemailer");
        const transporter = createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          auth: { user: config.smtp.user, pass: config.smtp.pass },
        });
        await transporter.sendMail({
          from: config.smtp.fromEmail,
          to: config.smtp.toEmail,
          replyTo: email,
          subject: `[Fizyka] Nowa wiadomość: ${subject}`,
          text: `Od: ${name} <${email}>\n\n${message}`,
        });
        emailStatus = "sent";
      } catch (mailErr) {
        emailStatus = "failed";
        logger.warn(
          { mailErr, contactMessageId: saved.id },
          "Email notification failed (non-critical); message saved in DB",
        );
      }
    }

    try {
      await db
        .update(contactMessages)
        .set({ emailStatus })
        .where(eq(contactMessages.id, saved.id));
    } catch (updateErr) {
      logger.warn({ updateErr, contactMessageId: saved.id }, "Failed to record email status");
    }

    res.status(201).json({ message: "Wiadomość została wysłana. Skontaktujemy się wkrótce!" });
  } catch (err) {
    logger.error({ err }, "Contact submit error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { contactMessages } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

router.post("/contact", async (req, res) => {
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

    await db.insert(contactMessages).values({ name, email, subject, message, status: "new" });

    const smtpHost = process.env.SMTP_HOST;
    const contactEmail = process.env.CONTACT_EMAIL;
    if (smtpHost && contactEmail) {
      try {
        const { createTransport } = await import("nodemailer");
        const transporter = createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT ?? 587),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: contactEmail,
          subject: `[Fizyka] Nowa wiadomość: ${subject}`,
          text: `Od: ${name} <${email}>\n\n${message}`,
        });
      } catch (mailErr) {
        logger.warn({ mailErr }, "Email notification failed (non-critical)");
      }
    }

    res.status(201).json({ message: "Wiadomość została wysłana. Skontaktujemy się wkrótce!" });
  } catch (err) {
    logger.error({ err }, "Contact submit error");
    res.status(500).json({ error: "Błąd serwera" });
  }
});

export default router;

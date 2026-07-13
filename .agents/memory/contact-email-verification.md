---
name: Contact email verification without prod SMTP
description: How to verify contact-form email delivery end-to-end when SMTP secrets are not present in the Replit environment
---

SMTP credentials (SMTP_HOST/USER/PASS, CONTACT_EMAIL) are NOT configured in the Replit environment — they live only in the VPS `.env`. `isSmtpConfigured()` requires host + toEmail, so the email branch is silently skipped in dev by default.

**How to verify delivery here:** create an Ethereal test account (`nodemailer.createTestAccount()`), start `dist/index.mjs` with SMTP_* env vars pointed at smtp.ethereal.email:587 and CONTACT_EMAIL set to the Ethereal user, POST the contact form, then confirm the message landed via IMAP (imap.ethereal.email:993, plain Node `tls` socket with LOGIN/SELECT/FETCH works — no extra packages needed).

**Why:** proves the real code path (createTransport + sendMail) over a real SMTP handshake after library upgrades, without needing the user's production credentials.

**Gotchas:** background (`nohup ... &`) servers are killed between bash tool calls — run start + curl + log check in ONE bash invocation. Delete the test row from `contact_messages` afterwards.

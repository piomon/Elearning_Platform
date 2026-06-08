import rateLimit from "express-rate-limit";

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Authentication endpoints (login/register): protect against credential
// stuffing and brute-force attacks.
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 20,
  message: {
    error: "Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Contact form: limit spam submissions.
export const contactLimiter = rateLimit({
  windowMs: ONE_HOUR,
  max: 5,
  message: {
    error: "Zbyt wiele wiadomości. Spróbuj ponownie później.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment creation: limit transaction-register abuse.
export const paymentLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 20,
  message: {
    error: "Zbyt wiele prób płatności. Spróbuj ponownie za kilka minut.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI checks: expensive third-party calls, keep tight.
export const aiLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 10,
  message: {
    error: "Zbyt wiele zapytań do AI. Spróbuj ponownie za kilka minut.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

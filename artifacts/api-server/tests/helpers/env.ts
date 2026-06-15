// A complete set of production-mode environment variables that satisfies every
// fail-fast check in src/config/env.ts. DATABASE_URL is intentionally left out
// so tests keep using the injected test database.
export const PROD_ENV: Record<string, string> = {
  NODE_ENV: "production",
  JWT_SECRET: "test_jwt_secret_min_32_chars_long_000000",
  APP_URL: "https://example.pl",
  API_URL: "https://example.pl/api",
  ALLOWED_ORIGINS: "https://example.pl",
  COURSE_PRICE_GROSZ: "3500",
  GEMINI_API_KEY: "gemini-test-key",
  PAYNOW_API_KEY: "paynow-api-key",
  PAYNOW_SIGNATURE_KEY: "paynow-signature-key",
  PAYNOW_ENV: "sandbox",
  SMTP_HOST: "smtp.example.pl",
  SMTP_USER: "smtp@example.pl",
  SMTP_PASS: "smtp-pass",
  CONTACT_FROM_EMAIL: "kontakt@example.pl",
  BUNNY_LIBRARY_ID: "1234",
  BUNNY_CDN_HOSTNAME: "cdn.example.pl",
};

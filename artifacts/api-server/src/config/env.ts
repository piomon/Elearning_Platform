const NODE_ENV = process.env.NODE_ENV ?? "development";

export const isProd = NODE_ENV === "production";
export const isTest = NODE_ENV === "test";
export const isDev = !isProd && !isTest;

class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

function readRequired(name: string, minLength?: number): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new EnvError(`Brak wymaganej zmiennej środowiskowej: ${name}`);
  }
  if (minLength && value.length < minLength) {
    throw new EnvError(
      `Zmienna środowiskowa ${name} musi mieć co najmniej ${minLength} znaków`,
    );
  }
  return value;
}

function readProd(name: string, fallback: string): string {
  const value = process.env[name];
  if (value && value.trim() !== "") {
    return value;
  }
  if (isProd) {
    throw new EnvError(
      `Brak wymaganej zmiennej środowiskowej (produkcja): ${name}`,
    );
  }
  return fallback;
}

// Optional in all environments. Third-party credentials (Gemini, Paynow,
// SMTP, Bunny) are read when present; when absent the related feature is cleanly
// disabled via the isXConfigured() guards rather than crashing the server. Add
// the secrets in production to activate the feature on the next deploy.
function readOptional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : undefined;
}

const devOrigins = [
  process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : null,
  "http://localhost",
  "http://localhost:5000",
].filter((v): v is string => Boolean(v));

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw && raw.trim() !== "") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (isProd) {
    throw new EnvError(
      "Brak wymaganej zmiennej środowiskowej (produkcja): ALLOWED_ORIGINS",
    );
  }
  return devOrigins;
}

// Comma-separated list of emails that are auto-promoted to admin when their
// owner signs in via Clerk (matched against the verified primary email). This is
// the VPS-friendly admin bootstrap now that there is no seeded admin password.
function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const paynowEnvRaw = (process.env.PAYNOW_ENV ?? "sandbox").toLowerCase();
const paynowEnv: "sandbox" | "production" =
  paynowEnvRaw === "production" ? "production" : "sandbox";

const appUrlFallback = devOrigins[0] ?? "http://localhost";

export const config = {
  nodeEnv: NODE_ENV,
  isProd,
  isTest,
  isDev,
  clerk: {
    secretKey: readRequired("CLERK_SECRET_KEY"),
    publishableKey: readRequired("CLERK_PUBLISHABLE_KEY"),
  },
  // Signs internal HMAC tickets (e.g. timed-quiz start tickets). Not a Clerk
  // credential. Provided by Replit in dev; required on the VPS.
  sessionSecret: readRequired("SESSION_SECRET", 32),
  adminEmails: parseAdminEmails(),
  databaseUrl: readRequired("DATABASE_URL"),
  appUrl: readProd("APP_URL", appUrlFallback),
  apiUrl: readProd("API_URL", appUrlFallback),
  allowedOrigins: parseAllowedOrigins(),
  coursePriceGrosz: (() => {
    const parsed = Number(readProd("COURSE_PRICE_GROSZ", "3500"));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 3500;
  })(),
  // Informational "old" price shown struck-through next to the promo price.
  // Optional everywhere; defaults to 19900 grosz (199 zł) when unset.
  courseOldPriceGrosz: (() => {
    const parsed = Number(process.env.COURSE_OLD_PRICE_GROSZ ?? "19900");
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 19900;
  })(),
  currency: "PLN",
  gemini: {
    apiKey: readOptional("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  },
  paynow: {
    apiKey: readOptional("PAYNOW_API_KEY"),
    signatureKey: readOptional("PAYNOW_SIGNATURE_KEY"),
    env: paynowEnv,
    apiUrl:
      readOptional("PAYNOW_API_URL") ??
      (paynowEnv === "production"
        ? "https://api.paynow.pl"
        : "https://api.sandbox.paynow.pl"),
    returnUrl: readOptional("PAYNOW_RETURN_URL"),
    notificationUrl: readOptional("PAYNOW_NOTIFICATION_URL"),
  },
  smtp: {
    host: readOptional("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT ?? 587),
    user: readOptional("SMTP_USER"),
    pass: readOptional("SMTP_PASS"),
    fromEmail:
      readOptional("CONTACT_FROM_EMAIL") ?? readOptional("SMTP_USER"),
    toEmail: readOptional("CONTACT_EMAIL") ?? readOptional("CONTACT_FROM_EMAIL"),
  },
  bunny: {
    libraryId: readOptional("BUNNY_LIBRARY_ID"),
    cdnHostname: readOptional("BUNNY_CDN_HOSTNAME"),
    apiKey: readOptional("BUNNY_STREAM_API_KEY"),
    readonlyApiKey: readOptional("BUNNY_STREAM_READONLY_API_KEY"),
    collections: {
      dzial1: readOptional("BUNNY_COLLECTION_DZIAL_1"),
      dzial2: readOptional("BUNNY_COLLECTION_DZIAL_2"),
      dzial3: readOptional("BUNNY_COLLECTION_DZIAL_3"),
    },
  },
} as const;

export function isGeminiConfigured(): boolean {
  return Boolean(config.gemini.apiKey);
}

export function isPaynowConfigured(): boolean {
  return Boolean(config.paynow.apiKey && config.paynow.signatureKey);
}

export function isSmtpConfigured(): boolean {
  return Boolean(config.smtp.host && config.smtp.toEmail);
}

export function isBunnyConfigured(): boolean {
  return Boolean(config.bunny.libraryId);
}

export function bunnyReadKey(): string | undefined {
  return config.bunny.readonlyApiKey ?? config.bunny.apiKey;
}

export function isBunnyApiConfigured(): boolean {
  return Boolean(bunnyReadKey());
}

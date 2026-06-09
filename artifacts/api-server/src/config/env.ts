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

// Optional in all environments. Third-party credentials (Gemini, Przelewy24,
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

const p24EnvRaw = (process.env.P24_ENV ?? "sandbox").toLowerCase();
const p24Env: "sandbox" | "production" =
  p24EnvRaw === "production" ? "production" : "sandbox";

const appUrlFallback = devOrigins[0] ?? "http://localhost";

export const config = {
  nodeEnv: NODE_ENV,
  isProd,
  isTest,
  isDev,
  jwtSecret: readRequired("JWT_SECRET", 32),
  databaseUrl: readRequired("DATABASE_URL"),
  appUrl: readProd("APP_URL", appUrlFallback),
  apiUrl: readProd("API_URL", appUrlFallback),
  allowedOrigins: parseAllowedOrigins(),
  coursePriceGrosz: (() => {
    const parsed = Number(readProd("COURSE_PRICE_GROSZ", "19900"));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 19900;
  })(),
  currency: "PLN",
  gemini: {
    apiKey: readOptional("GEMINI_API_KEY"),
    model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  },
  p24: {
    merchantId: readOptional("P24_MERCHANT_ID"),
    posId: readOptional("P24_POS_ID"),
    apiKey: readOptional("P24_API_KEY"),
    crc: readOptional("P24_CRC"),
    env: p24Env,
    baseUrl:
      p24Env === "production"
        ? "https://secure.przelewy24.pl"
        : "https://sandbox.przelewy24.pl",
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
  },
} as const;

export function isGeminiConfigured(): boolean {
  return Boolean(config.gemini.apiKey);
}

export function isP24Configured(): boolean {
  return Boolean(
    config.p24.merchantId &&
      config.p24.posId &&
      config.p24.apiKey &&
      config.p24.crc,
  );
}

export function isSmtpConfigured(): boolean {
  return Boolean(config.smtp.host && config.smtp.toEmail);
}

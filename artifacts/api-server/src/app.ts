import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { config } from "./config/env";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    // Allow non-browser clients (no Origin header): curl, server-to-server,
    // health checks, and same-origin requests proxied without an Origin.
    if (!origin) {
      callback(null, { origin: true, credentials: true });
      return;
    }
    // Strict allowlist in every environment. In development the allowlist is
    // seeded from the Replit dev domain + localhost (see config/env.ts).
    if (config.allowedOrigins.includes(origin)) {
      callback(null, { origin: true, credentials: true });
      return;
    }
    // Same-origin requests: the SPA and this API are served from a single
    // origin in production, so a request whose Origin matches the host we are
    // actually served on is same-origin and must be allowed — regardless of the
    // deployment's domain name (e.g. after a rename or on a custom domain).
    // Behind the Replit proxy the public host/scheme arrive in X-Forwarded-Host
    // / X-Forwarded-Proto. Match on both scheme and host so a plain-http origin
    // can never be treated as same-origin as the https site.
    const servedHost = String(
      req.headers["x-forwarded-host"] ?? req.headers.host ?? "",
    )
      .split(",")[0]
      .trim();
    const servedProto =
      String(req.headers["x-forwarded-proto"] ?? "")
        .split(",")[0]
        .trim() || (config.isProd ? "https" : "http");
    try {
      const reqOrigin = new URL(origin);
      if (
        servedHost &&
        reqOrigin.host === servedHost &&
        reqOrigin.protocol === `${servedProto}:`
      ) {
        callback(null, { origin: true, credentials: true });
        return;
      }
    } catch {
      // Malformed Origin header — fall through to rejection below.
    }
    callback(new Error("Not allowed by CORS"));
  }),
);
// AI task-check uploads carry a base64 image data URL: a ~5 MB decoded image is
// ~6.7 MB encoded, so this route needs a higher body limit than the global one.
// express.json() is a no-op once a body is parsed, so the global parser below
// will skip /api/ai requests this one already handled.
app.use("/api/ai", express.json({ limit: "8mb" }));
app.use(
  express.json({
    limit: "5mb",
    // Capture the raw bytes only for the Paynow webhook so its HMAC signature
    // can be verified against the exact payload (JSON.stringify would re-order
    // keys and break the signature).
    verify(req, _res, buf) {
      const url = (req as { originalUrl?: string }).originalUrl ?? "";
      if (url.split("?")[0] === "/api/payments/webhook") {
        (req as { rawBody?: Buffer }).rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Populates the Clerk auth context (req.auth / getAuth(req)) from the
// Authorization Bearer token or session cookie. It never rejects on its own —
// route-level requireAuth enforces authentication.
app.use(
  clerkMiddleware({
    secretKey: config.clerk.secretKey,
    publishableKey: config.clerk.publishableKey,
  }),
);

app.use("/api", router);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Nie znaleziono" });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  req.log?.error({ err }, "Unhandled error");
  if (res.headersSent) {
    next(err);
    return;
  }
  const e = err as { status?: number; statusCode?: number; type?: string; message?: string };
  if (e?.message === "Not allowed by CORS") {
    res.status(403).json({ error: "Niedozwolone źródło żądania" });
    return;
  }
  if (e?.type === "entity.too.large") {
    res.status(413).json({ error: "Zbyt duży rozmiar żądania" });
    return;
  }
  if (e?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Nieprawidłowy format danych" });
    return;
  }
  const status =
    typeof e?.status === "number"
      ? e.status
      : typeof e?.statusCode === "number"
        ? e.statusCode
        : 500;
  res
    .status(status >= 400 && status < 600 ? status : 500)
    .json({ error: "Błąd serwera" });
});

export default app;

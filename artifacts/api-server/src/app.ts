import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (no Origin header): curl, server-to-server,
      // health checks, and same-origin requests proxied without an Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      // Strict allowlist in every environment. In development the allowlist is
      // seeded from the Replit dev domain + localhost (see config/env.ts).
      if (config.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

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

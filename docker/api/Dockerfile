# ============================================================================
# Backend (API Server) — Express + Drizzle, monorepo pnpm
#
# Strategia: jeden obraz zawiera zbudowaną aplikację oraz pełne node_modules
# (potrzebne m.in. dla natywnego modułu bcrypt i dla drizzle-kit, który
# uruchamia migracje przy starcie kontenera).
# ============================================================================

# --- Etap 1: build ----------------------------------------------------------
FROM node:24-bookworm-slim AS builder

# Narzędzia do kompilacji natywnych modułów (bcrypt) + git dla pnpm.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Włącz pnpm przez corepack (wersja sterowana przez packageManager/pnpm).
RUN corepack enable

WORKDIR /app

# Skopiuj cały monorepo (node_modules są wykluczone w .dockerignore).
COPY . .

# Czysta instalacja zgodna z lockfile + build serwera API.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

# --- Etap 2: runtime --------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080

RUN corepack enable

WORKDIR /app

# Przenosimy cały zbudowany monorepo (z node_modules i natywnym bcrypt
# skompilowanym pod tę samą platformę linux/x64).
COPY --from=builder /app /app

EXPOSE 8080

# Healthcheck odpytuje wewnętrzny endpoint /api/healthz.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker/api/entrypoint.sh"]

# ============================================================================
# Frontend (Platforma Fizyki) — React + Vite, serwowany przez Nginx.
#
# Nginx serwuje statyczny build SPA ORAZ proxuje /api/ do kontenera `api`,
# dzięki czemu front i API są pod tym samym originem (tokeny Clerk działają bez
# problemów CORS).
# ============================================================================

# --- Etap 1: build ----------------------------------------------------------
FROM node:24-bookworm-slim AS builder

RUN corepack enable
WORKDIR /app

# Vite wymaga PORT i BASE_PATH w czasie buildu (patrz vite.config.ts).
# Aplikacja działa w katalogu głównym domeny, więc BASE_PATH="/".
ENV PORT=8080
ENV BASE_PATH=/
ENV NODE_ENV=production

# Klucz PUBLICZNY Clerk jest wstrzykiwany w czasie buildu: vite.config.ts czyta
# process.env.CLERK_PUBLISHABLE_KEY i wkompilowuje go w bundle jako
# VITE_CLERK_PUBLISHABLE_KEY. To klucz publiczny — NIGDY nie przekazuj tu
# CLERK_SECRET_KEY. Wartość pochodzi z build-arg (patrz docker-compose.yml).
ARG CLERK_PUBLISHABLE_KEY
ENV CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/physics-platform run build

# --- Etap 2: runtime (Nginx) ------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Statyczne pliki SPA.
COPY --from=builder /app/artifacts/physics-platform/dist/public /usr/share/nginx/html

# Konfiguracja: SPA fallback + proxy /api -> api:8080.
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]

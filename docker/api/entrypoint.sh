#!/bin/sh
# ============================================================================
# Punkt startowy kontenera API.
# 1. Uruchamia migracje bazy danych (drizzle-kit migrate).
# 2. Startuje zbudowany serwer Express.
# ============================================================================
set -e

echo "[entrypoint] Uruchamiam migracje bazy danych..."
pnpm --filter @workspace/db run migrate

echo "[entrypoint] Migracje zakończone. Startuję serwer API na porcie ${PORT:-8080}..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs

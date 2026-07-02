#!/usr/bin/env bash
# ============================================================================
# Aktualizacja aplikacji na VPS po nowym pushu na GitHub.
#
# Pobiera najnowszy kod, przebudowuje obrazy, uruchamia migracje (automatycznie
# przy starcie kontenera API) i restartuje usługi bez przestoju bazy danych.
#
# Użycie:   ./deploy/update.sh
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "==> Pobieram najnowsze zmiany z gita..."
git pull --ff-only

echo "==> Przebudowuję obrazy..."
$COMPOSE build

echo "==> Uruchamiam zaktualizowane kontenery (migracje wykonają się automatycznie)..."
$COMPOSE up -d --wait --wait-timeout 240

echo "==> Importuję brakujące treści kursu (idempotentnie, bez kasowania danych)..."
# Seed jest teraz NIENISZCZĄCY i idempotentny: dodaje tylko brakujące działy/
# lekcje/materiały, więc bezpiecznie uruchamia się przy każdej aktualizacji i
# gwarantuje, że kurs nigdy nie jest pusty (nawet po świeżym postawieniu bazy).
$COMPOSE exec -T api pnpm --filter @workspace/scripts run seed

echo "==> Czyszczę nieużywane obrazy..."
docker image prune -f

echo "==> Status:"
$COMPOSE ps

echo "==> Gotowe. Logi:  $COMPOSE logs -f"

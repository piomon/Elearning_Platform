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

echo "==> Tworzę kopię zapasową bazy PRZED importem treści..."
# Najpierw kopia zapasowa (pg_dump). Gdyby import coś zepsuł, można wrócić przez
# ./deploy/restore.sh. Nie przerywamy wdrożenia, jeśli kopia się nie powiedzie.
./deploy/backup.sh || echo "UWAGA: nie udało się utworzyć kopii zapasowej — kontynuuję ostrożnie."

if [ -f exports/full-elearning-export.json ]; then
  echo "==> Importuję treść e-learningu z exports/ (tryb merge — idempotentnie, bez kasowania danych)..."
  # merge = dodaje brakujące i AKTUALIZUJE istniejące wiersze, aby baza
  # odpowiadała eksportowi z Replit. NIGDY nie usuwa danych klientów.
  $COMPOSE exec -T api pnpm --filter @workspace/scripts run import:content --mode=merge
else
  echo "UWAGA: brak exports/full-elearning-export.json — używam awaryjnie wbudowanego seeda."
  echo "       Uruchom na Replit: pnpm export:content i zacommituj katalog exports/."
  $COMPOSE exec -T api pnpm --filter @workspace/scripts run seed
fi

echo "==> Weryfikuję wdrożenie..."
if ! $COMPOSE exec -T api pnpm --filter @workspace/scripts run verify:deployment; then
  echo "UWAGA: weryfikacja zgłosiła problemy — sprawdź powyższe komunikaty (❌)." >&2
fi

echo "==> Czyszczę nieużywane obrazy..."
docker image prune -f

echo "==> Status:"
$COMPOSE ps

echo "==> Gotowe. Logi:  $COMPOSE logs -f"

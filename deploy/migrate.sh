#!/usr/bin/env bash
# ============================================================================
# Ręczne uruchomienie migracji bazy danych w kontenerze API.
#
# Migracje wykonują się automatycznie przy starcie kontenera API
# (docker/api/entrypoint.sh). Ten skrypt przydaje się do ręcznego ponowienia
# migracji bez restartu całej usługi.
#
# Użycie:   ./deploy/migrate.sh
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml"
[ -f docker-compose.prod.yml ] && COMPOSE="$COMPOSE -f docker-compose.prod.yml"

echo "==> Uruchamiam migracje bazy danych w kontenerze API..."
$COMPOSE exec -T api pnpm --filter @workspace/db run migrate

echo "==> Migracje zakończone."

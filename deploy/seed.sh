#!/usr/bin/env bash
# ============================================================================
# Bezpieczny, IDEMPOTENTNY import treści kursu do bazy w kontenerze API.
#
# Uzupełnia BRAKUJĄCE dane kursu (działy, lekcje, filmy, grafiki, quizy,
# zadania). NIE usuwa użytkowników, płatności, dostępów ani postępów uczniów —
# istniejące wiersze pozostają nietknięte. Można uruchamiać wielokrotnie.
#
# Użycie:   ./deploy/seed.sh
#
# (Twardy reset treści — TYLKO dev, gdy w bazie nie ma płatności:
#    docker compose exec -e SEED_RESET=1 api pnpm --filter @workspace/scripts run seed)
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml"
[ -f docker-compose.prod.yml ] && COMPOSE="$COMPOSE -f docker-compose.prod.yml"

echo "==> Importuję treści kursu (idempotentnie, bez kasowania danych) w kontenerze API..."
$COMPOSE exec -T api pnpm --filter @workspace/scripts run seed

echo "==> Import zakończony."

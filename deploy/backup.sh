#!/usr/bin/env bash
# ============================================================================
# Kopia zapasowa bazy danych PostgreSQL z kontenera `db`.
#
# Zrzut tworzony jest z opcjami --clean --if-exists, dzięki czemu odtworzenie
# przez ./deploy/restore.sh czysto nadpisuje istniejące dane.
#
# Użycie:   ./deploy/backup.sh
# Wynik:    ./backups/<POSTGRES_DB>_YYYY-MM-DD_HHMMSS.sql.gz
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

# Wczytaj zmienne z .env (POSTGRES_USER / POSTGRES_DB).
set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a

COMPOSE="docker compose -f docker-compose.yml"
[ -f docker-compose.prod.yml ] && COMPOSE="$COMPOSE -f docker-compose.prod.yml"

mkdir -p backups
STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT="backups/${POSTGRES_DB:-fizyka}_${STAMP}.sql.gz"

echo "==> Tworzę kopię bazy -> ${OUT}"
$COMPOSE exec -T db pg_dump --clean --if-exists -U "${POSTGRES_USER:-fizyka}" "${POSTGRES_DB:-fizyka}" | gzip > "$OUT"

echo "==> Gotowe: ${OUT}"

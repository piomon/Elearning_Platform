#!/usr/bin/env bash
# ============================================================================
# Kopia zapasowa bazy danych PostgreSQL z kontenera `db`.
#
# Użycie:   ./deploy/backup-db.sh
# Wynik:    ./backups/fizyka_YYYY-MM-DD_HHMMSS.sql.gz
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

# Wczytaj zmienne z .env (POSTGRES_USER / POSTGRES_DB).
set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a

mkdir -p backups
STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT="backups/${POSTGRES_DB:-fizyka}_${STAMP}.sql.gz"

echo "==> Tworzę kopię bazy -> ${OUT}"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-fizyka}" "${POSTGRES_DB:-fizyka}" | gzip > "$OUT"

echo "==> Gotowe: ${OUT}"

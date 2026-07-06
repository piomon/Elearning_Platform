#!/usr/bin/env bash
# ============================================================================
# Odtworzenie bazy danych PostgreSQL z kopii zapasowej (./deploy/backup-db.sh).
#
# UWAGA: operacja NADPISUJE bieżące dane w bazie. Używaj kopii utworzonych
# skryptem ./deploy/backup-db.sh (zrzut zawiera instrukcje DROP ... IF EXISTS).
#
# Użycie:   ./deploy/restore-db.sh <ścieżka/do/kopii.sql.gz> [--yes]
#           (--yes pomija pytanie o potwierdzenie)
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP="${1:-}"
CONFIRM="${2:-}"

if [ -z "$BACKUP" ]; then
  echo "Użycie: ./deploy/restore-db.sh <ścieżka/do/kopii.sql.gz> [--yes]" >&2
  exit 1
fi
if [ ! -f "$BACKUP" ]; then
  echo "BŁĄD: plik kopii nie istnieje: $BACKUP" >&2
  exit 1
fi

# Wczytaj zmienne z .env (POSTGRES_USER / POSTGRES_DB).
set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a

COMPOSE="docker compose -f docker-compose.yml"
[ -f docker-compose.prod.yml ] && COMPOSE="$COMPOSE -f docker-compose.prod.yml"

PGUSER="${POSTGRES_USER:-fizyka}"
PGDB="${POSTGRES_DB:-fizyka}"

echo "!!! UWAGA: odtworzenie NADPISZE wszystkie bieżące dane w bazie '${PGDB}'."
if [ "$CONFIRM" != "--yes" ]; then
  printf "Wpisz 'tak', aby kontynuować: "
  read -r answer
  [ "$answer" = "tak" ] || { echo "Przerwano."; exit 1; }
fi

echo "==> Odtwarzam bazę '${PGDB}' z pliku ${BACKUP}..."
gunzip -c "$BACKUP" | $COMPOSE exec -T db psql --single-transaction -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDB"

echo "==> Gotowe. Baza odtworzona."

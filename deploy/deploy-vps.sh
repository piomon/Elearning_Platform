#!/usr/bin/env bash
# ============================================================================
# Wdrożenie / aktualizacja aplikacji na VPS (jeden skrypt do wszystkiego).
#
# Kolejność:
#   1. sprawdzenie plików i kluczowych zmiennych z .env,
#   2. pobranie najnowszego kodu z gita (git pull --ff-only) — jeśli to repo,
#   3. KOPIA ZAPASOWA bazy PRZED uruchomieniem nowego kodu (jeśli baza działa),
#   4. przebudowa obrazów,
#   5. start kontenerów (--wait) — a przy starcie kontenera API automatycznie
#      wykonują się: migracje schematu -> import treści (merge) -> migracje
#      treści -> walidacja treści (patrz docker/api/entrypoint.sh),
#   6. sprzątanie obrazów i status.
#
# Dzięki krokowi 5 treść e-learningu jest ODTWARZANA przy każdym wdrożeniu —
# lekcje nie znikają. Zmienne RUN_*/VERIFY_CONTENT_STRICT w .env sterują tym cyklem.
#
# Użycie:   ./deploy/deploy-vps.sh
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml"
[ -f docker-compose.prod.yml ] && COMPOSE="$COMPOSE -f docker-compose.prod.yml"

# --- 1) Wymagane pliki + zmienne -------------------------------------------
echo "==> Sprawdzam wymagane pliki..."
for f in docker-compose.yml docker-compose.prod.yml .env; do
  if [ ! -f "$f" ]; then
    echo "BŁĄD: brak pliku '$f'." >&2
    [ "$f" = ".env" ] && echo "       Skopiuj szablon:  cp .env.example .env   i uzupełnij wartości." >&2
    exit 1
  fi
done

echo "==> Wczytuję i sprawdzam kluczowe zmienne z .env..."
set -a
# shellcheck disable=SC1091
. ./.env
set +a

missing=0
require_var() {
  local name="$1"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    echo "BŁĄD: brak wymaganej zmiennej $name w .env" >&2
    missing=1
  fi
}
require_var POSTGRES_PASSWORD
require_var CLERK_SECRET_KEY
require_var CLERK_PUBLISHABLE_KEY
require_var SESSION_SECRET
require_var DOMAIN
require_var ACME_EMAIL
require_var APP_URL
require_var API_URL
require_var ALLOWED_ORIGINS

if [ -n "${SESSION_SECRET:-}" ] && [ "${#SESSION_SECRET}" -lt 32 ]; then
  echo "BŁĄD: SESSION_SECRET musi mieć co najmniej 32 znaki (openssl rand -hex 32)." >&2
  missing=1
fi
if [ "${POSTGRES_PASSWORD:-}" = "zmien_to_na_silne_haslo" ]; then
  echo "BŁĄD: zmień domyślne POSTGRES_PASSWORD w .env na własne, silne hasło." >&2
  missing=1
fi
[ "$missing" -eq 0 ] || { echo "Uzupełnij .env i uruchom ponownie." >&2; exit 1; }

# Bunny Stream jest opcjonalne przy starcie, ale bez BUNNY_LIBRARY_ID serwer nie
# zbuduje adresu odtwarzacza i filmy pokażą się jako „chwilowo niedostępne".
# To najczęstsza przyczyna, gdy filmy działają lokalnie, a na VPS nie.
if [ -z "${BUNNY_LIBRARY_ID:-}" ]; then
  echo "UWAGA: brak BUNNY_LIBRARY_ID w .env — filmy z Bunny nie będą się odtwarzać." >&2
  echo "       Uzupełnij BUNNY_LIBRARY_ID (i BUNNY_CDN_HOSTNAME) w .env, aby włączyć wideo." >&2
fi

# --- 2) Najnowszy kod ------------------------------------------------------
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  echo "==> Pobieram najnowsze zmiany z gita..."
  git pull --ff-only || echo "UWAGA: git pull nie powiódł się — kontynuuję z bieżącym kodem."
else
  echo "==> Pomijam git pull (to nie jest repozytorium git)."
fi

# --- 3) Kopia zapasowa PRZED importem --------------------------------------
# Nowe kontenery przy starcie zaimportują treść (merge). Robimy kopię wcześniej,
# aby w razie problemu wrócić przez ./deploy/restore-db.sh. Na pierwszym
# uruchomieniu (brak działającej bazy) kopia po prostu się nie powiedzie — OK.
if $COMPOSE ps --status running db 2>/dev/null | grep -q db; then
  echo "==> Tworzę kopię zapasową bazy PRZED wdrożeniem..."
  ./deploy/backup-db.sh || echo "UWAGA: nie udało się utworzyć kopii zapasowej — kontynuuję ostrożnie."
else
  echo "==> Pomijam kopię zapasową (baza jeszcze nie działa — pierwsze uruchomienie)."
fi

# --- 4) Build --------------------------------------------------------------
echo "==> Buduję obrazy (to może chwilę potrwać)..."
$COMPOSE build

# --- 5) Start (entrypoint API robi: migrate -> import -> content:migrate -> verify) ---
echo "==> Uruchamiam kontenery i czekam na healthcheck (db, api, web)..."
if ! $COMPOSE up -d --wait --wait-timeout 300; then
  echo "BŁĄD: usługi nie przeszły healthchecku w wyznaczonym czasie." >&2
  echo "      Najczęstsza przyczyna: brak/niepoprawne zmienne w .env albo błąd importu treści." >&2
  $COMPOSE ps
  echo "      Sprawdź logi:  $COMPOSE logs --tail=80 api" >&2
  exit 1
fi

# --- 6) Sprzątanie + status ------------------------------------------------
echo "==> Czyszczę nieużywane obrazy..."
docker image prune -f

echo "==> Status usług:"
$COMPOSE ps

cat <<EOF

==> Gotowe. Przy starcie kontenera API automatycznie wykonały się:
      migracje schematu -> import treści (merge) -> migracje treści -> walidacja.

Kolejne kroki:
  1. Wejdź na swoją domenę:  https://${DOMAIN}
  2. Zaloguj się adresem z ADMIN_EMAILS, aby otrzymać rolę administratora.

Podgląd logów:            $COMPOSE logs -f
Ręczna kopia zapasowa:    ./deploy/backup-db.sh
Odtworzenie z kopii:      ./deploy/restore-db.sh backups/<plik>.sql.gz
EOF

#!/usr/bin/env bash
# ============================================================================
# Pierwsze (pełne) uruchomienie aplikacji na VPS.
#
# Sprawdza wymagane pliki i kluczowe zmienne, buduje obrazy, uruchamia
# kontenery i czeka, aż baza danych będzie gotowa. Migracje wykonują się
# automatycznie przy starcie kontenera API (docker/api/entrypoint.sh).
# Na końcu wypisuje status i dalsze kroki (np. seed danych).
#
# Użycie:   ./deploy/deploy.sh
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml"
[ -f docker-compose.prod.yml ] && COMPOSE="$COMPOSE -f docker-compose.prod.yml"

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

echo "==> Buduję obrazy (to może chwilę potrwać)..."
$COMPOSE build

echo "==> Uruchamiam kontenery i czekam, aż przejdą healthcheck (db, api, web)..."
if ! $COMPOSE up -d --wait --wait-timeout 240; then
  echo "BŁĄD: usługi nie przeszły healthchecku w wyznaczonym czasie." >&2
  echo "      Najczęstsza przyczyna: brak/niepoprawne zmienne w .env (API nie startuje)." >&2
  $COMPOSE ps
  echo "      Sprawdź logi:  $COMPOSE logs --tail=50 api" >&2
  exit 1
fi

echo "==> Status usług:"
$COMPOSE ps

cat <<EOF

==> Gotowe. Migracje bazy wykonały się automatycznie przy starcie kontenera API.

Dalsze kroki:
  1. Zaimportuj treść e-learningu z repozytorium (exports/ z GitHuba):
       $COMPOSE exec api pnpm --filter @workspace/scripts run import:content --mode=merge
     (Gdyby brakowało katalogu exports/, uruchom na Replit: pnpm export:content
      i zacommituj wynik. Awaryjnie działa też wbudowany seed: ... run seed.)
  2. Zweryfikuj wdrożenie:
       $COMPOSE exec api pnpm --filter @workspace/scripts run verify:deployment
  3. Wejdź na swoją domenę:  https://${DOMAIN}
  4. Zaloguj się adresem wpisanym w ADMIN_EMAILS, aby otrzymać rolę administratora.

Podgląd logów:   $COMPOSE logs -f
EOF

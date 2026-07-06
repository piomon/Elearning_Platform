#!/bin/sh
# ============================================================================
# Punkt startowy kontenera API — pełny cykl życia danych treści.
#
# Kolejność (każdy krok można wyłączyć zmienną RUN_*=0):
#   1. RUN_DB_MIGRATE       migracje SCHEMATU bazy (drizzle-kit migrate)   [KRYTYCZNE]
#   2. RUN_IMPORT_ELEARNING import treści z repo (scripts/data/export, merge)
#   3. RUN_CONTENT_MIGRATE  jednorazowe migracje TREŚCI (content:migrate)
#   4. RUN_VERIFY_CONTENT   walidacja kompletności/spójności treści
#   5. start serwera Express
#
# Dzięki temu treść e-learningu jest ODTWARZANA przy każdym starcie kontenera —
# lekcje nie znikają po wdrożeniu ani po odtworzeniu świeżego wolumenu bazy.
#
# Krok 1 jest KRYTYCZNY: jego błąd przerywa start (schemat musi zgadzać się z kodem).
# Kroki 2–4 domyślnie NIE przerywają startu (logują błąd), aby awaria nie
# powodowała przestoju — import(merge) jest transakcyjny, więc przy błędzie baza
# zostaje w poprzednim, spójnym stanie. Ustaw VERIFY_CONTENT_STRICT=1, aby twardy
# błąd walidacji (❌) przerywał start kontenera.
# ============================================================================
set -e

run_enabled() {
  # $1 = nazwa zmiennej RUN_*; domyślnie włączone (1), chyba że ustawiono "0".
  eval "val=\${$1:-1}"
  [ "$val" = "1" ]
}

# 1) Migracje SCHEMATU — KRYTYCZNE (błąd przerywa start).
if run_enabled RUN_DB_MIGRATE; then
  echo "[entrypoint] (1/4) Migracje SCHEMATU bazy (drizzle-kit migrate)..."
  pnpm --filter @workspace/db run migrate
else
  echo "[entrypoint] (1/4) Pomijam migracje schematu (RUN_DB_MIGRATE=0)."
fi

# 2) Import treści z repo — idempotentny merge (NIGDY nie usuwa danych).
if run_enabled RUN_IMPORT_ELEARNING; then
  echo "[entrypoint] (2/4) Import treści e-learningu (merge)..."
  if ! pnpm --filter @workspace/scripts run import:elearning --mode=merge; then
    echo "[entrypoint] UWAGA: import treści nie powiódł się — baza pozostaje w poprzednim stanie. Kontynuuję start." >&2
  fi
else
  echo "[entrypoint] (2/4) Pomijam import treści (RUN_IMPORT_ELEARNING=0)."
fi

# 3) Migracje TREŚCI — jednorazowe transformacje danych (dziennik: content_migrations).
if run_enabled RUN_CONTENT_MIGRATE; then
  echo "[entrypoint] (3/4) Migracje TREŚCI (content:migrate)..."
  if ! pnpm --filter @workspace/scripts run content:migrate; then
    echo "[entrypoint] UWAGA: migracje treści nie powiodły się — sprawdź logi. Kontynuuję start." >&2
  fi
else
  echo "[entrypoint] (3/4) Pomijam migracje treści (RUN_CONTENT_MIGRATE=0)."
fi

# 4) Walidacja treści — bramka jakości (domyślnie NIE blokuje startu).
if run_enabled RUN_VERIFY_CONTENT; then
  echo "[entrypoint] (4/4) Walidacja treści (verify:content)..."
  if ! pnpm --filter @workspace/scripts run verify:content; then
    if [ "${VERIFY_CONTENT_STRICT:-0}" = "1" ]; then
      echo "[entrypoint] BŁĄD: walidacja treści zgłosiła twarde błędy (VERIFY_CONTENT_STRICT=1) — przerywam start." >&2
      exit 1
    fi
    echo "[entrypoint] UWAGA: walidacja treści zgłosiła problemy (❌) — sprawdź logi. Kontynuuję start." >&2
  fi
else
  echo "[entrypoint] (4/4) Pomijam walidację treści (RUN_VERIFY_CONTENT=0)."
fi

echo "[entrypoint] Startuję serwer API na porcie ${PORT:-8080}..."
exec node --enable-source-maps artifacts/api-server/dist/index.mjs

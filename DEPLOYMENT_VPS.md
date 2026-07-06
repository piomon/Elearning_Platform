# Wdrożenie i odtwarzanie treści na VPS — FizykaAI

Ten dokument opisuje **powtarzalny, profesjonalny proces** przenoszenia treści
e-learningu z Replit na serwer produkcyjny (VPS) tak, aby po każdym `git pull`
cała platforma (kursy, działy, lekcje, wideo z identyfikatorami Bunny.net, quizy,
pytania, odpowiedzi, zadania oraz ustawienia strony) odtwarzała się automatycznie.

Kluczowa zasada bezpieczeństwa: **eksport i import dotyczą wyłącznie treści.
Nigdy nie ruszają danych klientów** — kont użytkowników, płatności, dostępów,
postępów nauki, postępów wideo ani podejść do quizów.

---

## 1. Architektura procesu

```
   REPLIT (źródło treści)                     GITHUB                 VPS (produkcja)
 ┌────────────────────────┐          ┌──────────────────┐   ┌──────────────────────────┐
 │ pnpm export:content     │          │                  │   │ git pull                  │
 │  → exports/*.json       │  commit  │  exports/*.json  │──▶│ backup (pg_dump)          │
 │  → full-elearning-...    │─────────▶│  w repozytorium  │   │ import (merge)            │
 │  → manifest.json         │   push   │                  │   │ verify:deployment         │
 └────────────────────────┘          └──────────────────┘   └──────────────────────────┘
```

1. **Na Replit** eksportujesz treść do katalogu `exports/` i commitujesz go do repo.
2. **GitHub** przechowuje `exports/` razem z kodem (katalog nie jest ignorowany).
3. **Na VPS** skrypt `deploy/update.sh` po `git pull` robi kopię zapasową bazy,
   importuje treść w trybie `merge` i weryfikuje wynik.

Katalog `exports/` zawiera **wyłącznie treść** i można go bezpiecznie commitować.
Katalog `backups/` (zrzuty `pg_dump`) jest ignorowany przez git i `.dockerignore`.

---

## 2. Co jest eksportowane, a co pomijane

**Eksportowane (treść, tabele „content”):**
`courses`, `sections`, `topics`, `videos` (z `bunnyVideoId` / `bunnyCollectionId`),
`lesson_images`, `quizzes`, `quiz_questions`, `quiz_answers`, `tasks`,
`landing_sections`, `faq_items`, `seo_settings`, `ai_settings`,
`pricing_settings`, `platform_settings`.

**Nigdy nie eksportowane (dane klientów / PII / sekrety):**
`users`, `payments`, `payment_refunds`, `access_grants`, `discount_codes`,
`discount_code_uses`, `learning_progress`, `video_progress`, `quiz_attempts`,
`quiz_attempt_answers`, `ai_checks`, `contact_submissions`.

Lista pól i tabel jest zdefiniowana w jednym miejscu:
`scripts/src/content-io/tables.ts` (allowlista `EXPORT_TABLES` + funkcje kluczy
naturalnych). Manifest (`exports/manifest.json`) zapisuje datę eksportu, liczby
wierszy, listę pominiętych tabel oraz pokrycie wideo Bunny.net.

---

## 3. Krok 1 — Eksport na Replit

```bash
pnpm export:content
```

Wynik:
- `exports/<tabela>.json` — po jednym pliku na tabelę,
- `exports/full-elearning-export.json` — komplet w jednym pliku (używany przy imporcie),
- `exports/manifest.json` — metadane (data, liczby wierszy, pokrycie Bunny.net).

Następnie zacommituj i wypchnij:

```bash
git add exports/
git commit -m "Aktualizacja treści e-learningu (eksport)"
git push
```

> Eksport pomija tabele z danymi klientów, więc w `exports/` nie ma e-maili,
> haseł, tokenów ani sekretów. Można je bezpiecznie trzymać w repozytorium.

---

## 4. Krok 2 — Wdrożenie na VPS (automatyczne)

Na serwerze wystarczy jedno polecenie:

```bash
./deploy/update.sh
```

Skrypt wykonuje po kolei:

1. `git pull --ff-only` — pobiera kod **i** najnowszy `exports/`.
2. `docker compose build` — przebudowuje obrazy.
3. `docker compose up -d --wait` — migracje bazy wykonują się automatycznie przy
   starcie kontenera API.
4. **Kopia zapasowa PRZED importem** (`deploy/backup.sh` → `pg_dump` do `backups/`).
   Gdyby import coś zepsuł, wracasz przez `./deploy/restore.sh`.
5. **Import treści** w trybie `merge` (idempotentnie, bez kasowania danych).
   Jeśli katalog `exports/` nie istnieje, awaryjnie uruchamiany jest wbudowany
   `seed` (z ostrzeżeniem).
6. **Weryfikacja** (`verify:deployment`) — liczby treści, pokrycie Bunny.net i
   wymagane zmienne środowiskowe.

To samo można wywołać z Replit-owego aliasu na maszynie z dostępem do VPS:
`pnpm deploy:vps`.

---

## 5. Tryby importu

Import: `pnpm import:content <flagi>` (lub w kontenerze:
`docker compose ... exec -T api pnpm --filter @workspace/scripts run import:content <flagi>`).

### `--mode=merge` (domyślny, bezpieczny — używany przy wdrożeniu)

- Dopasowuje wiersze po **kluczach naturalnych** (np. `courses.slug`,
  `topic` po `sectionId + sortOrder`, `quiz_answers` po `questionId + sortOrder`),
  a nie po ID. Dzięki temu ID w bazie VPS mogą być inne niż na Replit.
- **Dodaje** brakujące wiersze i **aktualizuje** istniejące, aby baza odpowiadała
  eksportowi.
- **Nigdy nie usuwa** żadnych wierszy — dane klientów są całkowicie nietknięte.
- Jest **idempotentny**: kolejne uruchomienia z tym samym eksportem nie zmieniają
  liczby wierszy.

### `--mode=replace-demo-content` (twardy reset treści demo — z zabezpieczeniami)

- Kasuje treść eksportowanych kursów (po `slug`, kaskada FK czyści działy/lekcje/
  materiały/quizy/zadania) oraz zarządzane ustawienia strony, po czym wstawia je
  na nowo z eksportu.
- **Wymaga flagi `--yes`.**
- **Przerywa działanie**, jeśli w bazie są jakiekolwiek dane klientów: płatności,
  dostępy z `source='payment'`, postępy nauki, postępy wideo lub podejścia do
  quizów. Chroni to przed skasowaniem prawdziwych danych przez kaskady FK.
- Przeznaczony wyłącznie do czystego środowiska demo, zanim pojawią się pierwsi
  płacący użytkownicy.

### `--dry-run` (podgląd bez zapisu)

Dodaj do dowolnego trybu, aby zobaczyć, co by się zmieniło (ile wierszy dodanych /
zaktualizowanych), **bez zapisywania czegokolwiek** (cała operacja jest wycofywana
w transakcji):

```bash
pnpm import:content --dry-run                          # podgląd merge
pnpm import:content --mode=replace-demo-content --dry-run
```

---

## 6. Weryfikacja wdrożenia

```bash
pnpm verify:deployment
```

Sprawdza: połączenie z bazą, liczby kursów/działów/lekcji/wideo, czy **wszystkie
wideo mają powiązanie z Bunny.net**, oraz obecność wymaganych i zalecanych
zmiennych środowiskowych. Kod wyjścia `1` oznacza problem krytyczny (❌).

---

## 7. Kopie zapasowe i przywracanie

- **Kopia zapasowa (ręczna):** `pnpm backup:db` lub `./deploy/backup.sh`
  → `backups/<baza>_RRRR-MM-DD_GGMMSS.sql.gz` (`pg_dump --clean --if-exists`).
  Wykonywana jest też automatycznie przez `update.sh` **przed** każdym importem.
- **Przywracanie:** `./deploy/restore.sh backups/<plik>.sql.gz`
  (poprosi o potwierdzenie; `--yes` je pomija). **UWAGA: nadpisuje bieżącą bazę.**

Katalog `backups/` jest ignorowany przez git i pomijany w obrazach Dockera.

---

## 8. Konfiguracja Bunny.net (wideo)

Identyfikatory wideo (`bunnyVideoId`, `bunnyCollectionId`) są częścią eksportu,
więc odtwarzają się automatycznie. Aby wideo się odtwarzało, na VPS muszą być
ustawione zmienne (patrz `.env.example`):

- `BUNNY_LIBRARY_ID`
- `BUNNY_CDN_HOSTNAME`
- `BUNNY_STREAM_API_KEY` (do zarządzania / uploadu przez panel)
- `BUNNY_TOKEN_AUTH_KEY` (jeśli włączone uwierzytelnianie tokenem odtwarzania)

> Eksport zawiera identyfikatory GUID wideo (nie sekrety). Zaleca się włączenie
> Token Authentication w bibliotece Bunny, aby sam GUID nie umożliwiał
> nieautoryzowanego odtwarzania płatnych treści.

---

## 9. Ograniczenia trybu `merge` (świadome i udokumentowane)

Ponieważ `merge` nigdy nie usuwa wierszy:

- **Zmiana `slug` kursu** lub innych kluczy naturalnych tworzy **nowy** wiersz
  obok starego (stary zostaje). Po zmianie kluczy użyj `replace-demo-content`
  (na czystym demo) albo posprzątaj ręcznie.
- **Edycja tekstu pytania FAQ** (klucz = treść pytania) albo **zmiana kolejności**
  pytań quizu / odpowiedzi (klucz = `sortOrder`) może zostawić nieaktualne wiersze.
- Każdy `merge` przepisuje wszystkie wiersze treści, więc kolumna `updatedAt`
  odświeża się przy każdym wdrożeniu (nie odzwierciedla realnego czasu edycji).

Przy obecnej skali treści są to efekty nieszkodliwe. Dla „czystego” resetu treści
demo (bez klientów) użyj `--mode=replace-demo-content --yes`.

---

## 10. Szybka ściąga poleceń

| Cel | Polecenie |
| --- | --- |
| Eksport treści (Replit) | `pnpm export:content` |
| Wdrożenie na VPS (całość) | `./deploy/update.sh` (lub `pnpm deploy:vps`) |
| Import — bezpieczny merge | `pnpm import:content --mode=merge` |
| Import — podgląd bez zapisu | `pnpm import:content --dry-run` |
| Import — reset demo | `pnpm import:content --mode=replace-demo-content --yes` |
| Weryfikacja | `pnpm verify:deployment` |
| Kopia zapasowa | `pnpm backup:db` |
| Przywrócenie | `./deploy/restore.sh backups/<plik>.sql.gz` |

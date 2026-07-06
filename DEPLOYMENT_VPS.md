# Wdrożenie i cykl życia treści na VPS — FizykaAI

Ten dokument opisuje **powtarzalny, profesjonalny proces** przenoszenia treści
e-learningu z Replit na serwer produkcyjny (VPS) tak, aby po każdym wdrożeniu
cała platforma (kursy, działy, lekcje, wideo z identyfikatorami Bunny.net, quizy,
pytania, odpowiedzi, zadania oraz ustawienia strony) **odtwarzała się
automatycznie** — lekcje nie znikają po `git pull` ani po odtworzeniu świeżego
wolumenu bazy.

Kluczowa zasada bezpieczeństwa: **eksport i import dotyczą wyłącznie treści.
Nigdy nie ruszają danych klientów** — kont użytkowników, płatności, dostępów,
postępów nauki, postępów wideo ani podejść do quizów.

---

## 1. Architektura procesu

```
   REPLIT (źródło treści)                 GITHUB                 VPS (produkcja)
 ┌──────────────────────────┐      ┌──────────────────┐  ┌──────────────────────────┐
 │ pnpm export:elearning     │      │                  │  │ ./deploy/deploy-vps.sh    │
 │  → scripts/data/export/   │commit│ scripts/data/    │  │  • git pull --ff-only     │
 │    *.json                 │─────▶│   export/*.json  │─▶│  • backup PRZED importem  │
 │    full-elearning-...json  │ push │  w repozytorium  │  │  • docker compose build   │
 │    manifest.json           │      │                  │  │  • up -d (entrypoint API) │
 └──────────────────────────┘      └──────────────────┘  └──────────────────────────┘
```

1. **Na Replit** eksportujesz treść do `scripts/data/export/` i commitujesz ją do repo.
2. **GitHub** przechowuje `scripts/data/export/` razem z kodem (katalog NIE jest ignorowany).
3. **Na VPS** `./deploy/deploy-vps.sh` po `git pull` robi kopię zapasową bazy,
   przebudowuje i uruchamia kontenery, a **przy starcie kontenera API**
   automatycznie wykonuje pełny cykl: migracje schematu → import treści (merge)
   → migracje treści → walidacja (patrz `docker/api/entrypoint.sh`).

Katalog `scripts/data/export/` zawiera **wyłącznie treść** i można go bezpiecznie
commitować. Katalog `backups/` (zrzuty `pg_dump`) jest ignorowany przez git.

---

## 2. Co jest eksportowane, a co pomijane

Lista tabel i kluczy naturalnych jest zdefiniowana w **jednym miejscu**:
`scripts/src/content-io/tables.ts` (allowlista `EXPORT_TABLES` + funkcje kluczy
naturalnych). Eksport działa na **liście dozwolonych tabel**, więc dane wrażliwe
nigdy nie trafią do eksportu — nawet przez pomyłkę.

**Eksportowane (treść):**
`courses`, `sections`, `topics`, `videos` (z `bunnyVideoId` / `bunnyTitle`),
`lesson_images`, `quizzes`, `quiz_questions`, `quiz_answers`, `tasks`,
`landing_sections`, `faq_items`, `seo_settings`, `ai_settings`,
`pricing_settings`, `platform_settings`.

**Nigdy nie eksportowane (dane klientów / PII):**
`users`, `payments`, `payment_refunds`, `access_grants`, `discount_codes`,
`discount_code_uses`, `learning_progress`, `video_progress`, `quiz_attempts`,
`quiz_attempt_answers`, `ai_checks`, `contact_submissions`.

Manifest (`scripts/data/export/manifest.json`) zapisuje datę eksportu, liczby
wierszy, listę pominiętych tabel oraz pokrycie wideo Bunny.net.

---

## 3. Krok 1 — Eksport na Replit

```bash
pnpm export:elearning
```

Wynik w `scripts/data/export/`:
- `<tabela>.json` — po jednym pliku na tabelę treści,
- `full-elearning-export.json` — komplet w jednym pliku (używany przy imporcie),
- `manifest.json` — metadane (data, liczby wierszy, pokrycie Bunny.net),
- `bunny-videos.json` — pomocniczy wykaz powiązań wideo↔Bunny.

Następnie zacommituj i wypchnij:

```bash
git add scripts/data/export/
git commit -m "Aktualizacja treści e-learningu (eksport)"
git push
```

> Eksport pomija tabele z danymi klientów, więc w `scripts/data/export/` nie ma
> e-maili, haseł, tokenów ani sekretów. Można je bezpiecznie trzymać w repozytorium.

---

## 4. Krok 2 — Wdrożenie na VPS (automatyczne)

Na serwerze wystarczy jedno polecenie (wymaga wypełnionego `.env` —
patrz `.env.example`):

```bash
./deploy/deploy-vps.sh          # lub z aliasu: pnpm deploy:vps
```

Skrypt wykonuje po kolei:

1. **Sprawdza** obecność plików (`docker-compose.yml`, `docker-compose.prod.yml`,
   `.env`) i kluczowych zmiennych (`POSTGRES_PASSWORD`, `CLERK_*`,
   `SESSION_SECRET` ≥ 32 znaki, `DOMAIN`, `ACME_EMAIL`, `APP_URL`, `API_URL`,
   `ALLOWED_ORIGINS`). Braki przerywają wdrożenie z czytelnym komunikatem.
2. `git pull --ff-only` — pobiera kod **i** najnowszy `scripts/data/export/`.
3. **Kopia zapasowa PRZED importem** (`deploy/backup-db.sh`), o ile baza już
   działa. Gdyby wdrożenie coś zepsuło, wracasz przez `./deploy/restore-db.sh`.
4. `docker compose build` — przebudowa obrazów.
5. `docker compose up -d --wait` — start i oczekiwanie na healthcheck.
   **Przy starcie kontenera API** wykonuje się automatycznie pełny cykl treści
   (patrz sekcja 5).
6. Sprzątanie nieużywanych obrazów i wyświetlenie statusu usług.

---

## 5. Automatyczny cykl przy starcie kontenera API

Definiuje go `docker/api/entrypoint.sh`. Każdy krok można wyłączyć zmienną
`RUN_*=0` w `.env`:

| Krok | Zmienna (domyślnie `1`) | Co robi | Błąd |
| --- | --- | --- | --- |
| 1 | `RUN_DB_MIGRATE` | Migracje **schematu** bazy (`drizzle-kit migrate`) | **KRYTYCZNY — przerywa start** |
| 2 | `RUN_IMPORT_ELEARNING` | Import treści z repo w trybie `merge` | Loguje, **nie** przerywa startu |
| 3 | `RUN_CONTENT_MIGRATE` | Jednorazowe migracje **treści** (`content:migrate`) | Loguje, **nie** przerywa startu |
| 4 | `RUN_VERIFY_CONTENT` | Walidacja kompletności/spójności treści | Loguje; przerywa tylko przy `VERIFY_CONTENT_STRICT=1` |

Dlaczego kroki 2–4 nie przerywają startu: import (merge) jest **transakcyjny**,
więc w razie błędu baza pozostaje w poprzednim, spójnym stanie, a aplikacja nie
notuje przestoju. Ustaw `VERIFY_CONTENT_STRICT=1`, aby twardy błąd walidacji (❌)
świadomie blokował start (środowiska, w których wolisz „fail-fast”).

Krok 1 jest krytyczny: schemat bazy musi zawsze zgadzać się z kodem.

---

## 6. Tryby importu

Import: `pnpm import:elearning <flagi>` (w kontenerze:
`docker compose ... exec -T api pnpm --filter @workspace/scripts run import:elearning <flagi>`).

### `--mode=merge` (domyślny, bezpieczny — używany przy wdrożeniu)

- Dopasowuje wiersze po **kluczach naturalnych** (np. `courses.slug`,
  `sections` po `courseId + slug`, `topics` po `sectionId + slug`,
  `videos` po tokenie Bunny, `tasks` po `topicId + title`), a nie po ID.
  Dzięki temu ID w bazie VPS mogą być inne niż na Replit.
- **Dodaje** brakujące wiersze i **aktualizuje** istniejące, aby baza
  odpowiadała eksportowi.
- **Nigdy nie usuwa** żadnych wierszy — dane klientów są całkowicie nietknięte.
- Jest **idempotentny**: kolejne uruchomienia z tym samym eksportem nie
  zmieniają liczby wierszy.

### `--mode=replace-demo-content` (twardy reset treści demo — z zabezpieczeniami)

- Kasuje treść eksportowanych kursów (po `slug`; kaskada FK czyści
  działy/lekcje/materiały/quizy/zadania) oraz zarządzane ustawienia strony,
  po czym wstawia je na nowo z eksportu.
- **Wymaga flagi `--yes`.**
- **Przerywa działanie**, jeśli w bazie są jakiekolwiek dane klientów
  (płatności, dostępy `source='payment'`, postępy nauki/wideo, podejścia do
  quizów). Chroni przed skasowaniem prawdziwych danych przez kaskady FK.
- Przeznaczony wyłącznie do czystego środowiska demo, zanim pojawią się pierwsi
  płacący użytkownicy.

### `--dry-run` (podgląd bez zapisu)

Dodaj do dowolnego trybu, aby zobaczyć, co by się zmieniło (ile wierszy dodanych /
zaktualizowanych) **bez zapisywania czegokolwiek** (cała operacja jest wycofywana
w transakcji):

```bash
pnpm import:elearning --dry-run
pnpm import:elearning --mode=replace-demo-content --dry-run
```

---

## 7. Migracje treści (`content:migrate`)

Do jednorazowych, wersjonowanych transformacji **danych treści** (np. masowa
zmiana pola, przeliczenie, poprawka) — odpowiednik migracji, ale dla treści,
nie dla schematu.

- Pliki migracji leżą w `scripts/content-migrations/` (każdy eksportuje `name`
  oraz `up(ctx)`; `ctx` daje transakcję `tx`, `db` i `schema`).
- Uruchomienie: `pnpm content:migrate` (lub `--dry-run`).
- Każda migracja jest zapisywana w tabeli-dzienniku `content_migrations`
  (nazwa + suma kontrolna + status), więc uruchamia się **dokładnie raz** — przy
  kolejnych startach jest pomijana. Jest to bezpieczne do wielokrotnego wywołania
  (np. przy każdym starcie kontenera).

---

## 8. Weryfikacja treści (`verify:content`)

```bash
pnpm verify:content
```

Sprawdza:
- połączenie z bazą,
- **twardy błąd (❌, kod wyjścia 1)**, gdy brak jakiejkolwiek treści rdzenia
  (kursy / działy / lekcje / zadania = 0),
- **ostrzeżenie**, gdy brak wideo,
- osierocone wiersze (np. lekcja bez działu), duplikaty kluczy naturalnych,
  braki `title` / `slug` / `sort_order`, powiązania wideo↔Bunny,
- obecność wymaganych (`DATABASE_URL`, `BUNNY_LIBRARY_ID`) i zalecanych
  zmiennych środowiskowych.

Kod wyjścia `1` oznacza problem krytyczny. W kontenerze walidacja domyślnie tylko
ostrzega; ustaw `VERIFY_CONTENT_STRICT=1`, aby blokowała start.

---

## 9. Kopie zapasowe i przywracanie

- **Kopia zapasowa (ręczna):** `pnpm backup:db` lub `./deploy/backup-db.sh`
  → `backups/<POSTGRES_DB>_RRRR-MM-DD_GGMMSS.sql.gz` (`pg_dump --clean --if-exists`).
  Wykonywana jest też automatycznie przez `deploy-vps.sh` **przed** wdrożeniem.
- **Przywracanie:** `./deploy/restore-db.sh backups/<plik>.sql.gz`
  (poprosi o potwierdzenie słowem `tak`; `--yes` je pomija).
  **UWAGA: operacja NADPISUJE bieżącą bazę.**

Katalog `backups/` jest ignorowany przez git.

---

## 10. Konfiguracja Bunny.net (wideo)

Identyfikatory wideo (`bunnyVideoId`, `bunnyTitle`) są częścią eksportu, więc
odtwarzają się automatycznie. Aby wideo się odtwarzało, na VPS muszą być
ustawione zmienne (patrz `.env.example`):

- `BUNNY_LIBRARY_ID`
- `BUNNY_CDN_HOSTNAME`
- `BUNNY_STREAM_API_KEY` (zarządzanie / upload przez panel)
- `BUNNY_TOKEN_AUTH_KEY` (jeśli włączone uwierzytelnianie tokenem odtwarzania)

> Eksport zawiera identyfikatory GUID wideo (nie sekrety). Zaleca się włączenie
> Token Authentication w bibliotece Bunny, aby sam GUID nie umożliwiał
> nieautoryzowanego odtwarzania płatnych treści.

Ważna zasada modelu danych: **GUID wideo Bunny to globalny, unikalny
identyfikator (jeden klip ↔ jeden wiersz `videos`)** — to na nim opiera się
idempotentny import. Dlatego duplikowanie lekcji w panelu tworzy kopię **bez**
powiązania z Bunny (administrator przypisuje wideo do kopii ręcznie).

---

## 11. Ograniczenia trybu `merge` (świadome i udokumentowane)

Ponieważ `merge` nigdy nie usuwa wierszy:

- **Zmiana `slug`** kursu / działu / lekcji tworzy **nowy** wiersz obok starego
  (stary zostaje). Po zmianie kluczy naturalnych użyj `replace-demo-content`
  (na czystym demo) albo posprzątaj ręcznie.
- **Edycja tekstu pytania FAQ** (klucz = treść pytania) może zostawić nieaktualny
  wiersz obok nowego.
- Każdy `merge` przepisuje wiersze treści, więc kolumna `updatedAt` odświeża się
  przy każdym wdrożeniu (nie odzwierciedla realnego czasu edycji).

Przy obecnej skali treści są to efekty nieszkodliwe. Dla „czystego” resetu treści
demo (bez klientów) użyj `--mode=replace-demo-content --yes`.

---

## 12. Bezpieczeństwo danych klientów — gwarancje

Ochrona danych klientów jest egzekwowana na kilku poziomach:

1. **Allowlista eksportu** (`EXPORT_TABLES`) — eksport fizycznie nie widzi tabel
   spoza listy treści.
2. **Import nigdy nie usuwa** danych klientów; tryb `replace-demo-content`
   dodatkowo przerywa działanie, gdy wykryje realnych klientów.
3. **Testy automatyczne** (`artifacts/api-server/tests/`):
   - `import-safety.test.ts` — skan statyczny (importer nie zawiera `TRUNCATE`,
     `DROP TABLE` ani `.delete()` na tabelach klientów) **oraz** test wykonawczy
     (po realnym imporcie użytkownik, płatność, dostęp i postęp nadal istnieją),
   - `content-lifecycle.e2e.test.ts` — pełny cykl:
     import → eksport → ponowny import (idempotencja) → `content:migrate`
     (dziennik) → `verify:content`.

---

## 13. Szybka ściąga poleceń

| Cel | Polecenie |
| --- | --- |
| Eksport treści (Replit) | `pnpm export:elearning` |
| Wdrożenie na VPS (całość) | `./deploy/deploy-vps.sh` (lub `pnpm deploy:vps`) |
| Import — bezpieczny merge | `pnpm import:elearning --mode=merge` |
| Import — podgląd bez zapisu | `pnpm import:elearning --dry-run` |
| Import — reset demo | `pnpm import:elearning --mode=replace-demo-content --yes` |
| Migracje treści | `pnpm content:migrate` |
| Weryfikacja treści | `pnpm verify:content` |
| Kopia zapasowa | `pnpm backup:db` |
| Przywrócenie | `./deploy/restore-db.sh backups/<plik>.sql.gz` |

# Platforma edukacyjna z modułem AI — kursy fizyki

Komercyjna platforma e-learningowa (PWA) z kursami fizyki dla klasy 7, panelem ucznia,
panelem administratora, płatnościami, modułem zadań sprawdzanych przez AI oraz jasnym/ciemnym
motywem. Interfejs w języku polskim.

Cała aplikacja uruchamiana jest **wyłącznie przez Docker i Docker Compose** — na serwerze VPS
nie trzeba ręcznie instalować Node.js, pnpm ani żadnych zależności aplikacji.

---

## Spis treści

1. [Architektura](#architektura)
2. [Wymagania](#wymagania)
3. [Struktura projektu](#struktura-projektu)
4. [Zmienne środowiskowe](#zmienne-środowiskowe)
5. [Uruchomienie lokalne (Docker)](#uruchomienie-lokalne-docker)
6. [Migracje bazy danych](#migracje-bazy-danych)
7. [Seedowanie danych](#seedowanie-danych)
8. [GitHub — inicjalizacja repozytorium](#github--inicjalizacja-repozytorium)
9. [Deployment na VPS](#deployment-na-vps)
10. [Reverse proxy, domena i SSL](#reverse-proxy-domena-i-ssl)
11. [Aktualizacja aplikacji po pushu](#aktualizacja-aplikacji-po-pushu)
12. [Logi, restart i utrzymanie](#logi-restart-i-utrzymanie)
13. [Bezpieczeństwo produkcyjne](#bezpieczeństwo-produkcyjne)
14. [Najczęstsze problemy](#najczęstsze-problemy)

---

## Architektura

Trzy kontenery aplikacyjne + (w produkcji) reverse proxy:

```
                    ┌──────────────────────────────────────────┐
   Internet  ─────► │ Traefik (prod)  :80 / :443  SSL Let'sEncrypt│
                    └───────────────┬──────────────────────────┘
                                    │  HTTPS -> kontener web
                          ┌─────────▼─────────┐
                          │  web (Nginx)       │  serwuje SPA (React/Vite)
                          │  / -> pliki static │  oraz proxuje /api/ -> api
                          └─────────┬─────────┘
                                    │ /api/
                          ┌─────────▼─────────┐
                          │  api (Node/Express)│  port 8080, /api/*
                          │  migracje na starcie│
                          └─────────┬─────────┘
                                    │ DATABASE_URL
                          ┌─────────▼─────────┐
                          │  db (PostgreSQL 16)│  wolumen db_data
                          └───────────────────┘
```

- **Front i API są pod tym samym originem** (Nginx proxuje `/api/`), więc tokeny Clerk działają bez dodatkowej konfiguracji CORS.
- **Migracje** uruchamiają się automatycznie przy starcie kontenera `api`.
- **Dane bazy** trwają w nazwanym wolumenie Docker (`db_data`) — przeżywają restart i przebudowę.

| Usługa | Obraz / źródło | Port (wewn.) | Restart | Healthcheck |
|--------|----------------|--------------|---------|-------------|
| `db`   | `postgres:16-alpine` | 5432 | `unless-stopped` | `pg_isready` |
| `api`  | `docker/api/Dockerfile` | 8080 | `unless-stopped` | `GET /api/healthz` |
| `web`  | `docker/web/Dockerfile` (Nginx) | 80 | `unless-stopped` | `GET /` |
| `traefik` (prod) | `traefik:v3.1` | 80/443 | `unless-stopped` | — |

---

## Wymagania

Na maszynie docelowej (lokalnie lub VPS) wystarczy:

- **Docker Engine** 24+ oraz **Docker Compose v2** (`docker compose`, nie `docker-compose`).
- **git** (do sklonowania repozytorium).
- W produkcji: **domena** z rekordem `A` skierowanym na publiczne IP serwera oraz otwarte porty **80** i **443**.

Instalacja Dockera na świeżym Ubuntu/Debian:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # następnie wyloguj się i zaloguj ponownie
```

---

## Struktura projektu

```
.
├── artifacts/
│   ├── api-server/            # Backend Express (build esbuild -> dist/index.mjs)
│   │   ├── src/               #   trasy /api/* , logika, integracja AI
│   │   └── build.mjs
│   └── physics-platform/      # Frontend React + Vite (build -> dist/public)
│       ├── src/
│       └── vite.config.ts
├── lib/
│   ├── db/                    # Schemat bazy (Drizzle) + migracje
│   │   ├── src/schema/        #   źródło prawdy o strukturze bazy
│   │   ├── drizzle/           #   wygenerowane migracje SQL (0000_*.sql + meta)
│   │   └── drizzle.config.ts
│   ├── api-spec/              # Kontrakt OpenAPI (źródło prawdy API)
│   ├── api-zod/               # Wygenerowane schematy Zod
│   └── api-client-react/      # Wygenerowane hooki React Query
├── scripts/
│   └── src/seed.ts            # Seeder danych startowych
├── docker/
│   ├── api/
│   │   ├── Dockerfile         # Obraz backendu
│   │   └── entrypoint.sh      # Migracje + start serwera
│   └── web/
│       ├── Dockerfile         # Obraz frontendu (Nginx)
│       └── nginx.conf         # SPA fallback + proxy /api
├── deploy/
│   ├── deploy.sh             # Pierwsze uruchomienie (sprawdza .env, build, up)
│   ├── update.sh             # Aktualizacja po pushu (pull + build + up)
│   ├── migrate.sh            # Ręczne uruchomienie migracji
│   ├── backup.sh             # Kopia zapasowa bazy
│   └── restore.sh            # Odtworzenie bazy z kopii
├── docker-compose.yml         # Konfiguracja bazowa (lokalna)
├── docker-compose.prod.yml    # Nakładka produkcyjna (Traefik + SSL)
├── .env.example               # Wzór konfiguracji środowiska
├── .dockerignore
├── .gitignore
└── README.md
```

---

## Zmienne środowiskowe

Skonfiguruj plik `.env` na podstawie `.env.example`:

```bash
cp .env.example .env
```

Legenda kolumny *Wymagana*: ✅ = zawsze · **prod** = wymagana w produkcji
(serwer API waliduje to przy starcie w `src/config/env.ts` i nie wstanie bez
niej) · — = opcjonalna.

| Zmienna | Wymagana | Opis |
|---------|:--------:|------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | ✅ | Dane bazy w kontenerze `db`; z nich składany jest `DATABASE_URL`. |
| `CLERK_SECRET_KEY` | ✅ | Tajny klucz backendu Clerk (Dashboard → API Keys). Nigdy nie wystawiaj publicznie. |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Publiczny klucz Clerk. Wbudowywany w build frontendu (kontener `web` pobiera go jako build-arg) oraz używany przez API. |
| `ADMIN_EMAILS` | — | Lista e-maili (po przecinku) automatycznie promowanych do roli administratora przy logowaniu przez Clerk. |
| `SESSION_SECRET` | ✅ | Sekret podpisujący wewnętrzne tokeny HMAC (np. bilety quizów na czas). To NIE klucz Clerk. Min. 32 znaki: `openssl rand -hex 32`. |
| `NODE_ENV` | — | `production` (domyślnie). |
| `LOG_LEVEL` | — | Poziom logów: `info`, `debug`, `warn`, `error`. |
| `APP_URL` / `API_URL` | prod | Publiczne adresy (linki w e-mailach, walidacja `returnUrl` płatności). |
| `ALLOWED_ORIGINS` | prod | Dozwolone originy CORS (po przecinku). Zwykle = `APP_URL`. |
| `COURSE_PRICE_GROSZ` | — | Cena kursu w groszach (domyślnie `3500` = 35,00 zł). |
| `COURSE_OLD_PRICE_GROSZ` | — | Stara cena informacyjna w groszach, pokazywana z przekreśleniem (domyślnie `19900` = 199,00 zł). |
| `PAYNOW_API_KEY` / `PAYNOW_SIGNATURE_KEY` | prod | Dane Paynow. Bez nich w dev działa płatność „mock", a w produkcji płatność zwraca 503. |
| `PAYNOW_ENV` | — | `sandbox` (domyślnie) lub `production`. |
| `PAYNOW_API_URL` / `PAYNOW_RETURN_URL` / `PAYNOW_NOTIFICATION_URL` | — | Opcjonalne nadpisania (domyślnie dobierane wg `PAYNOW_ENV`). |
| `BUNNY_LIBRARY_ID` / `BUNNY_CDN_HOSTNAME` | prod | Hosting wideo Bunny.net. |
| `GEMINI_API_KEY` | prod | Sprawdzanie zadań przez AI. Bez klucza w dev działa tryb demonstracyjny. |
| `GEMINI_MODEL` | — | Model Gemini do **sprawdzania zadań** (puste = alias `gemini-flash-latest`, zawsze aktualny; wycofane modele są automatycznie zastępowane). |
| `GEMINI_CHAT_MODEL` | — | Model Gemini dla **asystenta tekstowego** lekcji (puste = tani `gemini-flash-lite-latest`; wycofane modele są automatycznie zastępowane). |
| `AI_USD_PLN_RATE` | — | Kurs USD→PLN do szacowania kosztów AI w statystykach admina (domyślnie `4.0`). |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | prod | Serwer SMTP do wysyłki e-mail. |
| `SMTP_PORT` | — | Port SMTP (domyślnie `587`). |
| `CONTACT_FROM_EMAIL` | prod | Adres nadawcy (From) wiadomości. |
| `CONTACT_EMAIL` | — | Adres odbiorcy zgłoszeń z formularza kontaktowego. |
| `DOMAIN` | prod | Domena dla Traefik/SSL (bez `https://`). |
| `ACME_EMAIL` | prod | E-mail rejestracji certyfikatu Let's Encrypt. |
| `WEB_PORT` | — | Port localhost do podglądu lokalnego (domyślnie 8080). |

> **Nigdy** nie commituj pliku `.env` — zawiera sekrety. Repozytorium śledzi tylko `.env.example`.

---

## Uruchomienie lokalne (Docker)

```bash
# 1. Konfiguracja
cp .env.example .env
#    edytuj .env: ustaw POSTGRES_PASSWORD, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, SESSION_SECRET

# 2. Budowa i start wszystkich usług
docker compose up -d --build

# 3. Podgląd
#    http://localhost:8080
```

Najważniejsze komendy lokalne:

```bash
docker compose ps                 # status kontenerów
docker compose logs -f            # logi wszystkich usług
docker compose logs -f api        # logi tylko backendu
docker compose down               # zatrzymanie (dane bazy zostają w wolumenie)
docker compose down -v            # zatrzymanie + USUNIĘCIE danych bazy
```

Migracje wykonują się automatycznie przy starcie `api`. Aby dodać dane przykładowe,
zobacz [Seedowanie danych](#seedowanie-danych).

---

## Migracje bazy danych

Schemat bazy jest źródłem prawdy w `lib/db/src/schema/`. Migracje SQL leżą w `lib/db/drizzle/`.

**Automatycznie:** przy każdym starcie kontenera `api` uruchamiany jest
`drizzle-kit migrate`, który stosuje wszystkie nowe migracje (`entrypoint.sh`).

**Po zmianie schematu** (gdy modyfikujesz pliki w `lib/db/src/schema/`):

```bash
# Wygeneruj nową migrację SQL na podstawie zmian w schemacie
pnpm --filter @workspace/db run generate
# Powstanie nowy plik w lib/db/drizzle/ — ZACOMMITUJ go do repozytorium.
```

**Ręczne uruchomienie migracji** (np. lokalnie poza Dockerem lub w działającym kontenerze):

```bash
# Wewnątrz działającego kontenera API (lokalnie lub na VPS):
docker compose exec api pnpm --filter @workspace/db run migrate
```

> Migracje wersjonowane (`generate` + `migrate`) są zalecane na produkcję. Komenda
> `pnpm --filter @workspace/db run push` (synchronizacja schematu bez plików migracji)
> jest wygodna w szybkim developmencie, ale **nie używaj jej na produkcji**.

---

## Seedowanie danych

Seeder ładuje pełny kurs **„Łatwa Fizyka — klasa 7"** (źródło: `scripts/src/course-data.ts`)
wraz z kontami startowymi. Jest **idempotentny i nieniszczący**: dopasowuje kurs,
działy i lekcje po stabilnych slugach i **dodaje tylko brakujące** dane — istniejące
wiersze, a także **użytkownicy, płatności, dostępy i postępy uczniów pozostają
nietknięte**. Dzięki temu można go bezpiecznie uruchamiać wielokrotnie na produkcji.

```bash
# Ręcznie (w działającym kontenerze API, lokalnie lub na VPS):
docker compose exec api pnpm --filter @workspace/scripts run seed
# lub skrótem:
./deploy/seed.sh
```

> `deploy/update.sh` uruchamia ten import automatycznie po każdej aktualizacji,
> więc kurs nigdy nie zostaje pusty (także po świeżym postawieniu bazy).
>
> **Ważne (skutek automatycznego importu):** ponieważ seed dodaje brakujące
> działy/lekcje przy każdym wdrożeniu, treść **usunięta** przez admina zostanie
> odtworzona przy następnym `update.sh`. Aby trwale ukryć materiał, użyj statusu
> **`hidden`/`archived`/`draft`** w panelu (istniejące wiersze nie są nadpisywane),
> zamiast twardego usuwania. Zmiana `slug` istniejącego działu/lekcji w panelu może
> spowodować dodanie duplikatu pod pierwotnym slugiem.
>
> **Konta demo na produkcji:** domyślnie **nie są** tworzone (seed pomija je, gdy
> `NODE_ENV=production`). Rolę administratora nadaje `ADMIN_EMAILS` przy logowaniu.
> Aby wymusić utworzenie kont demo: `-e SEED_DEMO_ACCOUNTS=1`.
>
> **Twardy reset treści (TYLKO dev):** `SEED_RESET=1` czyści i odtwarza całą treść
> kursu, ale **odmawia działania**, gdy w bazie są rzeczywiste płatności lub dostępy
> z płatności — nigdy nie skasuje danych klientów:
> ```bash
> docker compose exec -e SEED_RESET=1 api pnpm --filter @workspace/scripts run seed
> ```

Co ładuje seeder (źródło: `scripts/src/course-data.ts`):

- **3 działy, 21 lekcji** w ustalonej kolejności (`sortOrder`),
- **uporządkowane materiały lekcji** — filmy (osadzane z Bunny Stream po `bunnyVideoId`) oraz grafiki PNG z `public/course-assets/`,
- **14 quizów** z progiem zaliczenia **80%** i poprawnymi odpowiedziami,
- pierwsza lekcja oznaczona jako **demonstracyjna** (`isPreview`) — dostępna bez wykupionego dostępu,
- lekcje bez filmu (np. część działu 2) obsługiwane są poprawnie: pokazują grafiki i quiz.

Konta startowe tworzone przez seeder (**bez haseł** — logowanie odbywa się przez Clerk):

| Rola | E-mail | Uwagi |
|------|--------|-------|
| Administrator | `admin@fizyka.edu.pl` | rola `admin`; przy logowaniu przez Clerk tym adresem konto Clerk zostaje powiązane z tym wierszem |
| Uczeń | `uczen@fizyka.edu.pl` | otrzymuje pełny dostęp do kursu (do testów płatnej ścieżki) |

> Seeder nie ustawia haseł. Aby uzyskać dostęp administratora, zarejestruj się w
> Clerk **tym samym, zweryfikowanym** adresem e-mail (`admin@fizyka.edu.pl`) **lub**
> dodaj swój adres do `ADMIN_EMAILS` w `.env` — przy pierwszym logowaniu zostaniesz
> automatycznie promowany do roli administratora.

### Panel administratora

Po zalogowaniu jako administrator (`/admin`) dostępny jest panel z wbudowanym menu:

- **Pulpit** (`/admin`) — podsumowanie (liczba kursów, uczniów, przychód, ostatnie płatności).
- **Kursy** (`/admin/courses`) — przełączanie statusu publikacji kursów, działów, lekcji i quizów
  (`draft` / `published` / `hidden` / `archived`). Status jest **autorytatywny**: tylko treści ze
  statusem `published` są widoczne publicznie i możliwe do kupienia.
- **Strona główna** (`/admin/landing`) — edycja sekcji landing page (treść, włączanie/wyłączanie,
  kolejność) bez zmian w kodzie.
- **Cennik** (`/admin/pricing`) — cena kursu, stara cena (przekreślona), promocja i tekst CTA.
  Cennik jest **jedynym źródłem prawdy o cenie**: ta sama wartość zasila stronę, baner promocyjny
  **oraz kwotę pobieraną przez Paynow** (cena widoczna = kwota płatności, zawsze).
- **FAQ** (`/admin/faq`) — pytania i odpowiedzi (dodawanie, edycja, widoczność, kolejność).
- **SEO** (`/admin/seo`) — meta title/description, Open Graph, canonical i `robots`.
- **Kody rabatowe** (`/admin/discounts`) — kody promocyjne (procentowe lub kwotowe), opcjonalnie
  przypisane do kursu, z datami ważności i limitami (łącznym oraz na użytkownika). Można je
  włączać/wyłączać, a kodu już użytego nie da się usunąć (tylko wyłączyć). Każdy kod ma historię
  użyć (kto, kiedy, kwota przed/po rabacie). Rabat jest **przeliczany wyłącznie po stronie serwera**
  przy zakupie — klient nigdy nie dyktuje kwoty.
- **Dostępy** (`/admin/access`) — dedykowany widok „kto ma dostęp do czego”: aktywne i nieaktywne
  dostępy z filtrowaniem i wyszukiwaniem, ręczne **nadawanie** (z opcjonalną datą wygaśnięcia i
  notatką) oraz **odbieranie** dostępu, a także pełna **historia zmian** (nadania/odebrania wraz z
  administratorem i notatką).
- **Ustawienia** (`/admin/settings`) — techniczne ustawienia platformy z katalogu (klucz → wartość,
  **bez sekretów**; nieznane klucze są odrzucane) oraz **import/eksport danych**: lekcje (CSV/JSON),
  użytkownicy (CSV), płatności (CSV) i quizy (JSON w obie strony). Pliki CSV są zapisywane z BOM,
  aby Excel poprawnie pokazywał polskie znaki.

**Podgląd „jak u ucznia”** — przed publikacją można obejrzeć treść tak, jak zobaczy ją uczeń,
bez publikowania: lekcja i quiz (zakładka *Podgląd* w edytorze lekcji), karta/strona kursu
(przycisk podglądu przy kursie → `/courses/:slug?preview=:id`) oraz strona główna z FAQ i cennikiem
(przycisk *Podgląd jako uczeń* → `/?preview=1`). Tryb podglądu jest dostępny tylko dla administratora
i pobiera treść z chronionych endpointów `*/api/admin/*/preview` (quiz nigdy nie ujawnia poprawnych
odpowiedzi).

Wszystkie zmiany przechodzą przez endpointy `*/api/admin/*` chronione `requireAuth + requireAdmin`
i są zapisywane w dzienniku administratora.

### Diagnostyka materiałów wideo

Po zalogowaniu jako administrator dostępna jest strona **`/admin/course-debug`**, która
sprawdza na żywo stan wszystkich filmów w bibliotece Bunny Stream (gotowe / brak ID / błąd).
Endpointy: `GET /api/admin/video-health` oraz `GET /api/admin/video-health/:videoId`.

### Śledzenie postępu i asystent AI

- **Postęp jest egzekwowany po stronie serwera** — ukończenie wideo wynika z realnie obejrzanego
  czasu (`POST /api/progress/video`, próg 90%), a quiz zalicza się dopiero od 80% poprawnych odpowiedzi.
  Klient nie może samodzielnie oznaczyć lekcji jako ukończonej.
- **Asystent AI lekcji** (`POST /api/ai/lesson-chat`) korzysta z modelu **Gemini** skonfigurowanego
  przez `GEMINI_API_KEY` i odpowiada w języku polskim w kontekście danej lekcji.
- **Podział modeli AI:** sprawdzanie zadań (obraz z tablicy) używa modelu jakościowego
  (`GEMINI_MODEL` / ustawienie admina), a asystent tekstowy — taniego modelu
  (`GEMINI_CHAT_MODEL`, domyślnie `gemini-flash-lite-latest`) z krótkim promptem,
  przyciętą historią (6 ostatnich wiadomości) i limitem długości odpowiedzi.
  Ustawienie „Model" w panelu admina dotyczy wyłącznie sprawdzania zadań.
- **Ponawianie zapytań AI:** chwilowe błędy Gemini (429/5xx/timeout) są automatycznie
  ponawiane (do 4 prób, rosnące odstępy z jitterem, wskazówki `RetryInfo` serwera).
  Uczeń widzi na żywo status „Ponawiam próbę X z Y…" (`GET /api/ai/progress/:requestId`),
  a każde zapytanie trafia do `ai_usage_log` (tokeny, szacunkowy koszt, liczba prób).
  Statystyki: `GET /api/admin/ai-usage/stats` i karta „Statystyki użycia AI" w panelu admina.

---

## GitHub — inicjalizacja repozytorium

Jeśli projekt nie jest jeszcze repozytorium git:

```bash
git init
git add .
git commit -m "Initial commit: platforma fizyki + Docker deployment"
git branch -M main
git remote add origin git@github.com:TWOJA-NAZWA/twoje-repo.git
git push -u origin main
```

**Czego NIE wrzucać do repozytorium** (już ujęte w `.gitignore`):

- `.env` i wszelkie pliki z prawdziwymi sekretami (śledzony jest tylko `.env.example`),
- `node_modules/`, katalogi `dist/`, pliki `*.tsbuildinfo`,
- `letsencrypt/`, `acme.json` (certyfikaty),
- kopie zapasowe (`backups/`), logi.

---

## Deployment na VPS

Zakładamy świeży serwer z zainstalowanym Dockerem oraz domenę skierowaną na jego IP.

```bash
# 1. Zaloguj się na VPS i sklonuj repozytorium
git clone git@github.com:TWOJA-NAZWA/twoje-repo.git
cd twoje-repo

# 2. Utwórz i uzupełnij plik .env
cp .env.example .env
nano .env
#    Ustaw KONIECZNIE:
#      POSTGRES_PASSWORD     — silne hasło
#      CLERK_SECRET_KEY      — klucz tajny z dashboardu Clerk
#      CLERK_PUBLISHABLE_KEY — klucz publiczny z dashboardu Clerk
#      SESSION_SECRET        — openssl rand -hex 32
#      DOMAIN                — twoja-domena.pl
#      ACME_EMAIL            — admin@twoja-domena.pl
#      APP_URL/API_URL       — https://twoja-domena.pl (+ /api)

# 3. Uruchom w trybie produkcyjnym (z Traefik + SSL).
#    Skrypt sprawdza .env, buduje obrazy, startuje usługi i czeka na bazę:
./deploy/deploy.sh
#    (alternatywnie, ręcznie:)
# docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4. Sprawdź status i logi
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# 5. (opcjonalnie) Dodaj dane startowe
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec api pnpm --filter @workspace/scripts run seed
```

Migracje wykonają się automatycznie. Po chwili aplikacja będzie dostępna pod
`https://twoja-domena.pl` (certyfikat SSL może potrzebować ~1 minuty na wystawienie).

> **Wskazówka:** by uniknąć długiej komendy, możesz ustawić alias:
> ```bash
> alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
> ```
> wtedy: `dc ps`, `dc logs -f`, `dc up -d --build`.

---

## Reverse proxy, domena i SSL

W produkcji ruch obsługuje **Traefik** (plik `docker-compose.prod.yml`):

- Nasłuchuje na portach **80** i **443**.
- Automatycznie **wystawia i odnawia** certyfikat **Let's Encrypt** (wyzwanie TLS-ALPN-01).
- **Przekierowuje cały ruch HTTP → HTTPS**.
- Kieruje żądania dla `DOMAIN` do kontenera `web` (Nginx), który serwuje front i proxuje `/api/`.

Konfiguracja sprowadza się do ustawienia `DOMAIN` i `ACME_EMAIL` w `.env` oraz wskazania
rekordu `A` domeny na IP serwera. Certyfikaty trwają w wolumenie `letsencrypt`.

> Subdomena `www`: dodaj kolejny rekord `A`/`CNAME` i rozszerz regułę routera o
> `Host(\`${DOMAIN}\`) || Host(\`www.${DOMAIN}\`)` w `docker-compose.prod.yml`.

---

## Aktualizacja aplikacji po pushu

Po wypchnięciu nowych zmian na GitHub, na VPS wystarczy:

```bash
./deploy/update.sh
```

Skrypt: pobiera kod (`git pull`), przebudowuje obrazy, restartuje kontenery
(migracje wykonają się automatycznie) i sprząta nieużywane obrazy.

Ręcznie, bez skryptu:

```bash
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker image prune -f
```

---

## Logi, restart i utrzymanie

```bash
# Logi (dodaj -f aby śledzić na żywo)
docker compose logs -f api
docker compose logs -f web
docker compose logs -f db

# Restart pojedynczej usługi / wszystkich
docker compose restart api
docker compose restart

# Zatrzymanie i ponowny start
docker compose down
docker compose up -d

# Kopia zapasowa bazy danych
./deploy/backup.sh           # zapisuje do ./backups/

# Odtworzenie bazy z kopii (UWAGA: nadpisuje bieżące dane)
./deploy/restore.sh backups/PLIK.sql.gz
```

Automatyczny restart po awarii zapewnia polityka `restart: unless-stopped` —
kontenery wstają same po crashu lub po restarcie serwera.

---

## Bezpieczeństwo produkcyjne

- **Sekrety tylko w `.env`** (poza repozytorium); używaj długich, losowych wartości.
- **Rozdzielenie konfiguracji**: `docker-compose.yml` (lokalnie) vs `docker-compose.prod.yml` (produkcja).
- **Baza nie jest wystawiona** na świat — port 5432 dostępny tylko w sieci Docker.
- **API i front** nie publikują portów publicznie w produkcji — wejście wyłącznie przez Traefik (HTTPS).
- **Wymuszony HTTPS** + nagłówki bezpieczeństwa w Nginx (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).
- **Logowanie** strukturalne (pino) na `api`; poziom sterowany `LOG_LEVEL`.
- **Aktualizuj** obraz bazowy i zależności; rób regularne kopie (`deploy/backup.sh`).
- Po seedowaniu **zmień domyślne hasła** kont demonstracyjnych.
- **Integralność postępu (nie do podrobienia z klienta).** Ukończenie lekcji jest wyznaczane wyłącznie po stronie serwera:
  - mianownikiem procentu obejrzenia jest zawsze **czas trwania filmu zapisany w bazie** (`videos.durationSeconds`, pobierany z pola `length` Bunny podczas seedowania) — klient nie może przysłać własnego czasu trwania;
  - zapisany czas obejrzenia jest **ograniczony rzeczywistym czasem zegarowym** od pierwszego otwarcia filmu (`video_progress.created_at`), więc pojedyncze (ani seria szybkich) sfałszowane żądanie nie zaliczy filmu — dojście do końca wymaga realnego upływu czasu;
  - flagi ukończenia (`videoCompleted`, `quizCompleted`, `taskCheckedByAi`) ustawiają wyłącznie dedykowane trasy serwera po realnym zdarzeniu; `POST /api/progress` zapisuje tylko nawigację.

---

## Najczęstsze problemy

| Objaw | Przyczyna / rozwiązanie |
|-------|-------------------------|
| `api` restartuje się w pętli, logi: `DATABASE_URL ...` | Brak/niepoprawne dane bazy w `.env`. Sprawdź `POSTGRES_*`. Kontener `api` czeka aż `db` będzie zdrowy (healthcheck). |
| Brak certyfikatu SSL / błąd Let's Encrypt | Domena nie wskazuje na IP serwera, porty 80/443 zablokowane, albo zły `ACME_EMAIL`. Sprawdź `docker compose ... logs traefik`. |
| `502 Bad Gateway` na `/api` | Kontener `api` jeszcze się nie uruchomił lub padł — `docker compose logs -f api`. |
| Po `down -v` zniknęły dane | `-v` usuwa wolumen `db_data`. Używaj `down` bez `-v`, by zachować dane. |
| Zmiana schematu nie widoczna w bazie | Wygeneruj migrację (`pnpm --filter @workspace/db run generate`), zacommituj i zrób redeploy — migracja zastosuje się przy starcie `api`. |
| Sprawdzanie zadań „w trybie demonstracyjnym" | Brak `GEMINI_API_KEY` w `.env`. Dodaj klucz i zrestartuj `api`. |
| `docker compose` nie istnieje | Zainstalowana stara wersja. Użyj Docker Compose v2 (`docker compose`, nie `docker-compose`). |

---

## Szybka ściąga komend

```bash
# Lokalnie
cp .env.example .env
docker compose up -d --build
docker compose logs -f

# GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin git@github.com:USER/REPO.git
git push -u origin main

# VPS (produkcja) — pierwsze uruchomienie
git clone <repo> && cd <repo>
cp .env.example .env && nano .env
./deploy/deploy.sh          # sprawdza .env, buduje, startuje (migracje automatyczne)

# Seed danych startowych (jednorazowo)
docker compose exec api pnpm --filter @workspace/scripts run seed

# Migracje ręcznie (zwykle automatyczne przy starcie api)
./deploy/migrate.sh

# Kopia / odtworzenie bazy
./deploy/backup.sh
./deploy/restore.sh backups/PLIK.sql.gz

# Aktualizacja po pushu
./deploy/update.sh
```

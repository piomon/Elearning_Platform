# Raport końcowy — Etap 3/3 Panelu Administratora (warstwa komercyjna i operacyjna)

Dokument podsumowuje wdrożenie finalnego (3 z 3) etapu Panelu Administratora platformy
**fizyka7**: kody rabatowe, dedykowany widok dostępów z historią, ustawienia techniczne
platformy, import/eksport danych oraz podgląd treści przed publikacją. Domyka projekt:
testy, dokumentacja i raport.

Stan na: czerwiec 2026.
Stack: React + Vite + TypeScript (frontend), Express 5 + TypeScript (API),
PostgreSQL + Drizzle ORM, Gemini AI (backend), Paynow (płatności), Bunny (wideo, backend),
Docker, monorepo pnpm + OpenAPI (kontrakt i generowani klienci).

---

## 1. Zakres etapu

Etap 3 dodaje warstwę komercyjną i operacyjną na bazie ukończonych etapów 1 (strona, cennik,
FAQ, SEO, statusy publikacji, szkielet panelu) i 2 (lekcje, quizy, Bunny, materiały, AI).
Poziom „Rozdziały" pozostaje świadomie poza zakresem (odłożony).

Dostarczone funkcje:
1. Kody rabatowe (schemat + API + widok).
2. Rabaty w procesie zakupu (spójne z kwotą wysyłaną do Paynow).
3. Dedykowany widok **Dostępy** z historią i filtrami.
4. Ustawienia platformy (katalog klucz→wartość, bez sekretów).
5. Import/eksport danych (lekcje CSV/JSON, użytkownicy CSV, płatności CSV, quizy JSON w obie strony).
6. Podgląd treści „jak u ucznia" przed publikacją (lekcja, quiz, karta/strona kursu, strona główna).
7. Testy, build, dokumentacja, raport.

## 2. Kluczowe pliki

- Backend: `artifacts/api-server/src/routes/admin.ts` (kody, dostępy, ustawienia, import/eksport,
  podgląd), `artifacts/api-server/src/routes/payments.ts` (walidacja i naliczanie rabatu),
  `artifacts/api-server/src/lib/access.ts` (chain widoczności statusów).
- Schemat/baza: `lib/db/src/schema/payments.ts` (kody rabatowe + użycia, pola rabatu w płatności),
  `lib/db/src/schema/content.ts` (ustawienia platformy), migracja `lib/db/drizzle/0008_square_eternity.sql`.
- Kontrakt API: `lib/api-spec/openapi.yaml` + wygenerowani klienci (`@workspace/api-client-react`).
- Frontend: `artifacts/physics-platform/src/pages/admin/{discounts,access,settings}.tsx`,
  `pages/{home,course-overview}.tsx`, `pages/admin/{landing,courses}.tsx`,
  `components/preview-banner.tsx`, `App.tsx` (nawigacja + routing).
- Testy: `artifacts/api-server/tests/task4.test.ts` (+ `tests/helpers/factories.ts`).
- Dokumentacja: `README.md`, `.env.example`.

## 3. Kody rabatowe

- Tabele: `discount_codes` (kod, typ `percent`/`amount`, wartość, opcjonalne przypisanie do kursu,
  daty ważności, limit łączny i na użytkownika, licznik użyć, status aktywności) oraz
  `discount_code_uses` (kto, kiedy, kwota przed/po rabacie). Pola `discountCodeId` i `discountGrosz`
  dodane do tabeli płatności.
- CRUD z walidacją: kod ≥3 znaki, wzorzec `^[A-Z0-9_-]+$`, kod normalizowany do wielkich liter;
  wartość procentowa 1–100, kwotowa dodatnia; duplikat → **409**.
- Kodu już **użytego nie da się usunąć** (409) — można go tylko **wyłączyć** (zachowanie historii
  finansowej). Włączanie/wyłączanie przez `PATCH .../toggle`.
- Każdy kod ma podgląd **historii użyć** (liczba + szczegóły).

## 4. Rabaty w zakupie

- `POST /api/payments/validate-discount` zwraca przeliczony rabat (kwota przed, rabat, kwota po,
  waluta) **bez tworzenia płatności** — do podglądu na froncie.
- W `POST /api/payments/create` rabat jest **ponownie walidowany i przeliczany po stronie serwera**;
  klient nigdy nie dyktuje kwoty. Cena bazowa pochodzi z singletona cennika (jedyne źródło prawdy),
  więc kwota pobierana przez Paynow zawsze równa się kwocie po rabacie pokazanej użytkownikowi.
- Użycie kodu jest zapisywane dopiero przy potwierdzeniu płatności (status `completed`), wraz z
  inkrementacją licznika użyć — zgodnie z limitami łącznym i na użytkownika.

## 5. Dostępy

- `GET /api/admin/access` — lista „kto ma dostęp do czego" z filtrowaniem po statusie i
  wyszukiwaniem użytkownika; `GET /api/admin/access/history` — pełny dziennik zmian.
- `POST /api/admin/access` — ręczne **nadanie** dostępu (opcjonalna data wygaśnięcia i notatka),
  blokada duplikatu aktywnego dostępu (409).
- `DELETE /api/admin/access/:id` — **odebranie** dostępu (z notatką w treści żądania); próba
  odebrania nieaktywnego dostępu → 400.
- Każda akcja (nadanie/odebranie) trafia do dziennika administratora wraz z autorem i notatką.

## 6. Ustawienia platformy

- Tabela `platform_settings` (klucz→wartość) + `GET/PUT /api/admin/settings`.
- Endpoint zwraca **katalog** dozwolonych ustawień (typ, opis, wartości domyślne/zakresy). Zapis
  nieznanych kluczy jest **odrzucany (400)**.
- **Żadne sekrety** (klucze API, hasła SMTP, dane Paynow/Bunny/Gemini) nie są przechowywane ani
  edytowalne przez ten widok — pozostają wyłącznie w zmiennych środowiskowych.

## 7. Import / eksport

- Eksport: lekcje (`/api/admin/export/lessons` — CSV lub JSON), użytkownicy (CSV), płatności (CSV).
- Quizy: eksport (JSON) i **import** (JSON w obie strony).
- Pliki CSV zapisywane z **BOM UTF-8** i cytowaniem zgodnym z RFC 4180, aby Excel poprawnie
  pokazywał polskie znaki i przecinki/cudzysłowy w danych.

## 8. Podgląd treści „jak u ucznia"

- Endpointy `*/api/admin/*/preview`: `topics/:id/preview`, `quizzes/:id/preview`,
  `courses/:id/preview`, `preview/landing` — zwracają treść tak, jak zobaczy ją uczeń, **niezależnie
  od statusu publikacji** (z flagą `preview: true` i `hasAccess: true`).
- Podgląd quizu **nigdy nie ujawnia poprawnych odpowiedzi**.
- Frontend: zakładka *Podgląd* w edytorze lekcji/quizu, przycisk podglądu przy kursie
  (`/courses/:slug?preview=:id`) i przycisk *Podgląd jako uczeń* na stronie głównej (`/?preview=1`),
  z widocznym banerem trybu podglądu (`components/preview-banner.tsx`).

## 9. Bezpieczeństwo i autoryzacja

- Wszystkie nowe endpointy administracyjne są chronione `requireAuth + requireAdmin`; dostęp
  nie-admina zwraca **403**.
- Dostęp do treści jest przyznawany **wyłącznie po stronie serwera** (`user.hasAccess`); front nie
  przyznaje dostępu samodzielnie.
- Gating statusów publikacji obejmuje również trasy AI/postępu/metadanych (nie tylko GET treści),
  z reużyciem helperów z `access.ts`.

## 10. Wyniki kontroli

- Typecheck (root, wszystkie pakiety): **PASS**.
- Testy API (`@workspace/api-server`): **127/127 PASS** (w tym 17 nowych w `tests/task4.test.ts`
  pokrywających kody rabatowe, walidację rabatu, dostępy, ustawienia, eksport i podgląd).
- Build frontendu (`@workspace/physics-platform`, z `PORT`/`BASE_PATH`): **PASS**.
- Migracje: `drizzle-kit push` — **schemat zsynchronizowany** (brak różnic).
- Seed (`@workspace/scripts`): **PASS** (kurs „Łatwa Fizyka", konta admin/uczeń).

## 11. Dokumentacja

- `README.md` — rozszerzony opis panelu administratora o **Kody rabatowe**, **Dostępy**,
  **Ustawienia** (z importem/eksportem) oraz sekcję **Podgląd „jak u ucznia"**.
- `.env.example` — bez zmian: ustawienia platformy są przechowywane w bazie (klucz→wartość) i **nie
  zawierają sekretów**, więc etap nie wprowadza nowych zmiennych środowiskowych. Sekrety nadal
  wyłącznie w `.env`.

## Werdykt

Etap 3/3 zrealizuje całość zakresu warstwy komercyjnej i operacyjnej panelu. Wszystkie kontrole
(typecheck, testy, build, migracje, seed) przechodzą. Projekt domyka się funkcjonalnie i jest gotowy
do dalszego wdrożenia produkcyjnego zgodnie z procedurą z `README.md`.

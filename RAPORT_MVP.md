# Raport końcowy MVP — Platforma Edukacyjna fizyka7

Dokument podsumowuje audyt i wdrożenie zmian zleconych w *START PROMPT* (czyszczenie
prawne/treściowe, rebranding, zmiana cennika, kierunek płatności Paynow oraz audyt MVP),
a także gotowość projektu do komercyjnego uruchomienia.

Stan na: czerwiec 2026.
Stack: React + Vite + TypeScript (frontend), Express 5 + TypeScript (API),
PostgreSQL + Drizzle ORM, Gemini AI (backend), **Paynow (płatności)**, Bunny (wideo,
backend), Excalidraw, Docker.

---

## 1. Przeczytane załączniki

- `START PROMPT` (pełna lista wymagań: prawne, treści, marka, cennik, Paynow Sandbox/BLIK,
  Gemini/Bunny backend-only, README/.env, raport końcowy) — plik
  `attached_assets/Pasted-START-PROMPT-...txt`.
- Wcześniejszy *Audyt Techniczny Kodu MVP v2* (blokery P0/P1) — uwzględniony i nadal zamknięty.

## 2. Sprawdzone obszary i kluczowe pliki

- Frontend treści/marki/cennika: `src/pages/home.tsx`, `components/hero-showcase.tsx`,
  `components/layout.tsx`, `pages/regulamin.tsx`, `pages/privacy.tsx`,
  `pages/payment/success.tsx`, `pages/payment/error.tsx`, `index.html`,
  `public/manifest.webmanifest`.
- Płatności i dostęp (backend): `src/routes/payments.ts`, `src/app.ts`,
  `src/config/env.ts`, `src/lib/access.ts`, `src/routes/courses.ts`, `src/routes/progress.ts`,
  `src/middlewares/auth.ts`, `src/routes/admin.ts`.
- Baza/Schemat: `lib/db/src/schema/payments.ts`, migracje `lib/db/drizzle/*`.
- Kontrakt API: `lib/api-spec/openapi.yaml` (+ wygenerowani klienci).
- Konfiguracja: `.env.example`, `docker-compose.yml`, `README.md`, `replit.md`.
- Seed kursu: `scripts/src/seed.ts`, `scripts/src/course-data.ts`, `scripts/data/bunny-videos.json`.
- Testy: `artifacts/api-server/tests/*` + `tests/helpers/*`.

## 3. Podsumowanie zmian treściowych

- Nowy tekst sprzedażowy hero (rozbity na dwa akapity).
- FAQ przepisane: usunięto pytanie „Czy płatność jest bezpieczna?” i komunikację o karcie;
  metody płatności opisane jako **BLIK / Paynow**.
- Usunięto telefon jako rekomendowane urządzenie w FAQ.
- Z listy „Co jest w programie” usunięto ostatnią pozycję (zgodnie z punktem 3.5 promptu).

## 4. Podsumowanie zmian prawnych

- Usunięto wszystkie claimy o MEN / „Program zgodny z MEN” / „Zgodność z MEN” / „wymogi MEN”
  oraz o „pełnej zgodności z podstawą programową” (home, trust strip, karty dla rodziców,
  regulamin, polityka prywatności).
- Usunięto komunikaty o dostępie rocznym: „Dostęp na rok”, „365 dni”, „/ rok”, „na rok”
  (hero, FAQ, cennik, karta rodzica, mobilne CTA, strona sukcesu, regulamin).
- Weryfikacja: `rg` po `artifacts/physics-platform/src` nie zwraca żadnego z zakazanych
  zwrotów (MEN, podstawa programowa, 365, /rok, „dane karty”, „Czy płatność jest bezpieczna”).

## 5. Podsumowanie zmian UX/UI

- Rebranding **FizykaAI → fizyka7** w całym UI (nagłówek, hero wraz z domeną, stopka,
  mobilne CTA, regulamin, polityka), tytuł strony, meta i manifest PWA.
- Konwencja marki: „fizyka7” w środku zdania, „Fizyka7” na początku zdania.
- Strony `payment/success` i `payment/error` zaktualizowane (komunikaty bez karty/roku,
  obsługa błędu z możliwością ponowienia).
- Zachowana responsywność (Tailwind sm/md/lg) i dolna nawigacja mobilna z prior audytu.

## 6. Podsumowanie zmian płatności (Paynow zamiast P24)

Integracja P24 została zastąpiona Paynow (konsultacja architektoniczna wykonana przed wdrożeniem):

- **Tworzenie płatności po stronie serwera**: `POST ${PAYNOW_API_URL}/v1/payments`
  z nagłówkami `Api-Key`, `Signature` (HMAC-SHA256, base64 z surowego body) oraz
  `Idempotency-Key = paynow-payment-{id}`. `paymentId` zapisywany w `providerPaymentId`.
- **Redirect** do bramki zwracany przez backend (frontend nie zawiera sekretów płatności).
- **Webhook server-server**: weryfikacja nagłówka `Signature` względem surowego body
  (`crypto.timingSafeEqual`). `app.ts` przechwytuje `rawBody` wyłącznie dla
  `/api/payments/webhook`.
- **Mapowanie statusów**: `CONFIRMED → completed` + nadanie dostępu; `NEW/PENDING → ack`;
  pozostałe → `failed`. Status `completed` nigdy nie jest cofany. Powiązanie `externalId`
  z lokalnym `id` oraz zgodność `providerPaymentId`.
- **Idempotencja** po stronie tworzenia i webhooka (brak podwójnego nadania dostępu).
- **Odrzucona płatność nie odblokowuje lekcji** — dostęp tylko po `completed`.
- **Separacja env**: `PAYNOW_ENV=sandbox|production` dobiera domyślne URL-e; mock dostępny
  wyłącznie w `dev`/`test` (nigdy w produkcji).
- **Brak hardcodowanych kluczy** — `PAYNOW_API_KEY` / `PAYNOW_SIGNATURE_KEY` wyłącznie z env.

## 7. Podsumowanie zmian backendu

- `env.ts`: blok `paynow{apiKey, signatureKey, env, apiUrl, returnUrl, notificationUrl}`
  + `isPaynowConfigured()`. Cena kursu `coursePriceGrosz = 3500`, stara cena
  `courseOldPriceGrosz = 9000`. W produkcji brak wymaganych zmiennych = świadome zatrzymanie
  startu (bez cichego fallbacku); Paynow/Gemini/Bunny/SMTP bramkowane `isXConfigured`.
- `GET /payments/price` zwraca `{ price: 3500, currency: "PLN", oldPrice: 9000 }`.
- Ochrona treści płatnych nadal w pełni serwerowa (`requireTopicAccessOrPreview`,
  `userHasCourseAccess`); panel admina globalnie chroniony `requireAuth + requireAdmin`.

## 8. Podsumowanie zmian frontendu

- Cennik: stara cena **90 zł/mies. przekreślona** → nowa **35 zł/mies.**; „/ rok” → „/mies.”
  w karcie cennika i mobilnym CTA. Cena pobierana z `GET /payments/price` (spójność z backendem).
- Strony płatności i treści marketingowe zgodne z nową marką i metodami BLIK/Paynow.

## 9. Podsumowanie zmian bazy danych

- `payments.provider` — domyślna wartość `przelewy24 → paynow`.
- Wygenerowano migrację (`drizzle generate`) i wypchnięto na bazę dev (`drizzle push`).
  Migracja przy okazji domknęła wcześniejszy dryf schematu (m.in. `lesson_images`,
  `video_progress`, `topics.is_preview`, `sections.bunny_collection_id`,
  `videos.bunny_title/sort_order`) — to elementy istniejące już w źródle schematu.

## 10. Podsumowanie zmian env / Docker / README

- W lockstep zaktualizowano: `env.ts`, `.env.example`, `docker-compose.yml`, `README.md`,
  `replit.md`, helper testowy `tests/helpers/env.ts` (zmienne `PAYNOW_*`) oraz
  `openapi.yaml` (kształt `WebhookInput` zgodny z Paynow: `externalId/paymentId/status/modifiedAt`).
- README opisuje Paynow (sandbox i produkcję) zamiast P24 jako jedynego operatora; klucze
  jako puste placeholdery.

## 11. Wyniki testów

| Test | Komenda | Wynik |
|------|---------|-------|
| Typecheck | `pnpm run typecheck` | ✅ czysty (całe monorepo) |
| Testy jednostkowe/integr. | `pnpm --filter @workspace/api-server test` | ✅ **49/49** na realnym PostgreSQL |
| Build API | `pnpm --filter @workspace/api-server build` | ✅ przechodzi |
| Build frontend | `PORT=… BASE_PATH=… pnpm --filter @workspace/physics-platform build` | ✅ przechodzi |
| Migracje + seed | `pnpm --filter @workspace/db generate/push`, seed | ✅ baza dev zaktualizowana |
| Paynow Sandbox (live) | — | ⛔ wymaga kluczy (patrz §17) |

Uwaga (zgodnie z wymogiem „nie udawaj, że test przeszedł”):
- **Docker** (`docker compose up -d --build`) nie był uruchamiany w tym środowisku Replit
  (brak demona Docker). Komenda do uruchomienia u właściciela: `docker compose up -d --build`,
  następnie sprawdzenie `/api/healthz`, frontendu i healthchecków.
- **Build całego monorepo** (`pnpm run build`) kończy się błędem **tylko** w artefakcie
  `mockup-sandbox` (narzędzie deweloperskie Canvas, spoza produktu fizyka7; wymaga zmiennej
  `PORT` w czasie ładowania configu). Oba artefakty produktu (API, frontend) budują się czysto.

## 12. Wyniki testów BLIK

- BLIK `111 111` (sukces) oraz `333 333` (błąd autoryzacji): **niewykonane na żywo** —
  blokada: brak `PAYNOW_API_KEY` i `PAYNOW_SIGNATURE_KEY` w środowisku (sekrety dostarcza
  właściciel). Kod jest gotowy: po uzupełnieniu sekretów scenariusze z §8 promptu są
  wykonywalne end-to-end (create → bramka → BLIK → webhook → weryfikacja podpisu → status →
  nadanie/utrzymanie blokady dostępu).
- Pokrycie automatyczne potwierdza logikę niezależnie od bramki (`payments-webhook.test.ts`):
  weryfikacja podpisu HMAC webhooka (brak/niepoprawny/niezgodny `paymentId` → 400),
  mapowanie statusów (`CONFIRMED` → `completed` + dostęp; `PENDING` → bez dostępu;
  `REJECTED` → `failed` + brak odblokowania), idempotencja (powtórny `CONFIRMED` = jeden
  aktywny grant) oraz brak dostępu przed płatnością (403) i dostęp po `completed` (200).
  To odzwierciedla scenariusze BLIK sukces/błąd na poziomie logiki serwera — brakuje
  wyłącznie wykonania na żywo przez bramkę Paynow (blokada: sekrety).

## 13. Potwierdzenie usunięć

Potwierdzono usunięcie (weryfikacja `rg` po `src` = brak trafień):
„Program zgodny z MEN”, „Zgodność z MEN”, „Dostęp na rok”, „365 dni”, FAQ „Czy płatność
jest bezpieczna?”, komunikacja o karcie, telefon jako rekomendowane urządzenie, „FizykaAI/fizyka ai”.

## 14. Potwierdzenie ceny

- Stara: **90 zł/mies. (przekreślona)** — `courseOldPriceGrosz = 9000`.
- Nowa: **35 zł/mies.** — `coursePriceGrosz = 3500`.
- Backend, frontend i `GET /payments/price` spójne (3500 groszy / 9000 groszy).

## 15. Sekrety tylko w env

Wszystkie klucze (Paynow, Bunny, Gemini, JWT) wyłącznie w env/sekretach; brak hardcodów.
W produkcji `env.ts` wymusza obecność krytycznych zmiennych.

## 16. Brak kluczy API w bundlu frontendu

Audyt frontendu: jedyne użycie env to `import.meta.env.BASE_URL`. Brak `VITE_`-sekretów,
brak referencji do GEMINI/BUNNY/PAYNOW kluczy. Gemini i Bunny działają wyłącznie po backendzie.

## 17. Rzeczy wymagające decyzji / danych właściciela

1. **`PAYNOW_API_KEY` + `PAYNOW_SIGNATURE_KEY`** (sandbox) — wymagane do testów BLIK na żywo
   (`111 111` / `333 333`). Po dostarczeniu integracja jest gotowa do testu end-to-end.
2. **`GEMINI_API_KEY`** — do działania modułu AI (backend).
3. **Bunny** (`BUNNY_*`) — do odtwarzania wideo w produkcji.
4. **`PAYNOW_NOTIFICATION_URL`** — publiczny URL webhooka w produkcji (po wyborze domeny).

## 18. Rekomendacje po wdrożeniu

- Rotacja wszystkich sekretów po wdrożeniu (jeśli jakikolwiek klucz pojawił się wcześniej
  w treści/promptach — potraktować jak wyciek i zrotować).
- Konsultacja prawna regulaminu i polityki prywatności po zmianach treści.
- Konfiguracja produkcyjna Paynow (`PAYNOW_ENV=production` + produkcyjne klucze i URL-e).
- Uzupełnienie warstwy E2E (Playwright) dla przepływów UI jako kolejna iteracja.

---

## Werdykt

Wszystkie zmiany z priorytetów 1–3 promptu zostały wdrożone: brak ryzykownych prawnie
claimów, marka **fizyka7**, spójna cena **35 zł/mies.** ze starą **90 zł** przekreśloną,
kierunek płatności **Paynow** (serwerowe tworzenie, webhook z weryfikacją podpisu,
idempotencja, separacja sandbox/produkcja, dostęp tylko po potwierdzeniu), sekrety poza
frontendem, poprawna struktura kursu (1 kurs, 3 działy, 21 lekcji, 14 quizów, 34 PNG, wideo
Bunny). Typecheck, testy (49/49) i buildy produktu są zielone. Jedyny otwarty punkt to
testy BLIK na żywo — zablokowane wyłącznie brakiem sekretów Paynow po stronie właściciela.

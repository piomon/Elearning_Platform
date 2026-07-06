# Migracje treści (content migrations)

Jednorazowe **transformacje danych** treści e-learningu (np. masowa poprawka
pól, rozbicie jednej lekcji na dwie, ujednolicenie slugów). Uruchamiane na VPS
**po** imporcie treści, w kroku `content:migrate`.

To **nie** są migracje schematu bazy. Migracje schematu (zmiany kolumn/tabel)
żyją w `lib/db/drizzle/*.sql` i obsługuje je `drizzle-kit migrate` (alias
`pnpm db:migrate`).

## Jak to działa

- Każda migracja to jeden plik `NNNN-krotki-opis.ts` w tym katalogu.
- Pliki uruchamiane są **w kolejności leksykograficznej** — stąd prefiks
  numeryczny (`0001-`, `0002-`, …).
- Dziennik zastosowanych migracji trzyma tabela `content_migrations`
  (kolumna `name` jest unikalna). Migracja o danej nazwie stosowana jest
  **dokładnie raz** — wiersz zapisywany jest dopiero po udanym `up()`.
- `up()` działa **w transakcji**. Błąd = pełny rollback i brak wpisu w dzienniku
  (przy następnym uruchomieniu migracja spróbuje ponownie).
- Suma kontrolna pliku jest zapisywana. Jeśli po zastosowaniu ktoś zmieni plik,
  `content:migrate` wypisze ostrzeżenie (ale nie uruchomi migracji ponownie) —
  **nigdy nie edytuj zastosowanej migracji; utwórz nową.**

## Kontrakt pliku migracji

```ts
// scripts/content-migrations/0001-przyklad.ts
export const name = "0001-przyklad"; // opcjonalne; domyślnie = nazwa pliku bez rozszerzenia

export async function up({ tx, db, schema }) {
  // Używaj `tx` do zapisów (transakcja). Zwróć dowolne detale do dziennika.
  const { topics } = schema;
  const rows = await tx.select().from(topics);
  // ...transformacja...
  return { przetworzono: rows.length };
}
```

## Uruchomienie

```bash
pnpm content:migrate            # zastosuj oczekujące migracje
pnpm content:migrate -- --dry-run   # pokaż, co zostałoby zastosowane (bez zapisu)
```

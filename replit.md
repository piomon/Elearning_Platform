# FizykaAI — Platforma Edukacyjna AI

Polska platforma edukacyjna (LMS) z treściami z fizyki, sprawdzaniem zadań przez AI
(Gemini), quizami, wideo (Bunny) i tablicą Excalidraw. Dostęp do kursów płatny przez
Przelewy24.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/physics-platform run dev` — run the frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages (run before finishing)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/api-server test` — run integration tests (needs a real Postgres; harness builds `<db>_test`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env (dev): `DATABASE_URL`. Production requires the full set — see `README.md` env table and `artifacts/api-server/src/config/env.ts`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind, wouter (routing), TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- AI: Gemini; Video: Bunny; Payments: Przelewy24 (P24)
- Deploy: Docker Compose + Traefik (Let's Encrypt)

## Where things live

- API contracts (source of truth): `lib/api-spec/openapi.yaml` → regenerate clients after edits.
- Env contract (source of truth): `artifacts/api-server/src/config/env.ts`.
- API routes: `artifacts/api-server/src/routes/` (auth, payments, progress, admin, quizzes, ai).
- Frontend pages: `artifacts/physics-platform/src/pages/`; shared layout in `src/components/layout.tsx`; mobile bottom nav in `src/components/mobile-nav.tsx`.
- Auth guards (frontend): `src/hooks/use-auth.tsx` (ProtectedRoute / AccessRoute / AdminRoute).
- Integration tests: `artifacts/api-server/tests/`.
- MVP status report: `RAPORT_MVP.md`.

## Architecture decisions

- Access / progress / payment are server-authoritative. The client never grants access, never marks completion, and never sends `courseId`/`sectionId` for progress (derived server-side from `topicId`).
- Payment success uses status `"completed"` (not `"paid"`). Access is gated only by server `user.hasAccess`.
- Dev/test-only routes (e.g. `POST /payments/mock-complete/:id`) are gated by `config.isDev || config.isTest` and verify ownership.
- In production, `env.ts` hard-fails on missing required env vars instead of using silent fallbacks.

## User preferences

- Work autonomously through the full scope in a sensible order; no TODOs, no fake tests, no client-trusted access/progress/payment, secrets backend-only, no hardcoded `courseId`.

## Gotchas

- Always `pnpm run typecheck` at the repo root before finishing. Never set the root `packageManager` field.
- After editing `lib/api-spec/openapi.yaml`, run codegen — typed hooks only exist for endpoints in the spec (`customFetch` is not exported from the react client index).
- Tests need a real Postgres; routes are mounted under `/api`. Use `zod/v4`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

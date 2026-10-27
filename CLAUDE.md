# Träning – project rules for Claude

Personal training PWA. Owner is Swedish-speaking; talk to the owner in Swedish. **All user-facing text is Swedish. Code, comments and identifiers are English.** Docs in `docs/` are Swedish.

## Commands
```bash
npm run lint && npm run typecheck && npm test && npm run build   # = npm run check
npm run test:db          # migrations + RLS/RPC tests against local Postgres (see README)
npm run db:types         # regenerate src/data/database.types.ts after any migration
node e2e/smoke.mjs       # phone + desktop screenshots against the mocked API
```
Run `npm run check` and `npm run test:db` before every commit that touches code or SQL.

## Architecture (see docs/ARCHITECTURE.md)
| Layer | Path | Rules |
|---|---|---|
| Domain | `src/domain/` | Pure TS. No React, Supabase, DOM or fetch (ESLint-enforced). All business rules live here: progression, PBs, volume, statistics, validation, import parsing. Unit-tested. |
| Data | `src/data/` | The only place that talks to Supabase. Thin functions + TanStack Query hooks. Errors become `DataError` with Swedish messages. |
| UI kit | `src/ui/` | Design tokens are in `src/styles.css`; reuse components, don't invent new colours. |
| Features | `src/features/<area>/` | Screens and feature components. Call data hooks and domain functions; never compute statistics inline. |
| DB | `supabase/migrations/` | Versioned SQL. Never edit an applied migration; add a new one. |

## Hard rules
- **Security first** (docs/SECURITY.md): every table in `public` has RLS; writes are owner-only, reads are owner-only except the member-shared tables listed in docs/SECURITY.md → Delning (templates, custom exercises, member names) — never widen sharing without the owner's decision; `anon` has no access; new tables need grants for `authenticated` only and must be added to `supabase/tests/rls.test.ts` (the test fails if a table is missing). Use `(select auth.uid())` in policies. Child tables use composite FKs `(parent_id, user_id)`. Client-callable functions are `security invoker`; `security definer` only for triggers, with `set search_path = ''`, and revoke execute from API roles.
- Never put the service role key or any secret in the frontend, `VITE_` variables or the repo. Assume the repo is public.
- No public sign-up. No public storage buckets for health data.
- History is immutable by design: performed exercises snapshot the exercise name/category; activities snapshot the template name. Never make history depend on library or template rows.
- Statistics: one implementation in `src/domain/stats.ts`. Never fabricate or spread historical totals over dates. Follow the rules in docs/TRAINING_MODEL.md.
- The app must never claim data is saved before the server confirmed it (see `SyncQueue`). No offline write queue in v1.
- After a migration: `npm run db:types`, update docs/DATABASE.md, add tests to `supabase/tests/rls.test.ts`.
- TypeScript strict, no `any`/`@ts-ignore`. No new dependencies without the owner's approval.
- Keep the daily flow minimal: as few taps as possible, ≥44 px targets, no needless modals or confirmations (prefer undo).
- Out of scope for v1 (docs/PRODUCT.md): AI coach, diet, native Watch app, live HR, GPS, social, payments, gamification, medical analysis.

## Working method
Plan briefly, implement in small verified steps, update docs when behaviour changes, and report clearly what is implemented vs planned. Prefer doing small changes directly over spawning agents; when delegating, give each agent a narrow scope and non-overlapping files.

# Träning – personlig träningsplattform

Mobilanpassad webbapp (PWA) för strukturerad träning: gym i första hand, plus fotboll, löpning och promenader i samma system. Byggd med React, TypeScript, Vite, Tailwind CSS och Supabase (Postgres, Auth, RLS).

> Öppna appen → välj pass → träna → klicka av set → sparas automatiskt → se utvecklingen.

## Status

Version 1 (fas 1–6) är implementerad. Se [docs/ROADMAP.md](docs/ROADMAP.md) för vad som är gjort, vad som återstår före driftsättning och vad som är planerat.

## Kom igång lokalt

Krav: Node 20+ (CI kör 22). För databastesterna behövs PostgreSQL 15+ och `psql`, eller Supabase CLI med Docker.

```bash
npm install
cp .env.example .env.local      # fyll i Supabase-URL och anon/publishable key
npm run dev                      # http://localhost:5173
```

### Supabase-projekt (en gång)

1. Skapa ett projekt på supabase.com (region t.ex. `eu-north-1`, Stockholm).
2. Kör migrationerna: `npx supabase link --project-ref <ref>` och sedan `npx supabase db push`. Alternativt klistrar du in filerna i `supabase/migrations/` i SQL Editor i ordning.
3. **Auth → Providers → Email:** stäng av *Allow new users to sign up*. Slå på *Confirm email*. Sätt minsta lösenordslängd till 12.
4. **Auth → Users → Add user:** skapa ditt konto (e-post + lösenord). Profilen skapas automatiskt.
   **Bjuda in en vän:** *Auth → Users → Invite user* med vännens e-post. Länken i mejlet öppnar appen, där vännen väljer namn och lösenord. Se till att appens adress finns under *Redirect URLs*.
5. **Auth → URL Configuration:** sätt *Site URL* till produktions-URL:en och lägg till preview-URL:er under *Redirect URLs*.
6. Kopiera *Project URL* och *anon/publishable key* (Settings → API) till `.env.local` och till Vercel.

Detaljer och checklista: [docs/SECURITY.md](docs/SECURITY.md).

## Kommandon

| Kommando | Vad |
|---|---|
| `npm run dev` | Utvecklingsserver |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (strict) för app, tester och verktyg |
| `npm test` | Enhetstester: domänlogik, statistik, progression, import, autosparning |
| `npm run test:db` | Migrationer + RLS- och RPC-tester mot en riktig Postgres |
| `npm run db:types` | Generera `src/data/database.types.ts` från migrationerna |
| `npm run db:types:check` | Misslyckas om typerna inte matchar schemat (körs i CI) |
| `npm run build` | Typkontroll + produktionsbygge |
| `npm run check` | lint + typecheck + test + build |
| `node e2e/smoke.mjs` | Skärmdumpar och klickflöden på iPhone och desktop mot ett mockat API |

`npm run test:db` skapar en tom databas `training_test` via `DATABASE_ADMIN_URL` (standard `postgres://postgres:postgres@localhost:5432/postgres`), laddar en minimal Supabase-auth-shim och kör alla migrationer. Den rör aldrig ett riktigt Supabase-projekt.

## Driftsättning

### GitHub Pages (används nu)
Workflow `.github/workflows/pages.yml` bygger och publicerar vid varje push till `main`. Appen ligger på `https://ryngmarks.github.io/traningapp/`.

Engångsinställningar i GitHub (repot måste vara publikt, eller kräva GitHub Pro):
1. **Settings → Pages → Source:** *GitHub Actions*.
2. **Settings → Secrets and variables → Actions → Variables:** `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` (publishable/anon key, aldrig service role).
3. Supabase **Auth → URL Configuration:** Site URL `https://ryngmarks.github.io/traningapp/`.

Pages kan inte sätta egna HTTP-headers, så CSP och frame-skyddet i `vercel.json` gäller bara på Vercel. Datan skyddas av RLS oavsett värd.

### Vercel (alternativ)

1. Importera GitHub-repot i Vercel. Framework: Vite. Build: `npm run build`. Output: `dist`.
2. Miljövariabler: `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY`, separata värden för *Production* och *Preview/Development* (gärna ett separat Supabase-projekt för utveckling).
3. `vercel.json` sköter SPA-routing och säkerhetsheaders (CSP, frame-deny m.m.).
4. Lägg till Vercel-domänen i Supabase *Auth → URL Configuration*.
5. Installera på iPhone: öppna sidan i Safari → Dela → *Lägg till på hemskärmen*.

Lägg **aldrig** service role-nyckeln i en `VITE_`-variabel eller i repot. Frontend behöver den inte.

## Dokumentation

- [docs/PRODUCT.md](docs/PRODUCT.md): vision, principer och scope för version 1
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): lager, mappar, dataflöde och designsystem
- [docs/DATABASE.md](docs/DATABASE.md): datamodell och modellbeslut
- [docs/SECURITY.md](docs/SECURITY.md): auth, RLS, rättigheter och checklista
- [docs/TRAINING_MODEL.md](docs/TRAINING_MODEL.md): pass, set, progression och statistikregler
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): import, datakällor och framtida Apple Health
- [docs/ROADMAP.md](docs/ROADMAP.md): status och nästa steg
- [CLAUDE.md](CLAUDE.md): tekniska regler för AI-assisterad utveckling

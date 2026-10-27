# Arkitektur

## Översikt
```
Browser (React PWA)  ──supabase-js (HTTPS, JWT)──▶  Supabase
  src/features  (skärmar)                            ├─ Auth (e-post + lösenord, ingen självregistrering)
  src/ui        (designsystem)                       ├─ PostgREST → Postgres (RLS på alla tabeller)
  src/data      (enda vägen till Supabase)           └─ RPC-funktioner (security invoker)
  src/domain    (ren affärslogik)
```
Ingen egen backendserver. Det som måste ske atomärt (starta/avsluta pass, spara mall, import) körs som Postgres-funktioner med anroparens rättigheter, så att RLS alltid gäller.

## Lager
| Lager | Ansvar | Får importera |
|---|---|---|
| `src/domain` | Progression, personbästa, volym, statistik, datum, formatering, validering (zod), importtolkning, setlogik | Bara `zod` och andra domänfiler |
| `src/data` | Supabase-klient, queries, mutationer, React Query-hooks, felöversättning | domain, supabase-js, react-query |
| `src/ui` | Tokens och komponenter: Button, Card, Stat, Sheet, Field, States, Toast, Icon och diagram (`ui/charts`) | domain (för etiketter) |
| `src/features` | Skärmar per område (overview, train, workout, activity, stats, settings, auth) | allt ovan |
| `src/app` | App, routing, skal, auth-grind | allt |

ESLint stoppar att domänlagret importerar React, Supabase eller UI.

## Viktiga flöden

### Aktivt gympass
1. `start_workout(template_id)` skapar en aktivitet med `status = in_progress` och planerade set, förifyllda med senaste genomförda värden. Ett unikt index tillåter bara ett pågående pass per användare.
2. `useWorkoutSession` håller passet i minnet. Varje set sparas via `SyncQueue`:
   - set-id genereras i klienten, och sparning är `upsert` på id, så en omsändning kan aldrig skapa dubbletter
   - ändrade värden debouncas (600 ms), medan klar/ångra skickas direkt
   - skrivningar per set serialiseras, och senaste värdet vinner
   - fel visas per set och i en banner, med försök igen manuellt eller automatiskt när nätet kommer tillbaka
   - `beforeunload` varnar om något är osparat
3. Omladdning: passet hämtas från databasen (`useActiveWorkout`) och fortsätter där det var.
4. `finish_workout` tömmer först kön och vägrar avsluta om något är osparat. Därefter tas ej utförda set bort, och status blir `completed`.

### Statistik
All räkning sker i `src/domain/stats.ts`. Data hämtas en gång (alla aktiviteter, några tusen rader för en person) och räknas i klienten. Översikt och Statistik använder samma funktioner. Reglerna finns i [TRAINING_MODEL.md](TRAINING_MODEL.md).

### Felhantering
`toDataError` översätter Postgres-, PostgREST- och nätverksfel till svenska meddelanden och avgör om ett nytt försök kan hjälpa. Queries gör högst två nya försök, och bara vid fel där det är meningsfullt. Varje skärm har laddnings-, tom-, fel- och klartillstånd.

## Designsystem
- Tokens i `src/styles.css` (`@theme`): ytor (`bg`, `surface`, `raised`, `sunken`), linjer, text (`fg`, `muted`, `faint`), en accent (`accent`, lime) samt status- och aktivitetsfärger för diagram.
- Typografi: systemets SF Pro på iPhone, tabulära siffror (`.tabular`) för vikter och statistik.
- Klickytor på minst 44 px (klarknappen för set är större). Safe-area-utilities `pt-safe` och `pb-safe`.
- Animationer: `animate-fade-in`, `animate-slide-up` och `animate-pop`, avstängda vid *reduced motion*.
- Diagram: egna, beroendefria SVG-komponenter i `src/ui/charts`.

## Routing
| URL | Skärm |
|---|---|
| `/` | Översikt |
| `/traning` · `/traning/pass` · `/traning/mallar/:id` · `/traning/ovningar` | Träna, aktivt pass, mallredigering, övningsbibliotek |
| `/aktivitet` · `/aktivitet/ny?typ=` · `/aktivitet/:id` | Lista, snabbregistrering, detalj |
| `/statistik` · `/statistik/ovning/:id` | Statistik, styrkeutveckling per övning |
| `/installningar` · `/installningar/historik` · `/installningar/import` | Profil, historiska totaler, import |

## PWA
`public/manifest.webmanifest`, ikoner och en minimal service worker (`public/sw.js`) som bara cachar det statiska skalet. API-anrop cachas eller köas aldrig, eftersom komplex offline-synk inte ingår i v1.

## Miljöer
`VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` sätts per miljö i Vercel. Rekommendation: ett Supabase-projekt för utveckling/preview och ett för produktion. Nyckeln i frontend är publik per design; skyddet ligger i RLS.

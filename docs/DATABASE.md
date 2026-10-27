# Databas

PostgreSQL via Supabase. Migrationer finns i `supabase/migrations/` och körs i ordning:

| Fil | Innehåll |
|---|---|
| `…000000_initial_schema.sql` | Enum-typer, tabeller, constraints, index och triggers |
| `…000100_security.sql` | RLS, policies och grants |
| `…000200_functions.sql` | RPC-funktioner och bootstrap av ny användare |
| `…000300_exercise_library.sql` | Globalt övningsbibliotek (38 övningar) |

TypeScript-typerna i `src/data/database.types.ts` genereras från migrationerna (`npm run db:types`), och CI kontrollerar att de är i synk.

## Tabeller
| Tabell | Vad | Nyckel och relationer |
|---|---|---|
| `profiles` | Visningsnamn, tidszon, viktsteg | `id` = `auth.users.id` |
| `exercises` | Globalt bibliotek (`owner_id is null`, `slug`) och egna övningar (`owner_id`) | uuid |
| `workout_templates` | Mallar | uuid, `unique(id, user_id)` |
| `template_exercises` | Övningar i mall: ordning, set, repsintervall, mål-tid/distans | `(template_id, user_id)` → mall |
| `activities` | Alla träningstillfällen: gym, fotboll, match, promenad, löpning, övrigt | uuid, `unique(id, user_id)` |
| `activity_metrics` | Valfria mätvärden 1:1 (distans, steg under passet, snitt-/maxpuls) | `(activity_id, user_id)` → aktivitet |
| `performed_exercises` | Utförd övning (ögonblicksbild av namn, kategori och mättyp) | `(activity_id, user_id)` → aktivitet |
| `performed_sets` | Set: typ (uppvärmning/arbete), vikt, reps, tid, distans, `completed_at` | `(performed_exercise_id, user_id)` → övning |
| `historical_totals` | Totalsummor utan datum, t.ex. 110 gymbesök | uuid |
| `imports` | Logg per import (rader, infogade, dubbletter, fel) | uuid, `unique(id, user_id)` |
| `daily_metrics` | Dagliga steg och vilopuls per källa (förberedd) | `(user_id, date, source)` |
| `heart_rate_samples` | Pulsmätningar som tidsserie (förberedd) | bigint identity, `unique(user_id, source, recorded_at)` |

## Modellbeslut

**En aktivitetstabell för alla sporter.** Gemensamma fält (typ, tid, varaktighet, ansträngning, anteckning, källa) ligger i `activities`. Typade valfria mätvärden ligger i `activity_metrics`. Gymdetaljer ligger i egna tabeller (`performed_exercises`, `performed_sets`). Det ger en tabell att räkna i, utan en tabell per sport och utan EAV (nyckel/värde-tabeller). En ny mätbar egenskap blir en ny kolumn med typ och constraint.

**Ögonblicksbilder för historik.** En utförd övning kopierar namn, kategori och mättyp från biblioteket, och aktiviteten kopierar mallens namn. Att byta namn på en övning, redigera en mall eller ta bort en mall ändrar aldrig gamla pass. `exercise_id` och `template_id` behålls som länkar för progression och sätts till `null` om källan tas bort.

**Ägarskap via sammansatta främmande nycklar.** Varje barnrad har `user_id` och refererar `(parent_id, user_id)`. Databasen kan därför inte koppla en rad till en förälder som ägs av någon annan, oberoende av RLS. Referenser till övningar (som kan vara globala) kontrolleras i RLS-policyn.

**Globalt och eget övningsbibliotek i samma tabell.** Det håller främmande nycklar enkla (en `exercise_id`). Globala rader har `slug` och `owner_id is null`, ändras bara via migrationer och är skrivskyddade för användare enligt RLS. Egna övningar arkiveras (`archived_at`) i stället för att raderas.

**Tid och tidszon.** Alla tidpunkter är `timestamptz` (UTC). Varje aktivitet sparar IANA-tidszonen den loggades i. Triggern `activities_derive` räknar fram `local_date`, som all vecko- och månadsstatistik grupperar på. Ett pass 23.30 UTC i Stockholm hamnar alltså på rätt lokala dag, även efter flytt eller resa. Ogiltiga tidszoner avvisas.

**Idempotens.**
- Set får sitt id i klienten och sparas med `upsert` på id.
- `activities` har `unique(user_id, source, external_id)`, så samma importerade post kan bara landa en gång per källa.
- Ett partiellt unikt index tillåter max ett pågående pass per användare.

**Pass under arbete.** Planerade set sparas direkt när passet startar (förifyllda, `completed_at is null`). Det gör att passet går att återuppta efter omladdning. `finish_workout` tar bort ej utförda set, så historiken bara innehåller utfört arbete.

**Hälsodata hålls isär.** Högfrekventa pulsvärden ligger i `heart_rate_samples`, aldrig i aktivitetstabellerna. Pulssammanfattning per pass ligger i `activity_metrics`. Dagliga steg (`daily_metrics`) skiljs från steg under ett pass (`activity_metrics.steps`). Se räknereglerna i [TRAINING_MODEL.md](TRAINING_MODEL.md).

**Constraints.** Längdgränser på all text, rimliga intervall för vikt, reps, puls, distans och tid, `rep_min ≤ rep_max`, `ended_at ≥ started_at`, och bara gym får vara `in_progress`. Samma gränser valideras i klienten med zod för svenska felmeddelanden.

## RPC-funktioner
| Funktion | Vad |
|---|---|
| `start_workout(template_id?, timezone?)` | Skapar pågående gympass med planerade, förifyllda set. Fel: `active_workout_exists`. |
| `add_performed_exercise(...)` | Lägger till en övning i ett pass (används vid start, tillägg och byte) |
| `finish_workout(activity_id, ended_at?)` | Avslutar och rensar ej utförda set |
| `save_template(id?, name, notes, items)` | Skapar eller uppdaterar en mall med övningslista atomärt |
| `last_performances(exercise_ids[])` | Senast genomförda set per övning |
| `import_activities(source, file_name, rows)` | Validerad, idempotent import (max 5000 rader) |

Alla är `security invoker`. Bootstrap-funktionerna `handle_new_user` och `create_example_templates` är `security definer`, körs bara från triggern på `auth.users` och går inte att anropa via API:t.

## Ändra schemat
1. Ny fil `supabase/migrations/<timestamp>_<namn>.sql`. Ändra aldrig en redan körd migration.
2. RLS, policies och grants för nya tabeller i samma migration.
3. `npm run db:types`, `npm run test:db` och tester i `supabase/tests/rls.test.ts`.
4. Uppdatera det här dokumentet.

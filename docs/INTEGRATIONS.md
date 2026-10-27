# Integrationer och datakällor

## Läget i v1
- Manuell registrering i appen (`source = manual`).
- Import av aktiviteter från **CSV eller JSON** (`import_csv` eller `import_json`) via *Inställningar → Import*.
- Datamodellen har redan `source` och `external_id` på aktiviteter, `daily_metrics` för dagliga steg och vilopuls, och `heart_rate_samples` för pulsserier. De två sistnämnda har ingen skrivväg från klienten ännu.

## Importformat
CSV med rubrikrad, kommatecken eller semikolon som avgränsare. Alternativt JSON som en array, eller `{ "activities": [...] }`.

| Kolumn | Krav | Exempel |
|---|---|---|
| `type` | ja | `gym`, `football_training`, `football_match`, `walk`, `run`, `other`, eller svenska alias: `styrka`, `fotbollsträning`, `match`, `promenad`, `löpning`, `övrigt` |
| `started_at` | ja | `2026-05-01T07:30:00+02:00` (ISO 8601 med offset), eller bara datum `2026-05-01` som tolkas som kl. 12 UTC |
| `timezone` | nej | `Europe/Stockholm` (annars profilens tidszon) |
| `duration_s` | nej | `3600` |
| `distance_m` | nej | `5200` |
| `steps` | nej | steg under aktiviteten |
| `avg_heart_rate`, `max_heart_rate` | nej | 25–250 |
| `perceived_exertion` | nej | 1–10 |
| `title`, `notes` | nej | text |
| `external_id` | rekommenderas | källans id. Saknas det används en hash av typ och starttid. |

**Idempotens:** samma rad (samma källa och `external_id`) kan bara importeras en gång. Att importera samma fil igen lägger inte till något, och dubbletterna redovisas. Ogiltiga rader hoppas över och listas med radnummer.

**Gymimport:** importerade gympass blir aktiviteter utan set. De räknas som gymbesök men påverkar inte styrkestatistiken.

## Apple Health och Apple Watch (framtid)
En webbapp kan inte läsa HealthKit. Appen innehåller därför **ingen** falsk direktintegration. Föreslagen väg:

1. **Steg 1, export och import (inget nytt konto behövs):** exportera från Hälsa-appen, konvertera i en liten lokal eller klientbaserad parser till importformatet ovan, och importera med `source = apple_health`. Workout-UUID används som `external_id`.
2. **Steg 2, liten iOS-komponent:** en Swift-app eller App Intent / Shortcut som läser HealthKit med användarens tillstånd och skickar data till en **Supabase Edge Function** med användarens egen JWT. Funktionen validerar, mappar och upsertar:
   - träningspass → `activities` + `activity_metrics` (`source = apple_health`, `external_id` = HKWorkout UUID)
   - dagliga steg och vilopuls → `daily_metrics` (en rad per dag och källa)
   - puls under pass → `heart_rate_samples` med `activity_id`, glest samplad (t.ex. var 5:e sekund), aldrig i aktivitetstabellen
3. **Matchning mot manuellt loggade pass:** samma typ och överlappande tid (±15 min) markeras som trolig dubblett, och användaren väljer vilken som behålls. Raderas aldrig automatiskt.

### Principer för hälsodata
- Samla bara in det som driver en konkret funktion. Puls och vilopuls tas inte in förrän en vy faktiskt använder dem.
- Skrivningar från integrationer går via en Edge Function med validering, aldrig direkt från en extern tjänst med service role-nyckel.
- Tokens för externa tjänster (om de behövs) sparas krypterat (Supabase Vault) i en tabell utan klientåtkomst.
- Användaren ska kunna radera all data per källa.
- Statistikreglerna för steg och dubbelräkning står i [TRAINING_MODEL.md](TRAINING_MODEL.md).

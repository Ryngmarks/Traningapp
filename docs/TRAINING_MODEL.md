# Träningsmodell

## Begrepp
| Begrepp | Betydelse |
|---|---|
| Övning | Rad i biblioteket: kategori, muskler, utrustning, kort instruktion och mättyp |
| Mättyp | `weight_reps` (vikt × reps), `bodyweight_reps` (reps, valfri extravikt), `duration` (sekunder), `distance` (meter), `cardio` (konditionsmaskin: tid i minuter, km, km/h, lutning %, kcal; tid *eller* distans räcker för att klicka av, resten är valfritt) |
| Mall | Namngivet pass med ordnade övningar: uppvärmningsset, arbetsset, repsintervall eller mål-tid/distans, vila |
| Aktivitet | Ett träningstillfälle av valfri typ. Ett gympass är en aktivitet med utförda övningar och set. |
| Set | `warmup` eller `working`. Räknas som utfört när `completed_at` är satt. |

## Gympass
- **Starta:** från mall (övningar och plan kopieras) eller som fritt pass. Planerade set förifylls från senaste genomförda pass med samma övning: set *n* får värdena från set *n* förra gången. Utan historik får arbetsset repsintervallets nedre gräns och tom vikt.
- **Klicka av:** ett tryck sparar setet som utfört med de förifyllda värdena. Ett nytt tryck ångrar.
- **Ändra:** varje set kan ändras före och efter att det klickats av.
- **Lägga till:** nytt set kopierar föregående set av samma typ. Uppvärmningsset läggs före arbetsset.
- **Byta eller ta bort övning:** ett byte behåller planen (antal set och repsintervall) men förifyller från den nya övningens historik.
- **Avsluta:** tillåtet även om alla planerade set inte är gjorda. Ej utförda set och övningar utan utförda set tas bort. Avslut nekas medan något är osparat.
- **Släng pass:** raderar det pågående passet helt.
- **Framsteg:** antal utförda arbetsset av planerade.

## Progression (dubbel progression)
Arbeta inom ett repsintervall, t.ex. 3 × 8–12.
1. Senaste passets **arbetsset** bedöms. Uppvärmning räknas inte.
2. Om alla arbetsset nådde intervallets övre gräns med samma vikt föreslås en försiktig ökning: profilens viktsteg (standard 2,5 kg, max 1 kg under 20 kg). Därefter börjar man om på nedre gränsen.
3. Om något set hamnade under nedre gränsen föreslås att behålla vikten.
4. Annars föreslås en rep till (lägsta setet + 1, upp till övre gränsen).
5. För kroppsviktsövningar föreslås fler reps, inte mer vikt. För tid och distans ges inga förslag i v1.

Förslag är **alltid frivilliga**, används bara med ett tryck och appliceras aldrig automatiskt. Appen kan inte bedöma teknik, så användaren avgör. Implementation: `src/domain/progression.ts`.

## Mått
- **Volym** = Σ vikt × reps för utförda arbetsset med vikt.
- **Uppskattat 1RM** (Epley) = vikt × (1 + reps/30), bara för 1–12 reps.
- **Personbästa per övning:** tyngsta set, bästa uppskattade 1RM, flest reps, största volym per pass, längsta tid och längsta distans.
- **Tempo** = varaktighet / distans (min/km).

## Statistikregler
All räkning sker i `src/domain/stats.ts`.

1. **Daterade aktiviteter** räknas i den period som deras `local_date` hamnar i. Veckor börjar på måndag (ISO-veckor).
2. **Pågående pass** räknas inte förrän de avslutats.
3. **Historiska totaler** saknar datum. De räknas bara i vyn *Totalt* och fördelas aldrig över veckor, månader eller år.
4. **Distans:** promenad och löpning summeras var för sig och tillsammans. Historisk distans räknas bara i *Totalt*.

### Historiska totaler och avstämning
En historisk total gäller en aktivitetstyp och har:
- `session_count` (obligatorisk), samt valfri distans och tid
- `covers_until`: sista dagen totalen omfattar (obligatorisk)
- `period_start`: första dagen (valfri, saknas betyder från början)

**Regel mot dubbelräkning:** en daterad aktivitet av samma typ med datum inom `[period_start, covers_until]` antas redan ingå i totalen. I *Totalt* läggs den därför inte till en gång till. I sin egen vecka och månad syns den som vanligt.

**Exempel:** 110 gymbesök till och med 2026-06-30. Senare importeras 20 daterade gympass från juni 2026. *Totalt* visar 110 plus pass efter 30 juni, och juni-statistiken visar de 20 passen.

**Korrigering:**
- Om du importerar äldre pass som *inte* ingick i totalen: flytta `covers_until` bakåt eller ange `period_start`, så att intervallet bara täcker den period totalen gällde.
- Om totalen var fel: redigera `session_count`. Historiken räknas om direkt, eftersom inget lagras aggregerat.
- Vyn för historiska totaler visar hur många daterade aktiviteter varje total täcker.

### Steg
- `daily_metrics.steps` är dagens **alla** steg, inklusive steg under pass.
- `activity_metrics.steps` är steg **under ett registrerat pass**.
- Regel: för en dag med daglig total används bara den dagliga totalen. Passens steg läggs aldrig till ovanpå. För dagar utan daglig total summeras passens steg.
- Rapporterar flera källor samma dag används det högsta värdet. Källorna summeras aldrig.

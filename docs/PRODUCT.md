# Produkt

## Vision
Göra det enkelt att träna strukturerat och följa sin utveckling över tid. Enkel att använda, kraftfull genom den data som sparas.

Gymdelen fungerar för all sorts styrketräning. Ägaren har lång erfarenhet av styrketräning, framför allt överkropp, och fokuserar själv nu på funktionell styrka för fotboll: ben och explosivitet, bål, höft och ljumske, baksida lår, kondition och löpning, återhämtning och kontinuitet. Överkroppsstyrkan ska behållas, men bodybuilding är inte målet.

Appen stödjer träningen, den bestämmer inte. Den ska fungera även veckor med låg energi eller oregelbunden frekvens: inga streaks, inga skuldbeläggande meddelanden och inga tvingande program.

## Principer
1. **Så få tryck som möjligt under passet.** Ett färdigt set med föregående vikt och reps är *ett* tryck.
2. **Ärlig data.** Ingen statistik bygger på påhittade värden. Historiska totaler utan datum fördelas aldrig över veckor.
3. **Aldrig låtsas att något är sparat.** Osparade set syns tydligt, och det går att försöka igen.
4. **Ångra före bekräfta.** Ångra är förstahandsvalet; bekräftelse används bara när något inte kan ångras.
5. **Lugn premiumkänsla.** Mörkt tema, en återhållsam accentfärg, tydlig typografi och få widgets.

## Navigation
Huvudmeny: **Översikt · Träna · Aktivitet · Statistik**. Inställningar, profil, historik och import nås från Översikt (kugghjulet).

## Version 1 (scope)
- Gym: övningsbibliotek (65 övningar i 12 kategorier, från fotbollsstyrka till klassiskt gym) och egna övningar, mallar, aktivt pass med autosparning, återupptagning, uppvärmnings- och arbetsset, byt/lägg till/ta bort övning, avsluta med ofärdiga set, senaste resultat och frivilligt progressionsförslag (dubbel progression).
- Aktiviteter: fotbollsträning, match, löpning, promenad och övrigt, med snabb registrering (datum, tid, ansträngning, distans, tempo, steg, puls, anteckning).
- Historiska totaler (t.ex. 110 gymbesök före appen) med regler mot dubbelräkning.
- Import av aktiviteter från CSV/JSON (idempotent).
- Översikt och statistik (vecka/månad/år/totalt): antal per typ, frekvens, distans, steg, styrkeutveckling, volym och personbästa.
- PWA som kan installeras på iPhone.
- **Delning mellan inbjudna vänner** (beslut 2026-10-27): alla pass (mallar) och egna övningar som någon skapar syns för alla medlemmar under *Träningstips* och i övningsbiblioteket, med skaparens namn. Man kan starta andras pass direkt eller kopiera dem och anpassa. Bara skaparen kan ändra originalet. Loggad träning, vikter, statistik och historik är alltid privat.
- Fyra allmänna startpass för alla: Helkropp A, Helkropp B, Överkropp och Underkropp.

## Inte i version 1
AI-coach, kostregistrering, egen Apple Watch-app, livepuls, GPS-spårning, sociala flöden (att se varandras träning, kommentarer, gilla), betalningar, gamification/achievements och medicinsk eller fysiologisk analys. De finns i [ROADMAP.md](ROADMAP.md) och arkitekturen hindrar dem inte.

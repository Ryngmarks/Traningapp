# Roadmap

## Version 1: implementerad
- [x] **Fas 1, fundament:** schema, migrationer, RLS och grants, RPC-funktioner, säkerhetstester (två användare, SELECT/INSERT/UPDATE/DELETE), typgenerering, CI.
- [x] **Fas 2, grundläggande UI:** designtokens, komponentbibliotek, inloggning, navigation, översikt och övningsbibliotek.
- [x] **Fas 3, gym:** mallar, starta och återuppta pass, logga set med ett tryck, autosparning, senaste resultat, progressionsförslag, avsluta och historik.
- [x] **Fas 4, aktiviteter:** fotboll, match, löpning, promenad, övrigt, historiska totaler och import.
- [x] **Fas 5, statistik:** översikt och statistik från databasen, filter, diagram, styrkeprogression och personbästa.
- [x] **Fas 6, stabilisering:** lint, typecheck, tester, bygge, kontroll på mobil och desktop, dokumentation.

## Återstår före driftsättning (kräver dina konton)
1. Skapa Supabase-projekt (prod, och gärna dev) och kör migrationerna.
2. Gå igenom auth-inställningarna i [SECURITY.md](SECURITY.md) och skapa ditt konto.
3. Koppla repot till Vercel och sätt miljövariablerna.
4. Testa på din iPhone och installera som PWA.
5. Registrera dina 110 historiska gymbesök under *Inställningar → Historik*.

## Kända begränsningar i v1
- Ingen offline-skrivning. Utan nät visas osparade set tydligt och sparas när nätet kommer tillbaka, men appen kan inte startas från noll offline med data.
- Statistiken räknas i klienten. Det fungerar bra upp till några tusen aktiviteter. Därefter bör aggregering flyttas till SQL-vyer eller RPC.
- Vilotimer mellan set finns inte ännu.
- Inga bilder eller illustrationer för övningar (fältet `image_path` finns).
- Inget MFA för appkontot.

## Nästa steg (förslag, i prioritetsordning)
1. Vilotimer med vibration efter avklickat set.
2. Ordna om övningar under pågående pass med dra-och-släpp.
3. TOTP-MFA för kontot.
4. Apple Health-import, steg 1 (exportfil, se [INTEGRATIONS.md](INTEGRATIONS.md)).
5. Belastningsöversikt: veckovolym per kategori (ben, baksida, höft och ljumske …) mot fotbollsbelastning.
6. Övningsbilder i privat Storage-bucket.
7. Server-side aggregering för statistik vid stora datamängder.

## Senare och utanför v1
AI-coach, kost, egen Apple Watch-app, livepuls, GPS, sociala funktioner, betalningar, gamification och medicinsk analys. Arkitekturen hindrar inte detta, men inget av det byggs utan nytt beslut.

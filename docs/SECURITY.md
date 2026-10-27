# Säkerhet

Privat app med personliga tränings- och hälsouppgifter. Utgångspunkten är att repot blir publikt: ingen säkerhet bygger på att koden är hemlig.

## Modell
- **Autentisering:** Supabase Auth med e-post och lösenord. Självregistrering är avstängd, så konton skapas av ägaren i dashboarden. Anonym inloggning är avstängd.
- **Auktorisering:** Row Level Security på **alla** tabeller i `public`. Policies ger bara rollen `authenticated` åtkomst och bara till egna rader (`user_id = (select auth.uid())`). `anon` har inga rättigheter alls på tabeller eller funktioner.
- **Ägarskap i relationer:** barnrader refererar `(parent_id, user_id)` med sammansatta FK, så en rad kan inte kopplas till någon annans förälder. Referenser till övningar kontrolleras i policyn (global eller egen).
- **Minsta rättigheter:** standardrättigheterna Supabase ger `anon` och `authenticated` dras in (`revoke all` och `alter default privileges`). Bara det appen behöver beviljas igen. `profiles` får bara uppdateras i tre kolumner. Globala övningar kan läsas men aldrig skrivas. Hälsotabellerna är skrivskyddade för klienten tills en granskad importväg finns.
- **Funktioner:** API-funktioner är `security invoker` och kör alltså med anroparens RLS. `security definer` används bara i triggern för nya användare, med `search_path = ''` och utan exekveringsrätt för API-roller.
- **Hemligheter:** frontend använder bara projekt-URL och anon/publishable key, som är publika per design. Service role-nyckeln används aldrig i appen och får aldrig finnas i repot eller i en `VITE_`-variabel. `.env*` är gitignorerade, och `.env.example` innehåller bara platshållare.
- **Validering:** zod i klienten, och CHECK-constraints, enum-typer, längdgränser och tidszonskontroll i databasen. Import valideras i båda lagren, med max 5000 rader och 2 MB.
- **Dubbelregistrering:** id genererade i klienten plus `upsert` för set, unik `(user, source, external_id)` för importer och max ett pågående pass.
- **Sessioner:** supabase-js förnyar token automatiskt (rotation påslagen). Utloggning rensar sessionen och all cachad data (`queryClient.clear()`).
- **Webbsäkerhet:** `vercel.json` sätter CSP (bara egen origin och `*.supabase.co`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` och `Permissions-Policy`. React escapar all text. Ingen `dangerouslySetInnerHTML`.
- **Rate limiting och bot-skydd:** Supabase Auth har inbyggd rate limit för inloggning och tokenförnyelse. Eftersom ingen kan registrera sig och det inte finns publika formulär behövs ingen CAPTCHA nu. Slå på CAPTCHA (Turnstile) under *Auth → Bot protection* om inloggningssidan börjar få automatiserad trafik.
- **Storage:** inga buckets används i v1. Privata hälsofiler får aldrig ligga i publika buckets. Framtida filer ska ligga i privat bucket med RLS på `storage.objects` (`owner = auth.uid()`).
- **Framtida integrationer:** tokens för externa tjänster sparas aldrig i klartext i en tabell som klienten kan läsa. Se [INTEGRATIONS.md](INTEGRATIONS.md).

## Tester
`npm run test:db` (`supabase/tests/rls.test.ts`) kör mot en riktig Postgres och verifierar bland annat:
- RLS är på för varje tabell, och testet misslyckas om en ny tabell saknar täckning
- `anon` kommer inte åt någon tabell eller funktion
- användare B kan inte **SELECT**, **INSERT**, **UPDATE** eller **DELETE** användare A:s data i någon tabell
- B kan inte koppla barnrader till A:s föräldrar, använda A:s privata övningar, flytta egna rader till A, starta pass från A:s mall eller avsluta A:s pass
- globala övningar är skrivskyddade
- bootstrap-funktionerna kan inte anropas via API:t

## Checklista före produktionsdata
- [ ] Supabase: *Allow new users to sign up* av, *Confirm email* på, minsta lösenordslängd 12, *Secure password change* på.
- [ ] Supabase: *Site URL* och *Redirect URLs* satta till exakta domäner, inga wildcard i produktion.
- [ ] Supabase: kör *Security Advisor* (Database → Advisors). Inga varningar för RLS eller `search_path` ska finnas.
- [ ] Supabase: MFA för ditt dashboardkonto. Överväg TOTP-MFA för appkontot (roadmap).
- [ ] Vercel: separata variabler för Production och Preview. Ingen service role-nyckel.
- [ ] GitHub: secret scanning och Dependabot alerts på (gratis för publika repon).
- [ ] Backups: Supabase gör dagliga backuper på betalplan. På gratisplanen bör du exportera data regelbundet (`supabase db dump --data-only`).

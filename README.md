This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Ranking the Stars (teamspel)

Spelshow-app op `/rankingthestars` (optioneel ook via een subdomein `rankingthestars.` of `rts.`, zie `middleware.ts`).

- `/rankingthestars`: collega's kiezen per vraag hun top 3 (3, 2 en 1 punt) en vertellen waarom ze hun nummer 1 kozen.
- `/rankingthestars/host`: regiekamer (pincode): wie heeft gestemd, stembus open/dicht, stem resetten.
- `/rankingthestars/show`: de uitslag op het grote scherm (spatie/→ volgende, ← terug, F volledig scherm, M geluid). Met `?demo=1` draait een generale repetitie op nepdata.

Setup op Vercel:

1. Voeg **Upstash Redis** toe aan het project (Storage / Marketplace). Dat zet `KV_REST_API_URL` en `KV_REST_API_TOKEN` (of `UPSTASH_REDIS_REST_URL`/`_TOKEN`). Zonder database worden stemmen alleen tijdelijk bewaard.
2. Zet de env-variabelen en redeploy:
   - `RTS_TEAM_CODE`: teamcode waarmee collega's het spel openen (hoofdletterongevoelig). Zonder teamcode ziet een bezoeker alleen een inlogscherm, geen namen of vragen. Lokaal is de code `sterren`.
   - `RTS_ADMIN_PIN`: pincode voor regiekamer en show. Lokaal is de pincode `1234`.
3. Namen en vragen staan in `lib/rankingthestars/config.ts` (alleen server-side; ze gaan pas na de teamcode naar de browser). Pas alleen `name` aan, laat de `id` staan. Foto's kunnen in `public/rts-photos/`.

## Planner (persoonlijke productiviteits-app)

Taken, agenda en notities op één plek, met elke ochtend een top 3. Staat op `/app` (justinkuijpers.com/app). Kost €0 per jaar: geen AI en geen betaalde diensten.

Vier tabs, plus weekreview en dagafsluiting:

- **Vandaag** (dagplanner):
  - links je top 3 en "Te plannen", rechts je dag in de agenda; op de telefoon wissel je met **Lijst | Dag**
  - sleep taken naar een tijd, of tik op het agenda-icoon
  - **Plan mijn dag** zet je top 3 en wat erbij past in je vrije werktijd: eerst als voorstel, dan Toepassen
  - met ‹ › plan je ook morgen alvast
- **Taken**: één lijst met Inbox / Open / Wachten op / Ooit / Af, filter per gebied en zoeken. Open is gegroepeerd per gebied en project. In de Inbox tik je een taak aan om hem een plek te geven.
- **Week**: werkweek of week op de laptop, 1 of 3 dagen op de telefoon (vegen over de dagkoppen). Op de laptop sleep je taken uit de lade de week in.
- **Agenda bedienen** (in Vandaag en Week):
  - **slepen** verplaatst (ook naar een andere dag)
  - de **onderrand** rekt de duur op, de **bovenrand** verschuift het begin
  - **slepen op een lege plek** (of dubbelklikken) maakt een nieuw blok
  - **het rondje** in een blok vinkt af; **klikken** opent snel duur, focus, uit de agenda en details
  - op de telefoon: **lang drukken** om op te pakken, **tikken** om te selecteren (dan verschijnen grepen om op te rekken), **tik op een lege plek** voor een nieuw blok
  - toetsen op een geselecteerd blok: ↑/↓ 15 min, Shift+↑/↓ duur, ←/→ dag, spatie afvinken, ⌫ uit de agenda
  - alles kan terug met **Ongedaan maken** of **⌘Z**
- **Google Agenda**: ingeplande taken komen als afspraak in een eigen agenda **Planner** in Google (ook verplaatsen, oprekken en afvinken). Bij een afspraak zie je Deelnemen (Meet/Teams), Open in Google Agenda en "Voorbereiden als taak".
- **Notities**: een lijst met zoeken, vastpinnen en gebieden. Notities slaan vanzelf op. Met **Dagnotitie** open je in één tik de notitie van vandaag. Regels die beginnen met `[ ]` zet je met één knop om in taken (ze worden daarna `[→]`). `- ` en `[ ] ` lopen door als lijstje.
- **Weekreview**: hoeveel dagen je de top 3 haalde (doel 4 van 5), hoeveel dagen je afsloot met een lege inbox, per gebied wat af is, wat open staat en hoeveel focustijd erin zat, en wat blijft liggen. Je focus voor volgende week sla je op als notitie.
- **Dag afsluiten**: inbox naar nul, vandaag afronden (de rest schuift door), en na 3× doorschuiven kiezen: doen, inplannen, ooit of schrappen.
- **Focus-timer**: 25/50/90 minuten op een taak, met een balk onderin of een volledig scherm. De gewerkte minuten tellen op per taak.
- **Zoeken overal**: `⌘K` of `/` zoekt in taken en notities en springt naar elk scherm. `N` voegt overal een taak toe.

### Snelle invoer

Typ een gewone zin, bijv. `Offerte Jansen vrijdag, Appèl, half uur`. De parser (`lib/taken/parse.ts`) herkent:

- **dagen**: vandaag, morgen, vrijdag, volgende week (dinsdag), deze week, eind van de maand, 16 okt, 16-10, over 3 dagen
- **harde deadline**: `uiterlijk`, `deadline` of `voor` ervoor, of `!` aan het eind
- **tijd**: 5 min, kwartier, half uur, 2u, halve dag
- **gebied**: als los stukje tussen komma's of als `#tag`; `#appel/leadgeneratie` zet ook het project
- **impact**: `!!`, `#hoog`, `, belangrijk,`
- **lijsten**: `wachten op Piet`, `ooit`
- **plandag**: `@morgen`
- **herhalen**: `elke maandag`, `elke werkdag`, `om de 2 weken op zaterdag`, `maandelijks`, `elke 3 dagen`

Bij een terugkerende taak staat de volgende keer klaar zodra je hem afvinkt. Meerdere taken tegelijk kan met een nieuwe regel, `;` of "en daarnaast". De microfoonknop gebruikt de spraakherkenning van je browser.

### Setup op Vercel

1. `TAKEN_PASSWORD`: wachtwoord voor de app. Lokaal is het `taken`.
2. Opslag gebruikt dezelfde Upstash Redis als Ranking the Stars (`KV_REST_API_URL`/`_TOKEN`, gratis tier). Zonder Redis gaat alles in een tijdelijk bestand dat op Vercel niet bewaard blijft.
3. Agenda's koppel je in de app zelf: **Instellingen** (zijbalk, of het tandwiel in Agenda).
   - **Outlook**: plak de ICS-link. In Outlook op het web vind je die via Instellingen → Agenda → Gedeelde agenda's → "Een agenda publiceren" → "Kan alle details bekijken" → ICS-link. Ontbreekt die optie bij Appèl, dan heeft IT publiceren uitgezet.
   - **Google Agenda**: klik "Koppel Google Agenda". Daarvoor is eenmalig een eigen (gratis) Google-client nodig, zie hieronder.

### Eenmalig: Google-koppeling instellen (Workspace, ± 10 minuten)

1. Ga naar [console.cloud.google.com](https://console.cloud.google.com), ingelogd met je Workspace-account, en maak een nieuw project aan (bijv. "Planner").
2. APIs en services → Bibliotheek → zoek **Google Calendar API** → Inschakelen.
3. APIs en services → OAuth-toestemmingsscherm → type **Intern** (alleen jouw Workspace; geen verificatie en de koppeling verloopt niet). Vul een app-naam en je e-mailadres in.
4. APIs en services → Inloggegevens → Inloggegevens maken → **OAuth-client-ID** → type **Webapplicatie**. Bij "Geautoriseerde omleidings-URI's":
   - `https://justinkuijpers.com/api/taken/google/callback`
   - draait de site op `www.`, voeg dan ook `https://www.justinkuijpers.com/api/taken/google/callback` toe
5. Zet de client-ID en het clientgeheim in Vercel als `GOOGLE_CLIENT_ID` en `GOOGLE_CLIENT_SECRET` en deploy opnieuw.
6. In de app: Instellingen → **Koppel Google Agenda**.

Wat de app mag: al je agenda's **lezen**, en alleen in de agenda **Planner** (die hij zelf aanmaakt) afspraken zetten, wijzigen en verwijderen. Je andere agenda's kan hij niet aanpassen. Ontkoppelen kan in Instellingen; de agenda Planner blijft dan in Google staan.

Gebieden en hun trefwoorden pas je aan in `lib/taken/config.ts`. Je werkdag (voor "vrije tijd" en de top 3) stel je in bij Instellingen.

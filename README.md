# Teknikerkalender (Node.js)

Vaktplan, møteplan og live-styring for møter/gudstjenester. Hvem har
hvilken rolle (lyd, lys, tekst/ProPresenter, vert, forsanger osv.),
møteplan med sanger/tale/bønn, en live-visning som viser hvor langt man
har kommet akkurat nå, og en programoversikt du kan laste ned som PDF.

Alle med en rolle kan abonnere på en kalenderlenke (Google Kalender,
Apple Kalender, Outlook osv.) og få sine egne møter automatisk inn.

Dette er Node.js-versjonen, bygget for å kjøre i en Docker-container på
et deploy-panel (CapRover, Coolify e.l.) i stedet for vanlig delt
PHP-hosting. Det gir ekte sanntid (WebSocket) på live-visningen, og
ekte PDF-eksport via Puppeteer — se `../teknikerkalender/` for den
opprinnelige, enklere PHP-versjonen hvis dere noen gang trenger å kjøre
på vanlig delt hosting igjen.

## Kjøre lokalt

```bash
npm install
cp .env.example .env
npm run generate-hash    # kjør to ganger: én gang for admin, én for team
# lim de to hash-verdiene inn i .env (ADMIN_PASSORD_HASH / TEAM_PASSORD_HASH)
# generer FEED_NOKKEL og LIVE_NOKKEL, se instruks i .env.example
# fyll inn SESSION_SECRET, se instruks i .env.example
npm start
```

Åpne `http://localhost:3000`.

## Kjøre med Docker

```bash
docker build -t teknikerkalender .
docker run -p 3000:3000 --env-file .env -v $(pwd)/data:/app/data teknikerkalender
```

`-v $(pwd)/data:/app/data` sørger for at møter/roller/personer lagres
utenfor selve containeren, slik at data overlever omstarter og nye
utrullinger. **Dette er viktig** — uten volum forsvinner alt ved neste
deploy.

## Koble til git + automatisk deploy ved push

Denne mappen er allerede et git-repo (kjør `git log` for å se) — første
commit er gjort for deg. Du trenger bare å koble den til GitHub og gjøre
ett engangsoppsett i Coolify, så trigger enhver fremtidig `git push`
automatisk en ny utrulling.

### Steg 1: Push til GitHub

```bash
cd teknikerkalender-node
git remote add origin https://github.com/BRUKERNAVN/teknikerkalender.git
git push -u origin main
```

(Bytt ut URL-en med ditt eget, nyopprettede repo — gjerne privat.)

### Steg 2: Koble Coolify til GitHub med "GitHub App" (anbefalt)

Dette er engangsoppsettet som gjør ALT fremtidig automatisk:

1. I Coolify: **Sources** (i sidemenyen) → **Add GitHub App**
2. Følg lenken til GitHub, autoriser appen, og velg hvilke repo(er) den
   skal ha tilgang til (velg ditt teknikerkalender-repo)
3. Gå tilbake til Coolify, opprett ressursen på nytt denne gangen med
   **Private Repository (with GitHub App)** i stedet for
   "Public Repository" — velg repoet fra listen
4. Sett build pack til **Docker Compose** som før (Base Directory `/`,
   Docker Compose Location `/docker-compose.yml`)
5. Deploy én gang manuelt for å bekrefte at alt fungerer

**Det er alt.** Fra nå av: hver gang du (eller Claude Code) gjør
`git push` til `main`-branchen, oppdager Coolify pushen automatisk via
webhook, bygger på nytt, og bytter til den nye versjonen — helt uten at
noen må trykke Deploy manuelt igjen.

### Alternativ: bruker du GitLab/Gitea/Bitbucket i stedet for GitHub?

GitHub App-metoden er GitHub-spesifikk. For andre git-leverandører:
1. Opprett ressursen med **Private Repository (Deploy Key)** i stedet
2. Coolify lager et SSH-nøkkelpar — legg den offentlige nøkkelen inn i
   repoets innstillinger hos din git-leverandør
3. I ressursens **Advanced**-fane: skru på **Auto Deploy**, og legg inn
   en webhook hos git-leverandøren som peker på webhook-URL-en Coolify
   viser der (med samme hemmelige nøkkel begge steder)

Samme sluttresultat — automatisk deploy ved push — bare litt mer
oppsett siden GitHub App-integrasjonen ikke finnes for andre
leverandører.

## Automatisert utrulling til Coolify

`docker-compose.yml` i denne mappen er satt opp for Coolifys "magic"
miljøvariabler — de fleste passordene, hemmelige nøklene, og domenet
genereres automatisk av Coolify selv. Du trenger ikke kjøre
`npm run generate-hash` eller lage noen nøkler manuelt for dette sporet.

**Slik gjør du det:**

1. Push denne mappen (`teknikerkalender-node/`) til et git-repo (GitHub,
   GitLab, eller Gitea — det Coolify-instansen din støtter)
2. I Coolify: **New Resource → Docker Compose**, pek på repoet
3. Coolify finner `docker-compose.yml` automatisk. Trykk **Deploy**.
4. Ferdig — Coolify har nå:
   - Generert `SESSION_SECRET`, `FEED_NOKKEL`, `LIVE_NOKKEL` (lange
     tilfeldige verdier)
   - Generert et ekte admin-passord og et ekte team-passord (finnes i
     Coolifys **Environment Variables**-fane under `ADMIN_PASSORD` og
     `TEAM_PASSORD` etter første deploy — det er DER du henter dem,
     ikke i koden)
   - Tildelt et domene på wildcard-adressen din, med HTTPS (Let's
     Encrypt) automatisk
   - Koblet på et persistent volum for `data/`-mappen, så møter/roller/
     personer overlever nye utrullinger
   - Satt opp en helsesjekk (`/healthz`) slik at Coolify vet appen
     faktisk kjører, og kan restarte den automatisk hvis den krasjer

**Det eneste du eventuelt må gjøre selv i Coolifys UI etterpå:**
- Hvis dere vil bruke Google/Microsoft-innlogging: fyll inn
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (eller MS-ekvivalentene) og
  sett `GOOGLE_PALOGGET`/`MS_PALOGGET` til `true` — se eget avsnitt
  under for hvordan du registrerer app hos Google/Microsoft. Husk:
  redirect-URI-en du oppgir der er `https://<domenet-coolify-ga-deg>/oauth/callback`
- Hvis dere vil ha et eget domene i stedet for Coolifys wildcard-adresse:
  sett det i Coolifys "Domains"-felt for tjenesten

**For MSP-utrulling til flere kunder senere:** siden hele oppsettet
ligger i denne ene `docker-compose.yml`-filen, er "rull ut til ny kunde"
i praksis "opprett en ny Docker Compose-ressurs i Coolify som peker på
samme repo (eller en fork), gi den kundens eget domene". Hver kunde får
sine egne auto-genererte passord/nøkler og sitt eget volum — helt
isolert fra de andre, uten at du trenger å røre koden.

### Manuell utrulling (uten Coolifys magic-variabler)

Foretrekker du å sette alt selv (f.eks. hvis dere ikke bruker Coolify,
eller vil ha full kontroll)? Se avsnittene "Kjøre lokalt" og "Kjøre med
Docker" over — samme `Dockerfile`, bare med `.env`-filen fylt ut manuelt
i stedet for at Coolify genererer verdiene.

## Deploy til CapRover (eller andre Docker-paneler uten magic-variabler)

CapRover (og lignende paneler) forstår ikke Coolifys `SERVICE_*`-syntaks,
så der må du sette alt manuelt via `.env`-tilnærmingen:

1. Push denne mappen til et git-repo, eller last opp direkte hvis
   panelet støtter det
2. Panelet bygger automatisk fra `Dockerfile` (samme fil, `docker-compose.yml`
   trengs ikke her — CapRover bruker kun Dockerfile)
3. Generer passord-hasher og hemmelige nøkler lokalt (se «Passord og
   hemmelige nøkler» under), og sett alle miljøvariablene fra
   `.env.example` i panelets UI
4. **Koble på et persistent volum for `/app/data`** — se «Viktig:
   persistent lagring» under, dette er lett å glemme
5. Sett `BASE_URL` til den offentlige adressen appen får (f.eks.
   `https://teknikerkalender.dittdomene.no`) — appen må vite sin egen
   offentlige adresse for at abonnementslenker og OAuth-redirect skal
   bli riktige

## Viktig: persistent lagring

Data lagres som JSON-filer i `data/`-mappen (`meetings.json`,
`roller.json`, `personer.json`) — akkurat som i PHP-versjonen, bare
ingen database. I en Docker-container forsvinner alt som ikke ligger på
et volum ved neste utrulling. **Koble `data/`-mappen til et persistent
volum i deploy-panelet ditt**, ellers mister dere alle møter/roller/
personer hver gang dere pusher en oppdatering.

## Passord og hemmelige nøkler

Samme prinsipp som PHP-versjonen, bare miljøvariabler i stedet for
konstanter i en fil:

- `TEAM_PASSORD`/`TEAM_PASSORD_HASH` — kreves for å åpne forsiden
- `ADMIN_PASSORD`/`ADMIN_PASSORD_HASH` — kreves for å redigere møter/roller/personer
- `FEED_NOKKEL` — hemmelig nøkkel i kalenderfeed-lenkene (kalender-apper
  kan ikke logge inn med passord)
- `LIVE_NOKKEL` — hemmelig nøkkel i live-visning-lenken (lobbyskjermer
  kan heller ikke logge inn)
- `SESSION_SECRET` — signerer innloggingsøkter, må være lang og tilfeldig

**På Coolify** (se avsnittet over) genereres alt dette automatisk — ikke
gjør noe av det under der.

**Manuelt** (lokalt, CapRover, e.l.): sett enten `ADMIN_PASSORD`/
`TEAM_PASSORD` i klartekst (appen hasher dem selv ved oppstart), eller
lag et bcrypt-hash på forhånd med `npm run generate-hash` (spør
interaktivt om passordet, skriver ut hash-verdien du limer inn i
`ADMIN_PASSORD_HASH`/`TEAM_PASSORD_HASH`). Generer de to hemmelige
nøklene og SESSION_SECRET med:

```bash
node -e "console.log(require('crypto').randomBytes(20).toString('base64url'))"
```

## Sette opp roller, personer og møter

Samme arbeidsflyt som før:

1. Logg inn på `/admin`
2. **Roller**-fanen: fem vanlige roller er seedet inn fra start (Lyd,
   Lys, Tekst/ProPresenter, Vert, Forsanger) — juster etter behov
3. **Personer**-fanen: legg inn frivillig-oversikten med navn/e-post/
   telefon, kryss av hvilke roller hver kan fylle
4. **Møter**-fanen: legg til dato/tid, trykk «Rediger» for å bemanne
   roller og bygge møteplanen

## Live styring under møtet

Fra møteredigeringssiden: **Live styring** åpner et kontrollpanel med
store «Forrige»/«Neste»-knapper (eller trykk direkte på et punkt i
lista). Kun innlogget admin kan styre.

**Live-visning** er en offentlig lenke (nøkkelbeskyttet) du kan åpne på
en skjerm i lobbyen eller dele med teamet. I denne versjonen oppdaterer
den seg **umiddelbart** via WebSocket når du endrer noe i kontrollpanelet
— ikke polling som i PHP-versjonen. Kobler automatisk til på nytt hvis
forbindelsen brytes (nyttig siden dette gjerne står åpent i timevis).

## Program som PDF

Fra møteredigeringssiden: **Program (skriv ut/PDF)** åpner en ren
programoversikt (medvirkende per rolle + nummerert program). «Last ned
som PDF» genererer en ekte PDF-fil server-side med Puppeteer (samme
utseende som på skjermen, ferdig til å sende videre) — ikke bare en
"bruk nettleserens print-dialog"-løsning som i PHP-versjonen.

## Innlogging med Google/Microsoft (valgfritt)

Samme oppsett som PHP-versjonen (se steg-for-steg i den READMEen for
Google Cloud Console / Azure-appregistrering) — bare med én viktig
forskjell: **redirect-URI-en du registrerer hos Google/Microsoft er nå**
`https://dittdomene.no/oauth/callback` (ikke `/oauth-callback.php`).

Husk: `TEAM_TILLATTE_EPOSTER`/`_DOMENER` og `ADMIN_TILLATTE_EPOSTER`/
`_DOMENER` er tomme som standard — SSO nekter alltid innlogging til du
eksplisitt fyller inn hvem som har lov.

## Sikkerhet

- Forsiden og admin krever hver sitt passord (eller SSO), akkurat som før
- Kalenderfeed og live-visning er nøkkelbeskyttet i URL-en (ikke
  passord-innlogging, siden kalender-apper og lobbyskjermer ikke kan
  logge inn) — del disse lenkene direkte med teamet, ikke offentlig
- CSRF-token på alle admin-skjemaer
- `data/`-mappen er ikke tilgjengelig via HTTP i det hele tatt (Express
  serverer kun `public/`-mappen statisk — ingen `.htaccess` å huske på,
  det er strukturelt umulig å nå datafilene direkte fra nettleseren)
- Cookie-baserte sesjoner er signert (ikke krypterte, men manipulasjonssikre)
  med `SESSION_SECRET` — HttpOnly + SameSite=Lax

## Utviklet og testet slik

Node var tilgjengelig i utviklingsmiljøet dette ble bygget i (i
motsetning til PHP-versjonen), så det meste av logikken er faktisk kjørt
og verifisert underveis: ICS-linjefolding og tidssone-konvertering
(sommer-/vintertid), alle 17 sider gjengitt med realistiske testdata via
en midlertidig test-only EJS-kompatibel renderer (siden selve npm-pakken
`ejs` ikke kunne installeres uten nettverkstilgang), og all inline
JavaScript syntakssjekket. Se `../CLAUDE.md` for nøyaktig hva som IKKE er
verifisert og bør testes videre — spesielt: reell npm install + faktisk
oppstart av serveren, WebSocket-oppførsel over tid, og Puppeteer-PDF i
en ekte container.

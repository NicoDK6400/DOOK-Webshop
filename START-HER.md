# DOOK — start her

Denne pakke indeholder hjemmesiden, som blev udgivet 22. september 2026, samt en kopi af dens gemte data på eksporttidspunktet.

## Det følger med

- `public/`: hjemmesidens HTML, CSS, JavaScript og alle de indbyggede billeder.
- `worker/`: serverkode til login, priser, administration, billeder og ordreforespørgsler — hostinguafhængig.
- `server/`: den selv-hostede Node.js-server (database-, billed- og mailtilkobling, HTTP-serveren selv).
- `db/` og `drizzle/`: databaseskema og migrationer.
- `database/`: en separat eksport af sidens gemte data i SQLite, SQL og JSON.
- `scripts/`: byggefunktioner og en test af login, adgang, varer, billeder og ordrer.
- `dist/`: den byggede udgave (server + statiske filer), oprettet af `npm run build`.
- `Dockerfile` og `docker-compose.yml`: opsætning til at køre sitet i en container.
- `.env.example`: skabelon for miljøvariabler (aktiveringstoken, database-/billedplacering, SMTP).
- `package.json` og `package-lock.json`: projektets afhængigheder.
- `README.md`: tekniske noter om funktionerne og Uniconta-forberedelsen.

## Åbn projektet lokalt

1. Pak ZIP-filen ud.
2. Installér [Node.js](https://nodejs.org) 22 eller nyere, hvis det ikke allerede er installeret.
3. Åbn mappen `DOOK-hjemmeside` i fx Visual Studio Code.
4. Åbn en terminal i mappen og kør:

```sh
npm ci
npm run dev
```

Åbn den lokale adresse, som terminalen viser (normalt http://localhost:5173).
Du skal køre udviklingsserveren; det er ikke nok at dobbeltklikke på `index.html`.

Login virker også lokalt: opret en konto via `#signup`, og sæt `OWNER_ACTIVATION_TOKEN` i en lokal `.env`-fil for selv at kunne blive administrator via `#activate/<token>`. Der følger ingen indbygget administratoradgang eller testkodeord med. Testen nedenfor kan kontrollere de beskyttede serverfunktioner isoleret uden at bruge den rigtige hjemmeside.

Projektet opretter en lokal SQLite-database under `.sites-runtime/` første gang. Den indeholder startdata fra migrationerne. Eksporten i `database/` importeres ikke automatisk (se `npm run import-legacy-data` i afsnittet om drift nedenfor).

## Ret indhold og udseende

Redigér filerne uden hash i navnet, fx:

- `public/app.js`: forside, navigation og de oprindelige produktvisninger.
- `public/style.css`: layout, farver og typografi.
- `public/shop.js`: B2B-shop og varevalg.
- `public/manage.js`: administration af varer, kategorier, billeder og ordrer.
- `public/b2b.js`: kontoadgang og About DOOK.
- `public/news.js`: nyheder.
- `worker/index.mjs`, `worker/commerce.mjs` og `worker/auth.mjs`: serverlogik, adgangskontrol og login.

Filer som `app.<hash>.js` genereres ved build og skal ikke redigeres manuelt. Når du har ændret en kildefil, opdateres de referencer, som `index.html` bruger, med:

```sh
node scripts/publish-assets.mjs
```

Genindlæs siden efter opdateringen. Scriptet opdaterer også CSS-referencen.

## Byg og kontrollér

```sh
npm run build
node scripts/verify-commerce.mjs
```

Testen bruger en isoleret database og testbilleder i hukommelsen. Den ændrer ikke sidens rigtige data.

## Dataeksport

`database/dook.sqlite` er en database med skema og eksporterede data. Den kan åbnes i et SQLite-værktøj.
`database/restore.sql` kan genindlæses i den kørende hjemmesides database med `npm run import-legacy-data` (se driftsafsnittet nedenfor) — det er sikkert at køre flere gange.
`database/snapshot.json` indeholder eksporttidspunkt og rækker fordelt på tabel.

Eksporten indeholder de 540 gemte forhandlerpriser. Ved eksporten var der ingen oprettede webordrer, forhandlerkonti, administratorer, uploadede billeder eller ændringer i kataloget. De 45 oprindelige modeller og deres billeder ligger i koden og i `public/assets/`.

Datafilerne indeholder interne forhandlerpriser. De skal blive uden for den offentligt serverede mappe `public/`.
En eksport er et øjebliksbillede; senere ændringer på den udgivne hjemmeside bliver ikke automatisk opdateret i ZIP-filen.

## Sådan driftes hjemmesiden

Hjemmesiden er selv-hostet: en almindelig Node.js-server, en SQLite-databasefil og en billedmappe på disk, pakket med den medfølgende `Dockerfile`/`docker-compose.yml`. Den afhænger ikke længere af OpenAI Sites eller "Sign in with ChatGPT".

1. Kopiér `.env.example` til `.env`, og udfyld `OWNER_ACTIVATION_TOKEN` (et langt, tilfældigt hemmeligt kodeord) samt SMTP-oplysninger, hvis I har dem.
2. Kør `docker compose up --build`. Databasen og uploadede billeder gemmes i Docker-volumet `dook-data` og overlever genstart.
3. Opret en konto på `/#signup`, og åbn derefter `/#activate/<OWNER_ACTIVATION_TOKEN>` for at blive administrator.
4. Skal restore.sql-eksporten (540 forhandlerpriser) importeres, kør `npm run import-legacy-data` (eller `docker compose exec app npm run import-legacy-data`).

Uden Docker: `npm ci && npm run build && npm start` kører den samme server direkte (kræver Node 22+, som har SQLite indbygget — intet andet skal installeres).

Login-headere fra besøgende accepteres aldrig direkte — identitet kommer altid fra en server-verificeret session (se `worker/auth.mjs`). De offentlige sider og produktdata får aldrig forhandlerpriser med som statiske data.

## Uniconta

Uniconta er endnu ikke tilsluttet. Ordreforespørgsler gemmes i hjemmesidens database og bekræftes nu automatisk med en e-mail til kunden (kræver SMTP-opsætning), men sendes endnu ikke videre til Uniconta. Lagerstatus kan baseres på manuelt indtastede tal. Den kommende integration kræver bl.a. autoriseret API-adgang, firmaoplysninger, match mellem forhandlere og kundenumre samt aftalte regler for lager og salgsordrer.

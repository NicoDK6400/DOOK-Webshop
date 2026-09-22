# DOOK — start her

Denne pakke indeholder hjemmesiden, som blev udgivet 22. september 2026, samt en kopi af dens gemte data på eksporttidspunktet.

## Det følger med

- `public/`: hjemmesidens HTML, CSS, JavaScript og alle de indbyggede billeder.
- `worker/`: serverkode til loginrettigheder, priser, administration, billeder og ordreforespørgsler.
- `db/` og `drizzle/`: databaseskema og migrationer.
- `database/`: en separat eksport af sidens gemte data i SQLite, SQL og JSON.
- `scripts/`: byggefunktioner og en test af adgang, varer, billeder og ordrer.
- `dist/`: den byggede udgave til Cloudflare Workers med tilhørende filer.
- `package.json` og `package-lock.json`: projektets afhængigheder.
- `README.md`: tekniske noter om funktionerne og Uniconta-forberedelsen.
- `.openai/hosting.json`: henvisningen til det eksisterende Sites-projekt.

## Åbn projektet lokalt

1. Pak ZIP-filen ud.
2. Installér Node.js 24 og Python 3, hvis de ikke allerede er installeret.
3. Åbn mappen `DOOK-hjemmeside` i fx Visual Studio Code.
4. Åbn en terminal i mappen og kør:

```sh
npm ci
npm run dev
```

Åbn den lokale adresse, som terminalen viser (normalt http://localhost:5173).
Du skal køre udviklingsserveren; det er ikke nok at dobbeltklikke på `index.html`.

Den lokale visning er anonym. Du kan se den almindelige hjemmeside, men administrator- og forhandlerfunktionerne kræver login og serverrettigheder fra hostingmiljøet. Der følger ingen indbygget administratoradgang eller testkodeord med. Testen nedenfor kan kontrollere de beskyttede serverfunktioner isoleret uden at bruge den rigtige hjemmeside.

Projektet opretter en lokal SQLite-database under `.sites-runtime/` første gang. Den indeholder startdata fra migrationerne. Eksporten i `database/` importeres ikke automatisk.

## Ret indhold og udseende

Redigér filerne uden hash i navnet, fx:

- `public/app.js`: forside, navigation og de oprindelige produktvisninger.
- `public/style.css`: layout, farver og typografi.
- `public/shop.js`: B2B-shop og varevalg.
- `public/manage.js`: administration af varer, kategorier, billeder og ordrer.
- `public/b2b.js`: kontoadgang og About DOOK.
- `public/news.js`: nyheder.
- `worker/index.mjs` og `worker/commerce.mjs`: serverlogik og adgangskontrol.

Filer som `app.<hash>.js` genereres ved build og skal ikke redigeres manuelt. Når du har ændret en kildefil, opdateres de referencer, som `index.html` bruger, med:

```sh
python3 scripts/publish-assets.py
```

På Windows kan Python-kommandoen hedde `py -3` eller `python`. Brug da fx:

```sh
py -3 scripts/publish-assets.py
```

Genindlæs siden efter opdateringen. Filen `scripts/publish-assets.py` opdaterer også CSS-referencen.

## Byg og kontrollér

```sh
npm run build
node scripts/verify-commerce.mjs
```

Hvis `python3` ikke findes som kommando på Windows, svarer dette til byggekommandoen:

```sh
py -3 scripts/publish-assets.py
node scripts/build.mjs
```

Testen bruger en isoleret database og testbilleder i hukommelsen. Den ændrer ikke sidens rigtige data.

## Dataeksport

`database/dook.sqlite` er en database med skema og eksporterede data. Den kan åbnes i et SQLite-værktøj.
`database/restore.sql` kan importeres i en ny, tom SQLite-/D1-database. Kør ikke først migrationerne i samme tomme database: SQL-filen indeholder allerede tabellerne.
`database/snapshot.json` indeholder eksporttidspunkt og rækker fordelt på tabel.

Eksporten indeholder de 540 gemte forhandlerpriser. Ved eksporten var der ingen oprettede webordrer, forhandlerkonti, administratorer, uploadede billeder eller ændringer i kataloget. De 45 oprindelige modeller og deres billeder ligger i koden og i `public/assets/`.

Datafilerne indeholder interne forhandlerpriser. De skal blive uden for den offentligt serverede mappe `public/`.
En eksport er et øjebliksbillede; senere ændringer på den udgivne hjemmeside bliver ikke automatisk opdateret i ZIP-filen.

## Hvis siden flyttes til en anden server

Den eksisterende løsning er bygget til Sites/Cloudflare Workers. Den kan ikke flyttes som en ren statisk HTML-side med alle funktioner intakte.

Der skal opsættes:

- En Worker-kompatibel server eller en tilpasset serverløsning.
- Databasebindingen `DB` og billedlageret `MEDIA`.
- Login og serverkontrollerede rettigheder for administratorer og godkendte forhandlere.
- Nye hemmelige værdier, herunder administratoraktivering, i serverens miljøopsætning.

ChatGPT-loginruterne og identitetsoplysningerne leveres i dag af Sites. På anden hosting skal login integreres korrekt. Identitets-headere må ikke accepteres direkte fra besøgende. De offentlige sider og produktdata må aldrig få forhandlerpriser med som statiske data.

Pakken indeholder ikke adgangstokens, loginoplysninger, `.env`, Git-historik eller `node_modules`. Afhængigheder installeres med `npm ci`. Den nuværende Sites-adgangspolitik følger heller ikke automatisk med til et nyt hostingmiljø.

`.openai/hosting.json` peger på det eksisterende DOOK-projekt. Brug den ikke til at udgive til et andet projekt uden at ændre hostingopsætningen. At køre projektet lokalt udgiver ingen ændringer.

## Uniconta

Uniconta er endnu ikke tilsluttet. Ordreforespørgsler gemmes i hjemmesidens database, og lagerstatus kan baseres på manuelt indtastede tal. Den kommende integration kræver bl.a. autoriseret API-adgang, firmaoplysninger, match mellem forhandlere og kundenumre samt aftalte regler for lager og salgsordrer.

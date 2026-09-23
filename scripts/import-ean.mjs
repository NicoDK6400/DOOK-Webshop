import {readFileSync} from 'node:fs';
import {openDB} from '../server/db.mjs';
// database/ean-import.csv holds the 540 SKU→EAN pairs read once from the Uniconta-side
// frame catalogue spreadsheet (its ItemNo column already matches prices.sku exactly).
// catalogue_items only has rows for products an admin has already edited, so this upserts
// a row per SKU — deriving model from prices — and only ever writes the ean column; it
// never touches stock or active on a row that already exists. Safe to run more than once.
// Some SKUs contain a literal comma (a Danish decimal diopter suffix, e.g. "...AB+1,0"),
// so the CSV quotes those fields and this reads it as real CSV, not a naive comma-split.
function parseCsvLine(line){
 const fields=[];let cur='',quoted=false;
 for(let i=0;i<line.length;i++){const c=line[i];
  if(quoted){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++}else quoted=false}else cur+=c}
  else if(c==='"')quoted=true;else if(c===','){fields.push(cur);cur=''}else cur+=c;
 }
 fields.push(cur);return fields;
}
const path=new URL('../database/ean-import.csv',import.meta.url);
const rows=readFileSync(path,'utf8').trim().split(/\r?\n/).slice(1).map(parseCsvLine);
const db=openDB();
const upsert=db.prepare(`INSERT INTO catalogue_items(sku,model,active,stock,stock_updated,ean) SELECT ?,model,1,NULL,NULL,? FROM prices WHERE sku=? ON CONFLICT(sku) DO UPDATE SET ean=excluded.ean`);
let matched=0;const unmatched=[],flagged=[];
for(const [sku,ean] of rows){
 if(!/^\d{13}$/.test(ean))flagged.push(`${sku}: ${ean} (${ean.length} digits)`);
 const result=await upsert.bind(sku,ean,sku).run();
 if(result.meta.changes)matched++;else unmatched.push(sku);
}
console.log(`Imported EAN for ${matched}/${rows.length} SKU(s) from database/ean-import.csv.`);
if(flagged.length)console.log(`Flagged (not 13 digits — verify against Uniconta before relying on it):\n  ${flagged.join('\n  ')}`);
if(unmatched.length)console.log(`Not found in prices, skipped:\n  ${unmatched.join('\n  ')}`);

// Fingerprint authored static assets for cache-busting. Only used at build time —
// writes hashed copies into outputDir and returns the rewritten HTML; never touches
// the tracked public/index.html (see scripts/build.mjs).
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const ASSETS=['i18n.js','catalog.js','lenses.js','app.js','b2b.js','trade-catalog.js','shop.js','news.js','manage.js','style.css'];

export function publishAssets({sourceDir='public/',outputDir=sourceDir}={}){
 let page=readFileSync(sourceDir+'index.html','utf8');
 for(const name of ASSETS){
  const data=readFileSync(sourceDir+name);
  const [stem,suffix]=name.split('.');
  const version=`${stem}.${createHash('sha256').update(data).digest('hex').slice(0,12)}.${suffix}`;
  writeFileSync(outputDir+version,data);
  page=page.replace(new RegExp('/'+stem+'\\.'+suffix,'g'),'/'+version);
 }
 return page;
}

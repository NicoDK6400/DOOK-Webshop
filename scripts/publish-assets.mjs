// Fingerprint authored static assets and point the entrypoint at this revision.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export function publishAssets(){
 const root=fileURLToPath(new URL('../public/',import.meta.url));
 let page=readFileSync(root+'index.html','utf8');
 for(const name of ['i18n.js','catalog.js','lenses.js','app.js','b2b.js','trade-catalog.js','shop.js','news.js','manage.js','style.css']){
  const data=readFileSync(root+name);
  const [stem,suffix]=name.split('.');
  const version=`${stem}.${createHash('sha256').update(data).digest('hex').slice(0,12)}.${suffix}`;
  writeFileSync(root+version,data);
  if(name==='i18n.js'&&!new RegExp('/i18n[.\\w-]*\\.js').test(page)){
   // i18n.js must run before every other script, so it always precedes catalog.js.
   page=page.replace('<script src="/catalog.',`<script src="/${version}"></script><script src="/catalog.`);
  }else if(name==='lenses.js'&&!new RegExp('/lenses[.\\w-]*\\.js').test(page)){
   page=page.replace('<script src="/app.',`<script src="/${version}"></script><script src="/app.`);
  }else{
   page=page.replace(new RegExp('/'+stem+'(?:\\.[\\w-]+)?\\.'+suffix,'g'),'/'+version);
  }
 }
 writeFileSync(root+'index.html',page);
}

// Run directly (npm run build) as well as imported (vite.config.mjs, on dev server start).
if(import.meta.url===`file://${process.argv[1]}`)publishAssets();

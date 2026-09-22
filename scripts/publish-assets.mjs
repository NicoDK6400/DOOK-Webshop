// Fingerprint authored static assets and point the entrypoint at this revision.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../public/',import.meta.url));
let page=readFileSync(root+'index.html','utf8');
for(const name of ['catalog.js','lenses.js','app.js','b2b.js','trade-catalog.js','shop.js','news.js','manage.js','style.css']){
 const data=readFileSync(root+name);
 const [stem,suffix]=name.split('.');
 const version=`${stem}.${createHash('sha256').update(data).digest('hex').slice(0,12)}.${suffix}`;
 writeFileSync(root+version,data);
 if(name==='lenses.js'&&!new RegExp('/lenses[.\\w-]*\\.js').test(page)){
  page=page.replace('<script src="/app.',`<script src="/${version}"></script><script src="/app.`);
 }else{
  page=page.replace(new RegExp('/'+stem+'(?:\\.[\\w-]+)?\\.'+suffix,'g'),'/'+version);
 }
}
writeFileSync(root+'index.html',page);

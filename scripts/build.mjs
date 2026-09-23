import {readFile,writeFile,mkdir,rm,cp,unlink} from 'node:fs/promises';
import {publishAssets,ASSETS} from './publish-assets.mjs';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await cp('public','dist/client',{recursive:true});

const html=publishAssets({sourceDir:'public/',outputDir:'dist/client/'});
await writeFile('dist/client/index.html',html);
// The plain-named sources were copied above; only the hashed copies should ship.
for(const name of ASSETS)await unlink('dist/client/'+name);

const source=await readFile('worker/index.mjs','utf8');
await writeFile('dist/server/index.mjs',`const HTML=${JSON.stringify(html)};\n${source}`);

for(const file of ['commerce.mjs','catalogue-seed.mjs','auth.mjs','mail.mjs','security-headers.mjs'])await cp('worker/'+file,'dist/server/'+file);
for(const file of ['db.mjs','media.mjs','migrate.mjs','serve.mjs'])await cp('server/'+file,'dist/server/'+file);

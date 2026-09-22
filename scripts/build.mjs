import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await cp('public','dist/client',{recursive:true});
const source=await readFile('worker/index.mjs','utf8');
const html=await readFile('public/index.html','utf8');
await writeFile('dist/server/index.mjs',`const HTML=${JSON.stringify(html)};\n${source}`);

for(const file of ['commerce.mjs','catalogue-seed.mjs','auth.mjs','mail.mjs','security-headers.mjs'])await cp('worker/'+file,'dist/server/'+file);
for(const file of ['db.mjs','media.mjs','migrate.mjs','serve.mjs'])await cp('server/'+file,'dist/server/'+file);

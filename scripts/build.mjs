import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await cp('public','dist/client',{recursive:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
const source=await readFile('worker/index.mjs','utf8');
const html=await readFile('public/index.html','utf8');
await writeFile('dist/server/index.js',`const HTML=${JSON.stringify(html)};\n${source}`);

for(const file of ['commerce.mjs','catalogue-seed.mjs'])await cp('worker/'+file,'dist/server/'+file);

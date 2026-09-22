import {mkdirSync} from 'node:fs';
import {readFile,writeFile,unlink} from 'node:fs/promises';
// R2-compatible adapter: same put/get/delete shape the worker code and the dev
// preview (vite.config.mjs) already use, backed by a persistent directory on disk.
export function openMedia(path=process.env.MEDIA_PATH||'./data/media'){
 mkdirSync(path,{recursive:true});
 const file=key=>path+'/'+key.split('/').pop();
 return {
  async put(key,bytes,meta){await writeFile(file(key),bytes);await writeFile(file(key)+'.json',JSON.stringify(meta))},
  async get(key){
   try{const [body,meta]=await Promise.all([readFile(file(key)),readFile(file(key)+'.json','utf8')]);return {body,...JSON.parse(meta)}}
   catch{return null}
  },
  async delete(key){await Promise.all([unlink(file(key)),unlink(file(key)+'.json')]).catch(()=>{})}
 };
}

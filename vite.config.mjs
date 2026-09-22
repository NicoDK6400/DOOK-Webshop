import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import worker from './worker/index.mjs';
// Preview uses real API handlers and SQLite, with anonymous requests only.
export default {root:'public',server:{host:'0.0.0.0',allowedHosts:['terminal.local']},plugins:[{
 name:'dook-api-preview',configureServer(server){
  mkdirSync('.sites-runtime/media',{recursive:true});const sql=new DatabaseSync('.sites-runtime/preview.sqlite');
  sql.exec('CREATE TABLE IF NOT EXISTS preview_migrations (name TEXT PRIMARY KEY)');
  const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
  const legacy=!!sql.prepare("SELECT name FROM sqlite_master WHERE name='settings'").get();
  for(const entry of journal.entries){if(sql.prepare('SELECT name FROM preview_migrations WHERE name=?').get(entry.tag))continue;if(!(legacy&&entry.idx<2))sql.exec(readFileSync('drizzle/'+entry.tag+'.sql','utf8'));sql.prepare('INSERT INTO preview_migrations(name) VALUES(?)').run(entry.tag)}
  const DB={prepare(query){const make=(args=[])=>({first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>({meta:sql.prepare(query).run(...args)})});return {...make(),bind:(...args)=>make(args)}},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
  const MEDIA={async put(key,bytes,meta){const name='.sites-runtime/media/'+key.split('/').pop();writeFileSync(name,bytes);writeFileSync(name+'.json',JSON.stringify(meta));},async get(key){const name='.sites-runtime/media/'+key.split('/').pop();if(!existsSync(name))return null;return {body:readFileSync(name),...JSON.parse(readFileSync(name+'.json','utf8'))}},async delete(key){const name='.sites-runtime/media/'+key.split('/').pop();if(existsSync(name))unlinkSync(name);if(existsSync(name+'.json'))unlinkSync(name+'.json')}};
  server.middlewares.use(async(req,res,next)=>{
   if(!req.url?.startsWith('/api/')&&!req.url?.startsWith('/media/'))return next();
   try{const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value&&!key.startsWith('oai-authenticated-user-'))headers.set(key,String(value));
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
    const response=await worker.fetch(new Request('http://'+req.headers.host+req.url,{method:req.method,headers,...(body.length?{body}:{})}),{DB,MEDIA});res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
   }catch(error){console.error(error);res.statusCode=500;res.end('Preview service unavailable');}
  });
 }
}]};

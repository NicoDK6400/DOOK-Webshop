import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {normalize} from 'node:path/posix';
import worker from './index.mjs';
import {openDB} from './db.mjs';
import {openMedia} from './media.mjs';
import {securityHeaders} from './security-headers.mjs';
// Bundled into dist/server by scripts/build.mjs, alongside index.mjs (the worker
// handler with HTML baked in), commerce.mjs, auth.mjs, mail.mjs and this file's siblings.

const CLIENT_DIR=new URL('../client/',import.meta.url);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
async function serveStatic(request,env){
 let path=normalize(decodeURIComponent(new URL(request.url).pathname)).replace(/^\/+/,'');
 if(!path||path==='.'||path.startsWith('..'))return new Response('Not found',{status:404});
 try{
  const bytes=await readFile(new URL(path,CLIENT_DIR));
  const hashed=/\.[a-f0-9]{12}\.(js|css)$/.test(path);
  return new Response(bytes,{headers:{'Content-Type':MIME[extname(path)]||'application/octet-stream','Cache-Control':hashed?'public, max-age=31536000, immutable':'public, max-age=3600',...securityHeaders(env)}});
 }catch{return new Response('Not found',{status:404})}
}

const env={DB:openDB(),MEDIA:openMedia(),OWNER_ACTIVATION_TOKEN:process.env.OWNER_ACTIVATION_TOKEN,GA_MEASUREMENT_ID:process.env.GA_MEASUREMENT_ID};
env.ASSETS={fetch:request=>serveStatic(request,env)};

const server=createServer(async(req,res)=>{
 try{
  const headers=new Headers();
  for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(', '):String(value));
  const protocol=req.headers['x-forwarded-proto']||'http';
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=Buffer.concat(chunks);
  const request=new Request(`${protocol}://${req.headers.host}${req.url}`,{method:req.method,headers,...(body.length?{body}:{})});
  const response=await worker.fetch(request,env);
  res.statusCode=response.status;
  for(const [key,value] of response.headers)res.setHeader(key,value);
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('Request failed',error);res.statusCode=500;res.end('Internal error')}
});
const port=Number(process.env.PORT)||3000;
server.listen(port,()=>console.log(`DOOK server listening on :${port}`));

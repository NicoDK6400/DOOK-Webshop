import {loadEnv} from 'vite';
import worker from './worker/index.mjs';
import {openDB} from './server/db.mjs';
import {openMedia} from './server/media.mjs';
import {publishAssets} from './scripts/publish-assets.mjs';
// Vite only auto-loads .env into import.meta.env for client code, not into
// process.env here in the config/plugin — load it explicitly so OWNER_ACTIVATION_TOKEN
// (and SMTP_*, read directly from process.env by worker/mail.mjs) work locally too.
Object.assign(process.env,loadEnv('development',process.cwd(),''));
// Preview uses the same DB/MEDIA adapters as production, just pointed at a
// local folder. Signup/login work locally too, via real session cookies.
export default {root:'public',server:{host:'0.0.0.0',allowedHosts:['terminal.local']},plugins:[{
 name:'dook-api-preview',configureServer(server){
  // The fingerprinted app.<hash>.js etc. files aren't committed to the repo — generate
  // them now so a fresh clone works immediately, without a separate manual build step.
  publishAssets();
  const DB=openDB('.sites-runtime/preview.sqlite');
  const MEDIA=openMedia('.sites-runtime/media');
  server.middlewares.use(async(req,res,next)=>{
   if(!req.url?.startsWith('/api/')&&!req.url?.startsWith('/media/'))return next();
   try{const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,String(value));
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
    const response=await worker.fetch(new Request('http://'+req.headers.host+req.url,{method:req.method,headers,...(body.length?{body}:{})}),{DB,MEDIA,OWNER_ACTIVATION_TOKEN:process.env.OWNER_ACTIVATION_TOKEN});res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
   }catch(error){console.error(error);res.statusCode=500;res.end('Preview service unavailable');}
  });
 }
}]};

import {commerce,mediaResponse} from './commerce.mjs';
// Identity headers are supplied by the Sites dispatcher, never by a login form.
const defaults={name:'',history:'',concept:'Danish eyewear with magnetic click-ons. Change your lenses while keeping your favourite frame.',why:'Switch from everyday glasses to sun lenses with one magnetic click. Your optician helps you find the right frame and fit.',instagram:'https://www.instagram.com/dook_denmark/',linkedin:'https://www.linkedin.com/company/dook-denmark/',facebook:'https://www.facebook.com/profile.php?id=61572809430865'};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
const fail=(message,status)=>{throw Object.assign(new Error(message),{status})};
async function settings(db){const row=await db.prepare("SELECT value FROM settings WHERE key='prices'").first();return row?JSON.parse(row.value):{enabled:false,currency:'DKK',tax:'excl. VAT'}}
async function identity(request,env){
 const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
 if(!id||!email)return null;
 const admin=await env.DB.prepare('SELECT user_id FROM site_owner WHERE slot=1').first();
 return {id,email,role:admin?.user_id===id?'admin':(await env.DB.prepare('SELECT status FROM partners WHERE user_id=?').bind(id).first())?.status||'unregistered'};
}
async function body(request){if(!request.headers.get('content-type')?.startsWith('application/json'))fail('JSON required.',415);const raw=await request.text();if(raw.length>100000)fail('The submitted content is too long.',413);try{return JSON.parse(raw)}catch{fail('Invalid content.',400)}}
const str=(value,max=8000)=>typeof value==='string'&&value.length<=max?value.trim():fail('Please check the submitted fields.',400);
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path.startsWith('/media/'))return mediaResponse(request,env);
 if(!path.startsWith('/api/')){
  if(path==='/'||path==='/index.html')return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
  return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
 }
 try{
  if(!env.DB)fail('This service is temporarily unavailable. Please try again.',503);
  if(!['GET','POST','PUT'].includes(request.method))fail('Method not allowed.',405);
  if(request.method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))fail('Please reload the page and try again.',403);
  const user=await identity(request,env);
  const managed=await commerce(request,env,user);if(managed)return managed;
  if(path==='/api/me'&&request.method==='GET')return json({user});
  if(path==='/api/about'&&request.method==='GET'){
   const row=await env.DB.prepare("SELECT value FROM settings WHERE key='about'").first();return json({content:{...defaults,...(row?JSON.parse(row.value):{})}});
  }
  if(path==='/api/news'&&request.method==='GET'){
   const rows=(await env.DB.prepare("SELECT value FROM settings WHERE key LIKE 'news:%'").all()).results;
   const articles=rows.map(r=>JSON.parse(r.value)).filter(a=>a.published).sort((a,b)=>b.date.localeCompare(a.date));
   return json({articles});
  }
  if(!user)fail('Please sign in to continue.',401);
  // A one-time owner activation binds the stable signed-in ID. No first-user admin.
  if(path==='/api/activate-owner'&&request.method==='POST'){
   const b=await body(request);
   if(!env.OWNER_ACTIVATION_TOKEN||typeof b.token!=='string')fail('Invalid activation link.',403);
   const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(b.token)));
   const c=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.OWNER_ACTIVATION_TOKEN)));
   let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^c[i];if(mismatch)fail('Invalid activation link.',403);
   const existing=await env.DB.prepare('SELECT user_id FROM site_owner WHERE slot=1').first();
   if(existing&&existing.user_id!==user.id)fail('The owner has already been activated.',403);
   await env.DB.prepare('INSERT OR IGNORE INTO site_owner(slot,user_id) VALUES(1,?)').bind(user.id).run();
   return json({ok:true});
  }
  if(path==='/api/access-request'&&request.method==='POST'){
   const b=await body(request),company=str(b.company,200),name=str(b.name,200);if(!company||!name)fail('Enter your name and company.',400);
   await env.DB.prepare("INSERT INTO partners(user_id,email,name,company,status) VALUES(?,?,?,?,'pending') ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,name=excluded.name,company=excluded.company").bind(user.id,user.email,name,company).run();return json({ok:true});
  }
  if(path==='/api/prices'&&request.method==='GET'){
   if(!['admin','approved'].includes(user.role))fail('Your company needs approval before prices are available.',403);
   const config=await settings(env.DB);if(!config.enabled&&user.role!=='admin')return json({prices:[],config});
   return json({prices:(await env.DB.prepare('SELECT sku,model,colour,description,amount FROM prices ORDER BY sku').all()).results,config});
  }
  if(user.role!=='admin')fail('Administrator access required.',403);
  if(path==='/api/admin/news'&&request.method==='GET'){
   const rows=(await env.DB.prepare("SELECT value FROM settings WHERE key LIKE 'news:%'").all()).results;
   return json({articles:rows.map(r=>JSON.parse(r.value)).sort((a,b)=>b.date.localeCompare(a.date))});
  }
  if(path==='/api/admin/news'&&request.method==='PUT'){
   const b=await body(request);const id=b.id?str(b.id,80):crypto.randomUUID();if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))fail('Invalid article.',400);
   const article={id,title:str(b.title,160),excerpt:str(b.excerpt,500),body:str(b.body,24000),image:str(b.image,2000),date:str(b.date,10),published:b.published===true};
   if(!article.title||!article.body)fail('Add a title and article text.',400);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(article.date)||Number.isNaN(Date.parse(article.date)))fail('Choose a valid date.',400);
   if(article.image&&!/^\/assets\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp|svg)$/.test(article.image)){
    let image;try{image=new URL(article.image)}catch{fail('Choose an image or enter an HTTPS image URL.',400)}if(image.protocol!=='https:')fail('Image URLs must begin with https://.',400);
   }
   await env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('news:'+id,JSON.stringify(article)).run();return json({article});
  }
  if(path==='/api/admin'&&request.method==='GET')return json({partners:(await env.DB.prepare('SELECT user_id,email,name,company,status FROM partners ORDER BY created_at DESC').all()).results,config:await settings(env.DB)});
  if(path==='/api/about'&&request.method==='PUT'){
   const b=await body(request),content={};for(const key of Object.keys(defaults)){content[key]=str(b[key]??'');if(['instagram','linkedin','facebook'].includes(key)&&content[key]){let u;try{u=new URL(content[key])}catch{fail('Enter a valid social profile URL.',400)}if(u.protocol!=='https:')fail('Social links must begin with https://.',400)}}
   await env.DB.prepare("INSERT INTO settings(key,value) VALUES('about',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(content)).run();return json({content});
  }
  if(path==='/api/admin/partner'&&request.method==='PUT'){
   const b=await body(request);if(!['approved','revoked'].includes(b.status))fail('Invalid status.',400);
   const result=await env.DB.prepare('UPDATE partners SET status=? WHERE user_id=?').bind(b.status,str(b.id,200)).run();if(!result.meta.changes)fail('Customer not found.',404);return json({ok:true});
  }
  if(path==='/api/admin/pricing'&&request.method==='PUT'){
   const b=await body(request);if(!['DKK','EUR'].includes(b.currency)||typeof b.enabled!=='boolean'||!['excl. VAT','incl. VAT'].includes(b.tax))fail('Check currency and VAT settings.',400);
   await env.DB.prepare("INSERT INTO settings(key,value) VALUES('prices',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({enabled:b.enabled,currency:b.currency,tax:b.tax})).run();return json({ok:true});
  }
  fail('Not found.',404);
 }catch(error){if(!error.status)console.error('DOOK service error',error.message);return json({error:error.status?error.message:'Could not load or save right now. Your changes have not been cleared. Please try again.'},error.status||503)}
}};

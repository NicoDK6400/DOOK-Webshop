import {catalogueSeed,categorySeed} from './catalogue-seed.mjs';
import {orderRateLimit} from './auth.mjs';
const respond=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
const reject=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const clean=(v,n=200)=>{if(typeof v!=='string'||v.length>n)reject('Kontrollér felterne.');return v.trim()};
const key=v=>{v=clean(v,80);if(!/^[A-Za-z0-9_-]+$/.test(v))reject('Brug bogstaver, tal, bindestreg eller understregning i model- og kategori-ID.');return v};
const all=async(db,q,...args)=>(await db.prepare(q).bind(...args).all()).results;
const stmt=(db,q,...args)=>db.prepare(q).bind(...args);
const now=()=>new Date().toISOString();
const read=async r=>{if(!r.headers.get('content-type')?.startsWith('application/json'))reject('JSON required.',415);const t=await r.text();if(t.length>150000)reject('For mange oplysninger i én ændring.',413);try{return JSON.parse(t)}catch{reject('Invalid JSON.')}};
const imagePath=v=>{v=clean(v||'',200);if(v&&!/^\/(assets\/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp)|media\/[a-f0-9-]{36})$/.test(v))reject('Vælg et billede fra billedbiblioteket.');return v};
const gtin=v=>{v=clean(String(v||''),20).replace(/\s+/g,'');if(!v)return null;if(!/^\d{8,14}$/.test(v))reject('EAN-nummeret skal være 8–14 cifre, eller tomt.');return v};
export async function catalogue(db,admin=false){
 const overrides=await all(db,'SELECT id,payload,version FROM catalogue_products');const cats=await all(db,'SELECT id,payload,version FROM catalogue_categories');
 const products=new Map(catalogueSeed.map(p=>[p.id,{...p,name:p.id,description:'',kind:p.category==='DOOKs'?'dook':'frame',active:true,version:0}]));for(const r of overrides)products.set(r.id,{...JSON.parse(r.payload),version:r.version});
 const categories=new Map(categorySeed.map(c=>[c.id,{...c,version:0}]));for(const r of cats)categories.set(r.id,{...JSON.parse(r.payload),version:r.version});
 return {products:[...products.values()].filter(p=>admin||(p.active&&categories.get(p.category)?.active)),categories:[...categories.values()].filter(c=>admin||c.active).sort((a,b)=>a.position-b.position||a.name.localeCompare(b.name))};
}
export async function commerceSettings(db){const row=await db.prepare("SELECT value FROM settings WHERE key='commerce'").first();return {fewThreshold:5,stockFreshHours:24,...(row?JSON.parse(row.value):{})}}
export async function mediaResponse(request,env){const id=new URL(request.url).pathname.slice(7);if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Not found',{status:404});if(!env.MEDIA)return new Response('Image service unavailable',{status:503});const obj=await env.MEDIA.get('products/'+id);if(!obj)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}})}
export async function commerce(request,env,user){
 const path=new URL(request.url).pathname,db=env.DB;
 if(path==='/api/catalogue'&&request.method==='GET')return respond(await catalogue(db));
 if(!path.startsWith('/api/manage/')&&!['/api/inventory','/api/orders'].includes(path))return null;
 if(!user)reject('Please sign in to continue.',401);
 const admin=user.role==='admin';
 if(path.startsWith('/api/manage/')&&!admin)reject('Administrator access required.',403);
 if(['/api/inventory','/api/orders'].includes(path)&&!['admin','approved','seller'].includes(user.role))reject('Approved partner access required.',403);
 if(path==='/api/inventory'&&request.method==='GET'){
  const rows=await all(db,'SELECT sku,stock,stock_updated FROM catalogue_items WHERE active=1 AND stock IS NOT NULL');const config=await commerceSettings(db);const cutoff=Date.now()-config.stockFreshHours*3600000;
  return respond({items:rows.map(r=>({sku:r.sku,status:Date.parse(r.stock_updated)<cutoff?'unknown':r.stock<=0?'out':r.stock<=config.fewThreshold?'few':'available',updatedAt:r.stock_updated})),connected:false});
 }
 if(path==='/api/manage/catalogue'&&request.method==='GET'){
  const c=await catalogue(db,true),prices=await all(db,'SELECT sku,amount FROM prices'),inventory=await all(db,'SELECT sku,stock,stock_updated,ean FROM catalogue_items');return respond({...c,prices,inventory});
 }
 if(path==='/api/manage/product'&&request.method==='PUT'){
  const b=await read(request),id=key(b.id);if(id==='new')reject('Vælg et andet model-ID.');const c=await catalogue(db,true),existing=c.products.find(p=>p.id===id);
  if((existing?.version||0)!==b.version)reject('Varen er ændret af en anden. Genindlæs oversigten og prøv igen.',409);
  if(!c.categories.some(x=>x.id===b.category&&x.active))reject('Vælg en aktiv kategori.');
  const kind=b.kind||'frame';if(!['frame','dook','other'].includes(kind))reject('Vælg en varetype.');
  const p={id,kind,name:clean(b.name),description:clean(b.description||'',4000),material:clean(b.material||''),category:key(b.category),active:b.active!==false,referenceImage:imagePath(b.referenceImage),referenceColour:clean(b.referenceColour||'Product image'),pairedImage:imagePath(b.pairedImage),variants:[]};
  if(!p.name)reject('Varen skal have et navn.');if(!Array.isArray(b.variants)||!b.variants.length||b.variants.length>40)reject('Tilføj 1–40 farver.');
  const owned=new Map(c.products.filter(x=>x.id!==id).flatMap(x=>x.variants.flatMap(v=>v.items.map(i=>[i.sku,x.id]))));const seen=new Set(),codes=new Set(),eans=new Set(),priceRows=[],stockRows=[];
  const priorStock=new Map((await all(db,'SELECT sku,stock,stock_updated FROM catalogue_items WHERE model=?',id)).map(r=>[r.sku,r]));
  for(const v of b.variants){const code=clean(v.code,100),name=clean(v.name,200);if(!code||!name||codes.has(code))reject('Hver farve skal have en unik farvekode og et navn.');codes.add(code);if(!Array.isArray(v.items)||!v.items.length||v.items.length>20)reject('Tilføj 1–20 størrelser pr. farve.');
   const images=Array.isArray(v.images)?v.images.slice(0,6).map(im=>({src:imagePath(im.src),label:clean(im.label||'Front',100),view:im.view==='angled'?'angled':'front'})).filter(im=>im.src):[];const variant={code,name,images,items:[]};
   for(const i of v.items){const sku=clean(i.sku,160),size=clean(String(i.size||''),40);if(!sku||!size||seen.has(sku))reject('Alle varenumre skal være udfyldt og unikke.');if(owned.has(sku))reject('Varenummeret '+sku+' tilhører '+owned.get(sku)+'.');seen.add(sku);
    const amount=i.amount===''||i.amount===null?null:Number(i.amount),stock=i.stock===''||i.stock===null||i.stock===undefined?null:Number(i.stock),ean=gtin(i.ean);
    if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>1000000||Math.abs(amount*100-Math.round(amount*100))>.00001))reject('Prisen skal være et positivt tal med højst 2 decimaler.');
    if(stock!==null&&(!Number.isInteger(stock)||stock<0||stock>10000000))reject('Lager skal være et helt tal fra 0, eller tomt for ukendt.');
    if(ean){if(eans.has(ean))reject('EAN-nummeret '+ean+' bruges allerede på en anden størrelse i denne vare.');eans.add(ean)}
    const old=priorStock.get(sku);stockRows.push({sku,stock,ean,date:stock===null?null:old?.stock===stock?old.stock_updated:now()});priceRows.push({sku,amount,colour:code,description:p.name+' · '+name+' · '+size});variant.items.push({sku,size});
   }p.variants.push(variant);
  }
  const next=(existing?.version||0)+1;
  // Optimistic claim and all dependent writes are in one transactional D1 batch.
  const update=existing?.version?stmt(db,'UPDATE catalogue_products SET payload=?,version=version+1,updated_at=? WHERE id=? AND version=?',JSON.stringify(p),now(),id,b.version):stmt(db,'INSERT INTO catalogue_products(id,payload,version,updated_at) VALUES(?,?,1,?)',id,JSON.stringify(p),now());
  const gate='EXISTS(SELECT 1 FROM catalogue_products WHERE id=? AND version=? AND payload=?)',g=[id,next,JSON.stringify(p)];
  const statements=[update,stmt(db,`UPDATE catalogue_items SET active=0 WHERE model=? AND ${gate}`,id,...g),stmt(db,`DELETE FROM prices WHERE model=? AND ${gate}`,id,...g)];
  for(const r of stockRows)statements.push(stmt(db,`INSERT INTO catalogue_items(sku,model,active,stock,stock_updated,ean) SELECT ?,?,1,?,?,? WHERE ${gate} ON CONFLICT(sku) DO UPDATE SET model=CASE WHEN catalogue_items.model=excluded.model THEN excluded.model ELSE NULL END,active=1,stock=excluded.stock,stock_updated=excluded.stock_updated,ean=excluded.ean`,r.sku,id,r.stock,r.date,r.ean,...g));
  for(const r of priceRows)if(r.amount!==null)statements.push(stmt(db,`INSERT INTO prices(sku,model,colour,description,amount) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(sku) DO UPDATE SET model=excluded.model,colour=excluded.colour,description=excluded.description,amount=excluded.amount`,r.sku,id,r.colour,r.description,r.amount,...g));
  const result=await db.batch(statements);if(!result[0].meta.changes)reject('Varen blev ændret samtidig. Genindlæs og prøv igen.',409);return respond({ok:true,version:next});
 }
 if(path==='/api/manage/category'&&request.method==='PUT'){
  const b=await read(request),id=key(b.id),c=await catalogue(db,true),existing=c.categories.find(x=>x.id===id);if((existing?.version||0)!==b.version)reject('Kategorien er ændret. Genindlæs oversigten.',409);
  const row={id,name:clean(b.name),description:clean(b.description||'',1000),position:Number(b.position),active:b.active!==false};if(!row.name||!Number.isInteger(row.position)||row.position<0||row.position>999)reject('Udfyld navn og rækkefølge (0–999).');
  if(!row.active&&c.products.some(p=>p.category===id&&p.active))reject('Flyt eller fjern kategoriens aktive varer først.');
  const r=existing?.version?await stmt(db,'UPDATE catalogue_categories SET payload=?,version=version+1 WHERE id=? AND version=?',JSON.stringify(row),id,b.version).run():await stmt(db,'INSERT INTO catalogue_categories(id,payload,version) VALUES(?,?,1)',id,JSON.stringify(row)).run();if(!r.meta.changes)reject('Kategorien blev ændret samtidig. Prøv igen.',409);return respond({ok:true});
 }
 if(path==='/api/manage/media'&&request.method==='GET')return respond({images:await all(db,'SELECT id,name,type,bytes,created_at FROM media_uploads ORDER BY created_at DESC LIMIT 300')});
 if(path==='/api/manage/media'&&request.method==='POST'){
  if(!env.MEDIA)reject('Billedupload er midlertidigt utilgængelig.',503);const declared=Number(request.headers.get('content-length'));if(declared>8*1024*1024)reject('Billedet må højst fylde 8 MB.',413);
  const reader=request.body?.getReader();if(!reader)reject('Vælg et billede.');const chunks=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>8*1024*1024){await reader.cancel();reject('Billedet må højst fylde 8 MB.',413)}chunks.push(value)}const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
  const text=new TextDecoder();let type=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':bytes[0]===137&&text.decode(bytes.slice(1,4))==='PNG'?'image/png':text.decode(bytes.slice(0,4))==='RIFF'&&text.decode(bytes.slice(8,12))==='WEBP'?'image/webp':null;if(!type)reject('Vælg et JPG-, PNG- eller WebP-billede.');
  const id=crypto.randomUUID();let name='Product image';try{name=clean(decodeURIComponent(request.headers.get('x-file-name')||name),250)}catch{reject('Filnavnet er ugyldigt.')}
  await env.MEDIA.put('products/'+id,bytes,{httpMetadata:{contentType:type}});try{await stmt(db,'INSERT INTO media_uploads(id,name,type,bytes,created_at,created_by) VALUES(?,?,?,?,?,?)',id,name,type,length,now(),user.id).run()}catch(e){await env.MEDIA.delete('products/'+id);throw e}return respond({id,url:'/media/'+id,name},201);
 }
 if(path==='/api/manage/commerce'&&request.method==='GET')return respond({config:await commerceSettings(db),connected:false});
 if(path==='/api/manage/commerce'&&request.method==='PUT'){
  const b=await read(request);if(!Number.isInteger(b.fewThreshold)||b.fewThreshold<1||b.fewThreshold>1000||!Number.isInteger(b.stockFreshHours)||b.stockFreshHours<1||b.stockFreshHours>168)reject('Kontrollér lagergrænse og gyldighed.');await stmt(db,"INSERT INTO settings(key,value) VALUES('commerce',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({fewThreshold:b.fewThreshold,stockFreshHours:b.stockFreshHours})).run();return respond({ok:true});
 }
 if(path==='/api/orders'&&request.method==='POST'){
  const b=await read(request),id=clean(b.id,40);if(!/^[a-f0-9-]{36}$/.test(id))reject('Invalid order reference.');
  // A seller/admin can place an order for an approved customer's account instead of their own.
  let targetUserId=user.id,targetEmail=user.email,placedBy=null;
  if(b.customerId!==undefined&&b.customerId!==null&&b.customerId!==''){
   if(!['admin','seller'].includes(user.role))reject('Only sellers or administrators can place an order for another account.',403);
   const customerId=clean(String(b.customerId),40);
   const target=await stmt(db,"SELECT user_id FROM partners WHERE user_id=? AND status='approved'",customerId).first();if(!target)reject('Choose an approved customer.');
   const account=await stmt(db,'SELECT email FROM accounts WHERE user_id=?',customerId).first();if(!account)reject('Choose an approved customer.');
   targetUserId=customerId;targetEmail=account.email;placedBy=user.id;
  }else if(user.role==='seller')reject('Choose a customer to place this order for.');
  const prior=await stmt(db,'SELECT id,user_id,reference,status FROM trade_orders WHERE id=?',id).first();if(prior){if(prior.user_id!==targetUserId)reject('Invalid order reference.',409);return respond({order:prior})}
  // Only genuinely new orders count against the limit — retrying the same id (e.g. after a
  // dropped connection) always reaches the idempotent return above and is never throttled.
  if(!orderRateLimit(user.id))reject('Too many order requests from this account. Please wait a while before trying again, or contact DOOK directly.',429);
  const conf=await db.prepare("SELECT value FROM settings WHERE key='prices'").first();const pricing=conf?JSON.parse(conf.value):{};if(!pricing.enabled)reject('Trade prices must be activated before orders can be submitted.');
  if(!Array.isArray(b.lines)||!b.lines.length||b.lines.length>100)reject('Choose between 1 and 100 order lines.');
  const c=await catalogue(db),skus=new Map(c.products.flatMap(p=>p.variants.flatMap(v=>v.items.map(i=>[i.sku,{model:p.id,name:p.name,colour:v.name,size:i.size}])))),prices=new Map((await all(db,'SELECT sku,amount FROM prices')).map(r=>[r.sku,r.amount]));const seen=new Set(),lines=[];
  for(const l of b.lines){if(!skus.has(l.sku)||seen.has(l.sku)||!Number.isInteger(l.qty)||l.qty<1||l.qty>100)reject('An item is unavailable or its quantity is invalid. Review your selection.');seen.add(l.sku);if(!prices.has(l.sku))reject('A selected item has no confirmed price. Please contact DOOK.');const reference=clean(String(l.reference||''),200);lines.push({sku:l.sku,...skus.get(l.sku),qty:l.qty,unitPrice:prices.get(l.sku),reference})}
  const company=clean(b.company,200),delivery=clean(b.delivery,1500),note=clean(b.note||'',2000);if(!company||!delivery)reject('Enter your company and delivery address.');const partner=await stmt(db,'SELECT company,name FROM partners WHERE user_id=?',targetUserId).first();const ref='WEB-'+id.slice(0,8).toUpperCase();const payload={company,delivery,note,partner:partner||null,email:targetEmail,currency:pricing.currency,tax:pricing.tax,lines,total:Math.round(lines.reduce((s,l)=>s+l.qty*l.unitPrice,0)*100)/100};
  await stmt(db,"INSERT INTO trade_orders(id,user_id,reference,payload,status,placed_by,created_at,updated_at) VALUES(?,?,?,?,'pending',?,?,?)",id,targetUserId,ref,JSON.stringify(payload),placedBy,now(),now()).run();return respond({order:{id,reference:ref,status:'pending'}},201);
 }
 if(path==='/api/orders'&&request.method==='GET'){
  const filterCol=user.role==='seller'?'placed_by':'user_id';
  return respond({orders:(await all(db,`SELECT id,reference,payload,status,created_at,placed_by FROM trade_orders WHERE ${filterCol}=? ORDER BY created_at DESC LIMIT 100`,user.id)).map(r=>({...r,...JSON.parse(r.payload),payload:undefined}))});
 }
 if(path==='/api/manage/orders'&&request.method==='GET')return respond({orders:(await all(db,'SELECT trade_orders.id AS id,reference,payload,status,trade_orders.created_at AS created_at,placed_by,accounts.email AS placed_by_email FROM trade_orders LEFT JOIN accounts ON accounts.user_id=trade_orders.placed_by ORDER BY trade_orders.created_at DESC LIMIT 300')).map(r=>({...r,...JSON.parse(r.payload),payload:undefined}))});
 if(path==='/api/manage/order'&&request.method==='PUT'){const b=await read(request);if(!['pending','handled','cancelled'].includes(b.status))reject('Ugyldig ordrestatus.');await stmt(db,'UPDATE trade_orders SET status=?,updated_at=? WHERE id=?',b.status,now(),clean(b.id,40)).run();return respond({ok:true})}
 reject('Not found.',404);
}

import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';
import {createPasswordResetToken} from '../worker/auth.mjs';
const sql=new DatabaseSync(':memory:');
for(const entry of JSON.parse(readFileSync('drizzle/meta/_journal.json')).entries)sql.exec(readFileSync('drizzle/'+entry.tag+'.sql','utf8'));
const DB={prepare(q){const make=(args=[])=>({first:async()=>sql.prepare(q).get(...args)||null,all:async()=>({results:sql.prepare(q).all(...args)}),run:async()=>({meta:sql.prepare(q).run(...args)})});return {...make(),bind:(...args)=>make(args)}},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
const files=new Map(),MEDIA={async put(k,b,m){files.set(k,{body:b,...m})},async get(k){return files.get(k)||null},async delete(k){files.delete(k)}};
const env={DB,MEDIA,OWNER_ACTIVATION_TOKEN:'test-only'};

// Identity now comes from a signed-up session cookie, not a trusted header — sign
// each simulated user up once (lazily) and reuse its cookie/id for later calls.
const users=new Map();
async function ensureUser(label){
 if(users.has(label))return users.get(label);
 const r=await worker.fetch(new Request('https://test.local/api/signup',{method:'POST',headers:{'content-type':'application/json',origin:'https://test.local'},body:JSON.stringify({email:label+'@example.com',password:'correct horse battery '+label})}),env);
 const info={cookie:r.headers.get('set-cookie').split(';')[0],id:(await r.json()).user.id};
 users.set(label,info);
 return info;
}
const idOf=async label=>(await ensureUser(label)).id;
async function call(path,user=null,method='GET',data,origin='https://test.local'){const headers={'content-type':'application/json',origin};if(user)headers.cookie=(await ensureUser(user)).cookie;const r=await worker.fetch(new Request('https://test.local'+path,{method,headers,body:data?JSON.stringify(data):undefined}),env);return {status:r.status,data:await r.json()}}

await call('/api/activate-owner','owner','POST',{token:'test-only'});
await call('/api/access-request','partner','POST',{company:'Optician',name:'Partner'});await call('/api/admin/partner','owner','PUT',{id:await idOf('partner'),status:'approved'});
assert.equal((await call('/api/catalogue')).data.products.length,45);
assert.equal((await call('/api/manage/catalogue')).status,401);assert.equal((await call('/api/manage/catalogue','partner')).status,403);
const category={id:'TEST',name:'Test collection',description:'Test',position:9,active:true,version:0};assert.equal((await call('/api/manage/category','owner','PUT',category)).status,200);
const product={id:'TESTFRAME',name:'Test frame',description:'A frame',category:'TEST',material:'Titanium',active:true,referenceImage:'',referenceColour:'',pairedImage:'',version:0,variants:[{code:'BLUE',name:'Blue',images:[],items:[{sku:'TESTFRAME-49-BLUE',size:'49',amount:200,stock:3}]}]};
assert.equal((await call('/api/manage/product','owner','PUT',product,'https://evil.example')).status,403);
assert.equal((await call('/api/manage/product','partner','PUT',product)).status,403);
assert.equal((await call('/api/manage/product','owner','PUT',product)).status,200);
assert.equal((await call('/api/manage/product','owner','PUT',product)).status,409);
const publicData=(await call('/api/catalogue')).data;assert.equal(publicData.products.length,46);assert.ok(!JSON.stringify(publicData).includes('amount'));assert.ok(!JSON.stringify(publicData).includes('stock'));
assert.equal((await call('/api/inventory','partner')).data.items[0].status,'few');assert.equal((await call('/api/inventory')).status,401);
sql.prepare('UPDATE catalogue_items SET stock_updated=?').run('2000-01-01T00:00:00Z');assert.equal((await call('/api/inventory','partner')).data.items[0].status,'unknown');
product.version=1;product.variants[0].items[0].stock=0;assert.equal((await call('/api/manage/product','owner','PUT',product)).status,200);assert.equal((await call('/api/inventory','partner')).data.items[0].status,'out');
assert.equal((await call('/api/manage/category','owner','PUT',{...category,version:1,active:false})).status,400);
const order={id:crypto.randomUUID(),company:'Optician',delivery:'Street 1',lines:[{sku:'TESTFRAME-49-BLUE',qty:2,unitPrice:1}]};
assert.equal((await call('/api/orders','partner','POST',order)).status,400);
await call('/api/admin/pricing','owner','PUT',{enabled:true,currency:'DKK',tax:'excl. VAT'});
// Retail customers must never receive trade prices, even while pricing is active.
assert.equal((await call('/api/prices')).status,401);
assert.equal((await call('/api/prices','retail')).status,403);
assert.equal((await call('/api/prices?role=admin','retail')).status,403);
await call('/api/access-request','pending','POST',{company:'Awaiting approval',name:'Pending'});
assert.equal((await call('/api/prices','pending')).status,403);
await call('/api/access-request','revoked','POST',{company:'Revoked account',name:'Revoked'});
await call('/api/admin/partner','owner','PUT',{id:await idOf('revoked'),status:'revoked'});
assert.equal((await call('/api/prices','revoked')).status,403);
assert.ok((await call('/api/prices','partner')).data.prices.some(p=>p.sku==='TESTFRAME-49-BLUE'&&p.amount===200));
assert.ok((await call('/api/prices','owner')).data.prices.length>0);

assert.equal((await call('/api/orders','partner','POST',order)).status,201);assert.equal((await call('/api/orders','partner','POST',order)).status,200);
const orders=(await call('/api/manage/orders','owner')).data.orders;assert.equal(orders.length,1);assert.equal(orders[0].total,400);assert.equal(orders[0].lines[0].unitPrice,200);assert.equal((await call('/api/orders','owner')).data.orders.length,0);assert.equal((await call('/api/manage/orders','partner')).status,403);
assert.equal((await call('/api/orders','owner','POST',order)).status,409);
product.version=2;product.active=false;assert.equal((await call('/api/manage/product','owner','PUT',product)).status,200);assert.equal((await call('/api/catalogue')).data.products.length,45);
assert.equal((await call('/api/orders','partner','POST',{...order,id:crypto.randomUUID()})).status,400);assert.equal((await call('/api/manage/orders','owner')).data.orders[0].total,400);
product.version=3;product.active=true;assert.equal((await call('/api/manage/product','owner','PUT',product)).status,200);
const duplicate=structuredClone(product);duplicate.id='DUPLICATE';duplicate.version=0;assert.equal((await call('/api/manage/product','owner','PUT',duplicate)).status,400);

// --- EAN: optional per-item Uniconta-matching identifier, admin-only ---
const eanProduct={id:'EANTEST',name:'EAN test frame',description:'',category:'TEST',material:'',active:true,referenceImage:'',referenceColour:'',pairedImage:'',version:0,variants:[{code:'BLUE',name:'Blue',images:[],items:[{sku:'EANTEST-49-BLUE',size:'49',amount:100,stock:1,ean:'not-digits'}]}]};
assert.equal((await call('/api/manage/product','owner','PUT',eanProduct)).status,400,'a non-numeric EAN is rejected');
eanProduct.variants[0].items[0].ean='1234567890123456';
assert.equal((await call('/api/manage/product','owner','PUT',eanProduct)).status,400,'a 16-digit EAN is rejected');
eanProduct.variants[0].items[0].ean='5744006890009';
eanProduct.variants[0].items.push({sku:'EANTEST-51-BLUE',size:'51',amount:100,stock:1,ean:'5744006890009'});
assert.equal((await call('/api/manage/product','owner','PUT',eanProduct)).status,400,'the same EAN cannot repeat within one product');
eanProduct.variants[0].items[1].ean='5744006890276';
assert.equal((await call('/api/manage/product','owner','PUT',eanProduct)).status,200);
const eanManaged=(await call('/api/manage/catalogue','owner')).data;
assert.equal(eanManaged.inventory.find(x=>x.sku==='EANTEST-49-BLUE').ean,'5744006890009');
assert.equal(eanManaged.inventory.find(x=>x.sku==='EANTEST-51-BLUE').ean,'5744006890276');
const eanPublic=(await call('/api/catalogue')).data,eanInventory=(await call('/api/inventory','partner')).data;
assert.ok(!JSON.stringify(eanPublic).includes('"ean"')&&!JSON.stringify(eanPublic).includes('5744006890009'),'EAN never reaches the public catalogue');
assert.ok(!JSON.stringify(eanInventory).includes('"ean"')&&!JSON.stringify(eanInventory).includes('5744006890009'),'EAN never reaches the partner-facing inventory feed');

// --- Seller role: browse trade prices and place orders for an approved customer ---
assert.equal((await call('/api/admin/seller','partner','POST',{email:'someone@example.com'})).status,403,'only admins can grant seller access');
assert.equal((await call('/api/admin/seller','owner','POST',{email:'nobody-yet@example.com'})).status,404,'the target must already have an account');
await ensureUser('seller');
assert.equal((await call('/api/admin/seller','owner','POST',{email:'seller@example.com'})).status,200);
assert.equal((await call('/api/prices','seller')).status,200,'sellers can see trade prices');
assert.equal((await call('/api/customers','partner')).status,403,'a regular partner cannot list customers');
const customers=(await call('/api/customers','seller')).data.customers,partnerId=await idOf('partner');
assert.ok(customers.some(c=>c.user_id===partnerId));
const sellerOrder={id:crypto.randomUUID(),customerId:await idOf('partner'),company:'Optician',delivery:'Street 1',lines:[{sku:'TESTFRAME-49-BLUE',qty:1,unitPrice:1}]};
assert.equal((await call('/api/orders','partner','POST',{...sellerOrder,id:crypto.randomUUID(),customerId:await idOf('owner')})).status,403,'an approved partner cannot place an order for someone else');
assert.equal((await call('/api/orders','seller','POST',{...sellerOrder,customerId:undefined})).status,400,'a seller must choose a customer');
assert.equal((await call('/api/orders','seller','POST',sellerOrder)).status,201);
const placedOrder=(await call('/api/manage/orders','owner')).data.orders.find(o=>o.id===sellerOrder.id);
assert.equal(placedOrder.email,'partner@example.com','the order carries the customer\'s email, not the seller\'s');
assert.equal(placedOrder.placed_by_email,'seller@example.com');
assert.ok((await call('/api/orders','partner')).data.orders.some(o=>o.id===sellerOrder.id),'the customer sees the order under their own account');
assert.ok((await call('/api/orders','seller')).data.orders.some(o=>o.id===sellerOrder.id),'the seller sees the order they placed');
await call('/api/admin/partner','owner','PUT',{id:await idOf('seller'),status:'revoked'});
assert.equal((await call('/api/prices','seller')).status,403,'revoking removes seller access');

// --- Rate limiting: caps new order requests per account; idempotent retries are exempt ---
let hitOrderLimit=false;
for(let i=0;i<40&&!hitOrderLimit;i++){
 const r=await call('/api/orders','partner','POST',{id:crypto.randomUUID(),company:'Optician',delivery:'Street 1',lines:[{sku:'TESTFRAME-49-BLUE',qty:1,unitPrice:1}]});
 if(r.status===429)hitOrderLimit=true;
}
assert.ok(hitOrderLimit,'the account is rate-limited after enough new order requests');
assert.equal((await call('/api/orders','partner','POST',order)).status,200,'retrying an existing order id is exempt from the rate limit, even once limited');
assert.equal((await call('/api/orders','owner','POST',{id:crypto.randomUUID(),company:'Optician',delivery:'Street 1',lines:[{sku:'TESTFRAME-49-BLUE',qty:1,unitPrice:1}]})).status,201,'a different account is unaffected by another account\'s rate limit');

// --- Rate limiting: caps partner application submissions per account ---
await ensureUser('spammyapplicant');
let hitAccessLimit=false;
for(let i=0;i<10&&!hitAccessLimit;i++){
 const r=await call('/api/access-request','spammyapplicant','POST',{company:'Spam Optik',name:'Spammy'});
 if(r.status===429)hitAccessLimit=true;
}
assert.ok(hitAccessLimit,'the account is rate-limited after enough access-request submissions');
assert.equal((await call('/api/access-request','owner','POST',{company:'Owner Test',name:'Owner'})).status,200,'a different account is unaffected by another account\'s rate limit');

// --- Order line reference: a per-item note (e.g. an end customer/commission number) ---
const referencedOrder={id:crypto.randomUUID(),company:'Optician',delivery:'Street 1',lines:[{sku:'TESTFRAME-49-BLUE',qty:1,unitPrice:1,reference:'8252 - Louise Hansen'}]};
assert.equal((await call('/api/orders','owner','POST',referencedOrder)).status,201);
const referencedFetched=(await call('/api/manage/orders','owner')).data.orders.find(o=>o.id===referencedOrder.id);
assert.equal(referencedFetched.lines[0].reference,'8252 - Louise Hansen');
assert.equal((await call('/api/orders','owner','POST',{id:crypto.randomUUID(),company:'Optician',delivery:'Street 1',lines:[{sku:'TESTFRAME-49-BLUE',qty:1,unitPrice:1,reference:'x'.repeat(250)}]})).status,400,'a reference over 200 characters is rejected');

const ownerCookie=(await ensureUser('owner')).cookie;
const headers={'origin':'https://test.local',cookie:ownerCookie,'content-type':'image/webp','x-file-name':'test.webp'};
const upload=await worker.fetch(new Request('https://test.local/api/manage/media',{method:'POST',headers,body:readFileSync('public/assets/a002.webp')}),env);assert.equal(upload.status,201);const media=await upload.json();assert.ok(files.size===1);assert.equal((await worker.fetch(new Request('https://test.local'+media.url),env)).status,200);
const invalid=await worker.fetch(new Request('https://test.local/api/manage/media',{method:'POST',headers,body:'<svg><script>alert(1)</script></svg>'}),env);assert.equal(invalid.status,400);
assert.equal((await call('/api/manage/media','partner','POST',{})).status,403);
const pending={title:'Draft',excerpt:'Intro',body:'Story',date:'2026-09-22',published:false,image:''};assert.equal((await call('/api/admin/news','owner','PUT',pending)).status,200);assert.equal((await call('/api/news')).data.articles.length,0);

// --- Homepage slideshow ---
assert.deepEqual((await call('/api/slideshow')).data.images,[]);
assert.equal((await call('/api/admin/slideshow','partner','PUT',{images:[]})).status,403);
assert.equal((await call('/api/admin/slideshow','owner','PUT',{images:[{src:'/not-a-real-image.exe',alt:''}]})).status,400);
const savedSlideshow=await call('/api/admin/slideshow','owner','PUT',{images:[{src:media.url,alt:'Sunglasses on a table'}]});
assert.equal(savedSlideshow.status,200);
assert.equal((await call('/api/slideshow')).data.images[0].src,media.url);

// --- Authentication: signup, login lockout, password reset, logout ---
const post=(path,body,extraHeaders={})=>worker.fetch(new Request('https://test.local'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://test.local',...extraHeaders},body:JSON.stringify(body)}),env);
assert.equal((await post('/api/signup',{email:'not-an-email',password:'longenoughpassword'})).status,400);
assert.equal((await post('/api/signup',{email:'weak@example.com',password:'short'})).status,400);
const authEmail='authtest@example.com',authPassword='a fairly long password 1';
assert.equal((await post('/api/signup',{email:authEmail,password:authPassword})).status,201);
assert.equal((await post('/api/signup',{email:authEmail,password:authPassword})).status,409);
for(let i=0;i<5;i++)assert.equal((await post('/api/login',{email:authEmail,password:'totally wrong'})).status,401);
assert.equal((await post('/api/login',{email:authEmail,password:'totally wrong'})).status,429);
assert.equal((await post('/api/login',{email:authEmail,password:authPassword})).status,429,'even the correct password is rejected while locked out');

const resetEmail='resettest@example.com',oldPassword='original password 123',newPassword='brand new password 456';
const signedUp=await post('/api/signup',{email:resetEmail,password:oldPassword});
const resetUserId=(await signedUp.json()).user.id;
assert.equal((await post('/api/request-password-reset',{email:resetEmail})).status,200);
assert.equal((await post('/api/request-password-reset',{email:'nobody@example.com'})).status,200,'no user enumeration');
const token=await createPasswordResetToken(DB,resetUserId);
assert.equal((await post('/api/reset-password',{token,password:newPassword})).status,200);
assert.equal((await post('/api/reset-password',{token,password:'another password 789'})).status,400,'a reset token is single-use');
assert.equal((await post('/api/login',{email:resetEmail,password:oldPassword})).status,401);
const relogin=await post('/api/login',{email:resetEmail,password:newPassword});
assert.equal(relogin.status,200);
const sessionCookie=relogin.headers.get('set-cookie').split(';')[0];
assert.equal((await (await worker.fetch(new Request('https://test.local/api/me',{headers:{cookie:sessionCookie}}),env)).json()).user.email,resetEmail);
assert.equal((await post('/api/logout',{},{cookie:sessionCookie})).status,200);
assert.equal((await (await worker.fetch(new Request('https://test.local/api/me',{headers:{cookie:sessionCookie}}),env)).json()).user,null);

console.log('PASS: existing 540 prices + 45 models; catalogue CRUD, duplicate SKU and stale edit protection; admin-only writes/upload; CSRF; private prices and inventory; stock thresholds/staleness; archive/restore; durable, server-priced, idempotent orders and owner-scoped reads; validated R2 images; news draft access; signup/login/logout, lockout after repeated failures, and single-use password reset; seller role granting/revoking and placing orders for an approved customer; EAN format/uniqueness validation kept out of public and partner-facing endpoints; per-account order and access-request rate limiting with idempotent order retries exempt; per-line order reference stored and length-validated.');

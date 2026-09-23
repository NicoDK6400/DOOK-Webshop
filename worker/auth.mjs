// Self-hosted email+password auth, replacing the Sites-provided ChatGPT identity headers.
// Password hashing uses crypto.subtle (Web Crypto), the same API the worker already
// uses to compare OWNER_ACTIVATION_TOKEN — no extra crypto dependency.
const ITERATIONS=210000;
const SESSION_COOKIE='dook_session';
const DAY_MS=86400000;
const encoder=new TextEncoder();
const toHex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const fromHex=hex=>new Uint8Array(hex.match(/../g).map(b=>parseInt(b,16)));
const constantTimeEqual=(a,b)=>{if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];return mismatch===0};

async function pbkdf2(password,salt,iterations){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256));
}
async function sha256Hex(value){return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))}

export const normalizeEmail=email=>String(email||'').trim().toLowerCase();
export const isValidEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function hashPassword(password){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const hash=await pbkdf2(password,salt,ITERATIONS);
 return `pbkdf2:${ITERATIONS}:${toHex(salt)}:${toHex(hash)}`;
}
export async function verifyPassword(password,stored){
 const [scheme,iterations,saltHex,hashHex]=String(stored||'').split(':');
 if(scheme!=='pbkdf2'||!iterations||!saltHex||!hashHex)return false;
 const hash=await pbkdf2(password,fromHex(saltHex),Number(iterations));
 return constantTimeEqual(hash,fromHex(hashHex));
}

// Sessions are opaque random ids stored server-side (revocable), not signed JWTs.
export async function createSession(db,userId,maxAgeDays=Number(process.env.SESSION_MAX_AGE_DAYS)||30){
 const id=toHex(crypto.getRandomValues(new Uint8Array(32)));
 const now=new Date(),expiresAt=new Date(now.getTime()+maxAgeDays*DAY_MS).toISOString();
 await db.prepare('INSERT INTO sessions(id,user_id,created_at,expires_at) VALUES(?,?,?,?)').bind(id,userId,now.toISOString(),expiresAt).run();
 return {id,expiresAt};
}
export async function destroySession(db,sessionId){
 if(sessionId)await db.prepare('DELETE FROM sessions WHERE id=?').bind(sessionId).run();
}
function parseCookies(request){
 const out={};
 for(const part of (request.headers.get('cookie')||'').split(';')){
  const i=part.indexOf('=');if(i<0)continue;
  out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
 }
 return out;
}
export function sessionIdFromRequest(request){return parseCookies(request)[SESSION_COOKIE]||null}
export async function getSessionUser(request,db){
 const sessionId=sessionIdFromRequest(request);
 if(!sessionId)return null;
 const row=await db.prepare('SELECT sessions.user_id AS id,accounts.email AS email,sessions.expires_at AS expiresAt FROM sessions JOIN accounts ON accounts.user_id=sessions.user_id WHERE sessions.id=?').bind(sessionId).first();
 if(!row)return null;
 if(Date.parse(row.expiresAt)<Date.now()){await destroySession(db,sessionId);return null}
 return {id:row.id,email:row.email};
}
const isHttps=request=>{const url=new URL(request.url);return url.protocol==='https:'||request.headers.get('x-forwarded-proto')==='https'};
export function sessionCookieHeader(request,sessionId,expiresAt){
 return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly;${isHttps(request)?' Secure;':''} SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`;
}
export function clearSessionCookieHeader(request){
 return `${SESSION_COOKIE}=; Path=/; HttpOnly;${isHttps(request)?' Secure;':''} SameSite=Lax; Max-Age=0`;
}

// In-memory, per-process throttles, keyed by normalized email. Good enough for a
// single-container deployment; resets on restart, an acceptable trade-off for not
// adding a new store. Shared shape for login lockout, signup and password-reset-request
// abuse (repeated probing/enumeration or inbox-flooding of the same email address).
function createThrottle(){
 const attempts=new Map();
 return {
  lockedMs(email){const entry=attempts.get(normalizeEmail(email));return entry?Math.max(0,entry.lockedUntil-Date.now()):0},
  record(email){email=normalizeEmail(email);const entry=attempts.get(email)||{count:0,lockedUntil:0};entry.count++;if(entry.count>=5)entry.lockedUntil=Date.now()+Math.min(30*60000,2**(entry.count-5)*60000);attempts.set(email,entry)},
  clear(email){attempts.delete(normalizeEmail(email))}
 };
}
const loginThrottle=createThrottle();
export const loginLockedMs=loginThrottle.lockedMs;
export const recordLoginFailure=loginThrottle.record;
export const clearLoginFailures=loginThrottle.clear;
const signupThrottle=createThrottle();
export const signupLockedMs=signupThrottle.lockedMs;
export const recordSignupAttempt=signupThrottle.record;
const resetRequestThrottle=createThrottle();
export const resetRequestLockedMs=resetRequestThrottle.lockedMs;
export const recordResetRequestAttempt=resetRequestThrottle.record;

// A sliding-window rate limit for a legitimate, repeatable action — unlike createThrottle
// (which locks out after repeated FAILURES until explicitly cleared), this just caps how
// often the action can happen per key, and allows more again as the window passes.
function createRateLimit(max,windowMs){
 const hits=new Map();
 return key=>{
  const now=Date.now(),recent=(hits.get(key)||[]).filter(t=>now-t<windowMs);
  if(recent.length>=max)return false;
  recent.push(now);hits.set(key,recent);return true;
 };
}
// 30 new order requests per account per hour — generous for a seller placing several
// orders across different customers in a shift, but caps a compromised/scripted account.
export const orderRateLimit=createRateLimit(30,60*60000);

// One-time password-reset tokens: only the SHA-256 hash is stored, matching the
// existing OWNER_ACTIVATION_TOKEN pattern. The raw token only ever lives in the emailed link.
export async function createPasswordResetToken(db,userId,maxAgeMinutes=30){
 const token=toHex(crypto.getRandomValues(new Uint8Array(32)));
 const expiresAt=new Date(Date.now()+maxAgeMinutes*60000).toISOString();
 await db.prepare('INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256Hex(token),userId,expiresAt).run();
 return token;
}
export async function consumePasswordResetToken(db,token){
 const tokenHash=await sha256Hex(token);
 const row=await db.prepare('SELECT user_id AS userId,expires_at AS expiresAt FROM password_resets WHERE token_hash=?').bind(tokenHash).first();
 if(row)await db.prepare('DELETE FROM password_resets WHERE token_hash=?').bind(tokenHash).run();
 if(!row||Date.parse(row.expiresAt)<Date.now())return null;
 return row.userId;
}

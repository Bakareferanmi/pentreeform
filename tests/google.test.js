import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {handle,cleanup} from '../worker/index.js';
import {now,passwordHash,hash} from '../worker/core.js';
const keys=await generateKeyPair('RS256'),jwk={...await exportJWK(keys.publicKey),kid:'google-test',use:'sig',alg:'RS256'};
function database(){const db=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0002_google_auth.sql','0003_usage_alerts.sql','0004_hosted_verification.sql','0005_google_account_linking.sql','0006_welcome_email.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));const prepare=(sql,args=[])=>({bind(...v){return prepare(sql,v)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}}});return {raw:db,prepare,async batch(list){db.exec('BEGIN');try{const r=[];for(const s of list)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}}}
function fixture(){const DB=database(),env={DB,APP_ORIGIN:'https://app.test',GOOGLE_CLIENT_ID:'client-id',GOOGLE_CLIENT_SECRET:'secret-test',REGISTRATION_OPEN:'true'},requests=[],original=global.fetch;let claims={},wrongSignature=false;
 global.fetch=async(url,opt={})=>{requests.push([String(url),opt]);if(String(url).endsWith('/certs'))return Response.json({keys:[jwk]});if(String(url)==='https://oauth2.googleapis.com/token'){const flow=DB.raw.prepare('SELECT nonce FROM oauth_states').get();const current=await fixtureToken(claims,wrongSignature);return Response.json({id_token:current,access_token:'not-stored'})}throw Error('Unexpected request: '+url)};
 let pendingNonce='';async function fixtureToken(extra,bad){return new SignJWT({email:'owner@gmail.com',email_verified:true,name:'Google Owner',nonce:pendingNonce,...extra}).setProtectedHeader({alg:'RS256',kid:'google-test'}).setIssuer(extra.iss||'https://accounts.google.com').setAudience(extra.aud||'client-id').setSubject(extra.sub||'google-subject').setIssuedAt().setExpirationTime(extra.exp??'5m').sign(bad?(await generateKeyPair('RS256')).privateKey:keys.privateKey)}
 async function req(path,{method='GET',body,cookie,origin='https://app.test'}={}){return handle(new Request('https://app.test'+path,{method,headers:{Origin:origin,'X-Pentreeform':'1',...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{waitUntil(){}})}
 async function start(intent='login'){const r=await req('/api/auth/google/start',{method:'POST',body:{intent}});assert.equal(r.status,200,await r.clone().text());const url=new URL((await r.json()).url);pendingNonce=url.searchParams.get('nonce');return {response:r,url,cookie:r.headers.get('set-cookie').split(';')[0],state:url.searchParams.get('state')}}
 const callback=(flow,extra='')=>req('/api/auth/google/callback?code=code-test&state='+flow.state+extra,{cookie:flow.cookie});
 return {env,DB,requests,req,start,callback,setClaims(v){claims=v},setBadSignature(){wrongSignature=true},close(){DB.raw.close();global.fetch=original}}}
test('Google start uses state, nonce, PKCE, exact callback and protected browser cookie; CSRF/config gates apply',async()=>{const f=fixture();try{const flow=await f.start('register');assert.equal(flow.url.origin,'https://accounts.google.com');assert.equal(flow.url.searchParams.get('redirect_uri'),'https://app.test/api/auth/google/callback');assert.equal(flow.url.searchParams.get('scope'),'openid email profile');assert.equal(flow.url.searchParams.get('code_challenge_method'),'S256');const row=f.DB.raw.prepare('SELECT * FROM oauth_states').get(),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.verifier));const expected=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');assert.equal(flow.url.searchParams.get('code_challenge'),expected);assert.match(flow.response.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=600; Secure/);assert.equal((await f.req('/api/auth/google/start',{method:'POST',body:{intent:'login'},origin:'https://evil.test'})).status,403);f.env.REGISTRATION_OPEN='false';assert.equal((await f.req('/api/auth/google/start',{method:'POST',body:{intent:'register'}})).status,403);delete f.env.GOOGLE_CLIENT_SECRET;assert.equal((await f.req('/api/auth/google/start',{method:'POST',body:{intent:'login'}})).status,503)}finally{f.close()}});
test('Google signup and repeat login keep the same account, set a session and never store provider tokens',async()=>{const f=fixture();try{let flow=await f.start('register'),r=await f.callback(flow);assert.equal(r.status,303);assert.equal(r.headers.get('location'),'https://app.test/app');assert.match(r.headers.get('set-cookie'),/pentree_session=/);assert.ok(!r.headers.get('location').includes('token'));const u=f.DB.raw.prepare('SELECT * FROM users').get();assert.equal(u.email,'owner@gmail.com');assert.equal(u.verified,1);assert.equal(u.password_hash,'!google');assert.equal(u.welcome_email_queued,1);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM outbox WHERE kind='welcome'").get().n,1);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM oauth_states').get().n,0);assert.ok(!JSON.stringify(f.DB.raw.prepare('SELECT * FROM google_identities').get()).includes('access_token'));const cookies=r.headers.getSetCookie();const session=cookies.find(c=>c.startsWith('pentree_session=')).split(';')[0];assert.equal((await f.req('/api/auth/me',{cookie:session})).status,200);assert.ok((await f.callback(flow)).headers.get('location').endsWith('auth_error=invalid_state'));f.env.REGISTRATION_OPEN='false';flow=await f.start();r=await f.callback(flow);assert.equal(r.headers.get('location'),'https://app.test/app');assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM users').get().n,1);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM outbox WHERE kind='welcome'").get().n,1)}finally{f.close()}});
test('Google callback rejects missing/wrong browser cookie, expired flow and cancelled consent',async()=>{const f=fixture();try{const flow=await f.start();let r=await f.req('/api/auth/google/callback?state='+flow.state+'&code=x');assert.ok(r.headers.get('location').endsWith('auth_error=invalid_state'));assert.equal(f.requests.length,0);f.DB.raw.prepare('UPDATE oauth_states SET expires_at=?').run(now()-1);r=await f.callback(flow);assert.ok(r.headers.get('location').endsWith('auth_error=invalid_state'));const fresh=await f.start();r=await f.req('/api/auth/google/callback?state='+fresh.state+'&error=access_denied',{cookie:fresh.cookie});assert.ok(r.headers.get('location').endsWith('auth_error=cancelled'));assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM users').get().n,0)}finally{f.close()}});
test('Google JWT signature, audience, nonce and email verification are checked',async()=>{const f=fixture();try{for(const claim of [{aud:'other-client'},{nonce:'wrong'},{email_verified:false},{exp:now()-60},{iss:'https://evil.test'}]){f.setClaims(claim);const flow=await f.start(),r=await f.callback(flow);assert.ok(r.headers.get('location').endsWith('auth_error=failed'));assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM users').get().n,0)}f.setClaims({});f.setBadSignature();const r=await f.callback(await f.start());assert.ok(r.headers.get('location').endsWith('auth_error=failed'))}finally{f.close()}});
test('matching password accounts are not silently linked, and closed signup cannot create accounts',async()=>{const f=fixture();try{f.DB.raw.prepare("INSERT INTO users(id,email,name,workspace,password_hash,created_at) VALUES('password-user','owner@gmail.com','Owner','Workspace','test',?)").run(now());let r=await f.callback(await f.start());assert.ok(r.headers.get('location').endsWith('auth_error=account_exists'));assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM google_identities').get().n,0);f.setClaims({email:'new@gmail.com'});f.env.REGISTRATION_OPEN='false';r=await f.callback(await f.start());assert.ok(r.headers.get('location').endsWith('auth_error=registration_closed'));assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM users').get().n,1)}finally{f.close()}});
test('external Google emails still need local email verification before receiving form notifications',async()=>{const f=fixture();try{f.env.RESEND_API_KEY='test';f.setClaims({email:'owner@external.test'});const r=await f.callback(await f.start('register'));assert.equal(r.headers.get('location'),'https://app.test/app');assert.equal(f.DB.raw.prepare('SELECT verified FROM users').get().verified,0);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM outbox WHERE kind='verify'").get().n,1);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM auth_tokens WHERE kind='verify'").get().n,1);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM outbox WHERE kind='welcome'").get().n,0);const verification=JSON.parse(f.DB.raw.prepare("SELECT payload FROM outbox WHERE kind='verify'").get().payload).text.match(/#verify=([a-f0-9]+)/)[1];assert.equal((await f.req('/api/auth/verify',{method:'POST',body:{token:verification}})).status,200);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM outbox WHERE kind='welcome'").get().n,1)}finally{f.close()}});

const password='correct horse battery staple';
async function passwordAccount(f,{id='password-user',address='owner@gmail.com',verified=1}={}){
 const stored=await passwordHash(password);
 f.DB.raw.prepare("INSERT INTO users(id,email,name,workspace,password_hash,verified,plan,paid_until,created_at) VALUES(?,?,?,?,?,?,'Pro',?,?)").run(id,address,'Original Owner','Existing workspace',stored,verified,now()+86400,now());
 return f.DB.raw.prepare('SELECT * FROM users WHERE id=?').get(id);
}
async function pendingCookies(f){
 const response=await f.callback(await f.start());assert.equal(response.headers.get('location'),'https://app.test/app#google_link=1');
 const cookies=response.headers.getSetCookie();assert.ok(cookies.every(c=>c.includes('HttpOnly')&&c.includes('Secure')));
 assert.ok(!response.headers.get('location').includes('ticket'));
 return cookies.map(c=>c.split(';')[0]).join('; ');
}
test('password accounts confirm once, retain their original account and password, then support returning Google sign-in',async()=>{
 const f=fixture();try{
  const before=await passwordAccount(f);f.env.REGISTRATION_OPEN='false';
  f.DB.raw.prepare("INSERT INTO forms(id,user_id,name,domain,created_at) VALUES('existing-form',?,'Existing form','example.test',?)").run(before.id,now());
  f.DB.raw.prepare("INSERT INTO submissions(id,form_id,user_id,name,email,subject,message,fields,created_at,month) VALUES('existing-message','existing-form',?,'Visitor','visitor@example.test','Original enquiry','Keep this message','{}',?,?)").run(before.id,now(),new Date().toISOString().slice(0,7));
  const oldForm=f.DB.raw.prepare('SELECT * FROM forms').get(),oldMessage=f.DB.raw.prepare('SELECT * FROM submissions').get();
  const cookies=await pendingCookies(f);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM google_identities').get().n,0);
  let response=await f.req('/api/auth/google/link',{cookie:cookies});assert.deepEqual(await response.json(),{email:before.email});
  response=await f.req('/api/auth/google/link',{method:'POST',cookie:cookies,body:{password:'incorrect long password'}});assert.equal(response.status,401);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM google_link_requests').get().n,1);
  response=await f.req('/api/auth/google/link',{method:'POST',cookie:cookies,body:{password,user_id:'someone-else',email:'attacker@example.test',google_subject:'attacker'}});assert.equal(response.status,200,await response.clone().text());
  const signed=await response.json();assert.equal(signed.user.id,before.id);assert.equal(signed.user.plan,'Pro');assert.equal(signed.user.workspace,before.workspace);
  assert.deepEqual(f.DB.raw.prepare('SELECT * FROM users WHERE id=?').get(before.id),before);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM forms').get(),oldForm);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM submissions').get(),oldMessage);
  assert.deepEqual({...f.DB.raw.prepare('SELECT subject,user_id FROM google_identities').get()},{subject:'google-subject',user_id:before.id});
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM google_link_requests').get().n,0);assert.ok(response.headers.getSetCookie().some(c=>c.startsWith('pentree_google_link=;')&&c.includes('Max-Age=0')));
  assert.equal((await f.req('/api/auth/google/link',{method:'POST',cookie:cookies,body:{password}})).status,410,'Proof is single-use');
  response=await f.req('/api/auth/login',{method:'POST',body:{email:before.email,password}});assert.equal(response.status,200,'Existing password still works');assert.equal((await response.json()).user.id,before.id);
  response=await f.callback(await f.start());assert.equal(response.headers.get('location'),'https://app.test/app');assert.ok(response.headers.getSetCookie().some(c=>c.startsWith('pentree_session=')));assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM users').get().n,1);
 }finally{f.close()}
});
test('link proofs require the original browser, exact pending account, CSRF protection and an unexpired Google flow',async()=>{
 const f=fixture();try{
  await passwordAccount(f);const cookie=await pendingCookies(f);
  for(const invalid of ['',cookie.split('; ')[0],cookie.replace(/pentree_google=[a-f0-9]+/,'pentree_google='+'a'.repeat(64)),cookie.replace(/pentree_google_link=[a-f0-9]+/,'pentree_google_link='+'b'.repeat(64))])assert.equal((await f.req('/api/auth/google/link',{cookie:invalid})).status,410);
  assert.equal((await f.req('/api/auth/google/link',{method:'POST',cookie,origin:'https://evil.test',body:{password}})).status,403);
  f.DB.raw.prepare('UPDATE google_link_requests SET expires_at=?').run(now()-1);
  assert.equal((await f.req('/api/auth/google/link',{method:'POST',cookie,body:{password}})).status,410);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM google_identities').get().n,0);
  await cleanup(f.env);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM google_link_requests').get().n,0);
 }finally{f.close()}
});
test('linking rejects provider-identity conflicts and password changes during confirmation without moving accounts',async()=>{
 for(const conflict of ['subject','user','password-race']){
  const f=fixture();try{
   const user=await passwordAccount(f),cookie=await pendingCookies(f);
   if(conflict==='subject'){await passwordAccount(f,{id:'other',address:'other@gmail.com'});f.DB.raw.prepare('INSERT INTO google_identities VALUES(?,?,?)').run('google-subject','other',now())}
   if(conflict==='user')f.DB.raw.prepare('INSERT INTO google_identities VALUES(?,?,?)').run('different-subject',user.id,now());
   if(conflict==='password-race'){const batch=f.env.DB.batch.bind(f.env.DB);f.env.DB.batch=async statements=>{f.DB.raw.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await passwordHash('a different current password'),user.id);return batch(statements)}}
   const response=await f.req('/api/auth/google/link',{method:'POST',cookie,body:{password}});assert.equal(response.status,conflict==='password-race'?410:409);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM sessions').get().n,0);
   if(conflict==='subject')assert.equal(f.DB.raw.prepare('SELECT user_id FROM google_identities WHERE subject=?').get('google-subject').user_id,'other');
   if(conflict==='user')assert.equal(f.DB.raw.prepare('SELECT subject FROM google_identities WHERE user_id=?').get(user.id).subject,'different-subject');
  }finally{f.close()}
 }
});
test('password confirmation is rate-limited and does not promote an unverified password account',async()=>{
 const f=fixture();try{
  await passwordAccount(f,{verified:0});const cookie=await pendingCookies(f);
  for(let i=0;i<5;i++)assert.equal((await f.req('/api/auth/google/link',{method:'POST',cookie,body:{password:'wrong password value'}})).status,401);
  assert.equal((await f.req('/api/auth/google/link',{method:'POST',cookie,body:{password}})).status,429);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM google_identities').get().n,0);
  f.DB.raw.prepare('DELETE FROM rate_limits').run();const response=await f.req('/api/auth/google/link',{method:'POST',cookie,body:{password}});assert.equal(response.status,200);assert.equal((await response.json()).user.verified,false);
 }finally{f.close()}
});

test('resetting a password invalidates unfinished Google connections',async()=>{
 const f=fixture();try{
  const user=await passwordAccount(f),cookie=await pendingCookies(f),reset='a'.repeat(64);
  f.DB.raw.prepare("INSERT INTO auth_tokens(token_hash,user_id,kind,expires_at) VALUES(?,?,'reset',?)").run(await hash(reset),user.id,now()+600);
  const response=await f.req('/api/auth/reset',{method:'POST',body:{token:reset,password:'a different current password'}});assert.equal(response.status,200);
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM google_link_requests').get().n,0);assert.equal((await f.req('/api/auth/google/link',{method:'POST',cookie,body:{password:'a different current password'}})).status,410);
 }finally{f.close()}
});

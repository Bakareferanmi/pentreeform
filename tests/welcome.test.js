import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fixture} from './fixture.js';
import {welcomeMessage,welcomeStatements,queueExistingWelcomes,queueWelcomeSignatureResends} from '../worker/welcome.js';
import {drain} from '../worker/mail.js';
import worker,{cleanup} from '../worker/index.js';
import {now,uid} from '../worker/core.js';
const registration={email:'ada@example.test',password:'correct horse battery staple',name:'Ada Okafor',workspace:'Ada Studio',challenge:'valid-auth'};
async function register(f){const response=await f.request('/api/auth/register',{method:'POST',data:registration});assert.equal(response.status,201);return f.emails[0].text.match(/#verify=([a-f0-9]+)/)[1]}
const verify=(f,token)=>f.request('/api/auth/verify',{method:'POST',data:{token}});
const count=f=>f.DB.raw.prepare("SELECT count(*) n FROM outbox WHERE kind='welcome'").get().n;
function user(f,address){const u={id:uid(),name:'Ada Okafor',email:address};f.DB.raw.prepare("INSERT INTO users(id,email,name,workspace,password_hash,verified,created_at) VALUES(?,?,?,'Studio','test',1,?)").run(u.id,u.email,u.name,now());return u}

test('password registration sends one personalised welcome after verification, never on repeat sign-in',async()=>{const f=fixture();try{
 const token=await register(f);assert.equal(count(f),0);assert.equal(f.emails.length,1);
 assert.equal((await verify(f,token)).status,200);assert.equal(count(f),1);
 const welcome=f.emails.find(email=>email.subject==='Welcome to Pentreeform');assert.ok(welcome);assert.deepEqual(welcome.to,[registration.email]);assert.equal(welcome.from,f.env.EMAIL_FROM);assert.match(welcome.text,/Hi Ada,/);assert.match(welcome.html,/Hi Ada,/);assert.match(welcome.html,/https:\/\/app.test\/app/);assert.match(welcome.html,/https:\/\/app.test\/email-logo.png/);assert.match(welcome.html,/Check Inbox and Deliveries/);assert.match(welcome.text,/signed up for Pentreeform/);
 assert.equal((await verify(f,token)).status,400);assert.equal((await f.request('/api/auth/login',{method:'POST',data:registration})).status,200);await f.request('/api/auth/resend',{method:'POST',data:registration});assert.equal(f.emails.filter(email=>email.subject==='Welcome to Pentreeform').length,1);
 const owner=f.DB.raw.prepare('SELECT * FROM users WHERE email=?').get(registration.email);
 await f.DB.batch(welcomeStatements(f.env,owner));await f.DB.batch(welcomeStatements(f.env,owner));assert.equal(count(f),1);
 f.DB.raw.prepare("UPDATE outbox SET created_at=? WHERE kind='welcome'").run(now()-31*86400);await cleanup(f.env);assert.equal(count(f),0);await f.DB.batch(welcomeStatements(f.env,owner));assert.equal(count(f),0,'The durable claim survives outbox cleanup');
 }finally{f.close()}});

test('verification and welcome claims roll back together, allowing a safe retry',async()=>{const f=fixture();try{
 const token=await register(f);f.DB.raw.exec("CREATE TRIGGER fail_welcome BEFORE INSERT ON outbox WHEN NEW.kind='welcome' BEGIN SELECT RAISE(ABORT,'TEST_WELCOME_FAILURE'); END");
 assert.equal((await verify(f,token)).status,500);assert.deepEqual({...f.DB.raw.prepare('SELECT verified,welcome_email_queued FROM users').get()},{verified:0,welcome_email_queued:0});assert.equal(count(f),0);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM auth_tokens WHERE kind='verify'").get().n,1);
 f.DB.raw.exec('DROP TRIGGER fail_welcome');assert.equal((await verify(f,token)).status,200);assert.equal(count(f),1);
 }finally{f.close()}});

test('temporary welcome delivery failures retry with the same provider key and payload',async()=>{const f=fixture();try{
 const token=await register(f),provider=global.fetch,attempts=[];
 global.fetch=async(url,options)=>{if(String(url)==='https://api.resend.com/emails'){attempts.push({key:options.headers['Idempotency-Key'],body:options.body});return new Response('',{status:503})}return provider(url,options)};
 assert.equal((await verify(f,token)).status,200);let row=f.DB.raw.prepare("SELECT * FROM outbox WHERE kind='welcome'").get();assert.equal(row.state,'queued');assert.equal(row.attempts,1);assert.equal(f.DB.raw.prepare('SELECT verified,welcome_email_queued FROM users').get().welcome_email_queued,1);
 global.fetch=async(url,options)=>{if(String(url)==='https://api.resend.com/emails')attempts.push({key:options.headers['Idempotency-Key'],body:options.body});return provider(url,options)};
 f.DB.raw.prepare('UPDATE outbox SET available_at=0 WHERE id=?').run(row.id);await drain(f.env);row=f.DB.raw.prepare('SELECT * FROM outbox WHERE id=?').get(row.id);assert.equal(row.state,'accepted');assert.equal(row.attempts,2);assert.deepEqual(attempts[0],attempts[1]);assert.equal(count(f),1);await drain(f.env);assert.equal(attempts.length,2);
 }finally{f.close()}});

test('suppressed or no longer verified recipients do not receive welcome messages',async()=>{const f=fixture();try{
 const blocked=user(f,'blocked@example.test');await f.DB.batch(welcomeStatements(f.env,blocked));f.DB.raw.prepare("INSERT INTO suppressions(email,reason,created_at) VALUES(?,'bounced',?)").run(blocked.email,now());await drain(f.env);assert.equal(f.DB.raw.prepare('SELECT state FROM outbox WHERE user_id=?').get(blocked.id).state,'suppressed');
 const unverified=user(f,'unverified@example.test');await f.DB.batch(welcomeStatements(f.env,unverified));f.DB.raw.prepare('UPDATE users SET verified=0 WHERE id=?').run(unverified.id);await drain(f.env);assert.equal(f.DB.raw.prepare('SELECT state FROM outbox WHERE user_id=?').get(unverified.id).state,'cancelled');
 const changed=user(f,'changed@example.test');await f.DB.batch(welcomeStatements(f.env,changed));f.DB.raw.prepare("UPDATE users SET email='different@example.test' WHERE id=?").run(changed.id);await drain(f.env);assert.equal(f.DB.raw.prepare('SELECT state FROM outbox WHERE user_id=?').get(changed.id).state,'cancelled');assert.equal(f.emails.length,0);
 }finally{f.close()}});

test('welcome markup escapes names, supports plain text, and uses only canonical product links',()=>{
 const message=welcomeMessage({APP_ORIGIN:'https://pentreeform.test'},{name:'<img/src=x> Owner'});assert.match(message.html,/Hi &lt;img\/src=x&gt;,/);assert.ok(!message.html.includes('<img/src=x>'));assert.match(message.text,/Hi <img\/src=x>,/);assert.match(message.html,/prefers-color-scheme:dark/);assert.match(message.html,/width="560"/);assert.match(message.html,/href="https:\/\/pentreeform.test\/support"/);assert.ok(!message.html.includes('<script'));assert.match(welcomeMessage({APP_ORIGIN:'https://app.test'},{name:''}).text,/Hi there,/);
});

test('welcome migration does not backfill old accounts and health detects an unapplied migration',async()=>{
 const db=new DatabaseSync(':memory:');try{for(const file of ['0001_initial.sql','0002_google_auth.sql','0003_usage_alerts.sql','0004_hosted_verification.sql','0005_google_account_linking.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 db.exec("INSERT INTO users(id,email,name,workspace,password_hash,created_at) VALUES('old','old@example.test','Old','Old','test',0)");db.exec(readFileSync(new URL('../migrations/0006_welcome_email.sql',import.meta.url),'utf8'));assert.equal(db.prepare('SELECT welcome_email_queued FROM users').get().welcome_email_queued,1);
 db.exec("INSERT INTO users(id,email,name,workspace,password_hash,created_at) VALUES('new','new@example.test','New','New','test',0)");assert.equal(db.prepare("SELECT welcome_email_queued FROM users WHERE id='new'").get().welcome_email_queued,0);
 }finally{db.close()}
 const f=fixture();try{assert.equal((await f.request('/api/health')).status,200);f.DB.raw.exec('ALTER TABLE users DROP COLUMN welcome_email_queued');const response=await f.request('/api/health');assert.equal(response.status,503);assert.equal((await response.json()).checks.schema,false)}finally{f.close()}
});

async function scheduled(f){const waits=[];await worker.scheduled({},f.env,{waitUntil(promise){waits.push(promise)}});await Promise.all(waits)}
function existing(f,address,verified=1){const owner=user(f,address);f.DB.raw.prepare('UPDATE users SET verified=?,welcome_email_queued=1,welcome_email_backfill=1 WHERE id=?').run(verified,owner.id);return owner}

test('existing verified accounts receive one welcome without signing in, including after repeated scheduled runs and cleanup',async()=>{const f=fixture();try{
 const owner=existing(f,'existing@example.test');await scheduled(f);assert.equal(f.emails.length,1);assert.equal(f.emails[0].to[0],owner.email);assert.match(f.emails[0].text,/Hi Ada,/);assert.equal(f.DB.raw.prepare('SELECT welcome_email_backfill FROM users WHERE id=?').get(owner.id).welcome_email_backfill,0);
 await scheduled(f);assert.equal(f.emails.length,1);assert.equal(count(f),1);
 f.DB.raw.prepare("UPDATE outbox SET created_at=? WHERE kind='welcome'").run(now()-31*86400);await cleanup(f.env);assert.equal(count(f),0);await scheduled(f);assert.equal(f.emails.length,1,'Cleanup cannot recreate an existing-account welcome');
 }finally{f.close()}});

test('existing-account sends process small batches and preserve verification and suppression checks',async()=>{const f=fixture();try{
 for(let i=0;i<7;i++)existing(f,`batch${i}@example.test`);
 const unverified=existing(f,'not-verified@example.test',0),suppressed=existing(f,'suppressed@example.test');f.DB.raw.prepare("INSERT INTO suppressions(email,reason,created_at) VALUES(?,'complained',?)").run(suppressed.email,now());
 await scheduled(f);assert.equal(f.emails.length,5);await scheduled(f);assert.equal(f.emails.length,7);await scheduled(f);assert.equal(f.emails.length,7);assert.ok(!f.emails.some(email=>[unverified.email,suppressed.email].includes(email.to[0])));
 }finally{f.close()}});

test('existing unverified accounts receive their welcome when they later verify',async()=>{const f=fixture();try{
 const token=await register(f);f.DB.raw.prepare('UPDATE users SET welcome_email_queued=1,welcome_email_backfill=1').run();await scheduled(f);assert.equal(count(f),0);
 assert.equal((await verify(f,token)).status,200);assert.equal(count(f),1);await scheduled(f);assert.equal(f.emails.filter(email=>email.subject==='Welcome to Pentreeform').length,1);assert.equal(f.DB.raw.prepare('SELECT welcome_email_backfill FROM users').get().welcome_email_backfill,0);
 }finally{f.close()}});

test('existing-account claims are atomic and skip any welcome already queued after the snapshot',async()=>{const f=fixture();try{
 const owner=existing(f,'retry-existing@example.test');f.DB.raw.exec("CREATE TRIGGER fail_existing_welcome BEFORE INSERT ON outbox WHEN NEW.kind='welcome' BEGIN SELECT RAISE(ABORT,'TEST_BACKFILL_FAILURE'); END");
 await assert.rejects(queueExistingWelcomes(f.env),/TEST_BACKFILL_FAILURE/);assert.equal(count(f),0);assert.equal(f.DB.raw.prepare('SELECT welcome_email_backfill FROM users').get().welcome_email_backfill,1);
 f.DB.raw.exec('DROP TRIGGER fail_existing_welcome');await queueExistingWelcomes(f.env);assert.equal(count(f),1);
 f.DB.raw.prepare('UPDATE users SET welcome_email_backfill=1 WHERE id=?').run(owner.id);await queueExistingWelcomes(f.env);assert.equal(count(f),1);assert.equal(f.DB.raw.prepare('SELECT welcome_email_backfill FROM users').get().welcome_email_backfill,0);await scheduled(f);assert.equal(f.emails.length,1);
 }finally{f.close()}});

test('existing-account migration includes excluded users and excludes every previously attempted welcome',()=>{
 const db=new DatabaseSync(':memory:');try{
 for(const file of ['0001_initial.sql','0002_google_auth.sql','0003_usage_alerts.sql','0004_hosted_verification.sql','0005_google_account_linking.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const insert=id=>db.prepare("INSERT INTO users(id,email,name,workspace,password_hash,created_at) VALUES(?,?,'Old account','Workspace','test',0)").run(id,id+'@example.test');
 insert('excluded');insert('unverified');db.exec(readFileSync(new URL('../migrations/0006_welcome_email.sql',import.meta.url),'utf8'));
 for(const state of ['queued','sending','accepted','delivered','failed','bounced','complained','suppressed','cancelled']){insert(state);db.prepare('UPDATE users SET welcome_email_queued=1 WHERE id=?').run(state);db.prepare("INSERT INTO outbox(id,user_id,recipient,payload,kind,state,available_at,created_at) VALUES(?,?,?,'{}','welcome',?,0,0)").run('job-'+state,state,state+'@example.test',state)}
 db.exec(readFileSync(new URL('../migrations/0007_existing_account_welcome.sql',import.meta.url),'utf8'));
 assert.deepEqual(db.prepare('SELECT id FROM users WHERE welcome_email_backfill=1 ORDER BY id').all().map(row=>row.id),['excluded','unverified']);
 insert('new');assert.deepEqual({...db.prepare("SELECT welcome_email_queued,welcome_email_backfill FROM users WHERE id='new'").get()},{welcome_email_queued:0,welcome_email_backfill:0});
 }finally{db.close()}
});

function snapshotSignatureResends(f){
 f.DB.raw.exec('DROP TABLE welcome_signature_resends');
 f.DB.raw.exec(readFileSync(new URL('../migrations/0008_welcome_signature_resend.sql',import.meta.url),'utf8'));
}
const refreshCount=f=>f.DB.raw.prepare("SELECT count(*) n FROM outbox WHERE kind='welcome-signature'").get().n;

test('the three existing recipients get the updated signature once, including after cleanup; later accounts get no refresh',async()=>{const f=fixture();try{
 for(let i=0;i<3;i++){const owner=user(f,`old${i}@example.test`);await f.DB.batch(welcomeStatements(f.env,owner))}
 await drain(f.env);assert.equal(f.emails.length,3);
 snapshotSignatureResends(f);const future=user(f,'future@example.test');await f.DB.batch(welcomeStatements(f.env,future));
 await scheduled(f);assert.equal(refreshCount(f),3);assert.equal(f.emails.length,7);
 const refreshed=f.emails.slice(3).filter(email=>email.to[0]!==future.email);assert.equal(refreshed.length,3);
 for(const email of refreshed){assert.match(email.text,/Bakare Feranmi\nFounder\nPentreeform/);assert.match(email.html,/<strong>Bakare Feranmi<\/strong><br><span[^>]+>Founder<br>Pentreeform/)}
 await scheduled(f);await queueWelcomeSignatureResends(f.env);assert.equal(f.emails.length,7);
 f.DB.raw.prepare("UPDATE outbox SET created_at=? WHERE kind='welcome-signature'").run(now()-31*86400);await cleanup(f.env);assert.equal(refreshCount(f),0);await scheduled(f);assert.equal(f.emails.length,7);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM welcome_signature_resends WHERE queued=1').get().n,3);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM welcome_signature_resends WHERE user_id=?').get(future.id).n,0);
 }finally{f.close()}});

test('signature refresh snapshots verified accounts, waits for pending welcomes and respects suppression and recipient changes',async()=>{const f=fixture();try{
 const pending=user(f,'pending@example.test');await f.DB.batch(welcomeStatements(f.env,pending));
 const blocked=user(f,'blocked-refresh@example.test'),changed=user(f,'changed-refresh@example.test'),unverified=user(f,'unverified-refresh@example.test'),revoked=user(f,'revoked-refresh@example.test');
 f.DB.raw.prepare('UPDATE users SET verified=0 WHERE id=?').run(unverified.id);snapshotSignatureResends(f);
 f.DB.raw.prepare("INSERT INTO suppressions(email,reason,created_at) VALUES(?,'complained',?)").run(blocked.email,now());
 await queueWelcomeSignatureResends(f.env);assert.equal(refreshCount(f),2);assert.equal(f.DB.raw.prepare('SELECT queued FROM welcome_signature_resends WHERE user_id=?').get(pending.id).queued,0);
 f.DB.raw.prepare("UPDATE users SET email='replacement@example.test' WHERE id=?").run(changed.id);f.DB.raw.prepare('UPDATE users SET verified=0 WHERE id=?').run(revoked.id);
 await drain(f.env);assert.equal(f.emails.length,1);assert.equal(f.emails[0].to[0],pending.email);
 assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM outbox WHERE kind='welcome-signature' AND state='cancelled'").get().n,2);
 await scheduled(f);assert.equal(f.emails.length,2);assert.equal(f.emails[1].to[0],pending.email);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM welcome_signature_resends WHERE user_id=?').get(unverified.id).n,0);
 }finally{f.close()}});

test('signature refresh claims are atomic and provider retries keep the same key and body',async()=>{const f=fixture();try{
 user(f,'retry-refresh@example.test');snapshotSignatureResends(f);
 f.DB.raw.exec("CREATE TRIGGER fail_refresh BEFORE INSERT ON outbox WHEN NEW.kind='welcome-signature' BEGIN SELECT RAISE(ABORT,'TEST_REFRESH_FAILURE'); END");
 await assert.rejects(queueWelcomeSignatureResends(f.env),/TEST_REFRESH_FAILURE/);assert.equal(refreshCount(f),0);assert.equal(f.DB.raw.prepare('SELECT queued FROM welcome_signature_resends').get().queued,0);
 f.DB.raw.exec('DROP TRIGGER fail_refresh');await queueWelcomeSignatureResends(f.env);await queueWelcomeSignatureResends(f.env);assert.equal(refreshCount(f),1);
 const provider=global.fetch,attempts=[];let temporary=true;
 global.fetch=async(url,options)=>{if(String(url)==='https://api.resend.com/emails'){attempts.push({key:options.headers['Idempotency-Key'],body:options.body});if(temporary)return new Response('',{status:503})}return provider(url,options)};
 await drain(f.env);assert.equal(f.DB.raw.prepare("SELECT state FROM outbox WHERE kind='welcome-signature'").get().state,'queued');
 temporary=false;f.DB.raw.exec("UPDATE outbox SET available_at=0 WHERE kind='welcome-signature'");await drain(f.env);assert.deepEqual(attempts[0],attempts[1]);assert.equal(f.emails.length,1);await scheduled(f);assert.equal(f.emails.length,1);
 }finally{f.close()}});

test('signature refresh is batched and health reports a missing snapshot migration',async()=>{const f=fixture();try{
 for(let i=0;i<7;i++)user(f,`refresh-batch${i}@example.test`);snapshotSignatureResends(f);
 await scheduled(f);assert.equal(f.emails.length,5);await scheduled(f);assert.equal(f.emails.length,7);await scheduled(f);assert.equal(f.emails.length,7);
 f.DB.raw.exec('DROP TABLE welcome_signature_resends');const response=await f.request('/api/health');assert.equal(response.status,503);assert.equal((await response.json()).checks.schema,false);
 }finally{f.close()}});

import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fixture} from './fixture.js';
import {welcomeMessage,welcomeStatements} from '../worker/welcome.js';
import {drain} from '../worker/mail.js';
import {cleanup} from '../worker/index.js';
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

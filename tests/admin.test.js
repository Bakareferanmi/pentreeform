import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fixture} from './fixture.js';
import {uid,token,hash,now} from '../worker/core.js';
import {cleanup} from '../worker/index.js';
const today=()=>Math.floor(now()/86400)*86400;
const date=stamp=>new Date(stamp*1000).toISOString().slice(0,10);
async function member(f,{verified=1,owner=false,name='Akin User',address,createdAt=now(),plan='Free',paidUntil=0}={}){
 const id=uid(),email=address||id+'@example.test',value=token();f.DB.raw.prepare('INSERT INTO users(id,name,email,workspace,password_hash,verified,created_at,plan,paid_until) VALUES(?,?,?,?,?,?,?,?,?)').run(id,name,email,'Studio','pbkdf2:private-password-hash',verified,createdAt,plan,paidUntil);f.DB.raw.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(value),id,now()+3600);if(owner)f.env.ADMIN_USER_ID=id;return {id,email,cookie:'pentree_session='+value};
}
const get=(f,u,path)=>f.request('/api/admin/'+path,{cookie:u?.cookie});
function save(f,u,stamp=now()){
 const form=uid();f.DB.raw.prepare("INSERT INTO forms(id,user_id,name,domain,created_at) VALUES(?,?,'Contact','website.test',?)").run(form,u.id,stamp);
 f.DB.raw.prepare("INSERT INTO submissions(id,form_id,user_id,name,email,subject,message,fields,created_at,month) VALUES(?,?,?,'PRIVATE VISITOR','private@example.test','PRIVATE SUBJECT','PRIVATE MESSAGE','{\"secret\":\"PRIVATE FIELD\"}',?,?)").run(uid(),form,u.id,stamp,date(stamp).slice(0,7));return form;
}
function outbox(f,u,state,stamp=now()){f.DB.raw.prepare("INSERT INTO outbox(id,user_id,recipient,payload,kind,state,available_at,created_at) VALUES(?,?,?,'PRIVATE PAYLOAD','notification',?,0,?)").run(uid(),u.id,u.email,state,stamp)}

test('every admin report requires an authenticated, verified, explicitly configured owner',async()=>{const f=fixture();try{
 const owner=await member(f,{owner:true}),other=await member(f),unverified=await member(f,{verified:0});
 for(const path of ['overview','users','users/'+other.id,'unknown']){
  assert.equal((await get(f,null,path)).status,401);assert.equal((await get(f,other,path)).status,403);assert.equal((await get(f,unverified,path)).status,403);
 }
 const response=await get(f,owner,'overview');assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
 assert.equal((await f.request('/api/auth/me',{cookie:owner.cookie})).status,200);assert.equal((await (await f.request('/api/auth/me',{cookie:owner.cookie})).json()).user.isAdmin,true);assert.equal((await (await f.request('/api/auth/me',{cookie:other.cookie})).json()).user.isAdmin,false);
 assert.equal((await f.request('/api/admin/users',{cookie:other.cookie,headers:{'X-Admin':'true','X-User-Id':owner.id}})).status,403);
 delete f.env.ADMIN_USER_ID;assert.equal((await get(f,owner,'overview')).status,403);f.env.ADMIN_USER_ID=unverified.id;assert.equal((await get(f,unverified,'overview')).status,403);
 }finally{f.close()}});

test('overview shows measured adoption, daily counts, effective plans and retained email states',async()=>{const f=fixture();try{
 const owner=await member(f,{owner:true}),active=await member(f,{address:'active@example.test',plan:'Starter',paidUntil:now()+86400}),pending=await member(f,{verified:0,plan:'Pro'});
 save(f,active);save(f,owner);await f.request('/api/auth/me',{cookie:active.cookie});
 for(const state of ['delivered','accepted','accepted','failed','queued','suppressed'])outbox(f,active,state);
 let response=await get(f,owner,'overview?days=7'),data=await response.json();assert.equal(response.status,200);assert.equal(data.accounts.total,2);assert.equal(data.accounts.verified,1);assert.equal(data.accounts.active_seven,1);assert.equal(data.accounts.activated,1);assert.equal(data.forms.active,1);assert.equal(data.submissions,1);assert.equal(data.usage.count,1);assert.equal(data.series.length,7);assert.equal(data.series.at(-1).active,1);assert.equal(data.series.at(-1).submissions,1);assert.equal(data.delivery.confirmationRate,25);assert.equal(data.plans.find(p=>p.name==='Starter').count,1);assert.equal(data.plans.find(p=>p.name==='Free').count,1);
 data=await (await get(f,owner,'overview?days=30&includeOwner=1')).json();assert.equal(data.accounts.total,3);assert.equal(data.submissions,2);assert.equal(data.series.length,30);
 assert.equal((await get(f,owner,'overview?days=999')).status,400);assert.equal((await get(f,owner,'overview?includeOwner=yes')).status,400);
 }finally{f.close()}});

test('users support bounded keyset pages, literal search, verification filters and effective plan filters',async()=>{const f=fixture();try{
 const owner=await member(f,{owner:true});for(let i=0;i<28;i++)await member(f,{address:`user${i}@example.test`,name:'User '+i,verified:i%2,createdAt:today(),plan:i===2?'Pro':'Free'});
 const first=await (await get(f,owner,'users')).json();assert.equal(first.users.length,25);assert.equal(first.total,29);assert.ok(first.nextCursor);
 const second=await (await get(f,owner,'users?before='+encodeURIComponent(first.nextCursor))).json();assert.equal(second.users.length,4);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.users,...second.users].map(u=>u.id)).size,29);
 const filtered=await (await get(f,owner,'users?q=user2%40example.test&status=pending&plan=Free')).json();assert.equal(filtered.users.length,1);assert.equal(filtered.users[0].plan,'Free','Expired Pro is reported as Free');
 const literal=await (await get(f,owner,'users?q='+encodeURIComponent("%' OR 1=1 --"))).json();assert.equal(literal.total,0);
 assert.equal((await get(f,owner,'users?before=bad')).status,400);assert.equal((await get(f,owner,'users?plan=Unlimited')).status,400);assert.equal((await get(f,owner,'users?q='+'x'.repeat(101))).status,400);
 }finally{f.close()}});

test('account reports are read-only and never return message contents, provider identifiers or auth secrets',async()=>{const f=fixture();try{
 const owner=await member(f,{owner:true}),user=await member(f);save(f,user);f.DB.raw.prepare("INSERT INTO google_identities(subject,user_id,created_at) VALUES('PRIVATE_GOOGLE_SUBJECT',?,?)").run(user.id,now());
 const response=await get(f,owner,'users/'+user.id),raw=await response.text(),data=JSON.parse(raw);assert.equal(response.status,200);assert.equal(data.user.googleEnabled,true);assert.equal(data.user.passwordEnabled,true);assert.equal(data.user.activeForms,1);assert.equal(data.retained.submissions,1);assert.equal(data.user.usage,1);assert.equal(data.forms.length,1);
 assert.doesNotMatch(raw,/private-password-hash|PRIVATE VISITOR|private@example|PRIVATE SUBJECT|PRIVATE MESSAGE|PRIVATE FIELD|PRIVATE_GOOGLE_SUBJECT|password_hash|token_hash|provider_id/);
 assert.equal((await get(f,owner,'users/'+uid())).status,404);
 for(const method of ['POST','PATCH','DELETE'])assert.equal((await f.request('/api/admin/users/'+user.id,{method,cookie:owner.cookie,data:{verified:false}})).status,405);
 assert.equal(f.DB.raw.prepare('SELECT verified FROM users WHERE id=?').get(user.id).verified,1);
 }finally{f.close()}});

test('activity is recorded by day, throttles last-seen writes and does not turn admin refreshes into product usage',async()=>{const f=fixture();try{
 const owner=await member(f,{owner:true}),user=await member(f);
 assert.equal(f.DB.raw.prepare('SELECT last_seen_at FROM users WHERE id=?').get(user.id).last_seen_at,null);
 await f.request('/api/auth/me',{cookie:user.cookie});let record=f.DB.raw.prepare('SELECT last_seen_at FROM users WHERE id=?').get(user.id);assert.ok(record.last_seen_at>=now()-1);
 f.DB.raw.prepare('UPDATE users SET last_seen_at=? WHERE id=?').run(now()-60,user.id);await f.request('/api/auth/me',{cookie:user.cookie});assert.ok(f.DB.raw.prepare('SELECT last_seen_at FROM users WHERE id=?').get(user.id).last_seen_at<=now()-59);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM user_activity_days WHERE user_id=?').get(user.id).n,1);
 f.DB.raw.prepare('UPDATE users SET last_seen_at=? WHERE id=?').run(now()-500,user.id);await f.request('/api/state',{cookie:user.cookie});assert.ok(f.DB.raw.prepare('SELECT last_seen_at FROM users WHERE id=?').get(user.id).last_seen_at>=now()-1);
 await get(f,owner,'overview');assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM user_activity_days WHERE user_id=?').get(owner.id).n,0);
 f.DB.raw.prepare('INSERT INTO user_activity_days(user_id,day) VALUES(?,?)').run(user.id,date(now()-122*86400));await cleanup(f.env);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM user_activity_days WHERE user_id=?').get(user.id).n,1);
 }finally{f.close()}});

test('submission counters survive retention cleanup; missing analytics schema fails readiness',async()=>{const f=fixture();try{
 const owner=await member(f,{owner:true}),user=await member(f);save(f,user);f.DB.raw.exec('DELETE FROM submissions');const data=await (await get(f,owner,'overview')).json();assert.equal(data.submissions,1);assert.equal(data.accounts.activated,1);
 f.DB.raw.exec('DROP TABLE analytics_daily');const response=await f.request('/api/health');assert.equal(response.status,503);assert.equal((await response.json()).checks.schema,false);
 }finally{f.close()}});

test('analytics migration seeds only retained history and preserves existing verification and welcome claims',()=>{
 const db=new DatabaseSync(':memory:');try{
 for(const n of ['0001_initial.sql','0002_google_auth.sql','0003_usage_alerts.sql','0004_hosted_verification.sql','0005_google_account_linking.sql','0006_welcome_email.sql','0007_existing_account_welcome.sql','0008_welcome_signature_resend.sql'])db.exec(readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8'));
 db.exec("INSERT INTO users(id,name,email,workspace,password_hash,verified,created_at,welcome_email_queued) VALUES('old','Old','old@example.test','Studio','hash',1,0,1); INSERT INTO forms(id,user_id,name,domain,created_at) VALUES('form','old','Contact','example.test',0); INSERT INTO submissions(id,form_id,user_id,name,email,subject,message,fields,created_at,month) VALUES('submission','form','old','Visitor','visitor@example.test','Hi','Hello','{}',0,'1970-01')");
 db.exec(readFileSync(new URL('../migrations/0009_admin_analytics.sql',import.meta.url),'utf8'));assert.deepEqual({...db.prepare('SELECT day,user_id,submissions FROM analytics_daily').get()},{day:'1970-01-01',user_id:'old',submissions:1});assert.equal(db.prepare('SELECT count(*) n FROM user_activity_days').get().n,0);assert.deepEqual({...db.prepare('SELECT verified,welcome_email_queued,last_seen_at FROM users').get()},{verified:1,welcome_email_queued:1,last_seen_at:null});
 }finally{db.close()}
});

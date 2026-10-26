import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.js';
import {hash,now} from '../worker/core.js';
import {cleanup} from '../worker/index.js';

async function setup(f,domain='website.test'){
 const owner=await f.signup();
 const response=await f.request('/api/forms',{method:'POST',cookie:owner.cookie,data:{name:'Contact <script>alert(1)</script>',domain}});
 return {owner,form:(await response.json()).form};
}
async function begin(f,id,headers={}){
 const response=await f.request('/f/'+id,{method:'POST',headers:{Origin:'https://website.test',...headers},data:{name:'Visitor',email:'visitor@example.com',message:'A private project proposal'}});
 return {response,result:await response.json()};
}
async function complete(f,path,fields={}){
 const ticket=path.split('/').at(-1),digest=await hash(ticket),provider=globalThis.fetch;
 globalThis.fetch=async(url,options)=>String(url).includes('turnstile/v0/siteverify')?Response.json({success:true,hostname:'app.test',action:'submission',cdata:digest,...fields}):provider(url,options);
 try{return await f.request(path,{method:'POST',data:{'cf-turnstile-response':'synthetic-hosted-token'}})}finally{globalThis.fetch=provider;}
}
test('HTML and JSON forms start hosted verification without a customer widget or site key',async()=>{
 const f=fixture();try{
  const {form}=await setup(f),{response,result}=await begin(f,form.id);
  assert.equal(response.status,202);assert.equal(result.ok,false);assert.equal(result.verification_required,true);
  assert.equal(new URL(result.verification_url).origin,'https://app.test');
  assert.doesNotMatch(result.verification_url,/Visitor|visitor|proposal/);
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM submissions').get().n,0);
  assert.equal(f.DB.raw.prepare("SELECT COUNT(*) n FROM outbox WHERE kind='submission'").get().n,0);
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM monthly_usage').get().n,0);
  const pending=f.DB.raw.prepare('SELECT * FROM pending_submissions').get();
  assert.doesNotMatch(pending.encrypted_fields,/Visitor|visitor|proposal/);
  const path=new URL(result.verification_url).pathname;
  let page=await f.request(path),markup=await page.text();
  assert.equal(page.status,200);assert.match(markup,/Contact &lt;script&gt;/);assert.doesNotMatch(markup,/private project|visitor@example|test-turnstile/);
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  page=await f.request(path+'?mode=embed');
  assert.match(page.headers.get('content-security-policy'),/frame-ancestors https:\/\/website.test/);
  assert.equal(page.headers.get('x-frame-options'),null);assert.equal(page.headers.get('x-pentreeform-frame-origin'),null);
  const script=await f.request('/api/verification/script.js');assert.equal(script.status,200);assert.match(script.headers.get('content-type'),/javascript/);
  const html=await f.request('/f/'+form.id,{method:'POST',headers:{Origin:'https://website.test',Accept:'text/html'},data:{message:'HTML form'}});
  assert.equal(html.status,303);assert.match(html.headers.get('location'),/^https:\/\/app.test\/f\//);
 }finally{f.close();}
});
test('hosted verification binds origin, form, action, hostname and ticket before one atomic save',async()=>{
 const f=fixture();try{
  const {form,owner}=await setup(f),{result}=await begin(f,form.id),path=new URL(result.verification_url).pathname;
  assert.equal((await f.request(path,{method:'POST',headers:{Origin:'https://evil.test'},data:{}})).status,403);
  for(const fields of [{hostname:'website.test'},{action:'auth'},{cdata:'wrong-ticket'}])assert.equal((await complete(f,path,fields)).status,400);
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM submissions').get().n,0);
  const accepted=await complete(f,path);assert.equal(accepted.status,201,await accepted.clone().text());
  const id=(await accepted.json()).id;
  const state=await (await f.request('/api/state',{cookie:owner.cookie})).json();
  assert.equal(state.messages[0].id,id);assert.equal(state.messages[0].message,'A private project proposal');assert.equal(state.usage,1);
  assert.equal(f.DB.raw.prepare('SELECT encrypted_fields FROM pending_submissions').get().encrypted_fields,'');
  const retry=await f.request(path,{method:'POST',data:{}});assert.equal(retry.status,200);assert.equal((await retry.json()).id,id);
  assert.equal(f.DB.raw.prepare("SELECT COUNT(*) n FROM outbox WHERE kind='submission'").get().n,1);
  // A deleted inbox entry must not make a still-valid ticket reusable.
  await f.request('/api/messages/'+id,{method:'DELETE',cookie:owner.cookie,data:{}});
  assert.equal((await f.request(path,{method:'POST',data:{}})).status,200);
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM submissions').get().n,0);
 }finally{f.close();}
});
test('hosted tickets expire, respect archive and quota, and never cross forms',async()=>{
 const f=fixture();try{
  const {form,owner}=await setup(f),{result}=await begin(f,form.id),path=new URL(result.verification_url).pathname;
  const another=(await (await f.request('/api/forms',{method:'POST',cookie:owner.cookie,data:{name:'Other',domain:'website.test'}})).json()).form;
  assert.equal((await f.request(path.replace(form.id,another.id))).status,410);
  f.DB.raw.prepare('UPDATE pending_submissions SET expires_at=?').run(now()-1);
  assert.equal((await complete(f,path)).status,410);
  await cleanup(f.env);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM pending_submissions').get().n,0);
  const fresh=await begin(f,form.id),freshPath=new URL(fresh.result.verification_url).pathname;
  f.DB.raw.prepare('INSERT INTO monthly_usage(user_id,month,count) VALUES(?,?,100)').run(owner.user.id,new Date().toISOString().slice(0,7));
  assert.equal((await complete(f,freshPath)).status,429);
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM submissions').get().n,0);
  assert.equal(f.DB.raw.prepare("SELECT COUNT(*) n FROM outbox WHERE kind='submission'").get().n,0);
  await f.request('/api/forms/'+form.id+'/archive',{method:'POST',cookie:owner.cookie,data:{}});
  assert.equal((await f.request(freshPath)).status,404);
 }finally{f.close();}
});
test('registered websites accept root and www while other subdomains and origins stay blocked',async()=>{
 const f=fixture();try{
  const {form}=await setup(f,'www.website.test');
  for(const source of ['https://website.test','https://www.website.test']){
   const preflight=await f.request('/f/'+form.id,{method:'OPTIONS',headers:{Origin:source}});
   assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),source);
   const started=await begin(f,form.id,{Origin:source});assert.equal(started.response.status,202);
   const page=await f.request(new URL(started.result.verification_url).pathname+'?mode=embed');assert.match(page.headers.get('content-security-policy'),new RegExp('frame-ancestors '+source.replaceAll('.','\\.')));
  }
  for(const source of ['https://shop.website.test','https://website.test.evil.test','http://website.test','https://website.test:444','null']){
   assert.equal((await begin(f,form.id,{Origin:source})).response.status,403);
  }
 }finally{f.close();}
});
test('invalid fields, missing security configuration and corrupt encrypted fields fail closed',async()=>{
 const f=fixture();try{
  const {form}=await setup(f);
  assert.equal((await f.request('/f/'+form.id,{method:'POST',headers:{Origin:'https://website.test'},data:{email:'invalid',message:'Message'}})).status,400);
  const {result}=await begin(f,form.id),path=new URL(result.verification_url).pathname;
  f.DB.raw.prepare("UPDATE pending_submissions SET encrypted_fields='corrupt'").run();
  assert.equal((await complete(f,path)).status,410);
  f.env.TURNSTILE_SECRET_KEY='';assert.equal((await begin(f,form.id)).response.status,503);
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM submissions').get().n,0);
 }finally{f.close();}
});

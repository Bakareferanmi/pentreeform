import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {configureDeployment} from '../scripts/configure-deployment.mjs';
import {checkDeployment} from '../scripts/check-deployment.mjs';
const worker=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url))),frontend=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
const options={publicOrigin:'https://pentreeform.vercel.app',workerOrigin:'https://pentreeform.example.workers.dev',databaseId:'11111111-2222-3333-4444-555555555555'};
test('deployment configuration preserves registration choices and sender while setting same-origin proxy routes',()=>{
 for(const registrationOpen of ['false','true']){
  const input=structuredClone(worker);input.vars.REGISTRATION_OPEN=registrationOpen;
  const result=configureDeployment(input,frontend,options);
  assert.equal(result.worker.vars.APP_ORIGIN,options.publicOrigin);
  assert.equal(result.worker.d1_databases[0].database_id,options.databaseId);
  assert.equal(result.worker.vars.REGISTRATION_OPEN,registrationOpen);
  assert.equal(result.worker.vars.EMAIL_FROM,input.vars.EMAIL_FROM);
  assert.ok(result.frontend.rewrites.find(r=>r.source==='/app'));
  assert.deepEqual(result.frontend.rewrites.slice(0,2).map(r=>r.destination),[options.workerOrigin+'/api/:path*',options.workerOrigin+'/f/:path*']);
  assert.ok(result.frontend.headers.filter(r=>['/api/:path*','/f/:path*'].includes(r.source)).every(r=>r.headers.some(h=>h.key==='Cache-Control'&&h.value==='no-store')));
  assert.ok(result.frontend.headers.find(r=>r.source==='/app').headers.some(h=>h.key==='X-Robots-Tag'&&h.value==='noindex, nofollow'));
  assert.notEqual(input.d1_databases[0].database_id,options.databaseId);
  assert.deepEqual(configureDeployment(result.worker,result.frontend,options),result);
 }
});
test('configuration rejects proxy loops, invalid database IDs and secret-bearing URLs',()=>{for(const change of [{workerOrigin:options.publicOrigin},{workerOrigin:'http://localhost:8787'},{workerOrigin:'https://name:password@example.com'},{workerOrigin:'https://example.com/api'},{databaseId:'placeholder'}])assert.throws(()=>configureDeployment(worker,frontend,{...options,...change}))});
test('deployment checker catches static HTML masquerading as a successful API response',async()=>{const result=await checkDeployment(options.publicOrigin,async()=>new Response('<html>Landing page</html>',{headers:{'content-type':'text/html'}}));assert.equal(result.apiReady,false);assert.equal(result.results.filter(r=>r.ok).length,0)});
test('deployment checker confirms canonical origin, schema and unauthenticated session protection',async()=>{const result=await checkDeployment(options.publicOrigin,async url=>url.endsWith('/health')?Response.json({service:'pentreeform',applicationOrigin:options.publicOrigin,checks:{schema:true},configured:{}}):url.endsWith('/me')?Response.json({error:'Sign in'},{status:401}):Response.json({registrationOpen:false}));assert.equal(result.apiReady,true);assert.equal(result.results[1].registrationOpen,false)});

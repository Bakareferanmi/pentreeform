import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const powershell=process.env.POWERSHELL_BIN||(process.platform==='win32'?'powershell.exe':'pwsh');
const available=spawnSync(powershell,['-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()'],{encoding:'utf8'}).status===0;
// Exercise the actual updater's lookup section; stop before any source download,
// database migrations, secrets or deployment. All data and CLI responses are synthetic.
const source=readFileSync(new URL('../scripts/update-admin.ps1',import.meta.url),'utf8');
const lookup=source.slice(0,source.indexOf('\n$project ='))+'\nWrite-Host "LOOKUP_PASSED"\n';
const owner={id:'a'.repeat(32),email:'owner@example.test',name:'Test Owner',verified:1};
function run({email=owner.email,output=JSON.stringify([{success:true,results:[owner]}]),exit=0,stderr='',install=true}={}){
 const dir=mkdtempSync(join(tmpdir(),'pentreeform lookup '));
 try{
  writeFileSync(join(dir,'package.json'),'{}');writeFileSync(join(dir,'wrangler.jsonc'),'{"name":"pentreeform"}');writeFileSync(join(dir,'lookup.ps1'),lookup);
  if(install){const bin=join(dir,'node_modules','wrangler','bin');mkdirSync(bin,{recursive:true});writeFileSync(join(bin,'wrangler.js'),`const fs=require('node:fs');fs.writeFileSync('args.json',JSON.stringify(process.argv.slice(2)));process.stdout.write(${JSON.stringify(output)});process.stderr.write(${JSON.stringify(stderr)});process.exit(${exit});`)}
  const result=spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(dir,'lookup.ps1'),'-Revision','f'.repeat(40),'-OwnerEmail',email],{cwd:dir,encoding:'utf8',timeout:20000});
  assert.ifError(result.error);return {status:result.status,text:result.stdout+'\n'+result.stderr,args:existsSync(join(dir,'args.json'))?JSON.parse(readFileSync(join(dir,'args.json'),'utf8')):null};
 }finally{rmSync(dir,{recursive:true,force:true})}
}
test('admin updater preserves one SQL argument and checks the exact verified account before proceeding',{skip:!available},()=>{
 const result=run({email:"owner'o@example.test"});assert.equal(result.status,0,result.text);assert.match(result.text,/LOOKUP_PASSED/);assert.deepEqual(result.args,['d1','execute','pentreeform','--remote','--json','--command',"SELECT id, name, email, verified FROM users WHERE lower(email)='owner''o@example.test';"]);
});
test('admin updater displays captured Cloudflare errors and stops before any deployment work',{skip:!available},()=>{
 for(const config of [{exit:1,output:'{"error":"Cloudflare authentication failed (10000)"}'},{exit:2,stderr:'Database access denied',output:''},{output:'not valid JSON'},{output:JSON.stringify([{success:false,errors:[{message:'Query rejected'}]}])}]){
  const result=run(config);assert.notEqual(result.status,0);assert.doesNotMatch(result.text,/LOOKUP_PASSED/);assert.match(result.text.replace(/\s*\|\s*/g,' ').replace(/\s+/g,' '),/No source or secrets were changed/);assert.ok(result.text.includes(config.output||config.stderr),result.text);
 }
});
test('admin updater rejects missing, duplicate or unverified owners and missing local dependencies',{skip:!available},()=>{
 for(const rows of [[],[owner,owner],[{...owner,verified:0}],[{...owner,id:'bad'}]]){const result=run({output:JSON.stringify([{success:true,results:rows}])});assert.notEqual(result.status,0);assert.doesNotMatch(result.text,/LOOKUP_PASSED/);assert.match(result.text,/Exactly one existing verified account/)}
 const missing=run({install:false});assert.notEqual(missing.status,0);assert.match(missing.text,/Run npm ci/);assert.equal(missing.args,null);
});

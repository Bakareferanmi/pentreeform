const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {JSDOM}=require('jsdom'),{buildSync}=require('esbuild');
const output=path.join(os.tmpdir(),'pentreeform-google-link-'+process.pid+'.cjs');
buildSync({entryPoints:['src/LiveRoot.jsx'],bundle:true,platform:'node',format:'cjs',external:['react','react-dom'],outfile:output});
const Module=require('node:module'),resolve=Module._resolveFilename;Module._resolveFilename=function(request,parent,...rest){if(parent?.filename===output&&(request==='react'||request.startsWith('react/')))return require.resolve(request);return resolve.call(this,request,parent,...rest)};
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),LiveRoot=require(output).default;
global.IS_REACT_ACT_ENVIRONMENT=true;
const owner={id:'existing',name:'Existing Owner',email:'owner@gmail.com',workspace:'Original workspace',verified:true,plan:'Free'};
function surface(){const dom=new JSDOM('<div id="root"></div>',{url:'https://app.test/app#google_link=1'});Object.assign(global,{window:dom.window,document:dom.window.document,history:dom.window.history,localStorage:dom.window.localStorage,FormData:dom.window.FormData});return {dom,root:createRoot(document.getElementById('root'))}}
(async()=>{
 for(const scenario of ['confirm','cancel','expired','forgot']){
  const {dom,root}=surface();let posts=0;const calls=[];
  global.fetch=async(url,options={})=>{calls.push([url,options]);if(url==='/api/config')return Response.json({registrationOpen:true,googleConfigured:true,googleRegistrationOpen:true});if(url==='/api/auth/me')return scenario==='confirm'?Response.json({user:owner}):Response.json({error:'Sign in'},{status:401});if(url==='/api/state')return Response.json({forms:[],messages:[],usage:0,limit:100});
   if(url==='/api/auth/google/link'){
    if(!options.method)return scenario==='expired'?Response.json({error:'Google connection expired. Start Google sign-in again.'},{status:410}):Response.json({email:owner.email});
    posts++;assert.equal(options.headers['X-Pentreeform'],'1');return posts===1?Response.json({error:'Password is incorrect. Try again or reset your password.'},{status:401}):Response.json({user:owner});
   }throw Error('Unexpected request '+url)};
  await act(async()=>root.render(React.createElement(LiveRoot)));
  assert.equal(document.querySelector('h2').textContent,'Connect Google.','Link confirmation remains visible even when an existing session is signed in');assert.equal(document.querySelector('.google-btn'),null,'No second OAuth flow during confirmation');
  if(scenario==='expired'){assert.match(document.querySelector('[role=alert]').textContent,/expired/);assert.equal(document.querySelector('.asub').disabled,true)}
  else{const form=document.querySelector('form');assert.equal(form.elements.email.value,owner.email);assert.equal(form.elements.email.readOnly,true);assert.equal(form.elements.password.autocomplete,'current-password');assert.equal(document.querySelector('.challenge'),null,'Google proof replaces an extra CAPTCHA');}
  if(scenario==='cancel'){await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Back to sign in').click());assert.equal(window.location.hash,'');assert.equal(document.querySelector('h2').textContent,'Welcome back.');assert.equal(posts,0)}
  if(scenario==='forgot'){await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Forgot password?').click());assert.equal(window.location.hash,'');assert.equal(document.querySelector('h2').textContent,'Reset your password.');assert.equal(posts,0)}
  if(scenario==='confirm'){
   let form=document.querySelector('form');form.elements.password.value='synthetic test password';await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
   assert.match(document.querySelector('[role=alert]').textContent,/Password is incorrect/);assert.equal(document.querySelector('form').elements.password.value,'synthetic test password','Retry preserves input');
   form=document.querySelector('form');await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
   assert.equal(document.querySelector('h1').textContent,'Inbox');assert.equal(window.location.hash,'');assert.match(document.querySelector('.ws').textContent,/Original workspace/);assert.equal(posts,2);assert.ok(!JSON.stringify(localStorage).includes(owner.email));
  }
  await act(async()=>root.unmount());dom.window.close();
 }
 console.log('PASS: Google-link confirmation for existing sessions, readonly account, current password, retry, expiry, cancellation, recovery and original workspace');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{fs.unlinkSync(output)});

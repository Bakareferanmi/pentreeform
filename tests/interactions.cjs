const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {buildSync}=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const output=path.join(os.tmpdir(),'pentreeform-test-'+process.pid+'.cjs');
buildSync({entryPoints:['src/App.jsx'],bundle:true,platform:'node',format:'cjs',jsx:'transform',external:['react','react-dom'],outfile:output});
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
global.window=dom.window;dom.window.scrollTo=()=>{};global.document=dom.window.document;global.localStorage=dom.window.localStorage;global.FormData=dom.window.FormData;global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const {act}=React;const {createRoot}=require('react-dom/client');
// Resolve React from the project when the compiled test bundle lives in OS temp.
const Module=require('node:module');const originalResolve=Module._resolveFilename;Module._resolveFilename=function(request,parent,...rest){if(parent?.filename===output&&(request==='react'||request.startsWith('react/')))return require.resolve(request);return originalResolve.call(this,request,parent,...rest)};
const App=require(output).default;
function button(text){const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(b,'Button not found: '+text);return b}
async function click(b){await act(async()=>b.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})))}
(async()=>{const destinations=[];const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(App,{onAccount:path=>destinations.push(path)})));assert.equal(document.querySelector('h1').textContent,'Inbox');assert.equal(document.querySelectorAll('.row').length,7);
await click(button('Unread3'));assert.equal(document.querySelectorAll('.row').length,3);await click(button('All'));await click(document.querySelectorAll('[data-a="open"]')[1]);assert.ok(document.querySelector('.dh').textContent.includes('Volunteer application'));
await click(button('Spam'));assert.equal(document.querySelectorAll('.row').length,1);await click(button('All'));await click(button('Create form'));const form=document.querySelector('[role=dialog] form');form.querySelector('[name=name]').value='Integration form';form.querySelector('[name=domain]').value='https://example.com/contact';form.querySelector('[name=email]').value='owner@example.com';await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(document.querySelector('#mt').textContent,'Form setup');await click(button('Add submission'));assert.ok(document.querySelector('.dh').textContent.includes('Your submission is here'));assert.equal(JSON.parse(localStorage.getItem('pentreeform:forms')).length,4);assert.equal(JSON.parse(localStorage.getItem('pentreeform:messages')).length,9);
await click(document.querySelector('button[aria-label="More message actions"]'));await click(button('Move to spam'));assert.equal(JSON.parse(localStorage.getItem('pentreeform:messages'))[0].spam,true);
for(const name of ['Overview','Forms','Deliveries','Usage & billing','Settings','Documentation']){const nav=[...document.querySelectorAll('nav button')].find(b=>b.textContent.trim()===name);await click(nav);assert.equal(document.querySelector('h1').textContent,name)}
await click(document.querySelector('.account-profile'));assert.equal(document.querySelector('#mt').textContent,'Your profile');const profile=document.querySelector('[role=dialog] form');profile.querySelector('[name=name]').value='New Name';await act(async()=>profile.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(JSON.parse(localStorage.getItem('pentreeform:settings')).name,'New Name');await click(document.querySelector('[data-t=privacy]'));assert.equal(document.querySelector('#mt').textContent,'Data & privacy');await click(document.querySelector('[aria-label="Close dialog"]'));await click(document.querySelector('.account-signout'));await click(button('Cancel'));assert.ok(document.querySelector('.account-profile'));await click(document.querySelector('.account-signout'));await click(document.querySelector('[role=dialog] [data-a=logout]'));assert.equal(destinations.at(-1),'/app');
// Every account action in the browser-only workspace must exit to the live app.
const screen=async value=>act(async()=>{const select=document.querySelector('[data-c=screen]');select.value=value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}))});
await screen('login');await click(button('Resend verification'));assert.equal(destinations.at(-1),'/app?auth=resend');
await click(button('Create an account'));assert.equal(destinations.at(-1),'/app?auth=register');
await click(button('Forgot password?'));assert.equal(destinations.at(-1),'/app?auth=forgot');
await click(button('Continue with Google'));assert.equal(destinations.at(-1),'/app');
for(const [mode,destination] of Object.entries({login:'/app',register:'/app?auth=register',resend:'/app?auth=resend',forgot:'/app?auth=forgot',reset:'/app?auth=forgot',verify:'/app?auth=resend'})){
 await screen(mode);const form=document.querySelector('form[data-f=auth]');await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(destinations.at(-1),destination,mode);assert.ok(!document.body.textContent.includes('This account action is unavailable.'));
}
await act(async()=>root.unmount());fs.unlinkSync(output);console.log('PASS: render, unread/spam filters, message selection, form creation, local submission, persisted state, spam action, all seven pages');})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{if(fs.existsSync(output))fs.unlinkSync(output)});

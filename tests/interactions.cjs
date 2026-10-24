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
(async()=>{const root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(App)));assert.equal(document.querySelector('h1').textContent,'Your inbox');assert.equal(document.querySelectorAll('.row').length,7);
await click(button('Unread3'));assert.equal(document.querySelectorAll('.row').length,3);await click(button('All'));await click(document.querySelectorAll('[data-a="open"]')[1]);assert.ok(document.querySelector('.dh').textContent.includes('Volunteer application'));
await click(button('Spam'));assert.equal(document.querySelectorAll('.row').length,1);await click(button('All'));await click(button('Create form'));const form=document.querySelector('[role=dialog] form');form.querySelector('[name=name]').value='Integration form';form.querySelector('[name=domain]').value='https://example.com/contact';form.querySelector('[name=email]').value='owner@example.com';await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(document.querySelector('#mt').textContent,'Form setup');await click(button('Add a sample submission'));assert.ok(document.querySelector('.dh').textContent.includes('Your form preview works'));assert.equal(JSON.parse(localStorage.getItem('pentreeform:forms')).length,4);assert.equal(JSON.parse(localStorage.getItem('pentreeform:messages')).length,9);
await click(document.querySelector('button[aria-label="More message actions"]'));await click(button('Move to spam'));assert.equal(JSON.parse(localStorage.getItem('pentreeform:messages'))[0].spam,true);
for(const name of ['Overview','Forms','Deliveries','Usage & billing','Settings','Documentation']){const nav=[...document.querySelectorAll('nav button')].find(b=>b.textContent.trim()===name);await click(nav);assert.ok(document.querySelector('h1').textContent)}
await act(async()=>root.unmount());fs.unlinkSync(output);console.log('PASS: render, unread/spam filters, message selection, form creation, local submission, persisted state, spam action, all seven pages');})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{if(fs.existsSync(output))fs.unlinkSync(output)});

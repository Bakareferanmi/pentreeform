const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
(async()=>{
 const {verificationScript}=await import('../worker/hosted-verification.js');
 const ticket='a'.repeat(64),digest='b'.repeat(64),id='c'.repeat(32);
 const dom=new JSDOM(`<main data-origin="https://website.test" data-ticket="${ticket}" data-cdata="${digest}" data-sitekey="public-key" data-completed="" data-embedded="0"><h1>One quick check.</h1><form id="verify-form"><div id="challenge"></div><input name="cf-turnstile-response"><p id="status"></p><button id="send" disabled>Send</button><button id="retry" type="button" hidden>Retry</button></form></main>`,{url:'https://app.test/f/'+'d'.repeat(32)+'/verify/'+ticket,runScripts:'outside-only'});
 let settings,resets=0,sends=0;
 dom.window.turnstile={render(selector,options){settings=options;return 'widget'},reset(){resets++}};
 dom.window.fetch=async(url,options)=>{sends++;assert.equal(url,dom.window.location.pathname);assert.deepEqual(JSON.parse(options.body),{'cf-turnstile-response':'valid-proof'});return {ok:true,json:async()=>({ok:true,id})}};
 dom.window.eval(verificationScript);
 assert.equal(settings.action,'submission');assert.equal(settings.cData,digest);assert.equal(sends,0);
 settings['expired-callback']();assert.match(dom.window.document.querySelector('#status').textContent,/expired/);
 dom.window.document.querySelector('#retry').click();assert.equal(resets,1);
 settings['error-callback']();assert.match(dom.window.document.querySelector('#status').textContent,/unavailable/);
 settings.callback('valid-proof');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sends,1);assert.equal(dom.window.document.querySelector('#verify-form').hidden,true);assert.equal(dom.window.document.querySelector('h1').textContent,'Message received.');
 dom.window.close();console.log('PASS: hosted check uses app action/ticket, preserves pending state, retries and confirms only a saved submission');
})().catch(error=>{console.error(error);process.exitCode=1});

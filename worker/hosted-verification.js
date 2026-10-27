import {now,token,hash,query,origin,fail,json,readJSON,body,rate,effectivePlan} from './core.js';
import {challenge} from './auth.js';
import {submissionForm,saveSubmission,submissionError,approvedOrigin} from './submission-core.js';

const encoder=new TextEncoder();
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function encryptionKey(env){
 if(!env.TURNSTILE_SECRET_KEY?.trim())fail(503,'Spam protection is not configured.');
 const material=await crypto.subtle.importKey('raw',encoder.encode(env.TURNSTILE_SECRET_KEY.trim()),'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode('pentreeform'),info:encoder.encode('hosted-submission/v1')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(env,fields,associatedData){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(associatedData)},await encryptionKey(env),encoder.encode(JSON.stringify(fields)));
 return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
async function unseal(env,value,associatedData){
 try{
  const [iv,encrypted]=value.split('.');
  const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(iv),char=>char.charCodeAt(0)),additionalData:encoder.encode(associatedData)},await encryptionKey(env),Uint8Array.from(atob(encrypted),char=>char.charCodeAt(0)));
  return JSON.parse(new TextDecoder().decode(decoded));
 }catch{fail(410,'This verification has expired. Return to the website and submit again.');}
}
export async function beginHostedVerification(req,env,form,fields,requestKey,headers){
 if(!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET_KEY)fail(503,'Spam protection is not configured.');
 await rate(env,`hosted-form:${form.id}`,120,60);
 await rate(env,'hosted-global',1200,60);
 // Bound storage even when bots never finish verification. The scheduled job
 // removes expired tickets too; no unverified message enters inbox or outbox.
 await query(env,'DELETE FROM pending_submissions WHERE ticket_hash IN (SELECT ticket_hash FROM pending_submissions WHERE expires_at<? LIMIT 500)',now()).run();
 const count=await query(env,'SELECT COUNT(*) count FROM pending_submissions WHERE form_id=? AND expires_at>?',form.id,now()).first();
 if(count.count>=200)fail(429,'Too many messages are awaiting verification. Please try again shortly.');
 const ticket=token(),ticketHash=await hash(ticket),customerOrigin=req.headers.get('origin');
 const encrypted=await seal(env,fields,`${form.id}:${ticketHash}`);
 await query(env,'INSERT INTO pending_submissions(ticket_hash,form_id,encrypted_fields,customer_origin,request_key,expires_at) VALUES(?,?,?,?,?,?)',ticketHash,form.id,encrypted,customerOrigin,requestKey||'hosted_'+ticketHash,now()+600).run();
 const url=`${origin(env)}/f/${form.id}/verify/${ticket}`;
 if(req.headers.get('accept')?.includes('text/html'))return new Response(null,{status:303,headers:{...headers,Location:url,'Cache-Control':'no-store'}});
 return json({ok:false,verification_required:true,verification_url:url},202,headers);
}
async function pendingTicket(env,id,ticket){
 if(!/^[a-f0-9]{64}$/.test(ticket))fail(404,'Verification not found.');
 const pending=await query(env,'SELECT * FROM pending_submissions WHERE ticket_hash=? AND form_id=? AND expires_at>?',await hash(ticket),id,now()).first();
 if(!pending)fail(410,'This verification has expired. Return to the website and submit again.');
 return pending;
}
export async function hostedVerification(req,env,id,ticket){
 try{
  const form=await submissionForm(env,id),pending=await pendingTicket(env,id,ticket);
  const expectedOrigin=approvedOrigin(pending.customer_origin,form.domain);
  if(!expectedOrigin)fail(403,'Website origin not allowed.');
  if(req.method==='POST'){
   if(req.headers.get('origin')!==origin(env))fail(403,'Complete verification on Pentreeform.');
   await rate(env,`verify:${pending.ticket_hash}`,12,600);
   if(pending.submission_id)return json({ok:true,id:pending.submission_id});
   const type=req.headers.get('content-type')||'';
   const data=type.includes('application/json')?await readJSON(req,8192):Object.fromEntries(new URLSearchParams(await body(req,8192)));
   const verified=await challenge(req,env,data['cf-turnstile-response'],'submission');
   if(verified.hostname!==new URL(origin(env)).hostname||verified.cdata!==pending.ticket_hash)fail(400,'Security check does not match this message. Please retry.');
   if(pending.expires_at<=now())fail(410,'This verification has expired. Return to the website and submit again.');
   const fields=await unseal(env,pending.encrypted_fields,`${id}:${pending.ticket_hash}`);
   const saved=await saveSubmission(env,form,fields,pending.request_key,submissionId=>[
    query(env,'UPDATE pending_submissions SET submission_id=?,encrypted_fields=? WHERE ticket_hash=? AND submission_id IS NULL',submissionId,'',pending.ticket_hash),
   ]);
   // A simultaneous retry may have already saved the same idempotent request.
   if(saved.duplicate)await query(env,'UPDATE pending_submissions SET submission_id=?,encrypted_fields=? WHERE ticket_hash=?',saved.id,'',pending.ticket_hash).run();
   return json({ok:true,id:saved.id,...(effectivePlan(form)!=='Free'&&form.redirect?{redirect:form.redirect}:{})},saved.duplicate?200:201);
  }
  if(req.method!=='GET')fail(405,'Method not allowed.');
  const embedded=new URL(req.url).searchParams.get('mode')==='embed';
  const markup=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Send your message · Pentreeform</title><style>body{font:16px system-ui;margin:0;padding:32px 20px;color:#241435;background:#fff;box-sizing:border-box}main{max-width:430px;margin:auto}h1{font-size:24px;margin:12px 0}p{line-height:1.5;color:#5d5366}button{background:#6d37bd;color:white;border:0;border-radius:8px;padding:12px 18px;font:inherit;cursor:pointer}button:disabled{opacity:.5}a{color:#6334a6}#status{min-height:24px}#status[role=alert]{color:#a51e37}.brand{font-weight:650;color:#6d37bd}</style><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script><script src="${origin(env)}/api/verification/script.js" defer></script></head><body><main data-origin="${escape(pending.customer_origin)}" data-ticket="${escape(ticket)}" data-cdata="${pending.ticket_hash}" data-sitekey="${escape(env.TURNSTILE_SITE_KEY||'')}" data-completed="${escape(pending.submission_id||'')}" data-embedded="${embedded?'1':'0'}"><div class="brand">Pentreeform</div><h1>One quick check.</h1><p>We’ll send your message to ${escape(form.name)} once verification finishes.</p><form id="verify-form"><div id="challenge"></div><input type="hidden" name="cf-turnstile-response"><p id="status" role="status">Loading security check…</p><button id="send" disabled>Send message</button> <button id="retry" type="button" hidden>Retry check</button></form><p><a href="${escape(pending.customer_origin)}" rel="noreferrer">Return to website</a></p><noscript>Enable JavaScript to complete verification. Your message has not been sent yet.</noscript></main></body></html>`;
  return new Response(markup,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',...(embedded?{'X-Pentreeform-Frame-Origin':expectedOrigin}:{})}});
 }catch(error){return submissionError(error);}
}

export const verificationScript=String.raw`(()=>{
 const page=document.querySelector('main[data-ticket]');if(!page)return;
 const form=document.querySelector('#verify-form'),status=document.querySelector('#status'),send=document.querySelector('#send'),retry=document.querySelector('#retry'),input=form.elements['cf-turnstile-response'];
 let widget,busy=false;
 function message(text,error=false){status.textContent=text;status.setAttribute('role',error?'alert':'status')}
 function finished(result){
  form.hidden=true;document.querySelector('h1').textContent='Message received.';message('Your message has been saved. You can return to the website.');
  if(page.dataset.embedded==='1'&&window.parent!==window)window.parent.postMessage({type:'pentreeform:verified',ticket:page.dataset.ticket,id:result.id},page.dataset.origin);
  else if(result.redirect)window.location.replace(result.redirect);
 }
 function reset(){input.value='';send.disabled=true;retry.hidden=true;if(widget!==undefined)window.turnstile.reset(widget)}
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!input.value)return;busy=true;send.disabled=true;message('Sending your message…');
  try{
   const response=await fetch(window.location.pathname,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({'cf-turnstile-response':input.value})});
   const result=await response.json();if(!response.ok||result.ok!==true||!result.id)throw Error(result.error||'Your message could not be saved. Please retry.');finished(result);
  }catch(error){reset();retry.hidden=false;message(error.message||'Unable to connect. Please retry.',true)}finally{busy=false}
 });
 retry.addEventListener('click',()=>{if(window.turnstile&&widget!==undefined){reset();message('Checking…')}else window.location.reload()});
 if(page.dataset.completed){finished({id:page.dataset.completed});return}
 if(!window.turnstile){message('Security check could not load. Please retry.',true);retry.hidden=false;return}
 try{widget=window.turnstile.render('#challenge',{sitekey:page.dataset.sitekey,action:'submission',cData:page.dataset.cdata,size:'flexible',callback:value=>{input.value=value;send.disabled=false;retry.hidden=true;message('Verified. Sending…');form.requestSubmit()},'expired-callback':()=>{input.value='';send.disabled=true;retry.hidden=false;message('Verification expired. Please retry.',true)},'error-callback':()=>{input.value='';send.disabled=true;retry.hidden=false;message('Security check is unavailable. Please retry shortly.',true);return true}})}catch{message('Security check is unavailable. Please retry.',true);retry.hidden=false}
})();`;

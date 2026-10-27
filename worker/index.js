import {health} from './health.js';
import {hostedVerification,verificationScript} from './hosted-verification.js';
import {PLANS,query,now,origin,csrf,account,publicUser,json,fail,readJSON,text,rate} from './core.js';
import {authRoute} from './auth.js';
import {googleConfigured} from './google.js';
import {drain,mailWebhook} from './mail.js';
import {submit,state,createForm,updateMessage,exportCSV} from './submissions.js';
import {billingRoute,billingWebhook} from './billing.js';
function secure(response){const h=new Headers(response.headers);h.set('X-Content-Type-Options','nosniff');h.set('Strict-Transport-Security','max-age=31536000');h.set('Referrer-Policy','no-referrer');const frameOrigin=h.get('X-Pentreeform-Frame-Origin');h.delete('X-Pentreeform-Frame-Origin');if(!frameOrigin)h.set('X-Frame-Options','DENY');h.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");if(frameOrigin)h.set('Content-Security-Policy',h.get('Content-Security-Policy').replace("frame-ancestors 'none'",'frame-ancestors '+frameOrigin));return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h})}
export async function handle(req,env,ctx={waitUntil(){}}){const path=new URL(req.url).pathname;
 try{
 if(!path.startsWith('/api/')&&!path.startsWith('/f/'))return secure(await env.ASSETS.fetch(req));
 if(path==='/api/health'&&req.method==='GET')return secure(await health(env));
 if(!env.DB)fail(503,'Database binding is not configured.');
 if(path==='/api/config'&&req.method==='GET')return secure(json({registrationOpen:env.REGISTRATION_OPEN==='true'&&!!env.RESEND_API_KEY&&!!env.TURNSTILE_SECRET_KEY,googleConfigured:googleConfigured(env),googleRegistrationOpen:env.REGISTRATION_OPEN==='true'&&googleConfigured(env),turnstileSiteKey:env.TURNSTILE_SITE_KEY||'',emailConfigured:!!env.RESEND_API_KEY&&!!env.EMAIL_FROM&&!env.EMAIL_FROM.includes('YOUR-'),billingConfigured:!!env.PAYSTACK_SECRET_KEY,plans:PLANS}));
 if(path==='/api/verification/script.js'&&req.method==='GET')return secure(new Response(verificationScript,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}}));
 const hosted=path.match(/^\/f\/([a-f0-9]{32})\/verify\/([a-f0-9]{64})$/);
 if(hosted){const response=await hostedVerification(req,env,hosted[1],hosted[2]);if(response.ok&&req.method==='POST')ctx.waitUntil(drain(env).catch(()=>{}));return secure(response)}
 if(path==='/api/webhooks/resend'&&req.method==='POST')return secure(await mailWebhook(req,env));
 if(path==='/api/webhooks/paystack'&&req.method==='POST')return secure(await billingWebhook(req,env));
 if(path.startsWith('/f/')){const response=await submit(req,env,path.slice(3));if(response.ok)ctx.waitUntil(drain(env).catch(()=>{}));return secure(response)}
 if(!['GET','HEAD'].includes(req.method))csrf(req,env);
 if(path.startsWith('/api/auth/')){const response=await authRoute(req,env,path);ctx.waitUntil(drain(env).catch(()=>{}));return secure(response)}
 const u=await account(req,env);await rate(env,`api:${u.id}`,120,60);
 if(path==='/api/state'&&req.method==='GET')return secure(await state(req,env,u));
 if(path==='/api/forms'&&req.method==='POST')return secure(await createForm(req,env,u));
 if(/^\/api\/forms\/[a-f0-9]{32}\/archive$/.test(path)&&req.method==='POST'){const id=path.split('/')[3],r=await query(env,'UPDATE forms SET active=0 WHERE id=? AND user_id=?',id,u.id).run();if(!r.meta.changes)fail(404,'Form not found.');return secure(json({ok:true}))}
 if(path==='/api/settings'&&req.method==='PATCH'){const d=await readJSON(req),name=text(d.name,80),workspace=text(d.workspace,80);if(!name||!workspace)fail(400,'Name and workspace cannot be empty.');await query(env,'UPDATE users SET name=?,workspace=? WHERE id=?',name,workspace,u.id).run();return secure(json({user:publicUser({...u,name,workspace})}))}
 if(path==='/api/export'&&req.method==='GET')return secure(await exportCSV(req,env,u));
 if(path.startsWith('/api/messages/')&&/^[a-f0-9]{32}$/.test(path.slice(14))){const id=path.slice(14);if(req.method==='PATCH')return secure(await updateMessage(req,env,u,id));if(req.method==='DELETE'){const result=await query(env,'DELETE FROM submissions WHERE id=? AND user_id=?',id,u.id).run();if(!result.meta.changes)fail(404,'Submission not found.');return secure(json({ok:true}))}}
 if(path.startsWith('/api/billing/'))return secure(await billingRoute(req,env,u,path));
 fail(404,'Not found.');
 }catch(e){let status=e.status||500,message=e.status?e.message:'The request could not be completed. Please try again.';if(e.message?.includes('one_pending_checkout')||e.message?.includes('checkouts.user_id')){status=409;message='A checkout is already pending for this account.'}if(e.message?.includes('FORM_LIMIT')){status=403;message='Your plan has reached its active form limit.'}return secure(json({error:message},status))}
}
export async function cleanup(env){
 await env.DB.batch([query(env,'DELETE FROM pending_submissions WHERE expires_at<?',now()),query(env,'DELETE FROM oauth_states WHERE expires_at<?',now()),query(env,'DELETE FROM google_link_requests WHERE expires_at<?',now()),query(env,'DELETE FROM sessions WHERE expires_at<?',now()),query(env,'DELETE FROM auth_tokens WHERE expires_at<?',now()),query(env,'DELETE FROM rate_limits WHERE expires_at<?',now()),query(env,"DELETE FROM usage_alerts WHERE month < strftime('%Y-%m','now','-3 months')"),query(env,`DELETE FROM submissions WHERE id IN (SELECT s.id FROM submissions s JOIN users u ON u.id=s.user_id WHERE s.created_at < ? - (CASE WHEN u.paid_until<=? THEN 30 WHEN u.plan='Starter' THEN 183 ELSE 366 END)*86400 LIMIT 500)`,now(),now()),query(env,'DELETE FROM email_events WHERE created_at<? AND provider_id NOT IN (SELECT provider_id FROM outbox WHERE provider_id IS NOT NULL)',now()-30*86400),query(env,"DELETE FROM outbox WHERE submission_id IS NULL AND state NOT IN ('queued','sending') AND created_at<?",now()-30*86400)]);
}
export default {fetch:handle,async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await drain(env,20);await cleanup(env)})())}};

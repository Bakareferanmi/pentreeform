import {now,uid,query,fetchProvider,svixOK,body,fail,json} from './core.js';
export function job(env,{userId,submissionId=null,recipient,kind,payload}){return query(env,'INSERT INTO outbox(id,user_id,submission_id,recipient,payload,kind,available_at,created_at) VALUES(?,?,?,?,?,?,?,?)',uid(),userId,submissionId,recipient,JSON.stringify(payload),kind,now(),now())}
export async function reconcile(env){
 // Store signed events independently: provider callbacks may arrive before the send response.
 await query(env,`UPDATE outbox SET state=COALESCE((SELECT CASE type WHEN 'email.complained' THEN 'complained' WHEN 'email.bounced' THEN 'bounced' WHEN 'email.failed' THEN 'failed' WHEN 'email.delivered' THEN 'delivered' ELSE 'accepted' END FROM email_events e WHERE e.provider_id=outbox.provider_id ORDER BY CASE type WHEN 'email.complained' THEN 5 WHEN 'email.bounced' THEN 4 WHEN 'email.failed' THEN 3 WHEN 'email.delivered' THEN 2 ELSE 1 END DESC,created_at DESC LIMIT 1),state) WHERE provider_id IS NOT NULL`).run();
 await query(env,`INSERT OR IGNORE INTO suppressions(email,reason,created_at) SELECT recipient,state,? FROM outbox WHERE state IN ('bounced','complained')`,now()).run();
}
export async function drain(env,limit=10){
 if(!env.RESEND_API_KEY||!env.EMAIL_FROM||env.EMAIL_FROM.includes('YOUR-'))return;
 await reconcile(env);
 const {results:jobs}=await query(env,`SELECT * FROM outbox WHERE (state='queued' OR (state='sending' AND lease_until<?)) AND available_at<=? ORDER BY created_at LIMIT ?`,now(),now(),limit).all();
 for(const j of jobs){
 const claim=await query(env,`UPDATE outbox SET state='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND (state='queued' OR (state='sending' AND lease_until<?)) RETURNING id`,now()+120,j.id,now()).first();if(!claim)continue;
 try{
 const suppressed=await query(env,'SELECT email FROM suppressions WHERE email=?',j.recipient).first();if(suppressed){await query(env,"UPDATE outbox SET state='suppressed',payload='',error='Recipient suppressed after a bounce or complaint' WHERE id=?",j.id).run();continue}
 const linked=j.submission_id?await query(env,'SELECT spam FROM submissions WHERE id=?',j.submission_id).first():null;
 if(j.submission_id&&(!linked||linked.spam)){await query(env,"UPDATE outbox SET state='cancelled',payload='' WHERE id=?",j.id).run();continue}
 // Refuse to resend after the provider's idempotency window has elapsed.
 if(j.attempts>0&&now()-j.created_at>23*3600){await query(env,"UPDATE outbox SET state='failed',payload='',error='Retry window expired; inspect provider logs' WHERE id=?",j.id).run();continue}
 const payload=JSON.parse(j.payload);const response=await fetchProvider('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`pentreeform/${j.id}`},body:JSON.stringify({from:env.EMAIL_FROM,to:[j.recipient],...payload})});
 if(!response.ok)throw Object.assign(new Error(`Email service returned ${response.status}`),{permanent:response.status>=400&&response.status<500&&![408,409,429].includes(response.status)});
 const data=await response.json();if(typeof data.id!=='string')throw Error('Email service returned no message identifier');
 await query(env,"UPDATE outbox SET state='accepted',provider_id=?,payload='',error='',lease_until=0 WHERE id=?",data.id,j.id).run();
 }catch(e){const stop=e.permanent||j.attempts+1>=5;await query(env,"UPDATE outbox SET state=?,available_at=?,lease_until=0,error=?,payload=CASE WHEN ? THEN '' ELSE payload END WHERE id=?",stop?'failed':'queued',now()+Math.min(900,30*2**j.attempts),e.message?.slice(0,200)||'Email service unavailable',stop?1:0,j.id).run()}
 }
 await reconcile(env);
}
export async function mailWebhook(req,env){if(!env.RESEND_WEBHOOK_SECRET)fail(503,'Email webhook is not configured.');const raw=await body(req,65536);if(!await svixOK(req,raw,env.RESEND_WEBHOOK_SECRET))fail(401,'Invalid webhook signature.');let event;try{event=JSON.parse(raw)}catch{fail(400,'Invalid event.')}
 if(['email.sent','email.delivered','email.bounced','email.complained','email.failed'].includes(event.type)&&typeof event.data?.email_id==='string'){
 await query(env,'INSERT OR IGNORE INTO email_events(id,provider_id,type,created_at) VALUES(?,?,?,?)',req.headers.get('svix-id'),event.data.email_id,event.type,Math.floor(Date.parse(event.created_at)/1000)||now()).run();await reconcile(env)}return json({ok:true});}

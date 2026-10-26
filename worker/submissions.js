import {PLANS,now,uid,hash,query,origin,text,email,fail,json,readJSON,body,rate,effectivePlan} from './core.js';
import {challenge} from './auth.js';
import {submissionForm,submissionFields,saveSubmission,savedResponse,submissionError,approvedOrigin} from './submission-core.js';
import {beginHostedVerification} from './hosted-verification.js';
export function formJSON(f,u,env){return {id:f.id,name:f.name,domain:f.domain,redirect:f.redirect,email:u.email,active:!!f.active,endpoint:`${origin(env)}/f/${f.id}`}}
export async function createForm(req,env,u){const d=await readJSON(req);let host;try{const url=new URL(String(d.domain).includes('://')?d.domain:'https://'+d.domain);if(url.protocol!=='https:'||!url.hostname.includes('.')||url.username||url.password||url.port)throw 0;host=url.hostname}catch{fail(400,'Enter a valid HTTPS website domain.');}
 const name=text(d.name,80);if(!name)fail(400,'Enter a form name.');
 // The verified account email is the only recipient. Arbitrary recipients cannot receive mail.
 if(d.email&&email(d.email)!==u.email)fail(400,'Use your verified account email as the notification recipient.');
 let redirect='';if(d.redirect){if(effectivePlan(u)==='Free')fail(403,'Custom redirects require a paid plan.');try{const url=new URL(d.redirect);if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password)throw 0;redirect=url.href}catch{fail(400,'Redirect must be an HTTPS URL on your approved website domain.')}}
 const f={id:uid(),name,domain:host,redirect,active:1};await query(env,'INSERT INTO forms(id,user_id,name,domain,redirect,created_at) VALUES(?,?,?,?,?,?)',f.id,u.id,name,host,redirect,now()).run();return json({form:formJSON(f,u,env)},201);
}
function cors(req,host){const allowed=approvedOrigin(req.headers.get('origin'),host);return allowed?{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Idempotency-Key','Vary':'Origin'}:{}}

export async function submit(req,env,id){
 const f=await submissionForm(env,id);const headers=cors(req,f.domain);
 if(req.method==='OPTIONS'){if(!headers['Access-Control-Allow-Origin'])fail(403,'Website origin not allowed.');return new Response(null,{status:204,headers})}
 if(req.method!=='POST')fail(405,'Use POST to submit this form.');
 let requestKey=null;
 try{
 if(!headers['Access-Control-Allow-Origin'])fail(403,'Submit this form from its approved HTTPS website.');
 await rate(env,`submit:${id}:${req.headers.get('CF-Connecting-IP')||'local'}`,10,60);
 const type=req.headers.get('content-type')||'';let d;
 if(type.includes('application/json'))d=await readJSON(req);
 else if(type.includes('application/x-www-form-urlencoded'))d=Object.fromEntries(new URLSearchParams(await body(req)));
 else if(type.includes('multipart/form-data')){const raw=await body(req);const form=await new Response(raw,{headers:{'Content-Type':type}}).formData();d={};for(const [key,value] of form){if(typeof value!=='string')fail(400,'File uploads are not supported.');d[key]=value}}
 else fail(415,'Use JSON or an HTML form.');
 if(text(d._gotcha))return json({ok:true},200,headers);
 requestKey=req.headers.get('idempotency-key')||d._submission_id||null;if(requestKey&&!/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey))fail(400,'Invalid submission identifier.');
 if(requestKey){const existing=await query(env,'SELECT id FROM submissions WHERE form_id=? AND request_key=?',id,requestKey).first();if(existing)return json({ok:true,id:existing.id},200,headers)}
 const fields=submissionFields(d);
 if(!d['cf-turnstile-response'])return await beginHostedVerification(req,env,f,fields,requestKey,headers);
 // Existing direct-widget integrations remain valid during migration. New forms
 // use Pentreeform's hosted check and need no customer-domain Turnstile setup.
 const verified=await challenge(req,env,d['cf-turnstile-response'],'submission');if(verified.hostname!==new URL(req.headers.get('origin')).hostname)fail(400,'Security check hostname does not match this form.');
 const saved=await saveSubmission(env,f,fields,requestKey);
 return savedResponse(req,f,saved,headers);
 }catch(error){return submissionError(error,headers)}
}
export const messageJSON=m=>({id:m.id,name:m.name,email:m.email,formId:m.form_id,subject:m.subject,message:m.message,fields:JSON.parse(m.fields),date:new Date(m.created_at*1000).toISOString(),read:!!m.is_read,spam:!!m.spam,delivery:m.delivery||'queued',deliveryError:m.delivery_error||''});
export async function state(req,env,u){const plan=effectivePlan(u),usageMonth=new Date().toISOString().slice(0,7),cursor=new URL(req.url).searchParams.get('before');if(cursor&&!/^\d+:[a-f0-9]{32}$/.test(cursor))fail(400,'Invalid page cursor.');let extra='',args=[];if(cursor){const [date,id]=cursor.split(':');extra=' AND (s.created_at<? OR (s.created_at=? AND s.id<?))';args=[Number(date),Number(date),id]}
 const [forms,messages,usage,sub]=await Promise.all([query(env,'SELECT * FROM forms WHERE user_id=? ORDER BY created_at DESC',u.id).all(),query(env,`SELECT s.*,o.state delivery,o.error delivery_error FROM submissions s LEFT JOIN outbox o ON o.submission_id=s.id WHERE s.user_id=? AND s.created_at>?${extra} ORDER BY s.created_at DESC,s.id DESC LIMIT 101`,u.id,now()-PLANS[plan].days*86400,...args).all(),query(env,'SELECT count FROM monthly_usage WHERE user_id=? AND month=?',u.id,usageMonth).first(),query(env,'SELECT status FROM subscriptions WHERE user_id=?',u.id).first()]);
 const visible=messages.results.slice(0,100),last=visible.at(-1);return json({forms:forms.results.map(f=>formJSON(f,u,env)),messages:visible.map(messageJSON),usageMonth,nextCursor:messages.results.length>100?`${last.created_at}:${last.id}`:null,usage:usage?.count||0,limit:PLANS[plan].limit,subscriptionStatus:sub?.status||null})}
export async function updateMessage(req,env,u,id){const d=await readJSON(req),existing=await query(env,'SELECT id FROM submissions WHERE id=? AND user_id=?',id,u.id).first();if(!existing)fail(404,'Submission not found.');if(typeof d.read!=='boolean'&&typeof d.spam!=='boolean')fail(400,'No supported changes.');await query(env,'UPDATE submissions SET is_read=COALESCE(?,is_read),spam=COALESCE(?,spam) WHERE id=? AND user_id=?',typeof d.read==='boolean'?Number(d.read):null,typeof d.spam==='boolean'?Number(d.spam):null,id,u.id).run();return json({ok:true})}
export async function exportCSV(req,env,u){if(effectivePlan(u)==='Free')fail(403,'CSV export requires a paid plan.');const params=new URL(req.url).searchParams,args=[u.id,now()-PLANS[effectivePlan(u)].days*86400];let condition='user_id=? AND created_at>?';const form=params.get('form'),tab=params.get('tab'),days=params.get('days'),search=text(params.get('q'),200);if(form&&form!=='all'){condition+=' AND form_id=?';args.push(form)}condition+=' AND spam=?';args.push(tab==='Spam'?1:0);if(tab==='Unread')condition+=' AND is_read=0';if(['1','7','30'].includes(days)){condition+=' AND created_at>?';args.push(now()-Number(days)*86400)}if(search){condition+=" AND (name||' '||email||' '||subject||' '||message) LIKE ? ESCAPE '\\'";args.push('%'+search.replace(/[\\%_]/g,'\\$&')+'%')}
 const encode=s=>'"'+String(s??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';let cursor=null,started=false;const stream=new ReadableStream({async pull(controller){try{if(!started){controller.enqueue(new TextEncoder().encode('\ufeffName,Email,Form ID,Subject,Message,Received\r\n'));started=true}let extra='',values=[...args];if(cursor){extra=' AND (created_at<? OR (created_at=? AND id<?))';values.push(cursor.created_at,cursor.created_at,cursor.id)}const rows=await query(env,`SELECT * FROM submissions WHERE ${condition}${extra} ORDER BY created_at DESC,id DESC LIMIT 200`,...values).all();for(const m of rows.results)controller.enqueue(new TextEncoder().encode([m.name,m.email,m.form_id,m.subject,m.message,new Date(m.created_at*1000).toISOString()].map(encode).join(',')+'\r\n'));if(rows.results.length<200)controller.close();else cursor=rows.results.at(-1)}catch(e){controller.error(e)}}});return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="pentreeform-submissions.csv"','Cache-Control':'no-store'}})}

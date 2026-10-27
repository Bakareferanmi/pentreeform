import {now,uid,query,origin,text,email,fail,json,effectivePlan} from './core.js';
import {job} from './mail.js';
import {usageAlertStatements} from './usage.js';

export function approvedOrigin(value,domain){
 try{
  const url=new URL(value),normalize=hostname=>hostname.replace(/^www\./,'');
  return url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&url.origin===value&&normalize(url.hostname)===normalize(domain)?url.origin:null;
 }catch{return null;}
}

export async function submissionForm(env,id){
 const form=await query(env,'SELECT f.*,u.email recipient,u.verified,u.plan,u.paid_until FROM forms f JOIN users u ON u.id=f.user_id WHERE f.id=? AND f.active=1',id).first();
 if(!form||!form.verified)fail(404,'Form not found.');
 return form;
}
export function submissionFields(data){
 const entries=Object.entries(data).filter(([key])=>!['cf-turnstile-response','_gotcha','_submission_id'].includes(key));
 if(entries.length>30)fail(400,'At most 30 fields are allowed.');
 const fields={};
 for(const [key,value] of entries){
  if(typeof value!=='string'||key.length>80||value.length>8000||['__proto__','constructor','prototype'].includes(key))fail(400,'Fields must contain plain text within the field limits.');
  fields[key]=value.trim();
 }
 if(!Object.values(fields).some(Boolean))fail(400,'The submission is empty.');
 if(fields.email)email(fields.email);
 if(JSON.stringify(fields).length>24000)fail(413,'Submission too large.');
 return fields;
}
export async function saveSubmission(env,form,fields,requestKey,extraStatements=()=>[]){
 const address=fields.email?email(fields.email):'';
 const submission={id:uid(),name:text(fields.name,120)||[text(fields.first_name,60),text(fields.last_name,60)].filter(Boolean).join(' ')||'Website visitor',email:address,subject:text(fields.subject,160)||`New ${form.name} submission`,message:text(fields.message,8000)||Object.entries(fields).map(([key,value])=>`${key}: ${value}`).join('\n'),date:now()};
 const month=new Date(submission.date*1000).toISOString().slice(0,7);
 try{
  await env.DB.batch([
   query(env,'INSERT INTO submissions(id,form_id,user_id,name,email,subject,message,fields,created_at,month,request_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)',submission.id,form.id,form.user_id,submission.name,submission.email,submission.subject,submission.message,JSON.stringify(fields),submission.date,month,requestKey),
   job(env,{userId:form.user_id,submissionId:submission.id,recipient:form.recipient,kind:'submission',payload:{subject:`[Pentreeform] ${submission.subject}`,...(address?{reply_to:address}:{}),text:`${form.name}\n\n${Object.entries(fields).map(([key,value])=>`${key}: ${value}`).join('\n\n')}\n\nOpen your inbox: ${origin(env)}/`}}),
   ...usageAlertStatements(env,{...form,id:form.user_id},month),...extraStatements(submission.id),
  ]);
 }catch(error){
  if(error.message?.includes('UNIQUE constraint')&&requestKey){
   const old=await query(env,'SELECT id FROM submissions WHERE form_id=? AND request_key=?',form.id,requestKey).first();
   if(old)return {id:old.id,duplicate:true};
  }
  throw error;
 }
 return {id:submission.id,duplicate:false};
}
export function savedResponse(req,form,saved,headers={}){
 if(req.headers.get('accept')?.includes('text/html')){
  const redirect=effectivePlan(form)!=='Free'?form.redirect:'';
  if(redirect)return new Response(null,{status:303,headers:{...headers,Location:redirect}});
  return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Message received · Pentreeform</title><body style="font:18px system-ui;padding:12vh 8vw;color:#231638"><h1>Message received.</h1><p>Your submission has been saved. You can close this page or return to the website.</p></body></html>',{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 }
 return json({ok:true,id:saved.id},saved.duplicate?200:201,headers);
}
export function submissionError(error,headers={}){
 let status=error.status||500,message=error.message;
 if(message?.includes('SUBMISSION_LIMIT')){status=429;message='This account has reached its monthly submission limit.';}
 if(!error.status&&status===500)message='The submission could not be saved. Please try again.';
 return json({error:message},status,headers);
}

import {query,json,origin} from './core.js';
import {googleConfigured} from './google.js';
const tables=['users','sessions','auth_tokens','forms','submissions','monthly_usage','rate_limits','outbox','email_events','suppressions','checkouts','subscriptions','billing_events','google_identities','oauth_states','google_link_requests','usage_alerts','pending_submissions'];
export async function health(env){
 let database=false,schema=false,applicationOrigin=null;
 try{applicationOrigin=origin(env)}catch{}
 if(env.DB)try{const result=await query(env,"SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+tables.map(()=>'?').join(',')+")",...tables).all();database=true;schema=tables.every(name=>result.results.some(row=>row.name===name))}catch{}
 const ready=database&&schema&&!!applicationOrigin;
 return json({service:'pentreeform',status:ready?'ok':'setup_required',applicationOrigin,checks:{database,schema,origin:!!applicationOrigin},configured:{email:!!env.RESEND_API_KEY&&!!env.EMAIL_FROM&&!env.EMAIL_FROM.includes('YOUR-'),emailWebhooks:!!env.RESEND_WEBHOOK_SECRET,turnstile:!!env.TURNSTILE_SITE_KEY&&!!env.TURNSTILE_SECRET_KEY,google:googleConfigured(env),billing:!!env.PAYSTACK_SECRET_KEY&&['STARTER','PRO','AGENCY'].every(plan=>!!env['PAYSTACK_PLAN_'+plan])}},ready?200:503);
}

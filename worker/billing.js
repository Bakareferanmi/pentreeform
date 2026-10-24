import {PLANS,query,now,uid,fail,json,readJSON,body,hmac,safeEqual,origin,fetchProvider,rate} from './core.js';
async function paystack(env,path,data){if(!env.PAYSTACK_SECRET_KEY)fail(503,'Billing is not configured yet.');const res=await fetchProvider('https://api.paystack.co'+path,{method:data?'POST':'GET',headers:{Authorization:`Bearer ${env.PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const result=await res.json();if(!res.ok||!result.status)fail(502,'The payment provider could not complete this request.');return result.data}
function planCode(env,name){return env[`PAYSTACK_PLAN_${String(name).toUpperCase()}`]}
export async function checkout(req,env,u){await rate(env,`checkout:${u.id}`,5,3600);const data=await readJSON(req),name=data.plan;if(!PLANS[name]?.price)fail(400,'Choose a paid plan.');const code=planCode(env,name);if(!code)fail(503,'This plan is not available for checkout yet.');
 const sub=await query(env,'SELECT status FROM subscriptions WHERE user_id=?',u.id).first();if(sub&&!['complete','cancelled'].includes(sub.status))fail(409,'Manage your existing subscription before starting another one.');
 if(await query(env,'SELECT reference FROM checkouts WHERE user_id=? AND created_at>? AND paid=0',u.id,now()-3600).first())fail(409,'A checkout is already pending. Complete it or wait an hour before starting another.');
 // Never trust an amount or a provider plan code supplied by the browser.
 const plan=await paystack(env,`/plan/${encodeURIComponent(code)}`);if(plan.currency!=='USD'||Number(plan.amount)!==PLANS[name].price||plan.interval!=='monthly')fail(503,'The merchant plan does not match the approved monthly USD price.');
 await query(env,"UPDATE checkouts SET state='expired' WHERE user_id=? AND paid=0 AND created_at<=?",u.id,now()-3600).run();
 const reference='pf_'+uid();await query(env,'INSERT INTO checkouts(reference,user_id,plan,plan_code,amount,currency,created_at) VALUES(?,?,?,?,?,?,?)',reference,u.id,name,code,PLANS[name].price,'USD',now()).run();
 const result=await paystack(env,'/transaction/initialize',{email:u.email,reference,amount:PLANS[name].price,currency:'USD',plan:code,callback_url:`${origin(env)}/?billing=return`,metadata:{pentreeform_user:u.id}});
 if(!/^https:\/\/checkout\.paystack\.com\//.test(result.authorization_url))fail(502,'Invalid payment provider redirect.');return json({url:result.authorization_url});
}
function addMonth(timestamp){const date=new Date(timestamp*1000),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);const next=new Date(date);next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(0);date.setUTCDate(Math.min(day,next.getUTCDate()));return Math.floor(date.getTime()/1000)}
export async function settle(env,reference,owner=null){if(!/^[a-zA-Z0-9_-]{1,150}$/.test(reference))fail(400,'Invalid transaction reference.');const paid=await paystack(env,`/transaction/verify/${encodeURIComponent(reference)}`);if(paid.status!=='success'||paid.reference!==reference)fail(409,'Payment has not succeeded yet.');
 let row=await query(env,'SELECT * FROM checkouts WHERE reference=?',reference).first();const customer=paid.customer?.customer_code,code=paid.plan_object?.plan_code||paid.plan?.plan_code||(typeof paid.plan==='string'?paid.plan:null);
 if(!row){if(!customer)fail(404,'Payment does not belong to a Pentreeform subscription.');const sub=code?await query(env,'SELECT * FROM subscriptions WHERE customer_code=? AND plan_code=?',customer,code).first():await query(env,'SELECT * FROM subscriptions WHERE customer_code=?',customer).first();if(!sub)fail(404,'Subscription not found.');row={user_id:sub.user_id,plan:sub.plan,plan_code:sub.plan_code,amount:PLANS[sub.plan].price,currency:'USD'}}
 if(owner&&row.user_id!==owner.id)fail(404,'Transaction not found.');
 const user=await query(env,'SELECT * FROM users WHERE id=?',row.user_id).first();if(!user||!customer||paid.customer?.email?.toLowerCase()!==user.email||paid.currency!==row.currency||Number(paid.amount)!==row.amount||(code&&code!==row.plan_code))fail(400,'Payment details do not match the account and selected plan.');
 const paidAt=Math.floor(Date.parse(paid.paid_at||paid.paidAt)/1000);if(!Number.isFinite(paidAt))fail(400,'Payment time is missing.');const until=addMonth(paidAt);
 // Conditional updates and a unique payment ledger make duplicate webhooks harmless.
 await env.DB.batch([query(env,`UPDATE users SET plan=CASE WHEN paid_until<=? THEN ? ELSE plan END,paid_until=MAX(paid_until,?),customer_code=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM billing_events WHERE reference=?)`,until,row.plan,until,customer,row.user_id,reference),query(env,"UPDATE checkouts SET paid=1,state='paid',customer_code=? WHERE reference=?",customer,reference),query(env,'INSERT OR IGNORE INTO billing_events(reference,user_id,created_at) VALUES(?,?,?)',reference,row.user_id,paidAt)]);
 return json({ok:true,message:'Payment verified. Your plan is updated.'});
}
async function syncSubscription(env,event){const code=event.data?.subscription_code||event.data?.subscription?.subscription_code;if(typeof code!=='string'||!/^SUB_[a-zA-Z0-9]+$/.test(code))return;
 // Fetch current provider state instead of trusting potentially delayed event ordering.
 const sub=await paystack(env,`/subscription/${encodeURIComponent(code)}`),customer=sub.customer?.customer_code,plan=sub.plan?.plan_code;
 let checkout=await query(env,'SELECT * FROM checkouts WHERE customer_code=? AND plan_code=? AND paid=1 ORDER BY created_at DESC LIMIT 1',customer||'',plan||'').first();
 if(!checkout&&sub.customer?.email){const pending=await query(env,'SELECT c.* FROM checkouts c JOIN users u ON u.id=c.user_id WHERE u.email=? AND c.plan_code=? ORDER BY c.created_at DESC LIMIT 1',sub.customer.email.toLowerCase(),plan||'').first();if(pending){await settle(env,pending.reference);checkout=await query(env,'SELECT * FROM checkouts WHERE reference=? AND paid=1',pending.reference).first()}}
 if(!checkout)return;
 const existing=await query(env,'SELECT * FROM subscriptions WHERE user_id=?',checkout.user_id).first();if(existing&&existing.code!==code&&!['complete','cancelled'].includes(existing.status))return;
 const status=['active','non-renewing','attention','complete','cancelled'].includes(sub.status)?sub.status:'attention';
 await query(env,`INSERT INTO subscriptions(code,user_id,customer_code,plan_code,plan,status) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET code=excluded.code,customer_code=excluded.customer_code,plan_code=excluded.plan_code,plan=excluded.plan,status=excluded.status`,code,checkout.user_id,customer,plan,checkout.plan,status).run();
 // Access expires naturally at the paid period end even after cancellation.
}
export async function billingWebhook(req,env){if(!env.PAYSTACK_SECRET_KEY)fail(503,'Billing is not configured.');const raw=await body(req,131072);if(!safeEqual(await hmac(env.PAYSTACK_SECRET_KEY,raw),req.headers.get('x-paystack-signature')||''))fail(401,'Invalid payment signature.');let event;try{event=JSON.parse(raw)}catch{fail(400,'Invalid event.')}
 if(event.event==='charge.success')await settle(env,event.data?.reference);
 if(['subscription.create','subscription.disable','subscription.not_renew','invoice.payment_failed','invoice.update'].includes(event.event))await syncSubscription(env,event);
 return json({ok:true});
}
export async function billingRoute(req,env,u,path){if(path==='/api/billing/checkout'&&req.method==='POST')return checkout(req,env,u);if(path==='/api/billing/verify'&&req.method==='POST'){const d=await readJSON(req);return settle(env,d.reference,u)}if(path==='/api/billing/manage'&&req.method==='POST'){const sub=await query(env,'SELECT code FROM subscriptions WHERE user_id=?',u.id).first();if(!sub)fail(404,'No subscription is linked yet.');const data=await paystack(env,`/subscription/${encodeURIComponent(sub.code)}/manage/link`);if(!/^https:\/\/paystack\.com\//.test(data.link))fail(502,'Invalid subscription management URL.');return json({url:data.link})}fail(404,'Not found.')}

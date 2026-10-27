import {query,now,json,fail,isAdmin,effectivePlan,PLANS} from './core.js';
const day=stamp=>new Date(stamp*1000).toISOString().slice(0,10);
const all=async(env,sql,...args)=>(await query(env,sql,...args).all()).results;
const escapedLike=s=>'%'+s.replace(/[\\%_]/g,'\\$&')+'%';
function params(req){const p=new URL(req.url).searchParams,days=Number(p.get('days')||30);if(![7,30,90].includes(days))fail(400,'Choose 7, 30 or 90 days.');if(p.has('includeOwner')&&!['0','1'].includes(p.get('includeOwner')))fail(400,'Invalid account scope.');return {p,days,includeOwner:p.get('includeOwner')==='1'}}
export async function adminRoute(req,env,user,path){
 if(!isAdmin(user,env))fail(403,'This page is only available to the owner.');
 if(req.method!=='GET')fail(405,'Admin reports are read-only.');
 const {p,days,includeOwner}=params(req),stamp=now(),today=Math.floor(stamp/86400)*86400,start=today-(days-1)*86400,exclude=includeOwner?'':user.id,month=day(stamp).slice(0,7);
 if(path==='/api/admin/overview'){
  const [accounts,forms,usage,submissions,delivery,signups,active,volume,plans,systems]=await Promise.all([
   query(env,`SELECT COUNT(*) total,COALESCE(SUM(verified),0) verified,
    COALESCE(SUM(created_at>=?),0) new_in_range,COALESCE(SUM(last_seen_at>=?),0) active_seven,
    COALESCE(SUM(verified=1 AND EXISTS(SELECT 1 FROM forms f WHERE f.user_id=u.id)),0) with_forms,
    COALESCE(SUM(verified=1 AND EXISTS(SELECT 1 FROM forms f WHERE f.user_id=u.id) AND EXISTS(SELECT 1 FROM monthly_usage m WHERE m.user_id=u.id AND m.count>0)),0) activated
    FROM users u WHERE u.id<>?`,start,today-6*86400,exclude).first(),
   query(env,'SELECT COUNT(*) total,COALESCE(SUM(active),0) active FROM forms WHERE user_id<>?',exclude).first(),
   query(env,'SELECT COALESCE(SUM(count),0) used FROM monthly_usage WHERE month=? AND user_id<>?',month,exclude).first(),
   query(env,'SELECT COALESCE(SUM(submissions),0) total FROM analytics_daily WHERE day>=? AND day<=? AND user_id<>?',day(start),day(stamp),exclude).first(),
   all(env,'SELECT state,COUNT(*) count FROM outbox WHERE created_at>=? AND created_at<=? AND user_id<>? GROUP BY state',start,stamp,exclude),
   all(env,"SELECT strftime('%Y-%m-%d',created_at,'unixepoch') day,COUNT(*) count FROM users WHERE created_at>=? AND created_at<=? AND id<>? GROUP BY 1",start,stamp,exclude),
   all(env,'SELECT day,COUNT(*) count FROM user_activity_days WHERE day>=? AND day<=? AND user_id<>? GROUP BY day',day(start),day(stamp),exclude),
   all(env,'SELECT day,SUM(submissions) count FROM analytics_daily WHERE day>=? AND day<=? AND user_id<>? GROUP BY day',day(start),day(stamp),exclude),
   all(env,"SELECT CASE WHEN paid_until>? THEN plan ELSE 'Free' END name,COUNT(*) count FROM users WHERE id<>? GROUP BY 1",stamp,exclude),
   query(env,'SELECT MIN(day) first_day FROM analytics_daily').first()
  ]);
  const maps=[signups,active,volume].map(rows=>new Map(rows.map(r=>[r.day,r.count]))),series=Array.from({length:days},(_,i)=>{const date=day(start+i*86400);return {day:date,signups:maps[0].get(date)||0,active:maps[1].get(date)||0,submissions:maps[2].get(date)||0}});
  const states=Object.fromEntries(delivery.map(r=>[r.state,r.count])),attempted=Object.entries(states).filter(([state])=>!['queued','suppressed','cancelled'].includes(state)).reduce((n,[,count])=>n+count,0);
  return json({asOf:stamp,days,includeOwner,accounts,forms,usage:{month,count:usage.used},submissions:submissions.total,series,plans,delivery:{states,attempted,confirmed:states.delivered||0,confirmationRate:attempted?Math.round((states.delivered||0)*1000/attempted)/10:null},services:{email:!!env.RESEND_API_KEY&&!!env.EMAIL_FROM&&!env.EMAIL_FROM.includes('YOUR-'),deliveryWebhooks:!!env.RESEND_WEBHOOK_SECRET,google:!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET,registration:env.REGISTRATION_OPEN==='true'},historyStart:systems.first_day,notes:{activity:'Account activity dates start when this update is deployed. Historical activity is not inferred.',submissions:'Older submission counts begin with retained messages at setup. New counts survive message retention cleanup.',delivery:'Email states cover retained outbox jobs in this range, for all email types. Accepted is not confirmed delivery. Jobs older than 30 days may have been removed.'}});
 }
 if(path==='/api/admin/users'){
  const q=p.get('q')||'',status=p.get('status')||'all',plan=p.get('plan')||'all',cursor=p.get('before');
  if(q.length>100)fail(400,'Search is limited to 100 characters.');if(!['all','verified','pending'].includes(status)||!['all',...Object.keys(PLANS)].includes(plan))fail(400,'Invalid user filter.');
  if(cursor&&!/^\d{1,12}:[a-f0-9]{32}$/.test(cursor))fail(400,'Invalid page cursor.');
  const conditions=['1=1'],args=[];
  if(q){conditions.push("(u.name||' '||u.email||' '||u.workspace) LIKE ? ESCAPE '\\'");args.push(escapedLike(q))}
  if(status!=='all'){conditions.push('u.verified=?');args.push(status==='verified'?1:0)}
  if(plan!=='all'){conditions.push("(CASE WHEN u.paid_until>? THEN u.plan ELSE 'Free' END)=?");args.push(stamp,plan)}
  const where=conditions.join(' AND '),total=await query(env,'SELECT COUNT(*) count FROM users u WHERE '+where,...args).first();
  if(cursor){const [date,id]=cursor.split(':');conditions.push('(u.created_at<? OR (u.created_at=? AND u.id<?))');args.push(Number(date),Number(date),id)}
  const rows=await all(env,`SELECT u.id,u.name,u.email,u.workspace,u.verified,u.plan,u.paid_until,u.created_at,u.last_seen_at,
   EXISTS(SELECT 1 FROM google_identities g WHERE g.user_id=u.id) google_enabled,
   CASE WHEN u.password_hash LIKE 'pbkdf2:%' THEN 1 ELSE 0 END password_enabled,
   (SELECT COUNT(*) FROM forms f WHERE f.user_id=u.id AND f.active=1) active_forms,
   COALESCE((SELECT count FROM monthly_usage m WHERE m.user_id=u.id AND m.month=?),0) usage
   FROM users u WHERE ${conditions.join(' AND ')} ORDER BY u.created_at DESC,u.id DESC LIMIT 26`,month,...args);
  const page=rows.slice(0,25),last=page.at(-1);
  return json({users:page.map(u=>accountJSON(u,user.id)),total:total.count,month,nextCursor:rows.length>25?last.created_at+':'+last.id:null});
 }
 const match=/^\/api\/admin\/users\/([a-f0-9]{32})$/.exec(path);
 if(match){
  const u=await query(env,`SELECT u.id,u.name,u.email,u.workspace,u.verified,u.plan,u.paid_until,u.created_at,u.last_seen_at,
   EXISTS(SELECT 1 FROM google_identities g WHERE g.user_id=u.id) google_enabled,
   CASE WHEN u.password_hash LIKE 'pbkdf2:%' THEN 1 ELSE 0 END password_enabled,
   (SELECT COUNT(*) FROM forms f WHERE f.user_id=u.id AND f.active=1) active_forms,
   COALESCE((SELECT count FROM monthly_usage m WHERE m.user_id=u.id AND m.month=?),0) usage FROM users u WHERE u.id=?`,month,match[1]).first();if(!u)fail(404,'Account not found.');
  const [forms,usage,deliveries,retained]=await Promise.all([
   all(env,'SELECT id,name,domain,active,created_at FROM forms WHERE user_id=? ORDER BY active DESC,created_at DESC,id DESC LIMIT 100',u.id),
   all(env,'SELECT month,count FROM monthly_usage WHERE user_id=? ORDER BY month DESC LIMIT 12',u.id),
   all(env,'SELECT state,COUNT(*) count FROM outbox WHERE user_id=? AND created_at>=? GROUP BY state',u.id,today-29*86400),
   query(env,'SELECT COUNT(*) submissions,COALESCE(SUM(spam),0) spam FROM submissions WHERE user_id=?',u.id).first()
  ]);
  return json({user:accountJSON(u,user.id),forms,usage,deliveries,retained,month,formsLimited:forms.length===100});
 }
 fail(404,'Admin report not found.');
}
function accountJSON(u,owner){return {id:u.id,name:u.name,email:u.email,workspace:u.workspace,verified:!!u.verified,plan:effectivePlan(u),createdAt:u.created_at,lastSeenAt:u.last_seen_at,activeForms:u.active_forms,usage:u.usage,limit:PLANS[effectivePlan(u)].limit,googleEnabled:!!u.google_enabled,passwordEnabled:!!u.password_enabled,isOwner:u.id===owner}}

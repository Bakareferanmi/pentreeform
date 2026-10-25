import {PLANS,now,uid,query,origin,effectivePlan} from './core.js';
import {USAGE_THRESHOLDS,usageSummary} from '../shared/usage.js';
// Both claims and email jobs are inserted in the submission's existing transaction.
// Only a newly created claim matches its random outbox ID, so retries cannot resend it.
export function usageAlertStatements(env,account,month){
 const plan=effectivePlan(account),quota=PLANS[plan].limit,resetAt=usageSummary(0,quota,month).resetAt;
 const actualQuota=`CASE WHEN u.paid_until<=unixepoch() THEN ${PLANS.Free.limit} ${Object.entries(PLANS).filter(([name])=>name!=='Free').map(([name,p])=>`WHEN u.plan='${name}' THEN ${p.limit}`).join(' ')} ELSE ${PLANS.Free.limit} END`;
 return USAGE_THRESHOLDS.flatMap(threshold=>{
  const id=uid(),time=now(),minimum=Math.ceil(quota*threshold/100),upper=Math.ceil(quota*95/100);
  const payload=JSON.stringify({subject:`[Pentreeform] ${threshold}% of your monthly submissions used`,text:`Your account has used at least ${threshold}% of its monthly submission allowance.\n\nPlan: ${plan}\nAllowance: ${quota.toLocaleString('en-US')} submissions, shared across all your forms.\nUsage month: ${month} (UTC).\nResets: ${resetAt.slice(0,10)} at 00:00 UTC.\n\nNew submissions are not saved while your account is at its limit. Review your usage and plan before you run out of room.\n\nOpen your workspace: ${origin(env)}/app\nChoose Usage & billing to see your current usage.\n\nYou receive each threshold alert once per monthly allowance.`});
  return [query(env,`INSERT OR IGNORE INTO usage_alerts(user_id,month,quota,threshold,outbox_id,created_at) SELECT u.id,?,?,?,?,? FROM monthly_usage m JOIN users u ON u.id=m.user_id WHERE m.user_id=? AND m.month=? AND u.verified=1 AND m.count>=? ${threshold===80?'AND m.count<?':''} AND (${actualQuota})=?`,month,quota,threshold,id,time,account.id,month,minimum,...(threshold===80?[upper]:[]),quota),query(env,`INSERT OR IGNORE INTO outbox(id,user_id,recipient,payload,kind,available_at,created_at) SELECT a.outbox_id,a.user_id,u.email,?,?,?,? FROM usage_alerts a JOIN users u ON u.id=a.user_id WHERE a.outbox_id=?`,payload,'usage-'+threshold,time,time,id)];
 });
}

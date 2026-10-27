import {query,uid,now,origin} from './core.js';
const escapeHTML=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function welcomeMessage(env,user){
 const first=String(user.name||'').trim().split(/\s+/)[0]||'there',base=origin(env),workspace=base+'/app',support=base+'/support';
 const text=`Hi ${first},\n\nWelcome to Pentreeform. Here’s how to get your first form connected:\n\n1. Create a form in your workspace.\n2. Add its endpoint to your website form.\n3. Send a test message, then check Inbox and Deliveries.\n\nOpen your workspace: ${workspace}\n\nNeed a hand? Visit ${support}\n\nBakare Feranmi\nFounder\nPentreeform\n\nYou’re receiving this account email because you signed up for Pentreeform.`;
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Welcome to Pentreeform</title><style>
@media(max-width:480px){.email-content{padding:28px 22px!important}.email-heading{font-size:28px!important}}
@media(prefers-color-scheme:dark){.email-background{background:#111111!important}.email-card{background:#171717!important;border-color:#463459!important}.email-copy,.email-heading{color:#f5f5f5!important}.email-muted{color:#c7c7cc!important}.email-link,.email-step{color:#d1baff!important}.email-rule{border-color:#463459!important}}
</style></head><body class="email-background" style="margin:0;padding:24px 12px;background:#fafafa;font-family:Arial,Helvetica,sans-serif;color:#171717">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;mso-hide:all">Your first form, connected in three steps.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" class="email-card" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e1d6f2;border-radius:16px"><tr><td class="email-content" style="padding:36px 36px 32px">
<img src="${escapeHTML(base)}/email-logo.png" alt="Pentreeform" width="44" height="44" style="display:block;border:0;margin:0 0 32px">
<p class="email-copy" style="font-size:16px;line-height:1.6;margin:0 0 14px">Hi ${escapeHTML(first)},</p>
<h1 class="email-heading" style="font-size:32px;line-height:1.2;letter-spacing:-.7px;margin:0 0 18px;color:#171717">Your forms have a home.</h1>
<p class="email-muted" style="font-size:16px;line-height:1.7;margin:0 0 28px;color:#50505a">Welcome to Pentreeform. Get your first form connected in three steps.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-copy" style="font-size:16px;line-height:1.6;color:#171717">
<tr><td class="email-step" valign="top" width="28" style="padding:0 0 18px;color:#6020c8;font-weight:bold">1.</td><td style="padding:0 0 18px"><strong>Create a form.</strong><br><span class="email-muted" style="color:#50505a">Choose a name and your website.</span></td></tr>
<tr><td class="email-step" valign="top" width="28" style="padding:0 0 18px;color:#6020c8;font-weight:bold">2.</td><td style="padding:0 0 18px"><strong>Connect your website.</strong><br><span class="email-muted" style="color:#50505a">Add the endpoint to your form.</span></td></tr>
<tr><td class="email-step" valign="top" width="28" style="padding:0 0 28px;color:#6020c8;font-weight:bold">3.</td><td style="padding:0 0 28px"><strong>Send a test message.</strong><br><span class="email-muted" style="color:#50505a">Check Inbox and Deliveries.</span></td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#6020c8" style="border-radius:9px;background:#6020c8"><a href="${escapeHTML(workspace)}" style="display:inline-block;padding:15px 24px;border:1px solid #6020c8;border-radius:9px;font-size:15px;font-weight:bold;line-height:1.4;text-decoration:none;color:#ffffff">Open your workspace</a></td></tr></table>
<p class="email-muted" style="margin:28px 0 24px;font-size:15px;line-height:1.7;color:#50505a">Need a hand? <a class="email-link" href="${escapeHTML(support)}" style="color:#6020c8;text-decoration:underline">Visit Support</a>.</p>
<p class="email-copy" style="margin:0 0 28px;font-size:16px;line-height:1.6"><strong>Bakare Feranmi</strong><br><span class="email-muted" style="color:#50505a">Founder<br>Pentreeform</span></p>
<div class="email-rule" style="border-top:1px solid #e1d6f2;padding-top:20px"><p class="email-muted" style="font-size:12px;line-height:1.7;color:#676770;margin:0">You’re receiving this account email because you signed up for Pentreeform.</p></div>
</td></tr></table></td></tr></table></body></html>`;
 return {subject:'Welcome to Pentreeform',text,html};
}
export function welcomeStatements(env,user){
 const payload=JSON.stringify(welcomeMessage(env,user)),stamp=now();
 return [
  query(env,`INSERT INTO outbox(id,user_id,recipient,payload,kind,available_at,created_at)
   SELECT ?,id,email,?,'welcome',?,? FROM users WHERE id=? AND verified=1 AND (welcome_email_queued=0 OR welcome_email_backfill=1)
   AND NOT EXISTS(SELECT 1 FROM outbox WHERE user_id=users.id AND kind='welcome')`,uid(),payload,stamp,stamp,user.id),
  query(env,'UPDATE users SET welcome_email_queued=1,welcome_email_backfill=0 WHERE id=? AND verified=1 AND (welcome_email_queued=0 OR welcome_email_backfill=1)',user.id)
 ];
}

export async function queueExistingWelcomes(env,limit=5){
 const {results:users}=await query(env,`SELECT id,name,email FROM users WHERE verified=1 AND welcome_email_backfill=1
  AND NOT EXISTS(SELECT 1 FROM suppressions WHERE suppressions.email=users.email)
  ORDER BY created_at,id LIMIT ?`,limit).all();
 if(!users.length)return;
 await env.DB.batch(users.flatMap(user=>welcomeStatements(env,user)));
}

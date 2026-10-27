import {query,now,uid,token,hash,email,text,passwordHash,passwordOK,readJSON,fail,json,rate,publicUser,session,account,origin,cookie,fetchProvider} from './core.js';
import {job} from './mail.js';
import {welcomeStatements} from './welcome.js';
import {googleRoute} from './google.js';
export async function challenge(req,env,value,expectedAction){
 const secret=typeof env.TURNSTILE_SECRET_KEY==='string'?env.TURNSTILE_SECRET_KEY.trim():'';
 if(!secret)fail(503,'Spam protection is not configured.');
 if(typeof value!=='string'||!value)fail(400,'Complete the security check.');
 // Vercel proxies requests to this Worker: CF-Connecting-IP can identify the
 // proxy rather than the visitor. Omit optional remoteip instead of trusting
 // forwarded headers. Provider verification, action and hostname remain required.
 let result,data;
 const report=reason=>console.warn('pentreeform.turnstile',JSON.stringify({reason}));
 try{result=await fetchProvider('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:value})});data=await result.json()}
 catch{report('service_unavailable');fail(503,'The security service is unavailable. Please try again.')}
 if(!result.ok||data?.success!==true){
  const known=['missing-input-secret','invalid-input-secret','missing-input-response','invalid-input-response','timeout-or-duplicate','internal-error','bad-request'];
  const codes=Array.isArray(data?.['error-codes'])?data['error-codes'].filter(code=>known.includes(code)):[];
  report(codes.join(',')||'verification_failed');
  if(codes.some(code=>['missing-input-secret','invalid-input-secret'].includes(code)))fail(503,'Security verification is not configured correctly. Please contact support.');
  if(!result.ok||codes.includes('internal-error'))fail(503,'The security service is unavailable. Please try again.');
  if(codes.includes('timeout-or-duplicate'))fail(400,'The security check expired or was already used. Complete a fresh check.');
  fail(400,'Security check failed. Please complete a fresh check.');
 }
 if(data.action!==expectedAction){report('action_mismatch');fail(400,'Security check does not match this page. Refresh and try again.')}
 if(expectedAction==='auth'&&data.hostname!==new URL(origin(env)).hostname){report('hostname_mismatch');fail(400,'Security check does not match this website. Open Pentreeform from its official address and try again.')}
 return data;
}
async function authToken(env,u,kind){const value=token(),expires=now()+(kind==='verify'?86400:1800);const url=`${origin(env)}/#${kind}=${value}`;return [query(env,'DELETE FROM auth_tokens WHERE user_id=? AND kind=?',u.id,kind),query(env,'INSERT INTO auth_tokens(token_hash,user_id,kind,expires_at) VALUES(?,?,?,?)',await hash(value),u.id,kind,expires),job(env,{userId:u.id,recipient:u.email,kind,payload:{subject:kind==='verify'?'Verify your Pentreeform email':'Reset your Pentreeform password',text:`${kind==='verify'?'Verify your email':'Reset your password'} using this link:\n\n${url}\n\nThis link expires ${kind==='verify'?'in 24 hours':'in 30 minutes'}. If you did not request this, ignore this email.`}})]}
export async function authRoute(req,env,path){
 if(path.startsWith('/api/auth/google/'))return googleRoute(req,env,path,authToken);
 if(path==='/api/auth/me'&&req.method==='GET'){const u=await account(req,env,false);return json({user:publicUser(u)})}
 if(req.method!=='POST')fail(405,'Method not allowed.');
 const data=await readJSON(req,8192),ip=req.headers.get('CF-Connecting-IP')||'local';
 await rate(env,`auth:${ip}`,20,60);
 if(path==='/api/auth/register'){
 if(env.REGISTRATION_OPEN!=='true'||!env.RESEND_API_KEY)fail(503,'Registration is not open yet.');
 const address=email(data.email);await challenge(req,env,data.challenge,'auth');await rate(env,`signup:${address}`,3,3600);
 const pw=await passwordHash(data.password),name=text(data.name,80),workspace=text(data.workspace,80)||'My workspace';if(!name)fail(400,'Enter your name.');
 const existing=await query(env,'SELECT id FROM users WHERE email=?',address).first();if(existing)return json({message:'If this address can be registered, a verification email will arrive shortly. Otherwise sign in or reset your password.'});
 const u={id:uid(),email:address,name,workspace};const jobs=await authToken(env,u,'verify');
 await env.DB.batch([query(env,'INSERT INTO users(id,email,name,workspace,password_hash,created_at) VALUES(?,?,?,?,?,?)',u.id,u.email,u.name,u.workspace,pw,now()),...jobs]);
 return json({message:'Check your inbox for a verification link, then sign in.'},201);
 }
 if(path==='/api/auth/login'){
 const address=email(data.email);await rate(env,`login:${address}`,10,900);const u=await query(env,'SELECT * FROM users WHERE email=?',address).first();
 // Match password derivation work for unknown accounts to reduce timing disclosure.
 const dummy='pbkdf2:100000:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
 if(!await passwordOK(data.password,u?.password_hash||dummy)||!u)fail(401,'Email or password is incorrect.');return session(u,req,env);
 }
 if(path==='/api/auth/logout'){
 await query(env,'DELETE FROM sessions WHERE token_hash=?',await hash(cookie(req))).run();return json({ok:true},200,{'Set-Cookie':'pentree_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+(origin(env).startsWith('https:')?'; Secure':'')});
 }
 if(path==='/api/auth/resend'){
 const address=email(data.email);await rate(env,`resend:${address}`,3,3600);await challenge(req,env,data.challenge,'auth');const u=await query(env,'SELECT * FROM users WHERE email=?',address).first();if(u&&!u.verified)await env.DB.batch(await authToken(env,u,'verify'));return json({message:'If your account needs verification, a new link will arrive shortly.'});
 }
 if(path==='/api/auth/forgot'){
 const address=email(data.email);await rate(env,`forgot:${address}`,3,3600);await challenge(req,env,data.challenge,'auth');const u=await query(env,'SELECT * FROM users WHERE email=?',address).first();if(u)await env.DB.batch(await authToken(env,u,'reset'));return json({message:'If an account exists for this address, a reset link will arrive shortly.'});
 }
 if(path==='/api/auth/verify'||path==='/api/auth/reset'){
 const kind=path.endsWith('verify')?'verify':'reset';if(!/^[a-f0-9]{64}$/.test(data.token||''))fail(400,'Invalid or expired link.');const digest=await hash(data.token);
 const t=await query(env,'SELECT t.user_id,u.name,u.email FROM auth_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.kind=? AND t.expires_at>?',digest,kind,now()).first();if(!t)fail(400,'Invalid or expired link.');
 const condition='id=(SELECT user_id FROM auth_tokens WHERE token_hash=? AND kind=? AND expires_at>?)';
 const update=kind==='verify'?query(env,`UPDATE users SET verified=1 WHERE ${condition}`,digest,kind,now()):query(env,`UPDATE users SET password_hash=? WHERE ${condition}`,await passwordHash(data.password),digest,kind,now());
 const results=await env.DB.batch([update,...(kind==='verify'?welcomeStatements(env,{id:t.user_id,name:t.name,email:t.email}):[]),query(env,'DELETE FROM auth_tokens WHERE token_hash=?',digest)]);if(!results[0].meta.changes)fail(400,'This link has already been used.');
 if(kind==='reset')await env.DB.batch([query(env,'DELETE FROM sessions WHERE user_id=?',t.user_id),query(env,'DELETE FROM google_link_requests WHERE user_id=?',t.user_id)]);return json({message:kind==='verify'?'Email verified. You can now sign in.':'Password updated. Please sign in again.'});
 }
 fail(404,'Not found.');
}

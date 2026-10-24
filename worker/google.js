import {createRemoteJWKSet,jwtVerify} from 'jose';
import {query,now,uid,token,hash,origin,readJSON,rate,fail,json,email,text,safeEqual,session,fetchProvider} from './core.js';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:10000,cacheMaxAge:600000});
export const googleConfigured=env=>!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET;
const cookieName='pentree_google';
function flowCookie(value,env,clear=false){return `${cookieName}=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${clear?0:600}${origin(env).startsWith('https:')?'; Secure':''}`}
function browserToken(req){return (req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)||''}
function callbackURL(env){return origin(env)+'/api/auth/google/callback'}
function redirect(env,error,sessionCookie){const headers=new Headers({Location:origin(env)+(error?'/#auth_error='+error:'/'),'Cache-Control':'no-store'});if(sessionCookie)headers.append('Set-Cookie',sessionCookie);headers.append('Set-Cookie',flowCookie('',env,true));return new Response(null,{status:303,headers})}
export async function googleRoute(req,env,path,verificationStatements){
 if(path==='/api/auth/google/start'&&req.method==='POST'){
 if(!googleConfigured(env))fail(503,'Google sign-in is not configured yet.');
 const data=await readJSON(req,1024);if(!['login','register'].includes(data.intent))fail(400,'Choose sign in or create account.');
 if(data.intent==='register'&&env.REGISTRATION_OPEN!=='true')fail(403,'Registration is not open yet.');
 await rate(env,`google-start:${req.headers.get('CF-Connecting-IP')||'local'}`,10,60);
 const state=token(),browser=token(),nonce=token(),verifier=token();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 await query(env,'INSERT INTO oauth_states(state_hash,browser_hash,nonce,verifier,expires_at) VALUES(?,?,?,?,?)',await hash(state),await hash(browser),nonce,verifier,now()+600).run();
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:callbackURL(env),response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
 return json({url:url.href},200,{'Set-Cookie':flowCookie(browser,env)});
 }
 if(path==='/api/auth/google/callback'&&req.method==='GET'){
 try{
 if(!googleConfigured(env))return redirect(env,'unavailable');
 const params=new URL(req.url).searchParams,state=params.get('state'),browser=browserToken(req);
 if(!/^[a-f0-9]{64}$/.test(state||'')||!/^[a-f0-9]{64}$/.test(browser))return redirect(env,'invalid_state');
 // Consume this browser-bound flow before exchanging a code; callbacks are single-use.
 const flow=await query(env,'DELETE FROM oauth_states WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING nonce,verifier',await hash(state),await hash(browser),now()).first();
 if(!flow)return redirect(env,'invalid_state');
 if(params.has('error'))return redirect(env,'cancelled');
 const code=params.get('code');if(!code||code.length>4096)return redirect(env,'failed');
 const response=await fetchProvider('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:callbackURL(env),grant_type:'authorization_code',code_verifier:flow.verifier})});
 if(!response.ok)return redirect(env,'failed');const tokens=await response.json();
 const {payload:claims}=await jwtVerify(tokens.id_token,googleKeys,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID,requiredClaims:['sub','iat','exp','nonce','email','email_verified'],maxTokenAge:'10m',clockTolerance:5});
 if(!safeEqual(claims.nonce,flow.nonce)||claims.email_verified!==true||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||(claims.azp&&claims.azp!==env.GOOGLE_CLIENT_ID))return redirect(env,'failed');
 const address=email(claims.email);const identity=await query(env,'SELECT u.* FROM users u JOIN google_identities g ON g.user_id=u.id WHERE g.subject=?',claims.sub).first();let user=identity;
 if(user&&user.email!==address)return redirect(env,'email_changed');
 if(!user){
 // Never silently link a password account based only on matching email text.
 if(await query(env,'SELECT id FROM users WHERE email=?',address).first())return redirect(env,'account_exists');
 if(env.REGISTRATION_OPEN!=='true')return redirect(env,'registration_closed');
 const authoritative=address.endsWith('@gmail.com')||(typeof claims.hd==='string'&&claims.hd.length>0);
 if(!authoritative&&!env.RESEND_API_KEY)return redirect(env,'unavailable');
 user={id:uid(),email:address,name:text(claims.name,80)||address.split('@')[0],workspace:'My workspace',verified:authoritative?1:0,plan:'Free',paid_until:0};
 const statements=[query(env,'INSERT INTO users(id,email,name,workspace,password_hash,verified,created_at) VALUES(?,?,?,?,?,?,?)',user.id,user.email,user.name,user.workspace,'!google',user.verified,now()),query(env,'INSERT INTO google_identities(subject,user_id,created_at) VALUES(?,?,?)',claims.sub,user.id,now())];
 if(!authoritative)statements.push(...await verificationStatements(env,user,'verify'));
 await env.DB.batch(statements);
 }
 const signed=await session(user,req,env);return redirect(env,null,signed.headers.get('set-cookie'));
 }catch{return redirect(env,'failed')}
 }
 fail(405,'Method not allowed.');
}

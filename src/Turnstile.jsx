import React,{useEffect,useRef,useState} from 'react';
import {BrandMotion} from './Feedback.jsx';

export default function Turnstile({siteKey,onToken,resetKey}){
 const host=useRef(null),callback=useRef(onToken);
 callback.current=onToken;
 const [status,setStatus]=useState('loading'),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let stopped=false,widget,script,timer;
  const update=(state,token='')=>{if(stopped)return;callback.current(token);setStatus(state)};
  update('loading');
  if(!siteKey){update('unavailable');return()=>{stopped=true}};
  const fail=()=>{clearTimeout(timer);update('error')};
  const mount=()=>{
   if(stopped||widget!==undefined)return;
   clearTimeout(timer);
   if(!window.turnstile||!host.current){fail();return}
   setStatus('ready');
   try{widget=window.turnstile.render(host.current,{
    sitekey:siteKey,action:'auth',size:host.current.clientWidth>0&&host.current.clientWidth<300?'compact':'normal',
    callback:token=>update('verified',token),
    'expired-callback':()=>update('expired'),
    'timeout-callback':()=>update('expired'),
    'error-callback':()=>{fail();return true},
    'unsupported-callback':()=>update('unsupported')
   })}catch{fail()}
  };
  const scriptError=()=>{if(script)script.dataset.pentreeformState='error';fail()};
  if(window.turnstile)mount();
  else{
   script=document.querySelector('#turnstile-api');
   if(script?.dataset.pentreeformState==='error'){script.remove();script=null}
   const fresh=!script;
   if(fresh){script=document.createElement('script');script.id='turnstile-api';script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true}
   script.addEventListener('load',mount);
   script.addEventListener('error',scriptError);
   timer=setTimeout(scriptError,15000);
   if(fresh)document.head.append(script);
  }
  return()=>{
   stopped=true;clearTimeout(timer);
   script?.removeEventListener('load',mount);script?.removeEventListener('error',scriptError);
   if(widget!==undefined)try{window.turnstile?.remove(widget)}catch{}
  };
 },[siteKey,resetKey,attempt]);
 const messages={loading:'Loading the security check…',ready:'Complete the check below to enable the button.',verified:'Security check complete. You can continue.',expired:'The security check expired. Please retry.',error:'The security check could not load or finish. Please retry.',unsupported:'This browser cannot complete the security check. Try an updated browser.',unavailable:'Security verification is not configured yet.'};
 const retry=['expired','error','unsupported'].includes(status);
 return <section className={'challenge challenge-'+status} aria-label="Security check">
  <strong>{status==='loading'&&<BrandMotion/>}Security check</strong>
  <p id="security-status" role="status" aria-live="polite">{messages[status]}</p>
  {siteKey&&<div className="challenge-widget" ref={host}/>}
  {retry&&<button className="btn challenge-retry" type="button" onClick={()=>setAttempt(value=>value+1)}>Retry security check</button>}
 </section>;
}

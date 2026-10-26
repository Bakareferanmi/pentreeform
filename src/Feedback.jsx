import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {brandMotionMarkup} from './brand.js';

export function BrandMotion({state='loading'}){
 return <span className="brand-slot" dangerouslySetInnerHTML={{__html:brandMotionMarkup(state)}}/>;
}

export function LoadingScreen(){
 return <main className="brand-loading" role="status" aria-live="polite" aria-label="Loading Pentreeform"><BrandMotion/><span className="sr">Loading Pentreeform…</span></main>;
}

export function Toast({message,error=false,onDismiss}){
 const [paused,setPaused]=useState(false),dismiss=useRef(onDismiss);
 dismiss.current=onDismiss;
 useEffect(()=>{
  if(!message||error||paused)return;
  const timer=setTimeout(()=>dismiss.current(),7000);
  return()=>clearTimeout(timer);
 },[message,error,paused]);
 if(!message)return null;
 return <div className={'live-banner pf-toast'+(error?' is-error':'')} role={error?'alert':'status'} aria-atomic="true" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}>
  <BrandMotion state={error?'error':'notice'}/><span className="feedback-copy">{error&&<span className="sr">Attention: </span>}{message}</span><button type="button" aria-label="Dismiss notification" onClick={onDismiss}><X size={18}/></button>
 </div>;
}

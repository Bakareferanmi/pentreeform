import React,{useRef,useState} from 'react';
import {Copy,Check} from 'lucide-react';
import {Toast} from './Feedback.jsx';

const endpoint='https://pentreeform.vercel.app/f/YOUR_FORM_ID';
const before='<form action="';
const after='" method="POST">\n  <input type="email" name="email" placeholder="Your email" required />\n  <textarea name="message" placeholder="Your message" required></textarea>\n  <button type="submit">Send message</button>\n</form>';
export const SETUP_CODE=before+endpoint+after;
export const FAQS=[
 ['Can I keep my existing form?','Yes. Keep your design, point its action to your Pentreeform endpoint, and use named fields. Pentreeform handles spam verification. Submit and submit from the HTTPS website you registered.'],
 ['What happens if an email notification fails?','Your saved submission stays in your inbox for your plan’s retention period. Temporary sending failures are retried automatically, up to five attempts. Bounces and permanent failures need attention; check the notification status in your inbox.'],
 ['What happens when I reach my monthly limit?','New submissions are rejected and are not saved. Your limit is shared across all your forms and resets at the start of each calendar month in UTC. Upgrade for more room, and ask the visitor to submit again after capacity is available.']
];
export function SetupGuide(){
 const [feedback,setFeedback]=useState(''),[copied,setCopied]=useState(false),[expanded,setExpanded]=useState(false),code=useRef(null);
 async function copy(){try{await navigator.clipboard.writeText(SETUP_CODE);setCopied(true);setFeedback('Code copied. Replace the endpoint before publishing.')}catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(code.current);selection.removeAllRanges();selection.addRange(range);setCopied(false);setFeedback('Code selected. Use your device’s copy command.')}}
 return <section className="pf-setup" id="setup" aria-labelledby="pf-setup-title"><div className="pf-section-heading"><h2 id="pf-setup-title">Your form. Connected.</h2><p>Create a form. Copy your endpoint. Add it below.</p></div><div className={'pf-code-card'+(expanded?' is-expanded':'')}><div className="pf-code-toolbar"><span>HTML</span><button onClick={copy} aria-label="Copy setup code">{copied?<Check size={18}/>:<Copy size={18}/>}<span>{copied?'Copied':'Copy code'}</span></button></div><pre id="pf-setup-code" tabIndex="0" aria-label="HTML form setup example"><code ref={code}>{before}<mark>{endpoint}</mark>{after}</code></pre><button className="pf-code-expand" aria-expanded={expanded} aria-controls="pf-setup-code" onClick={()=>setExpanded(!expanded)}>{expanded?'Collapse code':'Expand code'}</button></div><p className="pf-setup-note">Replace the endpoint with yours. Pentreeform handles verification. No security keys or Cloudflare setup needed.</p><Toast message={feedback} onDismiss={()=>setFeedback('')}/></section>
}
export function LandingFAQ(){return <section className="pf-faq" aria-labelledby="pf-faq-title"><div className="pf-section-heading"><h2 id="pf-faq-title">A few quick answers.</h2></div><div className="pf-faq-list">{FAQS.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true" className="pf-faq-toggle"/></summary><p>{answer}</p></details>)}</div></section>}

import {usageSummary} from '../shared/usage.js';
import {getTheme,toggleTheme,themeLabel,THEME_EVENT} from './theme.js';
import {BRAND_ICON,brandMotionMarkup,loadingScreenMarkup} from './brand.js';
import {GOOGLE_ICON} from './google-brand.js';
// Imported from the supplied design. Presentation CSS and demo markup are preserved.
export function mountRedesign(host,options={}) {
let L=options.live||null,disposed=false;
const listeners=[],oldOverflow=document.body.style.overflow;
function listen(target,event,handler){target.addEventListener(event,handler);listeners.push(()=>target.removeEventListener(event,handler));}

"use strict";
/* ---------- icons (lucide paths) ---------- */
var P={
home:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
inbox:'<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
send:'<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
chart:'<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
settings:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
book:'<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
mail:'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
dl:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
check:'<path d="M20 6 9 17l-5-5"/>',
cc:'<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
down:'<path d="m6 9 6 6 6-6"/>',
clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
copy:'<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
dots:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
shieldc:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
menu:'<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
left:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
right:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
ur:'<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
cok:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'
};
function ic(n,s){if(['ur','right','left','down','out','dl'].indexOf(n)>-1)return '';s=s||20;return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+P[n]+'</svg>'}
var LOGO=BRAND_ICON.trim();
function logo(c){return '<div class="logo '+(c||'')+'">'+LOGO+'</div>'}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

/* ---------- data ---------- */
var FORMS0=[
 {id:'contact-demo',name:'Contact form',domain:'beepeelabs.cv',email:'hello@example.com'},
 {id:'involved-demo',name:'Get involved',domain:'connectvibeco.com',email:'join@example.com'},
 {id:'newsletter-demo',name:'Newsletter',domain:'connectvibeco.com',email:'join@example.com'}];
var NOW=Date.now();
var MSG0=[
 ['Ada Okafor','ada@example.com','contact-demo','Website redesign enquiry','Hi Feranmi,\n\nI am looking for someone to redesign our store website. Can you share your availability and an estimate? We would like to launch next month.',12,'delivered',false],
 ['Daniel Cole','daniel@example.com','involved-demo','Volunteer application','I would love to get involved with your team. Please share the next steps.',38,'delivered',false],
 ['Tolu Bakare','tolu@example.com','newsletter-demo','New subscriber','Hi! I would like to receive updates about your projects.',60,'delivered',false],
 ['Maya Lewis','maya@example.com','contact-demo','Pricing for an online store','Hello, I am interested in your services. What would a store with 20 products cost?',120,'failed',true],
 ['Samuel James','samuel@example.com','involved-demo','Partnership enquiry','We are a growing brand and would love to discuss a partnership.',180,'delivered',true],
 ['Grace Bello','grace@example.com','contact-demo','A quick question about your services','Do you work with businesses outside Lagos?',1440,'delivered',true],
 ['Alex Morgan','alex@example.com','contact-demo','Project availability','Are you available for a project next month?',2880,'failed',true],
 ['Promotions','spam@example.com','contact-demo','Exclusive offer','This is an example of a message held in the spam folder.',60,'blocked',true]
].map(function(e,i){return {id:'m'+i,name:e[0],email:e[1],formId:e[2],subject:e[3],message:e[4],date:new Date(NOW-e[5]*60000).toISOString(),delivery:e[6],read:e[7],spam:i===7}});
var SET0={name:'Feranmi',workspace:'BeepeeLabs',email:'hello@example.com'};
var PLANS=[{n:'Free',p:0,l:100,f:2,h:'30 days'},{n:'Starter',p:3,l:1000,f:5,h:'6 months'},{n:'Pro',p:7,l:5000,f:20,h:'12 months'},{n:'Agency',p:15,l:15000,f:50,h:'12 months'}];
var NAV=[['Overview','home'],['Forms','file'],['Inbox','inbox'],['Deliveries','send'],['Usage & billing','chart'],['Settings','settings'],['Documentation','book']];
var TITLES={'Inbox':['Inbox','Every submission, in one place.'],'Forms':['Forms','A home for every form on your website.'],'Overview':['Overview','A clear view of what’s coming in.'],'Deliveries':['Deliveries','See what happened after a submission was saved.'],'Usage & billing':['Usage & billing','Start free. Upgrade when your forms get busier.'],'Settings':['Settings','Make this workspace yours.'],'Documentation':['Documentation','Keep your form. Change where it submits.']};
var DELIVERY_STATES={
 delivered:{label:'Email delivered',tone:'success',icon:'check',note:'Delivered to the recipient’s mail server. Inbox placement is not guaranteed.'},
 accepted:{label:'Email accepted',tone:'pending',icon:'clock',note:'The email service accepted this notification. Delivery has not been confirmed.'},
 queued:{label:'Email queued',tone:'pending',icon:'clock',note:'Waiting to send. Temporary sending failures are retried automatically.'},
 sending:{label:'Email sending',tone:'pending',icon:'clock',note:'The notification is being sent to the email service.'},
 failed:{label:'Email failed',tone:'danger',icon:'alert',note:'This notification could not be sent. Your submission is still saved.'},
 bounced:{label:'Email bounced',tone:'danger',icon:'alert',note:'The recipient’s mail server rejected this notification.'},
 complained:{label:'Spam complaint',tone:'danger',icon:'shield',note:'The recipient marked an email as spam. Further notifications are suppressed.'},
 suppressed:{label:'Email suppressed',tone:'danger',icon:'shield',note:'Sending was stopped after a previous bounce or spam complaint.'},
 cancelled:{label:'Email cancelled',tone:'neutral',icon:'x',note:'The notification was cancelled. Check whether the submission was removed or marked as spam.'},
 blocked:{label:'Held as spam',tone:'warning',icon:'shield',note:'This notification was held as spam.'},
 'not-connected':{label:'Email not connected',tone:'neutral',icon:'mail',note:'Connect email notifications before expecting delivery.'}
};
function deliveryInfo(state){return DELIVERY_STATES[state]||{label:'Status unavailable',tone:'neutral',icon:'alert',note:'No confirmed email delivery status is available.'}}
function deliveryBadge(state){var info=deliveryInfo(state);return '<span class="status-pill '+info.tone+'" data-delivery-state="'+esc(state||'unknown')+'">'+ic(info.icon,14)+'<span>'+info.label+'</span></span>'}
function messageBadge(message){var state=message.spam?'spam':message.read?'read':'unread';return '<span class="message-state '+state+'" data-message-state="'+state+'">'+ic(message.spam?'shield':message.read?'check':'mail',14)+'<span>'+({spam:'Spam',read:'Read',unread:'Unread'})[state]+'</span></span>'}


function load(k,d){if(L)return d;try{var v=JSON.parse(localStorage.getItem('pentreeform:'+k));return v==null?d:v}catch(e){return d}}
function save(k,v){try{localStorage.setItem('pentreeform:'+k,JSON.stringify(v))}catch(e){}}

/* ---------- state ---------- */
var S={
 screen:'dashboard',page:'Inbox',nav:false,
 forms:load('forms',FORMS0),msgs:load('messages',MSG0),set:load('settings',SET0),
 sel:'m0',q:'',tab:'All',ff:'all',df:'30',chk:[],detail:false,modal:null,toast:'',toastKind:'notice',
 amsg:'',tok:false,mode:'login',focusQ:false
};
var toastT;
function persist(){if(L)return;save('forms',S.forms);save('messages',S.msgs);save('settings',S.set)}
function toast(m,kind='notice'){S.toast=m;S.toastKind=kind;resumeToast();render()}
function resumeToast(){clearTimeout(toastT);if(S.toastKind==='error')return;toastT=setTimeout(function(){S.toast='';render()},7000)}
function rel(d){var a=Math.max(0,Math.floor((Date.now()-new Date(d))/60000));return a<1?'Just now':a<60?a+' min ago':a<1440?Math.floor(a/60)+' hours ago':Math.floor(a/1440)+' days ago'}
function formName(id){var f=S.forms.filter(function(x){return x.id===id})[0];return f?f.name:'Deleted form'}
function ep(id){return L?window.location.origin+'/f/'+id:'https://pentreeform.example/f/'+id.replace(/-demo$/,'')}
function copy(t){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast('Copied to clipboard')},function(){toast('Clipboard unavailable. Select and copy the text manually.')})}
function filtered(){
 return S.msgs.filter(function(m){
  if(S.tab==='Spam'?!m.spam:m.spam)return false;
  if(S.tab==='Unread'&&m.read)return false;
  if(S.ff!=='all'&&m.formId!==S.ff)return false;
  if(S.df!=='all'&&Date.now()-new Date(m.date)>Number(S.df)*864e5)return false;
  return (m.name+' '+m.email+' '+m.subject+' '+m.message).toLowerCase().indexOf(S.q.toLowerCase())>-1;
 });
}
function upd(id,patch){if(L){L.setMessages(function(ms){return ms.map(function(m){return m.id===id?Object.assign({},m,patch):m})});return;}S.msgs=S.msgs.map(function(m){if(m.id===id){for(var k in patch)m=Object.assign({},m,patch)}return m});persist()}
function avc(n){return 'av c'+(n.charCodeAt(0)%4)}
function ini(n){return n.split(' ').map(function(x){return x[0]}).slice(0,2).join('')}

/* ---------- views ---------- */
function badge(t,c){return '<span class="badge '+(c||'')+'">'+t+'</span>'}
function themeButton(){return '<button type="button" class="theme-toggle" data-a="theme" aria-label="'+themeLabel()+'" title="'+themeLabel()+'" aria-pressed="'+(getTheme()==='dark')+'"><svg class="theme-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><svg class="theme-moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 13A9 9 0 0 1 11 3.1a9 9 0 1 0 9.9 9.9Z"/></svg></button>'}
listen(window,THEME_EVENT,function(){host.querySelectorAll('.theme-toggle').forEach(function(button){button.setAttribute('aria-label',themeLabel());button.setAttribute('title',themeLabel());button.setAttribute('aria-pressed',String(getTheme()==='dark'))})});
function codeBlock(c){return '<div class="code"><button class="ibtn" data-a="copy" data-v="'+esc(c)+'" aria-label="Copy code">'+ic('copy',17)+'</button><pre>'+esc(c)+'</pre></div>'}

function sidebar(){
 var nonspam=S.msgs.filter(function(m){return !m.spam}),unread=nonspam.filter(function(m){return !m.read}).length;
 return (S.nav?'<button class="scrim" data-a="navclose" aria-label="Close navigation"></button>':'')+
 '<aside class="side'+(S.nav?' open':'')+'">'+logo()+
 '<button class="ws" data-a="nav" data-v="Settings"><i>'+esc((S.set.workspace[0]||'P'))+'</i><strong>'+esc(S.set.workspace)+'</strong>'+ic('down',16)+'</button>'+
 '<nav class="nav">'+NAV.map(function(n,i){return (i===4?'<div class="sep"></div>':'')+'<button class="'+(S.page===n[0]?'on':'')+'" data-a="nav" data-v="'+n[0]+'">'+ic(n[1])+'<span>'+n[0]+'</span>'+(n[0]==='Inbox'&&unread?'<span class="cnt">'+unread+'</span>':'')+'</button>'}).join('')+'</nav>'+
 '<div class="side-bot"><button class="plan" data-a="nav" data-v="Usage & billing"><div class="r"><strong>Starter</strong><span>'+nonspam.length+' / 1,000</span></div><div class="bar"><i style="width:'+Math.max(2,nonspam.length/10)+'%"></i></div><small>Submissions this month</small></button>'+
 '<button class="me" data-a="modal" data-t="profile" aria-label="Open profile" aria-haspopup="dialog"><span class="'+avc(S.set.name||'U')+'">'+esc(ini(S.set.name||'User'))+'</span><div><strong>'+esc(S.set.name)+'</strong><small>'+esc(S.set.email)+'</small></div>'+ic('down',16)+'</button></div></aside>';
}

function monthlyUsage(){return usageSummary(L?L.usage:S.msgs.filter(function(m){return !m.spam&&m.date.slice(0,7)===new Date().toISOString().slice(0,7)}).length,L?L.limit:1000,L?.usageMonth||new Date().toISOString().slice(0,7))}
function usageProgress(usage){return '<div class="usage-progress" role="progressbar" aria-label="Monthly submission usage" aria-valuemin="0" aria-valuemax="'+usage.limit+'" aria-valuenow="'+Math.min(usage.used,usage.limit)+'" aria-valuetext="'+usage.used.toLocaleString()+' of '+usage.limit.toLocaleString()+' submissions used"><i style="width:'+usage.progress+'%"></i></div>'}
function usageReset(usage){return new Date(usage.resetAt).toLocaleDateString(undefined,{day:'numeric',month:'short',timeZone:'UTC'})+' (UTC)'}
function usageAlert(){
 var usage=monthlyUsage();if(!usage||!usage.level)return '';
 var title=usage.level===100?'Monthly submission limit reached':usage.level===95?'You’re close to your monthly limit':usage.percent+'% of your monthly submissions used';
 return '<section class="usage-alert '+(usage.level>=95?'critical':'warning')+'" data-usage-level="'+usage.level+'" role="'+(usage.level===100?'alert':'status')+'" aria-label="Monthly usage warning">'+ic('alert',24)+'<div><h2>'+title+'</h2><p>'+usage.used.toLocaleString()+' of '+usage.limit.toLocaleString()+' used · '+usage.remaining.toLocaleString()+' remaining. Resets '+usageReset(usage)+'.</p>'+(usage.level===100?'<p>New submissions won’t be saved while your account is at its limit.</p>':'')+'</div><button class="btn" data-a="nav" data-v="Usage & billing">View usage</button></section>';
}
function usageCard(){var usage=monthlyUsage();if(!usage)return '';return '<section class="card usage-card" data-usage-level="'+usage.level+'" aria-labelledby="usage-heading"><div class="ph"><h2 id="usage-heading">This month’s submissions</h2><span class="usage-percent">'+usage.percent+'%</span></div><p><strong>'+usage.used.toLocaleString()+'</strong> / '+usage.limit.toLocaleString()+' used</p>'+usageProgress(usage)+'<div class="usage-foot"><span>'+usage.remaining.toLocaleString()+' remaining across all forms</span><span>Resets '+usageReset(usage)+'</span></div></section>'}
function stats(){
 var ns=S.msgs.filter(function(m){return !m.spam}),un=ns.filter(function(m){return !m.read}).length,
 del=ns.filter(function(m){return m.delivery==='delivered'}).length,att=needAtt().length;
 var d=[['file',ns.length,'submissions',''],['mail',un,'unread',''],['cok',ns.length?Math.round(del/ns.length*100)+'%':'—','delivered','g'],['alert',att,'need attention','a']];
 return '<section class="stats" aria-label="Submission summary">'+d.map(function(x){return '<div class="card stat '+x[3]+'"><span class="ic">'+ic(x[0],22)+'</span><span><strong>'+x[1]+'</strong><small>'+x[2]+'</small></span></div>'}).join('')+'</section>';
}
function needAtt(){return S.msgs.filter(function(m){return ['failed','bounced','complained','suppressed'].indexOf(m.delivery)>-1&&!m.spam})}

function inbox(){
 var list=filtered(),cur=S.msgs.filter(function(m){return m.id===S.sel})[0],att=needAtt().length,ur=S.msgs.filter(function(m){return !m.read&&!m.spam}).length;
 var h='';
 if(att)h+='<div class="alert">'+ic('alert',20)+'<span><strong>'+att+' notifications need attention.</strong> Your submissions are saved.</span><button data-a="nav" data-v="Deliveries">Review deliveries '+ic('ur',16)+'</button></div>';
 h+='<section class="card inbox'+(S.detail?' det':'')+'"><div class="lp"><div class="flt"><label class="search">'+ic('search',18)+'<input id="q" aria-label="Search submissions" placeholder="Search submissions" value="'+esc(S.q)+'"></label>'+
 '<select data-c="ff" aria-label="Filter by form"><option value="all">All forms</option>'+S.forms.map(function(f){return '<option value="'+esc(f.id)+'"'+(S.ff===f.id?' selected':'')+'>'+esc(f.name)+'</option>'}).join('')+'</select>'+
 '<select data-c="df" aria-label="Filter by date">'+[['30','Last 30 days'],['7','Last 7 days'],['1','Last 24 hours'],['all','All time']].map(function(o){return '<option value="'+o[0]+'"'+(S.df===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></div>'+
 '<div class="tabs">'+['All','Unread','Spam'].map(function(t){return '<button class="'+(S.tab===t?'on':'')+'" data-a="tab" data-v="'+t+'">'+t+(t==='Unread'?'<span>'+ur+'</span>':'')+'</button>'}).join('')+
 (S.chk.length?'<button class="bulk" data-a="bulk">'+ic('cc',16)+'Read ('+S.chk.length+')</button>':'')+'</div><div class="list">'+
 (list.length?list.map(function(m){return '<div class="row'+(S.sel===m.id?' sel':'')+(m.read?'':' unread')+'"><input type="checkbox" class="cb" aria-label="Select '+esc(m.name)+'" data-k="'+m.id+'"'+(S.chk.indexOf(m.id)>-1?' checked':'')+'>'+
  '<button class="open" data-a="open" data-v="'+m.id+'"><span class="'+avc(m.name)+'">'+esc(ini(m.name))+'</span><span class="rb"><span class="rt"><strong>'+esc(m.name)+'</strong><small>'+rel(m.date)+'</small></span><div class="subj">'+esc(m.subject)+'</div><div class="snip">'+esc(m.message)+'</div><span class="message-statuses">'+messageBadge(m)+deliveryBadge(m.delivery)+'</span>'+badge(esc(formName(m.formId)),m.formId.indexOf('newsletter')>-1?'g':'')+'</span></button></div>'}).join(''):
  '<div class="empty"><div class="ei">'+ic('inbox',28)+'</div><h3>No submissions here</h3><p>Try another search or filter.</p><button class="btn" data-a="clear">Clear filters</button></div>')+
 '</div></div><div class="dp">'+(cur?detail(cur):'<div class="empty"><div class="ei">'+ic('mail',28)+'</div><h3>Select a submission</h3><p>Its details will appear here.</p></div>')+'</div></section>';
 return h;
}
function detail(m){
 var d=m.delivery,info=deliveryInfo(d);
 return '<button class="back btn sm" data-a="back">'+ic('left',16)+'Back to inbox</button><div class="dh"><h2>'+esc(m.subject)+'</h2><button class="ibtn bd" title="'+(m.read?'Mark unread':'Mark read')+'" aria-label="'+(m.read?'Mark unread':'Mark read')+'" data-a="toggleread" data-v="'+m.id+'">'+ic('mail',18)+'</button><button class="ibtn bd" aria-label="More message actions" data-a="modal" data-t="actions" data-v="'+m.id+'">'+ic('dots',20)+'</button></div>'+badge(esc(formName(m.formId)))+'<div class="message-flags">'+messageBadge(m)+'</div>'+
 '<div class="ds"><span class="'+avc(m.name)+'">'+esc(ini(m.name))+'</span><div><strong>'+esc(m.name)+'</strong><small>'+esc(m.email)+'</small></div><time>'+new Date(m.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+'</time></div>'+
 '<dl><dt>Name</dt><dd>'+esc(m.name)+'</dd><dt>Email</dt><dd><a href="mailto:'+esc(m.email)+'">'+esc(m.email)+'</a></dd><dt>Message</dt><dd class="mbody">'+esc(m.message)+'</dd></dl>'+
 '<div class="dcard delivery-card '+info.tone+'">'+ic(info.icon,24)+'<div><strong>'+info.label+'</strong><small>' +esc(L&&m.deliveryError?m.deliveryError:info.note)+'</small></div><button class="btn sm" aria-label="View delivery details" data-a="nav" data-v="Deliveries">Details</button></div>'+
 '<a class="btn reply" href="mailto:'+esc(m.email)+'?subject='+encodeURIComponent('Re: '+m.subject)+'">'+ic('mail',17)+'Reply by email</a>';
}
function overview(){
 return '<section class="grid2"><div class="card pad"><div class="ph"><h2>Forms at a glance</h2><button class="lk" data-a="nav" data-v="Forms">View forms '+ic('ur',16)+'</button></div>'+
 S.forms.map(function(f){return '<button class="orow" data-a="formjump" data-v="'+esc(f.id)+'"><span class="fic">'+ic('file')+'</span><span><strong>'+esc(f.name)+'</strong><small>'+esc(f.domain)+'</small></span>'+badge(S.msgs.filter(function(m){return m.formId===f.id&&!m.spam}).length+' submissions')+ic('ur',17)+'</button>'}).join('')+'</div>'+
 '<div class="card pad start">'+badge('GETTING STARTED')+'<h2>Your forms, connected.</h2><p>Create an endpoint, add it to your website, and keep enquiries together.</p><ol><li>'+ic('check',17)+'Review your inbox</li><li>'+ic('clock',17)+'Create a form configuration</li><li>'+ic('clock',17)+'Connect your website form</li></ol><button class="btn" data-a="nav" data-v="Documentation">Read setup guide '+ic('ur',16)+'</button></div></section>';
}
function formsPage(){
 return '<section class="fgrid">'+S.forms.map(function(f){return '<article class="card fcard"><div class="ph" style="margin:0"><span class="fic">'+ic('file')+'</span>'+badge('Ready')+'</div><h2>'+esc(f.name)+'</h2><p class="dom">'+ic('globe',15)+esc(f.domain)+'</p><div class="fnum"><strong>'+S.msgs.filter(function(m){return m.formId===f.id&&!m.spam}).length+'</strong><small>submissions</small></div>'+
  '<div class="ep"><code>'+esc(ep(f.id))+'</code><button class="ibtn" aria-label="Copy endpoint for '+esc(f.name)+'" data-a="copy" data-v="'+esc(ep(f.id))+'">'+ic('copy',16)+'</button></div>'+
  '<div class="facts"><button class="btn sm" data-a="modal" data-t="setup" data-v="'+esc(f.id)+'">Setup details</button><button class="btn sm" data-a="testlocal" data-v="'+esc(f.id)+'">'+ic('plus',16)+'Add submission</button></div></article>'}).join('')+
 '<button class="add" data-a="modal" data-t="create">'+ic('plus',30)+'<strong>Create a form</strong><span>Give your next enquiry a home.</span></button></section>';
}
function deliveries(){
 var ns=S.msgs.filter(function(m){return !m.spam});
 return '<section class="card pad"><div class="info">'+ic('shield',20)+'<p>Track email notifications for your submissions.</p></div><div class="tw"><div class="tr h"><span>Submission</span><span>Recipient</span><span>Status</span><span>Received</span></div>'+
 ns.map(function(m){var f=S.forms.filter(function(x){return x.id===m.formId})[0];return '<button class="tr" data-a="deljump" data-v="'+m.id+'"><span><strong>'+esc(m.subject)+'</strong><small>'+esc(m.name)+'</small></span><span>'+esc(f?f.email:'—')+'</span><span>'+deliveryBadge(m.delivery)+'</span><span>'+rel(m.date)+'</span></button>'}).join('')+'</div></section>';
}
function billing(){
 return '<div class="bill"><p class="muted">Submission limits are shared across your account.</p>'+badge('Monthly plans')+'</div>'+usageCard()+'<section class="pricing">'+PLANS.map(function(p){var ft=p.n==='Starter';
  return '<article class="card pc'+(ft?' ft':'')+'"><div class="ph" style="margin:0"><h2>'+p.n+'</h2>'+(ft?badge('Start here'):'')+'</div><div class="price">$'+p.p+'<small>/ month</small></div><p class="muted">'+p.l.toLocaleString()+' submissions / month</p><ul><li>'+ic('check',17)+p.f+' active forms</li><li>'+ic('check',17)+p.h+' message history</li><li>'+ic('check',17)+'Email notifications</li><li>'+ic('check',17)+'Spam protection</li><li>'+ic('check',17)+'Delivery status</li>'+(p.p?'<li>'+ic('check',17)+'CSV exports &amp; custom redirects</li>':'')+'</ul><button class="btn'+(ft?' pri':'')+'" data-a="plan">'+(p.p?'Choose '+p.n:'Start free')+ic('ur',16)+'</button></article>'}).join('')+'</section><p class="muted">Prices are in USD, billed monthly.</p>';
}
function settings(){
 return '<section class="card pad setp"><h2>Your workspace</h2><form data-f="settings"><label class="field">Your name<input name="name" value="'+esc(S.set.name)+'" required maxlength="80"></label><label class="field">Workspace name<input name="workspace" value="'+esc(S.set.workspace)+'" required maxlength="80"></label><label class="field">Display email<input name="email" type="email" value="'+esc(S.set.email)+'" required></label><p class="muted">Manage your workspace preferences.</p><div style="margin-top:16px"><button class="btn pri">Save preferences</button></div></form><hr><h3>Workspace data</h3><p class="muted" style="margin:6px 0 14px">Restore the original forms, messages, and preferences.</p><button class="btn dng" data-a="modal" data-t="reset">Reset workspace</button></section>';
}
function docs(){
 return '<section class="card pad docs">'+badge('HTML · REACT · ANY WEBSITE')+'<h2>One endpoint. Your own form.</h2><p>Connect your existing form with a POST request.</p><div class="info">'+ic('alert',20)+'<p>Every input needs a name so its value can be included.</p></div>'+
 '<h3>1. Create a form</h3><p>Choose a name, your website domain, and a notification address.</p><button class="btn" data-a="modal" data-t="create">'+ic('plus',16)+'Create form</button>'+
 '<h3>2. Connect your website</h3><p>Use the endpoint from your form settings. Every input needs a <code>name</code> attribute.</p>'+
 codeBlock('<form action="https://pentreeform.example/f/YOUR-FORM-ID" method="POST">\n  <input name="name" required placeholder="Your name" />\n  <input type="email" name="email" required />\n  <textarea name="message" required></textarea>\n  <button type="submit">Send message</button>\n</form>')+
 '<h3>3. Test the flow</h3><p>Check your inbox and delivery status after submitting your form.</p><h3>Your workflow</h3><p>Manage forms, read submissions, and track notifications from your workspace.</p></section>';
}
function modalView(){
 var m=S.modal;if(!m)return '';var t=m.t,title={archive:'Archive this form?',create:'Create a form',setup:'Form setup',actions:'Message actions',reset:'Reset this workspace?',del:'Delete submission?',privacy:'Data & privacy',profile:'Your profile',signout:'Sign out?'}[t],body='';
 if(t==='profile')body='<div class="profile-identity"><span class="'+avc(S.set.name||'User')+'">'+esc(ini(S.set.name||'User'))+'</span><div><strong>'+esc(S.set.name)+'</strong><span>'+esc(S.set.email)+'</span></div></div><form data-f="settings"><label class="field">Your name<input name="name" value="'+esc(S.set.name)+'" required maxlength="80" autocomplete="name"></label><label class="field">Workspace name<input name="workspace" value="'+esc(S.set.workspace)+'" required maxlength="80" autocomplete="organization"></label><label class="field">Email address<input name="email" type="email" value="'+esc(S.set.email)+'" readonly autocomplete="email"></label><button class="btn pri" type="submit">Save changes</button></form><div class="profile-links"><button class="btn" data-a="profile-nav" data-v="Settings">Workspace settings</button><button class="btn" data-a="profile-nav" data-v="Usage & billing">Plan &amp; billing</button><button class="btn" data-a="modal" data-t="privacy">Data &amp; privacy</button><button class="btn dng" data-a="modal" data-t="signout">Sign out</button></div>';
 else if(t==='signout')body='<p>You can sign back in whenever you’re ready.</p><div class="modal-actions"><button class="btn" data-a="close">Cancel</button><button class="btn pri" data-a="logout">Sign out</button></div>';
 else if(t==='create')body='<form data-f="create"><p>Choose a name, domain, and notification address.</p><label class="field">Form name<input name="name" required maxlength="80" placeholder="e.g. Contact form"></label><label class="field">Website domain<input name="domain" required placeholder="example.com"></label><label class="field">Notification email<input name="email" type="email" required placeholder="you@example.com"></label>'+(m.err?'<p class="err" role="alert">'+esc(m.err)+'</p>':'')+'<button class="btn pri" type="submit">'+ic('plus',17)+'Create form</button></form>';
 else if(t==='setup'){var f=S.forms.filter(function(x){return x.id===m.v})[0]||S.forms[0];body=badge('Form configuration')+'<p style="margin-top:12px">Your form configuration and connection details.</p><label class="field">Form name<input readonly value="'+esc(f.name)+'"></label><label class="field">Website domain<input readonly value="'+esc(f.domain)+'"></label><label class="field">Notification recipient<input readonly value="'+esc(f.email)+'"></label><h3>Your endpoint</h3>'+codeBlock(ep(f.id))+'<button class="btn pri" data-a="testlocal" data-v="'+esc(f.id)+'">Add submission</button>'}
 else if(t==='actions'){var cm=S.msgs.filter(function(x){return x.id===m.v})[0];body='<div class="alist"><button class="btn" data-a="spamtoggle" data-v="'+m.v+'">'+ic('shield',17)+(cm&&cm.spam?'Move to inbox':'Move to spam')+'</button><button class="btn dng" data-a="modal" data-t="del" data-v="'+m.v+'">'+ic('trash',17)+'Delete submission</button></div>'}
 else if(t==='del')body='<p>Delete this submission from this browser? This cannot be undone.</p><button class="btn dng" data-a="delmsg" data-v="'+m.v+'">Delete submission</button>';
 else if(t==='reset')body='<p>This restores the original forms, messages, and workspace settings.</p><button class="btn dng" data-a="doreset">Reset workspace data</button>';
 else body='<p>Forms, messages, and workspace preferences are saved in this browser.</p><p>Anyone using this browser profile can access this workspace. You can clear it in Settings.</p><p>Keep personal account details private.</p>';
 return '<div class="mb" data-a="mbclose"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="mt" tabindex="-1"><div class="ph"><h2 id="mt">'+title+'</h2><button class="ibtn" aria-label="Close dialog" data-a="close">'+ic('x',20)+'</button></div>'+body+'</section></div>';
}
function dashboard(){
 var pg=S.page,tt=TITLES[pg],body='';
 if(pg==='Inbox')body=stats()+inbox();else if(pg==='Overview')body=stats()+overview();else if(pg==='Forms')body=formsPage();else if(pg==='Deliveries')body=deliveries();else if(pg==='Usage & billing')body=billing();else if(pg==='Settings')body=settings();else body=docs();
 var hasActs=['Inbox','Forms','Overview'].indexOf(pg)>-1;
 return '<div class="shell">'+sidebar()+'<main class="main"><header class="top"><button class="ibtn burger" aria-label="Open navigation" data-a="navopen">'+ic('menu')+'</button><span class="crumb">Workspace<i>/</i><b>'+pg+'</b></span><span class="grow"></span><span class="live"><i></i><span class="t">Workspace</span></span><button class="ibtn" aria-label="Open documentation" data-a="nav" data-v="Documentation">'+ic('book',18)+'</button><div class="account-actions" data-account-actions>'+themeButton()+'<button class="account-profile" data-a="modal" data-t="profile" aria-label="Profile" aria-haspopup="dialog"><span class="account-avatar" aria-hidden="true">'+esc(ini(S.set.name||'User'))+'</span></button><button class="account-signout" data-a="modal" data-t="signout" aria-haspopup="dialog">Sign out</button></div></header>'+
 '<div class="wrap"><div class="head"><div><h1>'+tt[0]+'</h1><p>'+tt[1]+'</p></div>'+(hasActs?'<div class="acts"><button class="btn" data-a="export">'+ic('dl',17)+'Export</button><button class="btn pri" data-a="modal" data-t="create">'+ic('plus',19)+'Create form</button></div>':'')+'</div>'+usageAlert()+body+
 '<footer class="foot"><span>© '+new Date().getFullYear()+' Pentreeform</span><a href="https://www.beepeelabs.cv/" target="_blank" rel="noreferrer">Built by BeepeeLabs '+ic('ur',13)+'</a><button data-a="modal" data-t="privacy">Data & privacy</button></footer></div></main></div>';
}
function auth(){
 var m=S.mode,v=S.screen==='verify',need=['register','forgot','resend'].indexOf(m)>-1||v;
 var title=v?'Verify your email':{login:'Welcome back.',register:'Give your forms a home.',forgot:'Reset your password.',resend:'Get a fresh verification link.',reset:'Choose a new password.'}[m];
 var sub=v?'A verification link was sent to you@example.com. Open it to activate your workspace.':m==='register'?'Start with 100 submissions per month, free.':m==='login'?'Sign in to your workspace.':'We’ll help you get back to your workspace.';
 var f='';
 if(!v&&m==='register')f+='<label class="field">Your name<input name="name" required maxlength="80" autocomplete="name"></label><label class="field">Workspace name<input name="workspace" required maxlength="80" placeholder="Your business or project"></label>';
 if(!v&&m!=='reset')f+='<label class="field">Email address<input name="email" type="email" required autocomplete="email"></label>';
 if(!v&&['login','register','reset'].indexOf(m)>-1)f+='<label class="field">Password<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="'+(m==='login'?'current-password':'new-password')+'">'+(m!=='login'?'<small>Use at least 12 characters.</small>':'')+'</label>';
 if(need)f+='<label class="sec"><input type="checkbox" data-sec'+(S.tok?' checked':'')+'>Confirm you are human</label>';
 var lbl=v?'Resend verification':{login:'Sign in',register:'Create account',forgot:'Send reset link',resend:'Send verification link',reset:'Update password'}[m];
 var links=v?'<button data-a="screen" data-v="login">'+ic('out',14)+'Sign out</button>':(m==='login'?'<button data-a="mode" data-v="register">Create an account</button><button data-a="mode" data-v="forgot">Forgot password?</button><button data-a="mode" data-v="resend">Resend verification</button>':'<button data-a="mode" data-v="login">Back to sign in</button>');
 return '<div class="auth"><div class="auth-theme">'+themeButton()+'</div><section class="story">'+logo()+'<div><h1>Your website enquiries.<br>All accounted for.</h1><p>Connect your form, keep every message, and see what happened to the notification.</p><div class="prom">'+ic('shieldc',20)+'<span>Saved first. Sent second.</span></div></div><button class="demo" data-a="screen" data-v="dashboard">Open dashboard '+ic('right',17)+'</button></section>'+
 '<section class="amain"><div class="acard"><span class="eyebrow">PENTREEFORM</span><h2>'+title+'</h2><p>'+sub+'</p>'+(S.amsg?'<div role="status" class="amsg ok">'+esc(S.amsg)+'</div>':'')+
 (!v&&['login','register'].indexOf(m)>-1?'<div class="social-auth"><button type="button" class="btn google-btn" data-a="google-preview">'+GOOGLE_ICON+'Continue with Google</button><div class="auth-divider">or continue with email</div></div>':'')+'<form data-f="auth">'+f+'<button class="btn pri asub" type="submit"'+((need&&!S.tok)?' disabled':'')+'>'+lbl+ic('right',17)+'</button></form><div class="links">'+links+'</div></div><p class="credit">Built by <a href="https://www.beepeelabs.cv/" target="_blank" rel="noreferrer">BeepeeLabs</a></p></section></div>';
}
function pbar(){
 var o=[['dashboard','Dashboard & all app pages'],['login','Sign in'],['register','Create account'],['forgot','Forgot password'],['resend','Resend verification'],['reset','Reset password'],['verify','Verify email']];
 return '<div class="pbar screen-switcher" hidden><b>Pentreeform <span>Workspace</span></b><label>Screen<select data-c="screen" aria-label="Choose account screen">'+o.map(function(x){return '<option value="'+x[0]+'"'+(S.screen===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></label><small>Saved first. Sent second.</small></div>';
}
function prepareDialog(markup){
 if(!markup)return '';
 var template=document.createElement('template');template.innerHTML=markup;
 var dialog=template.content.querySelector('.modal');if(!dialog)return markup;
 var header=dialog.querySelector('.ph');header.classList.add('modal-header');
 var body=document.createElement('div');body.className='modal-body';
 Array.from(dialog.children).filter(function(node){return node!==header}).forEach(function(node){body.appendChild(node)});
 var actions=body.querySelector(':scope > .modal-actions');
 if(actions)actions.remove();else{
  actions=document.createElement('div');actions.className='modal-actions';
  var form=body.querySelector('form'),submit=form&&form.querySelector(':scope > button.btn');
  var direct=Array.from(body.children).filter(function(node){return node.matches('button.btn')});
  if(submit){form.id='pf-dialog-form';submit.setAttribute('form',form.id);submit.remove();direct=[submit]}
  if(direct.length){var cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.dataset.a='close';cancel.textContent='Cancel';actions.appendChild(cancel);direct.forEach(function(node){actions.appendChild(node)})}
  else{var done=document.createElement('button');done.type='button';done.className='btn';done.dataset.a='close';done.textContent='Done';actions.appendChild(done)}
 }
 dialog.append(body,actions);return template.innerHTML;
}
var modalOpener=null;
function render(){
 var a=document.activeElement,keepQ=a&&a.id==='q',pos=keepQ?a.selectionStart:0,wasModal=!!host.querySelector('.modal');
 if(S.modal&&!wasModal&&a&&host.contains(a))modalOpener={action:a.getAttribute('data-a'),type:a.getAttribute('data-t'),value:a.getAttribute('data-v'),label:a.getAttribute('aria-label'),className:a.className};
 host.innerHTML=pbar()+(S.screen==='dashboard'?dashboard():auth())+prepareDialog(modalView())+(S.toast?'<div role="'+(S.toastKind==='error'?'alert':'status')+'" aria-atomic="true" class="toast pf-toast'+(S.toastKind==='error'?' is-error':'')+'">'+brandMotionMarkup(S.toastKind)+'<span class="feedback-copy">'+esc(S.toast)+'</span>'+'<button aria-label="Dismiss notification" data-a="toastx">'+ic('x',16)+'</button></div>':'');
 document.title='Pentreeform · '+(S.screen==='dashboard'?S.page:'Account');
 if(keepQ){var q=document.getElementById('q');if(q){q.focus();q.setSelectionRange(pos,pos)}}
 if(S.modal){var d=host.querySelector('.modal');if(d)d.focus()}
 else if(wasModal&&modalOpener){var opener=Array.from(host.querySelectorAll('[data-a]')).find(function(button){return button.getAttribute('data-a')===modalOpener.action&&button.getAttribute('data-t')===modalOpener.type&&button.getAttribute('data-v')===modalOpener.value&&button.getAttribute('aria-label')===modalOpener.label&&button.className===modalOpener.className});if(opener)opener.focus();modalOpener=null}
 host.querySelectorAll('.shell,.auth,.pbar').forEach(function(node){node.inert=!!S.modal});
 document.body.style.overflow=S.modal?'hidden':oldOverflow;
 syncPending();
}
function go(p){S.page=p;S.nav=false;S.detail=false;render();window.scrollTo(0,0)}
function openAccount(mode){
 var target=['register','forgot','resend'].includes(mode)?mode:'login';
 var path='/app'+(target==='login'?'':'?auth='+target);
 if(options.onAccount)options.onAccount(path);else window.location.assign(path);
}
function setScreen(s){S.screen=s;S.amsg='';S.tok=false;S.modal=null;S.mode=(s==='verify'||s==='dashboard')?'resend':s;render()}

/* ---------- events ---------- */
var R=host;
listen(R,'pointerover',function(e){if(e.target.closest('.toast'))clearTimeout(toastT)});
listen(R,'pointerout',function(e){const t=e.target.closest('.toast');if(t&&!t.contains(e.relatedTarget))resumeToast()});
listen(R,'focusin',function(e){if(e.target.closest('.toast'))clearTimeout(toastT)});
listen(R,'focusout',function(e){const t=e.target.closest('.toast');if(t&&!t.contains(e.relatedTarget))resumeToast()});
listen(R,'click',function(e){
 var t=e.target.closest('[data-a]');if(!t)return;
 var a=t.getAttribute('data-a'),v=t.getAttribute('data-v');
 if(a==='theme'){toggleTheme();return}
 if(L&&liveClick(e,t,a,v))return;
 if(a==='mbclose'){if(e.target!==t)return;S.modal=null;return render()}
 switch(a){
  case 'google-preview':openAccount('login');break;
  case 'nav':go(v);break;
  case 'navopen':S.nav=true;render();break;
  case 'navclose':S.nav=false;render();break;
  case 'tab':S.tab=v;S.chk=[];render();break;
  case 'bulk':S.msgs=S.msgs.map(function(m){return S.chk.indexOf(m.id)>-1?Object.assign({},m,{read:true}):m});S.chk=[];persist();toast('Selected messages marked as read');break;
  case 'open':S.sel=v;upd(v,{read:true});S.detail=true;render();break;
  case 'back':S.detail=false;render();break;
  case 'clear':S.q='';S.ff='all';S.tab='All';S.df='all';render();break;
  case 'toggleread':var cm=S.msgs.filter(function(m){return m.id===v})[0];upd(v,{read:!cm.read});render();break;
  case 'copy':copy(v);break;
  case 'modal':S.nav=false;S.modal={t:t.getAttribute('data-t'),v:v};render();break;
  case 'profile-nav':S.modal=null;S.nav=false;go(v);break;
  case 'logout':openAccount('login');break;
  case 'close':S.modal=null;render();break;
  case 'toastx':S.toast='';clearTimeout(toastT);render();break;
  case 'spamtoggle':var sm=S.msgs.filter(function(m){return m.id===v})[0];upd(v,{spam:!sm.spam});S.modal=null;toast(sm.spam?'Moved to inbox':'Moved to spam');break;
  case 'delmsg':S.msgs=S.msgs.filter(function(m){return m.id!==v});S.sel=null;S.modal=null;S.detail=false;persist();toast('Submission deleted');break;
  case 'doreset':S.forms=FORMS0;S.msgs=MSG0;S.set=SET0;S.sel='m0';S.modal=null;persist();toast('Workspace reset');break;
  case 'formjump':S.ff=v;go('Inbox');break;
  case 'deljump':S.sel=v;S.page='Inbox';S.detail=true;render();break;
  case 'testlocal':var f=S.forms.filter(function(x){return x.id===v})[0];var nm={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),name:'Test Visitor',email:'visitor@example.com',formId:f.id,subject:'Your submission is here',message:'A new message for your inbox.',date:new Date().toISOString(),delivery:'not-connected',read:false,spam:false};S.msgs=[nm].concat(S.msgs);S.sel=nm.id;S.ff='all';S.tab='All';S.modal=null;S.page='Inbox';persist();toast('Submission added to your inbox.');break;
  case 'plan':toast('Checkout is unavailable.');break;
  case 'export':exportCSV();break;
  case 'screen':if(v==='dashboard')setScreen(v);else openAccount(v);break;
  case 'mode':openAccount(v);break;
 }
});
listen(R,'input',function(e){if(e.target.id==='q'){S.q=e.target.value;render()}});
listen(R,'change',function(e){
 var t=e.target;
 if(t.hasAttribute('data-k')){var id=t.getAttribute('data-k');S.chk=t.checked?S.chk.concat(id):S.chk.filter(function(x){return x!==id});render();return}
 if(t.hasAttribute('data-sec')){S.tok=t.checked;render();return}
 var c=t.getAttribute('data-c');
 if(c==='screen')setScreen(t.value);
 else if(c==='ff'){S.ff=t.value;render()}
 else if(c==='df'){S.df=t.value;render()}
});
listen(R,'submit',function(e){
 var f=e.target.getAttribute('data-f');if(!f)return;e.preventDefault();
 var d=new FormData(e.target);
 if(L){liveSubmit(f,d);return;}
 if(f==='settings'){S.set={name:d.get('name').trim(),workspace:d.get('workspace').trim(),email:d.get('email').trim()};persist();toast('Workspace preferences saved')}
 else if(f==='create'){
  var dom=d.get('domain').trim();
  try{var u=new URL(dom.indexOf('://')>-1?dom:'https://'+dom);if(['https:','http:'].indexOf(u.protocol)<0||u.hostname.indexOf('.')<0)throw 0;dom=u.hostname}catch(x){S.modal={t:'create',err:'Enter a valid website domain, such as example.com.'};render();return}
  var nf={id:(crypto.randomUUID?crypto.randomUUID().replace(/-/g,'').slice(0,16):String(Date.now())),name:d.get('name').trim(),domain:dom,email:d.get('email').trim()};
  S.forms=S.forms.concat(nf);persist();S.modal={t:'setup',v:nf.id};toast('Form configuration saved');
 }
 else if(f==='auth'){
  // Account actions always run in the live flow, never against browser-only data.
  openAccount(S.screen==='verify'?'resend':S.mode==='reset'?'forgot':S.mode);
 }
});
listen(document,'keydown',function(e){if(e.key==='Escape'&&S.modal){S.modal=null;render()}});

function exportCSV(){if(L){L.exportCSV({form:S.ff,days:S.df,tab:S.tab,q:S.q});return;}
 var rows=[['Name','Email','Form','Subject','Message','Received','Delivery']].concat(filtered().map(function(m){return [m.name,m.email,formName(m.formId),m.subject,m.message,m.date,m.delivery]}));
 var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"'}).join(',')}).join('\r\n');
 var url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');
 a.href=url;a.download='pentreeform-submissions.csv';a.click();URL.revokeObjectURL(url);
 toast('Exported '+(rows.length-1)+' submissions');
}
// Adapt only live data and actions. Demo presentation remains the supplied design.
const original={sidebar,detail,inbox,overview,formsPage,deliveries,billing,settings,docs,modalView,pbar,dashboard};
function syncLive(next){L=next;if(!L)return;S.forms=L.forms;S.msgs=L.messages;S.set=L.settings;if(!S.msgs.some(m=>m.id===S.sel))S.sel=S.msgs[0]?.id||null;}
pbar=function(){return L?'':original.pbar()};
sidebar=function(){let h=original.sidebar();if(!L)return h;const usage=monthlyUsage();h=h.replace('<strong>Starter</strong>','<strong>'+esc(L.user.plan)+' plan</strong>').replace(S.msgs.filter(m=>!m.spam).length+' / 1,000',esc(L.usage)+' / '+esc(L.limit.toLocaleString()));if(!usage)return h;h=h.replace('class="plan"','class="plan" data-usage-level="'+usage.level+'" aria-label="Usage: '+usage.used.toLocaleString()+' of '+usage.limit.toLocaleString()+' submissions this month"');return h.replace(/style="width:[^\"]+"/,'style="width:'+usage.progress+'%"')};
detail=function(m){let h=original.detail(m);if(!L)return h;const fields=Object.entries(m.fields||{}).filter(([key])=>!['name','email','message','subject'].includes(key));return h.replace('</dl>',fields.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>')};
inbox=function(){let h=original.inbox();if(!L)return h;h=h.replace('placeholder="Search submissions"','placeholder="Search loaded submissions"');if(L.nextCursor)h=h.replace('</div></div><div class="dp">','</div><button class="btn sm" data-a="older">Load older submissions</button></div><div class="dp">');return h};
overview=function(){const h=original.overview();return L?h.replace('Review your inbox','Your account is verified').replace('Connect your website form','Connect your website form'):h};
formsPage=function(){let h=original.formsPage();if(!L)return h;h=h.replace(/<small>submissions<\/small>/g,'<small>loaded submissions</small>');for(const f of S.forms){const button='<button class="btn sm" data-a="testlocal" data-v="'+esc(f.id)+'">'+ic('plus',16)+'Add submission</button>';h=h.replace(button,f.active?'<button class="btn sm" data-a="modal" data-t="archive" data-v="'+esc(f.id)+'">Archive</button>':'');}let index=0;return h.replace(/<span class="badge ">Ready<\/span>/g,()=>badge(S.forms[index++]?.active?'Active':'Archived'))};
deliveries=function(){const h=original.deliveries();return L?h.replace('Track email notifications for your submissions.','Signed email callbacks update these delivery records. Queued requests retry automatically; accepted emails are not resent.'):h};
billing=function(){let h=original.billing();if(!L)return h;h=h.replace('Monthly plans',L.billingConfigured?'Merchant checkout configured':'Checkout not configured').replace('Prices are in USD, billed monthly.','Checkout uses the approved monthly USD prices. Availability depends on the configured merchant account.');let index=0;h=h.replace(/data-a="plan"/g,()=> 'data-a="plan" data-v="'+PLANS[index++].n+'"');return h+'<button class="btn" data-a="manage">Manage subscription</button>'};
settings=function(){let h=original.settings();if(!L)return h;return h.replace('name="email" type="email"','name="email" type="email" readonly').replace('Manage your workspace preferences.','Your verified email is the notification recipient. It cannot be changed here.').split('<hr>')[0]+'</section>'};
docs=function(){if(!L)return original.docs();const endpoint=S.forms[0]?ep(S.forms[0].id):window.location.origin+'/f/YOUR-FORM-ID';const snippet='<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>\n<form action="'+endpoint+'" method="POST">\n  <input name="name" required />\n  <input type="email" name="email" required />\n  <textarea name="message" required></textarea>\n  <input name="_gotcha" hidden tabindex="-1" autocomplete="off" />\n  <div class="cf-turnstile" data-sitekey="'+(L.turnstileSiteKey||'YOUR-SITE-KEY')+'" data-action="submission"></div>\n  <button type="submit">Send message</button>\n</form>';return '<section class="card pad docs">'+badge('HTML · REACT · ANY WEBSITE')+'<h2>One endpoint. Your own form.</h2><p>Create a form for your website’s exact HTTPS hostname. Notifications go to your verified account email.</p><h3>1. Create a form</h3><button class="btn" data-a="modal" data-t="create">'+ic('plus',16)+'Create form</button><h3>2. Connect your website</h3><p>Add your endpoint and security widget. Register your website hostname in the Turnstile configuration and use action <code>submission</code>.</p>'+codeBlock(snippet)+'<h3>3. Test the flow</h3><p>Submit from your approved website. Confirm the message appears in your inbox and check the email delivery status. File uploads are not supported.</p><p>Search and summary counts cover loaded messages. CSV export includes all retained matching records.</p></section>'};
modalView=function(){if(!L)return original.modalView();const m=S.modal;if(!m)return '';if(m.t==='archive')return '<div class="mb" data-a="mbclose"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="mt" tabindex="-1"><div class="ph"><h2 id="mt">Archive this form?</h2><button class="ibtn" aria-label="Close dialog" data-a="close">'+ic('x',20)+'</button></div><p>This stops new submissions and frees an active form slot. Existing messages remain in your inbox.</p><button class="btn dng" data-a="archive" data-v="'+esc(m.v)+'">Archive form</button></section></div>';let h=original.modalView();if(m.t==='create'){h=h.replace('Choose a name, domain, and notification address.','Notifications are sent to your verified account email.').replace('name="email" type="email" required placeholder="you@example.com"','name="email" type="email" required readonly value="'+esc(L.user.email)+'"');if(L.user.plan!=='Free')h=h.replace('<button class="btn pri" type="submit">','<label class="field">Success redirect URL (optional)<input name="redirect" type="url" placeholder="https://example.com/thank-you"></label><button class="btn pri" type="submit">');}if(m.t==='setup'){h=h.replace('Form configuration','Live endpoint').replace('Your form configuration and connection details.','Add this endpoint to your website. Notifications go to your verified email.').replace(/<button class="btn pri" data-a="testlocal"[\s\S]*?<\/button>/,'<p>Open Documentation for the HTML and Turnstile setup instructions.</p>');}if(m.t==='del')h=h.replace('Delete this submission from this browser?','Delete this submission permanently from your account?');if(m.t==='privacy')h=h.replace(/<p>Forms, messages,[\s\S]*?<\/p><\/section>/,'<p>Messages are stored in your account database and sent to your verified email. Retention follows your plan; a downgrade to Free reduces history to 30 days. You can delete messages from your inbox.</p></section>');return h};
dashboard=function(){let h=original.dashboard();if(!L)return h;return h.replace('Workspace','Live workspace')};
let pending=false;
function syncPending(){
 if(disposed)return;
 const controls='button[type=submit],[data-a=archive],[data-a=plan],[data-a=manage],[data-a=refresh],[data-a=older],[data-a=logout]';
 if(pending){
  host.querySelectorAll(controls).forEach(button=>{if(!button.disabled){button.dataset.pendingDisabled='true';button.disabled=true}});
  host.querySelectorAll('form').forEach(form=>form.setAttribute('aria-busy','true'));
  if(!host.querySelector('.request-loading'))host.insertAdjacentHTML('beforeend',loadingScreenMarkup(true));
 }else{
  host.querySelectorAll('[data-pending-disabled]').forEach(button=>{button.disabled=false;delete button.dataset.pendingDisabled});
  host.querySelectorAll('form[aria-busy]').forEach(form=>form.removeAttribute('aria-busy'));
  host.querySelector('.request-loading')?.remove();
 }
 host.querySelectorAll('.shell,.auth,.pbar').forEach(node=>{node.inert=pending||!!S.modal});
 host.querySelectorAll('.mb').forEach(node=>{node.inert=pending});
}
async function action(fn){if(pending)return;pending=true;syncPending();try{await fn()}catch(e){if(!disposed)toast(e.message||'The action could not be completed.','error')}finally{pending=false;syncPending()}}
function liveClick(e,t,a,v){switch(a){
 case 'refresh':action(()=>L.refresh());return true;
 case 'logout':action(()=>L.logout());return true;
 case 'older':action(()=>L.loadMore());return true;
 case 'manage':action(()=>L.manageBilling());return true;
 case 'plan':if(v==='Free')toast('Every account starts on Free. Paid access lasts through its paid period.');else action(()=>L.checkout(v));return true;
 case 'testlocal':return true;
 case 'doreset':return true;
 case 'archive':action(async()=>{await L.archiveForm(v);S.modal=null;render()});return true;
 case 'bulk':L.setMessages(ms=>ms.map(m=>S.chk.includes(m.id)?{...m,read:true}:m));S.chk=[];render();return true;
 case 'spamtoggle':{const m=S.msgs.find(m=>m.id===v);upd(v,{spam:!m.spam});S.modal=null;render();return true;}
 case 'delmsg':L.setMessages(ms=>ms.filter(m=>m.id!==v));S.modal=null;S.detail=false;render();return true;
 default:return false;
}}
async function liveSubmit(kind,data){if(kind==='create'){await action(async()=>{try{const form=await L.createForm({name:String(data.get('name')||'').trim(),domain:String(data.get('domain')||'').trim(),email:L.user.email,redirect:data.get('redirect')||''});if(!S.forms.some(f=>f.id===form.id))S.forms=[...S.forms,form];S.modal={t:'setup',v:form.id};render()}catch(e){S.modal={t:'create',err:e.message};render()}});}else if(kind==='settings'){await action(()=>L.setSettings({name:String(data.get('name')||'').trim(),workspace:String(data.get('workspace')||'').trim(),email:L.user.email}));}}
listen(document,'keydown',function(e){if(!S.modal||e.key!=='Tab')return;const elements=host.querySelector('.modal')?.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),a[href]');if(!elements?.length)return;const first=elements[0],last=elements[elements.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===host.querySelector('.modal'))){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
syncLive(L);render();
return {update(next){if(disposed)return;if(next){syncLive(next);render()}},destroy(){disposed=true;clearTimeout(toastT);for(const remove of listeners)remove();document.body.style.overflow=oldOverflow;host.replaceChildren()}};

}

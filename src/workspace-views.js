// Live account views. Shared helpers keep status labels and escaping consistent.
export function workspaceViews({state:S,getLive,esc,ic,badge,ep,filtered,detail,row,needAtt}){
 const dates=[['all','All time'],['30','Last 30 days'],['7','Last 7 days'],['1','Last 24 hours']];
 const empty=(title,copy,action='',icon='inbox')=>'<div class="empty contextual-empty"><div class="ei">'+ic(icon,28)+'</div><h3>'+title+'</h3><p>'+copy+'</p>'+action+'</div>';
 const newForm=()=>'<button class="btn pri" data-a="modal" data-t="create">'+ic('plus',17)+'New form</button>';
 const formEmpty=()=>empty('Create your first form','Connect your website to start receiving submissions.',newForm(),'file');
 function inboxEmpty(){
  if(!S.forms.length)return formEmpty();
  if(!S.msgs.length){const form=S.forms.find(f=>f.active);return form?empty('No submissions yet','Connect your form, then send your first message.','<button class="btn" data-a="modal" data-t="setup" data-v="'+esc(form.id)+'">Connect form</button>'):empty('No active forms','Create a form to start receiving submissions.',newForm(),'file')}
  const inTab=S.msgs.filter(m=>S.tab==='Spam'?m.spam:!m.spam&&(S.tab!=='Unread'||!m.read));
  if(!inTab.length&&S.tab!=='All')return empty(S.tab==='Spam'?'No spam':'All caught up',S.tab==='Spam'?'Messages marked as spam will appear here.':'No unread submissions.','<button class="btn" data-a="tab" data-v="All">View inbox</button>');
  return empty('No matching submissions','Try another search or remove a filter.','<button class="btn" data-a="clear">Clear filters</button>');
 }
 function filters(){
  const count=Number(S.ff!=='all')+Number(S.df!=='all');
  const chip=(key,label)=>'<button class="filter-chip" data-a="clearfilter" data-v="'+key+'" aria-label="Remove '+(key==='ff'?'form':'date')+' filter">'+esc(label)+ic('x',14)+'</button>';
  return '<div class="flt live-filters"><div class="filter-search"><label class="search">'+ic('search',18)+'<input id="q" aria-label="Search submissions" placeholder="Search" value="'+esc(S.q)+'"></label><button class="btn filter-toggle" data-a="filters" aria-controls="inbox-filters" aria-expanded="'+!!S.filtersOpen+'">'+ic('filter',18)+'Filters'+(count?'<span class="filter-count">'+count+'</span>':'')+'</button></div>'+
   '<div class="filter-fields" id="inbox-filters" data-open="'+!!S.filtersOpen+'"><label>Form<select data-c="ff" aria-label="Filter by form"><option value="all">All forms</option>'+S.forms.map(f=>'<option value="'+esc(f.id)+'"'+(S.ff===f.id?' selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></label><label>Date<select data-c="df" aria-label="Filter by date">'+dates.map(([value,label])=>'<option value="'+value+'"'+(S.df===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label></div>'+
   (count?'<div class="filter-chips" aria-label="Active filters">'+(S.ff!=='all'?chip('ff',S.forms.find(f=>f.id===S.ff)?.name||'Selected form'):'')+(S.df!=='all'?chip('df',dates.find(d=>d[0]===S.df)?.[1]||'Date'):'')+'</div>':'')+'</div>';
 }
 function inbox(){
  const L=getLive(),list=filtered(),cur=list.find(m=>m.id===S.sel)||(S.detail?S.msgs.find(m=>m.id===S.sel):null),att=needAtt().length,unread=S.msgs.filter(m=>!m.read&&!m.spam).length;
  return (att?'<div class="alert">'+ic('alert',20)+'<span><strong>'+att+' notifications need attention.</strong> Your submissions are saved.</span><button data-a="nav" data-v="Deliveries">Review deliveries</button></div>':'')+
   '<section class="card inbox live-inbox'+(S.detail?' det':'')+'"><div class="lp">'+filters()+'<div class="tabs">'+['All','Unread','Spam'].map(tab=>'<button class="'+(S.tab===tab?'on':'')+'" data-a="tab" data-v="'+tab+'">'+tab+(tab==='Unread'?'<span>'+unread+'</span>':'')+'</button>').join('')+(S.chk.length?'<button class="bulk" data-a="bulk">'+ic('cc',16)+'Read ('+S.chk.length+')</button>':'')+'</div><div class="list">'+(list.length?list.map(row).join(''):inboxEmpty())+'</div>'+
   (L.nextCursor?'<div class="inbox-pagination"><small>Search covers these '+S.msgs.length+' submissions.</small><button class="btn sm" data-a="older">Load more</button></div>':'')+'</div><div class="dp">'+(cur?detail(cur):empty('Select a submission','Its details will appear here.','','mail'))+'</div></section>';
 }
 function formsPage(){
  if(!S.forms.length)return '<section class="card form-empty">'+formEmpty()+'</section>';
  const L=getLive();
  return '<section class="fgrid live-forms">'+S.forms.map(f=>{const count=S.msgs.filter(m=>m.formId===f.id&&!m.spam).length;return '<article class="card fcard"><div class="ph"><span class="fic">'+ic('file')+'</span><div class="form-card-state">'+badge(f.active?'Active':'Archived')+(f.active?'<details class="form-menu" data-form-id="'+esc(f.id)+'"><summary aria-label="More actions for '+esc(f.name)+'" title="More actions">'+ic('dots',19)+'</summary><div class="form-menu-panel"><button data-a="modal" data-t="archive" data-v="'+esc(f.id)+'">'+ic('archive',17)+'Archive</button></div></details>':'')+'</div></div><h2>'+esc(f.name)+'</h2><p class="dom">'+ic('globe',15)+esc(f.domain)+'</p><div class="fnum"><strong>'+count+'</strong><small>'+(L.nextCursor?'recent ':'')+(count===1?'submission':'submissions')+'</small></div><div class="ep"><code>'+esc(ep(f.id))+'</code></div><div class="facts"><button class="btn sm" data-a="copy" data-v="'+esc(ep(f.id))+'" aria-label="Copy endpoint for '+esc(f.name)+'">'+ic('copy',17)+'Copy endpoint</button><button class="btn sm" data-a="modal" data-t="setup" data-v="'+esc(f.id)+'">Settings</button></div></article>'}).join('')+'</section>';
 }
 function deliveries(){
  const messages=S.msgs.filter(m=>!m.spam);
  if(!messages.length)return '<section class="card">'+empty('No notifications yet','Delivery updates appear after your first submission.',S.forms.length?'<button class="btn" data-a="nav" data-v="Inbox">View inbox</button>':newForm(),'send')+'</section>';
  return null;
 }
 return {inbox,formsPage,formEmpty,deliveries};
}

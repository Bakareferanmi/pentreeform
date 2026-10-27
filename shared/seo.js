import {isLandingLocation,isLegacyWorkspaceLocation,publicPageAt} from '../src/routes.js';
export const SITE_ORIGIN=typeof __SITE_ORIGIN__==='string'?__SITE_ORIGIN__:'https://pentreeform.vercel.app';
export const PUBLIC_ROUTES=['/','/support','/privacy','/terms'];
const descriptions={
 home:'Connect your HTML or React forms to Pentreeform. Collect submissions in one inbox, get email notifications, and start free with 100 submissions a month.',
 support:'Get help connecting website forms to Pentreeform, checking submission delivery, and managing your account.',
 privacy:'Read how Pentreeform collects, stores and protects account information and website form submissions.',
 terms:'Read the terms for using Pentreeform, including accounts, form submissions, service limits and acceptable use.',
 app:'Sign in to your Pentreeform workspace to manage forms, submissions and email notifications.',
 'not-found':'This page could not be found. Return to Pentreeform to connect your website forms.'
};
const titles={home:'Pentreeform · Form backend for HTML and React',support:'Support · Pentreeform',privacy:'Privacy policy · Pentreeform',terms:'Terms of service · Pentreeform',app:'Sign in · Pentreeform','not-found':'Page not found · Pentreeform'};
export function pageAt(location){
 const page=publicPageAt(location.pathname);if(page)return page;
 if(isLandingLocation(location))return 'home';
 if(/^\/app\/?$/.test(location.pathname)||location.pathname==='/'||isLegacyWorkspaceLocation(location))return 'app';
 return 'not-found';
}
export function metadata(page,base=SITE_ORIGIN){
 const path=page==='home'?'/':page==='not-found'?null:'/'+page;
 return {page,title:titles[page],description:descriptions[page],url:path?base+path:null,image:base+'/og-image.png',robots:['app','not-found'].includes(page)?'noindex, follow':'index, follow, max-image-preview:large'};
}
export function structuredData(page,base=SITE_ORIGIN){
 if(['app','not-found'].includes(page))return null;
 const organization={'@type':'Organization','@id':base+'/#organization',name:'Pentreeform',url:base+'/',logo:{'@type':'ImageObject',url:base+'/logo.png',width:512,height:512},sameAs:['https://github.com/Bakareferanmi/pentreeform']};
 const website={'@type':'WebSite','@id':base+'/#website',name:'Pentreeform',url:base+'/',publisher:{'@id':base+'/#organization'}};
 const info=metadata(page,base),webpage={'@type':'WebPage','@id':info.url+'#webpage',url:info.url,name:info.title,description:info.description,isPartOf:{'@id':base+'/#website'}};
 return {'@context':'https://schema.org','@graph':page==='home'?[organization,website,webpage,{'@type':'SoftwareApplication',name:'Pentreeform',url:base+'/',description:info.description,applicationCategory:'BusinessApplication',operatingSystem:'Web',image:base+'/og-image.png',publisher:{'@id':base+'/#organization'},offers:{'@type':'Offer',name:'Free',price:'0',priceCurrency:'USD'}}]:[webpage]};
}
export function applyMetadata(doc,location){
 const page=pageAt(location),info=metadata(page);doc.title=info.title;
 const set=(attribute,key,value)=>{let el=doc.head.querySelector(`meta[${attribute}="${key}"]`);if(!el){el=doc.createElement('meta');el.setAttribute(attribute,key);doc.head.append(el)}el.content=value};
 set('name','description',info.description);set('name','robots',info.robots);
 for(const [key,value] of Object.entries({'og:title':info.title,'og:description':info.description,'og:url':info.url||SITE_ORIGIN+'/','og:image':info.image,'og:image:alt':'Pentreeform purple pen nib logo','og:site_name':'Pentreeform','og:type':'website'}))set('property',key,value);
 for(const [key,value] of Object.entries({'twitter:card':'summary_large_image','twitter:title':info.title,'twitter:description':info.description,'twitter:image':info.image,'twitter:image:alt':'Pentreeform purple pen nib logo'}))set('name',key,value);
 let canonical=doc.head.querySelector('link[rel="canonical"]');if(info.url){if(!canonical){canonical=doc.createElement('link');canonical.rel='canonical';doc.head.append(canonical)}canonical.href=info.url}else canonical?.remove();
 let schema=doc.getElementById('site-schema');const data=structuredData(page);if(data){if(!schema){schema=doc.createElement('script');schema.id='site-schema';schema.type='application/ld+json';doc.head.append(schema)}schema.textContent=JSON.stringify(data)}else schema?.remove();
}

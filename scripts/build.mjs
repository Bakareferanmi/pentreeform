import {build} from 'vite';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {metadata,structuredData,PUBLIC_ROUTES} from '../shared/seo.js';
import {siteOrigin} from './site-origin.mjs';
const base=siteOrigin(),root=resolve('.'),dist=resolve('dist');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function headMarkup(page,base){
 const data=metadata(page,base),meta=(key,value,attribute='name')=>`<meta ${attribute}="${key}" content="${escape(value)}"/>`;
 const schema=structuredData(page,base);
 return [`<title>${escape(data.title)}</title>`,meta('description',data.description),meta('robots',data.robots),data.url?`<link rel="canonical" href="${escape(data.url)}"/>`:'',...Object.entries({'og:type':'website','og:site_name':'Pentreeform','og:locale':'en_US','og:title':data.title,'og:description':data.description,'og:url':data.url||base+'/','og:image':data.image,'og:image:secure_url':data.image,'og:image:type':'image/png','og:image:width':'1200','og:image:height':'630','og:image:alt':'Pentreeform purple pen nib logo'}).map(([key,value])=>meta(key,value,'property')),...Object.entries({'twitter:card':'summary_large_image','twitter:title':data.title,'twitter:description':data.description,'twitter:image':data.image,'twitter:image:alt':'Pentreeform purple pen nib logo'}).map(([key,value])=>meta(key,value)),schema?`<script id="site-schema" type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`:''].filter(Boolean).join('\n');
}
await build();
const temporary=await mkdtemp(resolve(root,'.seo-build-'));
try{
 await build({configFile:false,define:{__SITE_ORIGIN__:JSON.stringify(base)},build:{ssr:resolve('scripts/prerender-entry.jsx'),outDir:temporary,emptyOutDir:true,rollupOptions:{output:{entryFileNames:'render.mjs'}}},logLevel:'warn'});
 const {renderPage}=await import(pathToFileURL(resolve(temporary,'render.mjs')).href),template=await readFile(resolve(dist,'index.html'),'utf8');
 for(const path of [...PUBLIC_ROUTES,'/app']){
  const page=path==='/'?'home':path.slice(1),body=page==='app'?'':renderPage(page);
  const html=template.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/,headMarkup(page,base)).replace('<div id="root"></div>',`<div id="root" data-page="${page}"${body?' data-prerendered="true"':''}>${body}</div>`);
  const folder=path==='/'?dist:resolve(dist,page);await mkdir(folder,{recursive:true});await writeFile(resolve(folder,'index.html'),html);
 }
 const notFound=template.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/,headMarkup('not-found',base));await writeFile(resolve(dist,'404.html'),notFound);
 await writeFile(resolve(dist,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
 await writeFile(resolve(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+PUBLIC_ROUTES.map(path=>`  <url><loc>${escape(base+path)}</loc></url>`).join('\n')+'\n</urlset>\n');
 console.log('Prerendered public pages, page metadata, robots.txt and sitemap.xml.');
}finally{await rm(temporary,{recursive:true,force:true})}

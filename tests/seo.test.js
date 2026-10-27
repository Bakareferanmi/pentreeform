import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {applyMetadata,pageAt,PUBLIC_ROUTES,SITE_ORIGIN} from '../shared/seo.js';
const require=createRequire(import.meta.url),{JSDOM}=require('jsdom');
const built=path=>new JSDOM(readFileSync(new URL('../dist/'+path,import.meta.url),'utf8'),{url:SITE_ORIGIN});

test('public HTML includes real content, unique metadata and canonical social URLs without executing JavaScript',()=>{
 const titles=new Set(),descriptions=new Set();
 for(const path of PUBLIC_ROUTES){
  const dom=built(path==='/'?'index.html':path.slice(1)+'/index.html'),doc=dom.window.document;
  assert.ok(doc.querySelector('#root[data-prerendered="true"] h1'));assert.ok(doc.querySelector('main'));assert.ok(doc.querySelector('footer a[href="/support"]'));
  assert.equal(doc.querySelectorAll('title').length,1);assert.equal(doc.querySelectorAll('meta[name="description"]').length,1);assert.equal(doc.querySelectorAll('link[rel="canonical"]').length,1);
  assert.equal(doc.querySelector('link[rel="canonical"]').href,SITE_ORIGIN+path);assert.equal(doc.querySelector('meta[property="og:url"]').content,SITE_ORIGIN+path);assert.equal(doc.querySelector('meta[name="twitter:card"]').content,'summary_large_image');assert.equal(doc.querySelector('meta[property="og:image"]').content,SITE_ORIGIN+'/og-image.png');
  assert.equal(doc.querySelector('meta[property="og:image:width"]').content,'1200');assert.equal(doc.querySelector('meta[property="og:image:height"]').content,'630');assert.ok(!doc.querySelector('meta[name="robots"]').content.includes('noindex'));
  titles.add(doc.title);descriptions.add(doc.querySelector('meta[name="description"]').content);JSON.parse(doc.getElementById('site-schema').textContent);dom.window.close();
 }
 assert.equal(titles.size,4);assert.equal(descriptions.size,4);
 const dom=built('index.html'),doc=dom.window.document;
 assert.match(doc.querySelector('h1').textContent,/Your forms.One inbox./);assert.equal(doc.querySelectorAll('.pf-price').length,4);assert.equal(doc.querySelectorAll('.pf-faq details').length,3);assert.ok(doc.querySelector('#setup pre').textContent.includes('YOUR_FORM_ID'));
 const graph=JSON.parse(doc.getElementById('site-schema').textContent)['@graph'];assert.equal(graph.find(x=>x['@type']==='WebSite').name,'Pentreeform');assert.equal(graph.find(x=>x['@type']==='Organization').logo.url,SITE_ORIGIN+'/logo.png');assert.ok(!graph.some(x=>x.aggregateRating));dom.window.close();
});

test('account and missing pages are excluded from indexing; sitemap contains only canonical public pages',()=>{
 for(const path of ['app/index.html','404.html']){const dom=built(path),doc=dom.window.document;assert.match(doc.querySelector('meta[name="robots"]').content,/noindex/);assert.equal(doc.getElementById('site-schema'),null);assert.equal(doc.querySelector('#root[data-prerendered]'),null);dom.window.close()}
 const sitemap=new JSDOM(readFileSync(new URL('../dist/sitemap.xml',import.meta.url),'utf8'),{contentType:'text/xml'});assert.deepEqual([...sitemap.window.document.querySelectorAll('loc')].map(el=>el.textContent),PUBLIC_ROUTES.map(path=>SITE_ORIGIN+path));sitemap.window.close();
 const robots=readFileSync(new URL('../dist/robots.txt',import.meta.url),'utf8');assert.match(robots,/Allow: \//);assert.ok(robots.includes('Sitemap: '+SITE_ORIGIN+'/sitemap.xml'));assert.doesNotMatch(robots,/Disallow:\s*\/app/);
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 for(const route of ['/app','/app/','/demo','/demo/','/api/:path*','/f/:path*'])assert.ok(config.headers.find(h=>h.source===route).headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex')));
 for(const page of ['privacy','terms','support','app'])assert.equal(config.rewrites.find(r=>r.source==='/'+page).destination,'/'+page+'/index.html');
});

test('runtime metadata never exposes auth tokens, query strings or private workspace data',()=>{
 const dom=built('index.html'),doc=dom.window.document;
 for(const path of ['/app?auth=register&email=private@example.test#reset=secret','/#verify=secret','/?demo=1','/demo']){
  const location=new URL(SITE_ORIGIN+path);assert.equal(pageAt(location),'app');applyMetadata(doc,location);assert.match(doc.querySelector('meta[name="robots"]').content,/noindex/);assert.equal(doc.querySelector('link[rel="canonical"]').href,SITE_ORIGIN+'/app');assert.equal(doc.getElementById('site-schema'),null);assert.doesNotMatch(doc.head.innerHTML,/private@example|secret|#verify=|#reset=/);
 }
 applyMetadata(doc,new URL(SITE_ORIGIN+'/support/?from=footer#privacy-requests'));assert.equal(doc.querySelector('link[rel="canonical"]').href,SITE_ORIGIN+'/support');assert.equal(doc.title,'Support · Pentreeform');assert.ok(doc.getElementById('site-schema'));
 applyMetadata(doc,new URL(SITE_ORIGIN+'/missing'));assert.match(doc.querySelector('meta[name="robots"]').content,/noindex/);assert.equal(doc.querySelector('link[rel="canonical"]'),null);dom.window.close();
});

test('social previews and install icons are PNGs with the declared dimensions',()=>{
 for(const [path,w,h] of [['og-image.png',1200,630],['logo.png',512,512],['apple-touch-icon.png',180,180],['favicon-48.png',48,48]]){
  const buffer=readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(buffer.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(buffer.readUInt32BE(16),w);assert.equal(buffer.readUInt32BE(20),h);assert.ok(buffer.length<200000);
 }
});

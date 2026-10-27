import {defineConfig} from 'vite';
import {siteOrigin} from './scripts/site-origin.mjs';

export default defineConfig({
 define:{__SITE_ORIGIN__:JSON.stringify(siteOrigin())},
 plugins:[{
  name:'prerendered-preview-routes',
  configurePreviewServer(server){server.middlewares.use((request,response,next)=>{
   const url=new URL(request.url,'http://preview'),page=/^\/(privacy|terms|support|app|demo)\/?$/.exec(url.pathname)?.[1];
   if(page)request.url='/'+(page==='demo'?'app':page)+'/index.html'+url.search;
   next();
  })}
 }],
 server:{allowedHosts:['terminal.local']}
});

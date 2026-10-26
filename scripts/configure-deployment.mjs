import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function httpsOrigin(value,label){let url;try{url=new URL(value)}catch{throw Error(`${label} must be an HTTPS origin.`)}if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||!url.hostname.includes('.')||['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname))throw Error(`${label} must be an HTTPS origin without a path, port or credentials.`);return url.origin}
export function configureDeployment(wrangler,vercel,{publicOrigin,workerOrigin,databaseId,accountId}){
 publicOrigin=httpsOrigin(publicOrigin,'Public origin');workerOrigin=httpsOrigin(workerOrigin,'Worker origin');
 if(publicOrigin===workerOrigin)throw Error('The Vercel frontend and proxy backend must have different origins.');
 if(!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(databaseId||''))throw Error('Use the UUID returned by Cloudflare for the D1 database.');
 if(accountId&&!/^[a-f\d]{32}$/i.test(accountId))throw Error('Cloudflare account ID must contain 32 hexadecimal characters.');
 const worker=structuredClone(wrangler),frontend=structuredClone(vercel),binding=worker.d1_databases?.find(db=>db.binding==='DB');if(!binding)throw Error('The Worker must declare its existing DB binding.');
 binding.database_id=databaseId;worker.vars={...worker.vars,APP_ORIGIN:publicOrigin};if(accountId)worker.account_id=accountId;
 const paths=['/api/:path*','/f/:path*'];frontend.rewrites=[...paths.map(source=>({source,destination:workerOrigin+source})),...(frontend.rewrites||[]).filter(route=>!paths.includes(route.source))];
 frontend.headers=[...(frontend.headers||[]).filter(rule=>!paths.includes(rule.source)),...paths.map(source=>({...(frontend.headers||[]).find(rule=>rule.source===source),source,headers:[...((frontend.headers||[]).find(rule=>rule.source===source)?.headers||[]).filter(header=>header.key.toLowerCase()!=='cache-control'),{key:'Cache-Control',value:'no-store'}]}))];
 return {worker,frontend};
}
export async function configureFiles(args,cwd=process.cwd()){
 const allowed=new Set(['--public-origin','--worker-origin','--database-id','--account-id','--write']),options={};let write=false;
 for(let i=0;i<args.length;i++){const key=args[i];if(!allowed.has(key))throw Error('Unknown option: '+key);if(key==='--write'){write=true;continue}const value=args[++i];if(!value||value.startsWith('--'))throw Error('Missing value for '+key);options[key.slice(2)]=value}
 const workerPath=resolve(cwd,'wrangler.jsonc'),frontendPath=resolve(cwd,'vercel.json');
 const result=configureDeployment(JSON.parse(await readFile(workerPath,'utf8')),JSON.parse(await readFile(frontendPath,'utf8')),{publicOrigin:options['public-origin'],workerOrigin:options['worker-origin'],databaseId:options['database-id'],accountId:options['account-id']});
 if(write){await writeFile(workerPath,JSON.stringify(result.worker,null,2)+'\n');await writeFile(frontendPath,JSON.stringify(result.frontend,null,2)+'\n')}
 return {written:write,publicOrigin:result.worker.vars.APP_ORIGIN,databaseId:result.worker.d1_databases.find(db=>db.binding==='DB').database_id,proxyRoutes:result.frontend.rewrites.slice(0,2),registrationOpen:result.worker.vars.REGISTRATION_OPEN==='true'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await configureFiles(process.argv.slice(2)),null,2))}catch(error){console.error(error.message);process.exitCode=1}}

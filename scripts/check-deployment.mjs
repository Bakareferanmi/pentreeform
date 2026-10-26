import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {httpsOrigin} from './configure-deployment.mjs';
export async function checkDeployment(value,request=fetch){
 const base=httpsOrigin(value,'Public origin');const paths=['/api/health','/api/config','/api/auth/me'];
 const results=await Promise.all(paths.map(async path=>{try{const response=await request(base+path,{redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});const isJSON=(response.headers.get('content-type')||'').includes('application/json');const body=isJSON?await response.json():null;const ok=path==='/api/auth/me'?response.status===401&&isJSON:response.status===200&&isJSON&&(path!=='/api/health'||body?.service==='pentreeform'&&body?.checks?.schema===true&&body?.applicationOrigin===base);return {path,status:response.status,json:isJSON,ok,...(path==='/api/health'&&body?{checks:body.checks,configured:body.configured}:{}),...(path==='/api/config'&&body?{registrationOpen:body.registrationOpen,googleConfigured:body.googleConfigured,emailConfigured:body.emailConfigured,billingConfigured:body.billingConfigured}:{})}}catch{return {path,ok:false,error:'Request failed or timed out'}}}));
 return {origin:base,apiReady:results.every(result=>result.ok),results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const result=await checkDeployment(process.argv[2]||'https://pentreeform.vercel.app');console.log(JSON.stringify(result,null,2));if(!result.apiReady)process.exitCode=1}catch(error){console.error(error.message);process.exitCode=1}}

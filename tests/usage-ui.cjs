const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {JSDOM}=require('jsdom'),{buildSync}=require('esbuild');
const output=path.join(os.tmpdir(),'pentreeform-usage-'+process.pid+'.cjs');
buildSync({stdin:{contents:"export {usageSummary} from './shared/usage.js';export {mountRedesign} from './src/redesign.js';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:output});
const {usageSummary,mountRedesign}=require(output),dom=new JSDOM('<div id="root"></div>',{url:'https://app.test/app'});
global.window=dom.window;global.document=dom.window.document;global.FormData=dom.window.FormData;dom.window.scrollTo=()=>{};
let view;const data={user:{id:'owner',plan:'Free'},settings:{name:'Owner',workspace:'Workspace',email:'owner@example.test'},forms:[{id:'contact',name:'Contact form',email:'owner@example.test'}],messages:[{id:'message',formId:'contact',name:'Visitor',email:'visitor@example.test',subject:'Hello',message:'One loaded submission',date:new Date().toISOString(),read:false,spam:false,delivery:'delivered'}],usage:79,limit:100,usageMonth:'2026-10'};
try{
 for(const limit of [100,1000,5000,15000]){for(const [fraction,level] of [[.79,0],[.8,80],[.94,80],[.95,95],[1,100],[1.1,100]])assert.equal(usageSummary(Math.floor(limit*fraction),limit,'2026-10').level,level)}
 assert.equal(usageSummary(799,1000).level,0);assert.equal(usageSummary(949,1000).level,80);assert.equal(usageSummary(0,0),null);assert.equal(usageSummary(5,undefined),null);assert.equal(usageSummary(80,100,'2026-12').resetAt,'2027-01-01T00:00:00.000Z');
 view=mountRedesign(document.getElementById('root'),{live:data});assert.equal(document.querySelector('.usage-alert'),null);
 for(const count of [80,94,95,99,100,120]){data.usage=count;view.update(data);const warning=document.querySelector('.usage-alert');assert.equal(warning.dataset.usageLevel,count>=100?'100':count>=95?'95':'80');assert.match(warning.textContent,new RegExp(count+' of 100 used'));assert.match(warning.textContent,/UTC/);assert.equal(document.querySelector('.plan').dataset.usageLevel,warning.dataset.usageLevel)}
 assert.match(document.querySelector('.usage-alert').textContent,/won’t be saved/);assert.equal(document.querySelector('.usage-alert').getAttribute('role'),'alert');
 data.usage=95;view.update(data);document.querySelector('.usage-alert button').click();assert.equal(document.querySelector('h1').textContent,'Simple plans. Room to grow.');assert.match(document.querySelector('.usage-card').textContent,/5 remaining/);assert.equal(document.querySelector('[role=progressbar]').getAttribute('aria-valuenow'),'95');
 data.limit=1000;data.user.plan='Starter';view.update(data);assert.equal(document.querySelector('.usage-alert'),null,'Sufficient upgrade clears the warning');assert.match(document.querySelector('.usage-card').textContent,/905 remaining/);
 data.usage=0;data.usageMonth='2026-11';view.update(data);assert.equal(document.querySelector('.usage-alert'),null,'New month clears the warning');assert.equal(document.querySelector('[role=progressbar]').getAttribute('aria-valuenow'),'0');assert.match(document.querySelector('.plan .bar i').getAttribute('style'),/width:0%/);
 console.log('PASS: exact thresholds across all four plans; warnings use account totals despite one loaded message; remaining counts, reset dates, capped progress, billing navigation, upgrades and month resets.');
}catch(error){console.error(error);process.exitCode=1}finally{view?.destroy();dom.window.close();fs.unlinkSync(output)}

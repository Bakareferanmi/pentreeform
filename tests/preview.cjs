const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1512,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('**/api/config',route=>route.fulfill({json:{registrationOpen:true,googleConfigured:false}}));
  await page.route('**/api/auth/me',route=>route.fulfill({status:401,json:{error:'Sign in'}}));
  const origin=process.env.PREVIEW_ORIGIN||'http://127.0.0.1:5173';
  await page.goto(origin);await page.getByRole('heading',{name:'Your forms.One inbox.',exact:true}).waitFor();
  assert.equal(await page.getByText('Open dashboard',{exact:true}).count(),0);
  assert.equal(await page.locator('.pf-ctas .pf-secondary').getAttribute('href'),'/app');
  assert.equal(await page.locator('.pf-form-card button').count(),0);
  await page.screenshot({path:path.join(os.tmpdir(),'pentreeform-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const route of ['/demo','/demo/','/?demo=1','/?view=workspace','/#demo']){
   await page.goto(origin+route);await page.getByRole('heading',{name:'Welcome back.',exact:true}).waitFor();
   assert.equal(new URL(page.url()).pathname,'/app');assert.equal(await page.locator('.shell,.row,.demo,.pbar,.screen-switcher').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.screenshot({path:path.join(os.tmpdir(),'pentreeform-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: landing, real account links, no fake submit controls, legacy routes require sign-in, mobile overflow, no runtime errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

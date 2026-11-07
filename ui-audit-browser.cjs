/* Browser-backed site gate. Uses loaded CSS/computed colors, not design-tokens.css. */
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].slice(2)]=process.argv[i+1];
const root=path.resolve(args.root),out=path.resolve(args.output),host=args.host||'tboxapp.top';
let pw;for(const name of [process.env.PLAYWRIGHT_MODULE,'playwright',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){try{pw=require(name);break}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e}}
if(!pw)throw Error('Install/configure Playwright; computed-style checks cannot fall back to static tokens');
const pages=['index.html','download.html','pricing.html','activate.html','setup-key.html','buy.html','faq.html','membership.html','404.html'];
const result={status:'FAIL',mode:args.origin?'deployed-source-not-canonical':'local-browser',views:[],errors:[],posts:0,contrast_scope:'visible direct text nodes; inactive text exempt; gradients/images need manual review',flow:{}};
function samples(){
 const rgba=s=>{const m=s.match(/^rgba?\(([^)]+)\)$/);if(!m)return null;const a=m[1].split(/[, /]+/).map(Number);return [a[0],a[1],a[2],a.length>3?a[3]:1]};
 const blend=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
 const lum=a=>{const c=a.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};
 const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 function bg(el){let chain=[];for(let n=el;n;n=n.parentElement)chain.push(n);let color=[255,255,255,1],unknown=false,opacity=1;for(const n of chain.reverse()){const s=getComputedStyle(n);if(s.backgroundImage!=='none')unknown=true;opacity*=Number(s.opacity);const c=rgba(s.backgroundColor);if(c)color=blend(c,color)}return {color,unknown,opacity}}
 const rows=[],unresolved=[],issues=[];let inactive=0;
 for(const el of document.querySelectorAll('body *')){
  if(!Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent.trim())||['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName))continue;
  const s=getComputedStyle(el),rect=el.getBoundingClientRect();if(!rect.width||!rect.height||s.visibility!=='visible'||s.display==='none')continue;
  if(el.closest('[aria-disabled="true"],:disabled')){inactive++;continue}
  const b=bg(el),fg=rgba(s.color);if(b.unknown||b.opacity<1||!fg){unresolved.push({tag:el.tagName,text:el.innerText?.slice(0,55),reason:'background-image/opacity/color requires manual review'});continue}
  const size=parseFloat(s.fontSize),large=size>=24||(size>=18.66&&Number(s.fontWeight)>=700),minimum=large?3:4.5,value=ratio(blend(fg,b.color),b.color);
  const row={tag:el.tagName,text:el.textContent.trim().slice(0,65),foreground:s.color,background:b.color.slice(0,3),fontSize:size,ratio:Number(value.toFixed(3)),minimum};rows.push(row);if(value+0.001<minimum)issues.push(row);
 }
 const missing=[];for(const el of document.querySelectorAll('[style]'))for(const m of el.getAttribute('style').matchAll(/var\((--[\w-]+)\)/g))if(!getComputedStyle(el).getPropertyValue(m[1]).trim())missing.push(m[1]);
 const focused=document.activeElement,fc=getComputedStyle(focused),back=bg(focused),outline=rgba(fc.outlineColor);
 const focus={tag:focused.tagName,visible:fc.outlineStyle!=='none'&&parseFloat(fc.outlineWidth)>0,ratio:outline?ratio(blend(outline,back.color),back.color):null,width:fc.outlineWidth};
 return {samples:rows.length,minimumRatio:rows.length?Math.min(...rows.map(r=>r.ratio)):null,issues,unresolved,inactive_exempt:inactive,missingVariables:missing,focus,overflow:document.documentElement.scrollWidth>innerWidth+1,loadedStyles:[...document.styleSheets].map(s=>s.href).filter(Boolean),pricingPadding:document.querySelector('.page-pricing>header')?getComputedStyle(document.querySelector('.page-pricing>header')).paddingTop:null};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const transport=await pw.request.newContext({timeout:45000});
 const edge=process.env.EDGE_BINARY||path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe');
 const browser=await pw.chromium.launch({headless:true,...(fs.existsSync(edge)?{executablePath:edge}:{})});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage();
   page.on('pageerror',e=>result.errors.push({check:'javascript',message:e.message}));
   await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());if(req.method()!=='GET'){result.posts++;return route.abort()}
    if(u.hostname!==host)return route.abort();if(u.pathname.endsWith('.mp4'))return route.abort();
    const rel=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';
    if(args.origin){const response=await transport.get(args.origin.replace(/\/$/,'')+'/'+rel,{headers:{Host:host},maxRedirects:0});const headers={...response.headers()};delete headers['content-encoding'];delete headers['content-length'];delete headers['transfer-encoding'];return route.fulfill({status:response.status(),headers,body:await response.body()})}
    const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'not found'});return route.fulfill({path:file})
   });
   for(const name of pages){
    await page.goto('https://'+host+'/'+name,{waitUntil:'load'});await page.keyboard.press('Tab');const data=await page.evaluate(samples);const entry={page:name,width,...data};result.views.push(entry);
    for(const css of ['portal.css','experience.css'])if(!data.loadedStyles.some(s=>new URL(s).pathname.endsWith('/'+css)))result.errors.push({page:name,width,check:'loaded-css',css});
    if(data.overflow||data.issues.length||data.unresolved.length||data.missingVariables.length||!data.samples||!data.focus.visible||data.focus.ratio<3)result.errors.push({page:name,width,check:'computed-style',overflow:data.overflow,contrast:data.issues,unresolved:data.unresolved,missing:data.missingVariables,focus:data.focus});
    if(name==='pricing.html'&&data.pricingPadding!=='48px')result.errors.push({page:name,width,check:'pricing-padding',actual:data.pricingPadding});
    if(['index.html','pricing.html','buy.html','membership.html'].includes(name)){
     const controls=await page.locator('[aria-disabled="true"]').evaluateAll(es=>es.map(e=>({tag:e.tagName,href:e.getAttribute('href'),disabled:e.disabled===true})));entry.disabledMarkers=controls;
     if(controls.length<2||controls.some(e=>e.href||e.tag==='BUTTON'&&!e.disabled))result.errors.push({page:name,width,check:'closed-state',controls});
    }
    if(['index.html','setup-key.html'].includes(name))await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});
   }
   await page.goto('https://'+host+'/index.html');
   const compare=page.locator('[data-plan-compare]');await compare.focus();await compare.press('Enter');await page.locator('#plan-comparison[open]').waitFor();await page.keyboard.press('Escape');assert(await compare.evaluate(e=>e===document.activeElement));
   const first=page.locator('[data-first-setup]');await first.focus();await first.press('Enter');assert((await page.url()).endsWith('setup-key.html#model-setup'));await page.locator('nav[aria-label="首次使用步骤"] a[href="#first-answer"]').click();assert((await page.locator('#first-answer').innerText()).includes('66'));await page.locator('nav[aria-label="首次使用步骤"] a[href="#model-errors"]').click();assert((await page.locator('#model-errors').innerText()).includes('402'));await page.locator('#model-errors a[href="#support"]').click();assert((await page.locator('#support').innerText()).includes('1127804697'));result.flow[width]={keyboard_compare_escape_restore:true,keyboard_setup:true,setup:true,first_answer:true,specific_failure:true,support:true,website_only:true};
   await context.close();
  }
  if(result.posts)result.errors.push({check:'side-effects',posts:result.posts});result.status=result.errors.length?'FAIL':'PASS';
 }catch(e){result.errors.push({check:'runtime',message:e.message})}
 finally{fs.writeFileSync(path.join(out,'ui-audit-results.json'),JSON.stringify(result,null,2));await browser.close();await transport.dispose();console.log(JSON.stringify({status:result.status,views:result.views.length,errors:result.errors.length,posts:result.posts}));if(result.status!=='PASS')process.exitCode=1}
})().catch(e=>{console.error(e);process.exitCode=1});

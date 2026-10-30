import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const BASE='https://tboxapp.top/';
const pages=['index.html','download.html','faq.html','pricing.html','activate.html','buy.html','membership.html','setup-key.html','404.html'];
const fail=[]; const rows=[];
function attr(src,re){const m=src.match(re);return m?.[1]||'';}
function pngSize(file){const b=fs.readFileSync(file);if(b.readUInt32BE(0)!==0x89504e47)return [0,0];return [b.readUInt32BE(16),b.readUInt32BE(20)];}
for(const page of pages){
 const src=fs.readFileSync(path.join(root,page),'utf8');
 const og=[...src.matchAll(/<meta\s+property="og:[^"]+"[^>]*>/gi)].length;
 const tw=[...src.matchAll(/<meta\s+name="twitter:[^"]+"[^>]*>/gi)].length;
 const canonical=attr(src,/<link\s+rel="canonical"\s+href="([^"]+)"/i), theme=attr(src,/<meta\s+name="theme-color"\s+content="([^"]+)"/i), desc=attr(src,/<meta\s+name="description"\s+content="([^"]+)"/i), image=attr(src,/<meta\s+property="og:image"\s+content="([^"]+)"/i);
 let imageOk=false,imageBytes=0,dims=[0,0],imageName='';
 if(/^https:\/\//.test(image)){const rel=image.replace(BASE,'');imageName=path.basename(rel);const local=path.join(root,rel);if(fs.existsSync(local)){imageBytes=fs.statSync(local).size;dims=pngSize(local);imageOk=imageName==='og-wechat.png'&&dims[0]===1200&&dims[1]===630&&imageBytes<=32768;}}
 const ok=og>=5&&tw>=2&&canonical.startsWith(BASE)&&theme==='#0b0f14'&&desc&&/^https:\/\//.test(image)&&imageOk;
 console.log(`${page} og:image=${imageName||'MISSING'} bytes=${imageBytes} dimensions=${dims[0]}x${dims[1]}`); rows.push({page,og,twitter:tw,canonical:canonical?'OK':'EMPTY',theme:theme||'EMPTY',image:imageName||'MISSING',imageBytes});
 if(!ok)fail.push(`${page}: og=${og} twitter=${tw} canonical=${canonical} theme=${theme} desc=${!!desc} image=${image} dims=${dims.join('x')} bytes=${imageBytes}`);
}
const wechatFile=path.join(root,'assets','img','og-wechat.png');
let wechatDims=[0,0],wechatBytes=0;
if(fs.existsSync(wechatFile)){wechatBytes=fs.statSync(wechatFile).size;wechatDims=pngSize(wechatFile);}
const wechatOk=fs.existsSync(wechatFile)&&wechatDims[0]>=300&&wechatDims[1]>=300&&wechatBytes<30720;
rows.push({page:'og-wechat.png',og:'-',twitter:'-',canonical:'-',theme:'-',image:wechatOk?`${wechatDims[0]}x${wechatDims[1]}`:'BAD',imageBytes:wechatBytes});
if(!wechatOk)fail.push(`og-wechat.png: dims=${wechatDims.join('x')} bytes=${wechatBytes} (need PNG >=300x300 and <30720 bytes)`);
console.table(rows);if(fail.length){console.error(fail.join('\n'));process.exit(1);}console.log(`SOCIAL PASS pages=${pages.length}`);


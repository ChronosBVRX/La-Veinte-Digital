import { chromium } from 'playwright';
const M=process.env.MATRICULA, P=process.env.PASS;
const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', viewport:{width:1280,height:900}, locale:'es-MX', acceptDownloads:true });
const page = await ctx.newPage();
const log=(...a)=>console.log(...a);

await page.goto('https://tuperfil.imss.gob.mx/guitpei-web/login',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(3000);
await page.locator('#matricula').fill(M); await page.locator('#password').fill(P);
await page.locator('button:has-text("Iniciar sesión")').first().click();
await page.waitForTimeout(5000);
await page.goto('https://tuperfil.imss.gob.mx/guitpei-web/app/administration/biometric/consult-period',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(4000);

await page.evaluate(async ()=>{
  function n(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
  function txt(e){return (e.innerText||e.textContent||'').replace(/\s+/g,' ').trim()}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function pick(id,tl,tv){const el=document.getElementById(id);const trig=el.querySelector('.mat-select-trigger')||el;trig.click();let opts=[];for(let i=0;i<30;i++){await sleep(200);opts=[...document.querySelectorAll('.cdk-overlay-container mat-option[role="option"], mat-option[role="option"]')];if(opts.length>0)break;}const code=(n(tl).match(/\b\d{6,7}\b/)||[])[0];let hit=null;for(let i=0;i<opts.length;i++){const ot=n(txt(opts[i]));if(code&&ot.indexOf(code)>=0){hit=i;break;}if(n(tv)&&ot.indexOf(n(tv))>=0){hit=i;break;}if(n(tl)&&ot.indexOf(n(tl))>=0){hit=i;break;}}if(hit==null)return;opts[hit].click();for(let i=0;i<10;i++){await sleep(150);if(!document.querySelector('.cdk-overlay-pane'))break;}}
  await pick('mat-select-0','Michoacán','17'); await sleep(2500);
  await pick('mat-select-2','2025001 (1ra - enero)','2025001'); await sleep(1500);
});
const btn=page.locator('button.primary:has-text("Buscar"), button:has-text("Buscar")').first();
if(await btn.count()>0) await btn.first().click();
await page.waitForTimeout(6000);

// dump ALL anchors/buttons/links that contain descargar/compartir (case-insensitive), with outerHTML
const raw = await page.evaluate(()=>{
  function vis(e){return e&&e.getClientRects().length>0}
  const cands=[...document.querySelectorAll('a,button,mat-icon,mat-icon-button,[role="button"],i,span')].filter(vis);
  const hits=[];
  for(const c of cands){
    const t=(c.innerText||c.textContent||'').replace(/\s+/g,' ').trim();
    const cls=String(c.className||'');
    const id=c.id||'';
    if(/descargar|compartir|download|export|pdf|\.pdf|\.aspx/i.test(t+' '+cls+' '+id)){
      hits.push({tag:c.tagName, id:c.id, cls:cls.slice(0,80), text:t.slice(0,40), outerHTML:c.outerHTML.slice(0,700)});
    }
  }
  return hits;
});
log('MATCHES:', raw.length);
for(const h of raw){ log('---'); log('tag='+h.tag+' id='+h.id+' cls="'+h.cls+'" text="'+h.text+'"'); log('HTML: '+h.outerHTML); }

// Also dump the whole row near "Descargar" (parent container)
const ctxHtml = await page.evaluate(()=>{
  function vis(e){return e&&e.getClientRects().length>0}
  const el=[...document.querySelectorAll('*')].find(e=>vis(e)&&/descargar/i.test(e.textContent||'')&&e.querySelector('a,button,mat-icon'));
  return el? el.parentElement ? el.parentElement.outerHTML.slice(0,1500):'no-parent' : 'no-el';
});
log('CONTEXT HTML:', ctxHtml);
await browser.close();

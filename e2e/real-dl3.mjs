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

// Find the span "Descargar" and dump ancestors up to 6 levels with tag/id/class
const anc = await page.evaluate(()=>{
  function vis(e){return e&&e.getClientRects().length>0}
  const span=[...document.querySelectorAll('span')].find(e=>vis(e)&&/^\s*Descargar\s*$/i.test(e.textContent||''));
  if(!span) return 'no-span';
  let out=[]; let cur=span;
  for(let i=0;i<7&&cur;i++){
    out.push(`L${i}: <${cur.tagName}> id=${cur.id||''} cls="${String(cur.className||'').slice(0,100)}" onclick=${cur.getAttribute&&cur.getAttribute('onclick')||''}`);
    cur=cur.parentElement;
  }
  return out.join('\n');
});
log('ANCESTORS of Descargar:\n'+anc);

// instrument and click the span, watch network + blob + window.open + download
await page.evaluate(()=>{ window.__ev=[]; const p=u=>window.__ev.push(u); const ow=window.open; window.open=function(u,...a){p('window.open:'+u);try{return ow.apply(this,[u,...a])}catch(e){return null}}; if(window.URL){const oc=window.URL.createObjectURL;window.URL.createObjectURL=function(b){const r=oc.apply(this,arguments);p('blob:mime='+(b&&b.type)+'(this read)');return r;}} });
page.on('download',d=>log('DOWNLOAD:', d.suggestedFilename(), d.url()));
page.on('request',r=>{ if(/pdf|aspx|reporte|download|descargar/i.test(r.url())||r.method()==='POST'){ log('REQ:', r.method(), r.url()); return; } });
const clicked=await page.evaluate(()=>{ function vis(e){return e&&e.getClientRects().length>0} const span=[...document.querySelectorAll('span')].find(e=>vis(e)&&/^\s*Descargar\s*$/i.test(e.textContent||'')); if(!span){return 'no-span'} span.click(); return 'clicked span'; });
log('click result:', clicked);
await page.waitForTimeout(5000);
const ev=await page.evaluate(()=>window.__ev);
log('EVENTS after click:', JSON.stringify(ev));
await browser.close();

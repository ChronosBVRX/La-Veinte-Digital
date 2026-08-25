import { chromium } from 'playwright';
const M=process.env.MATRICULA, P=process.env.PASS;
const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', viewport:{width:1280,height:900}, locale:'es-MX', acceptDownloads:true });
const page = await ctx.newPage();
const log=(...a)=>console.log(...a);

// track downloads + window.open + blob
const dlEvents=[];
page.on('download', d=>{ log('DOWNLOAD event:', d.suggestedFilename(), d.url()); dlEvents.push({kind:'download', url:d.url(), name:d.suggestedFilename()}); });
page.on('popup', p=>{ log('POPUP:', p.url()); });
await page.exposeFunction('__lvdWinOpen',(u)=>log('window.open:',u));
await page.exposeFunction('__lvdBlob',(u,m)=>log('blob:',u,'mime:',m,'scheme:', (u||'').slice(0,10)));

await page.goto('https://tuperfil.imss.gob.mx/guitpei-web/login',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(3000);
await page.locator('#matricula').fill(M); await page.locator('#password').fill(P);
await page.locator('button:has-text("Iniciar sesión")').first().click();
await page.waitForTimeout(5000);
await page.goto('https://tuperfil.imss.gob.mx/guitpei-web/app/administration/biometric/consult-period',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(4000);

// select OOAD + periodo via real flow (dual matcher)
await page.evaluate(async ()=>{
  function n(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
  function txt(e){return (e.innerText||e.textContent||'').replace(/\s+/g,' ').trim()}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function pick(id, tl, tv){
    const el=document.getElementById(id); const trig=el.querySelector('.mat-select-trigger')||el; trig.click();
    let opts=[]; for(let i=0;i<30;i++){ await sleep(200); opts=[...document.querySelectorAll('.cdk-overlay-container mat-option[role="option"], mat-option[role="option"]')]; if(opts.length>0)break; }
    const code=(n(tl).match(/\b\d{6,7}\b/)||[])[0];
    let hit=null;
    for(let i=0;i<opts.length;i++){ const ot=n(txt(opts[i])); if(code && ot.indexOf(code)>=0){hit=i;break;} if(n(tv)&&ot.indexOf(n(tv))>=0){hit=i;break;} if(n(tl)&&ot.indexOf(n(tl))>=0){hit=i;break;} }
    if(hit==null)return 'NOTFOUND';
    opts[hit].click();
    for(let i=0;i<10;i++){ await sleep(150); if(!document.querySelector('.cdk-overlay-pane'))break; }
  }
  await pick('mat-select-0','Michoacán','17');
  await sleep(2500);
  await pick('mat-select-2','2025001 (1ra - enero)','2025001');
  await sleep(1500);
});
// click Buscar
const btn=page.locator('button.primary:has-text("Buscar"), button:has-text("Buscar")').first();
log('Buscar count:', await btn.count());
if(await btn.count()>0) await btn.first().click();
await page.waitForTimeout(6000);

// NOW find the Descargar/Compartir controls in the results
const dlCtrls = await page.evaluate(()=>{
  function txt(e){return (e.innerText||e.textContent||'').replace(/\s+/g,' ').trim()}
  function vis(e){return e&&e.getClientRects().length>0}
  const cands=[...document.querySelectorAll('button,a,[role="button"],mat-icon,mat-icon-button,[onclick]')].filter(vis);
  return cands.filter(c=>/descargar|compartir|dowload|export|pdf|generar/i.test(txt(c))||/descargar|export|pdf|compartir/i.test(String(c.className||''))||/descargar|export|pdf|compartir/i.test(String(c.id||''))).map(c=>({tag:c.tagName, id:c.id, cls:String(c.className||'').slice(0,60), text:txt(c).slice(0,60), href:c.href||c.getAttribute&&c.getAttribute('href')||'', onclick:!!c.getAttribute&&!!c.getAttribute('onclick'), ariaLabel:c.getAttribute&&c.getAttribute('aria-label')||''}));
});
log('Download/share candidates:', JSON.stringify(dlCtrls,null,2));

// Also: network + any asset/pdf URL in page
const pdfish = await page.evaluate(()=>{
  const links=[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(h=>/pdf|reporte|download|descargar|\.aspx/i.test(h));
  return links.slice(0,10);
});
log('pdf-ish links:', JSON.stringify(pdfish));

// Inject watchers then click each candidate, capture what happens
await page.evaluate(()=>{
  window.__probeEvents=[];
  const push=(e)=>window.__probeEvents.push(e);
  const ow=window.open; window.open=function(u,...a){push({type:'window.open',u}); try{return ow.apply(this,[u,...a])}catch(e){return null}};
  if(window.URL){ const oc=window.URL.createObjectURL; window.URL.createObjectURL=function(b){ const r=oc.apply(this,arguments); push({type:'blob',mime:b&&b.type}); return r; }; }
});
log('clicking candidates...');
for(let i=0;i<dlCtrls.length;i++){
  const c=dlCtrls[i];
  const idx=i;
  await page.evaluate((idx)=>{ const cands=[...document.querySelectorAll('button,a,[role="button"],mat-icon,mat-icon-button,[onclick]')].filter(c=>c.getClientRects().length>0); const t=cands[idx]; if(t) t.click(); }, idx);
  await page.waitForTimeout(2000);
  const ev=await page.evaluate(()=>window.__probeEvents);
  if(ev.length) log(`after click #${idx} "${c.text}":`, JSON.stringify(ev));
}
const dl=await page.evaluate(()=>window.__probeEvents);
log('all probe events:', JSON.stringify(dl));
await page.screenshot({path:'/tmp/biometric-dl.png', fullPage:true});
log('screenshot /tmp/biometric-dl.png');
await browser.close();

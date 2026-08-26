import { chromium } from 'playwright';
const M=process.env.MATRICULA, P=process.env.PASS;
const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', viewport:{width:1280,height:900}, locale:'es-MX', acceptDownloads:true });
const page = await ctx.newPage();
const log=(...a)=>console.log(...a);
page.on('download', async d=>{ log('DL:', d.suggestedFilename()); try{await d.saveAs('/tmp/chk.pdf'); log('saved');}catch{} });

await page.goto('https://tuperfil.imss.gob.mx/guitpei-web/login',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(3000);
await page.locator('#matricula').fill(M); await page.locator('#password').fill(P);
await page.locator('button:has-text("Iniciar sesión")').first().click();
await page.waitForTimeout(5000);
await page.goto('https://tuperfil.imss.gob.mx/guitpei-web/app/administration/biometric/consult-period',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(5000);
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

// click Descargar via real gesture
const span=page.locator('span').filter({hasText:/^\s*Descargar\s*$/i}).first();
if(await span.count()>0){ await span.click(); log('clicked Descargar'); }
await page.waitForTimeout(5000);

// NOW try fetch with sessionStorage.token
const res = await page.evaluate(async ()=>{
  const token=sessionStorage.getItem('token')||null;
  const headers={'Content-Type':'application/json'};
  if(token)headers['Authorization']=token;
  const body=JSON.stringify({matricula:'98173968',idPeriodo:'2025001',tipoConsuta:2,fechaInicial:'-',fechaFinal:'-',ooad:'17'});
  const r=await fetch('/mstpei-biometricos/v1/biometricos/recuperar',{method:'POST',headers:headers,body:body,credentials:'include'});
  const txt=await r.text();
    let j; try{j=JSON.parse(txt);}catch{return {status:r.status, notJson:txt.slice(0,50)};}
  const b=j.data&&j.data.archivoB64;
  if(!b)return {status:r.status, msg:j.message, noB64:true};
  const bytes=atob(b); const head=String.fromCharCode(bytes.charCodeAt(0),bytes.charCodeAt(1),bytes.charCodeAt(2),bytes.charCodeAt(3),bytes.charCodeAt(4));
  return {status:r.status, isPdf:head==='%PDF-', len:bytes.length};
});
log('fetch after Descargar click:', JSON.stringify(res));
console.log('--- file ---');
await browser.close();

import { chromium } from 'playwright';
const M=process.env.MATRICULA, P=process.env.PASS;
const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', viewport:{width:1280,height:900}, locale:'es-MX' });
const page = await ctx.newPage();
const log=(...a)=>console.log(...a);

await page.goto('https://tuperfil.imss.gob.mx/guitpei-web/login',{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(3000);
await page.locator('#matricula').fill(M); await page.locator('#password').fill(P);
await page.locator('button:has-text("Iniciar sesión")').first().click();
await page.waitForTimeout(5000);

// Inject auth monitor BEFORE the biometric page loads
await page.evaluate(()=>{
  if(window.__LVD_BIO_AUTH_HOOKED__)return;
  window.__LVD_BIO_AUTH_HOOKED__=true; window.__LVD_BIO_AUTH__=null;
  var ox=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){ this.__lvdUrl=u; var origSet=this.setRequestHeader; if(origSet){ try{ this.setRequestHeader=function(n,v){ if(/authorization/i.test(n)&&/bearer/i.test(v))window.__LVD_BIO_AUTH__=v; return origSet.apply(this,arguments); }; }catch{} } return ox.apply(this,arguments); };
});

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

// read captured token
const auth = await page.evaluate(()=>window.__LVD_BIO_AUTH__||'');
log('captured AUTH:', auth.slice(0,30)+'... len='+auth.length);

// now do the fetch using captured token
const b64 = await page.evaluate(async ()=>{
  const token=window.__LVD_BIO_AUTH__;
  const body=JSON.stringify({matricula:'98173968',idPeriodo:'2025001',tipoConsuta:2,fechaInicial:'-',fechaFinal:'-',ooad:'17'});
  const headers={'Content-Type':'application/json'}; if(token)headers['Authorization']=token;
  const r=await fetch('/mstpei-biometricos/v1/biometricos/recuperar',{method:'POST',headers:headers,body:body});
  const txt=await r.text();
  const j=JSON.parse(txt);
  const b=j.data&&j.data.archivoB64;
  if(!b)return {ok:false,status:r.status,msg:j.message||txt.slice(0,50)};
  const bytes=atob(b);
  const head=String.fromCharCode(bytes.charCodeAt(0),bytes.charCodeAt(1),bytes.charCodeAt(2),bytes.charCodeAt(3),bytes.charCodeAt(4));
  return {ok:true,status:r.status,isPdf:head==='%PDF-',len:bytes.length};
});
log('fetch w/ captured token:', JSON.stringify(b64));
await browser.close();

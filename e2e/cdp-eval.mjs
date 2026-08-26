import http from 'node:http';

function wsUrl(id){
  return new Promise((resolve,reject)=>{
    http.get('http://localhost:9222/json', res=>{
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        try{ const arr=JSON.parse(d); const t=arr.find(x=>x.id===id); resolve(t.webSocketDebuggerUrl); }catch(e){reject(e)}
      });
    }).on('error',reject);
  });
}

async function evalJs(id, expression){
  const url = await wsUrl(id);
  const WebSocket = (await import('ws')).default;
  const ws = new WebSocket(url);
  return new Promise((resolve,reject)=>{
    ws.on('open', ()=>{
      ws.send(JSON.stringify({id:1, method:'Runtime.evaluate', params:{expression, returnByValue:true, awaitPromise:true}}));
    });
    ws.on('message', (data)=>{
      const msg = JSON.parse(data.toString());
      if(msg.id===1){ ws.close(); resolve(msg.result?.result?.value ?? msg); }
    });
    ws.on('error', reject);
    setTimeout(()=>{ ws.close(); resolve('TIMEOUT'); }, 8000);
  });
}

const id = process.argv[2];
const expr = process.argv[3];
console.log(JSON.stringify(await evalJs(id, expr), null, 2));

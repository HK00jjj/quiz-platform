/* tts_proxy_diag.cjs — 页面内直测 TTS 代理：状态码 + 响应体 + 连测 3 次（真实 Chrome 网络栈） */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = '9253';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
async function main() {
  const profile = path.join(OUT, `profile-diag-${Date.now()}`);
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profile}`, '--no-sandbox', 'about:blank'], { stdio: 'ignore' });
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) { await sleep(500); try { targets = await getJSON(`http://127.0.0.1:${PORT}/json`); if (targets && targets.length) break; } catch { } }
    if (!targets) throw new Error('CDP 未就绪');
    const page = targets.find(t => t.type === 'page');
    const WebSocket = require('ws');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 16 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
    let msgId = 0; const pending = new Map();
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const send = (method, params = {}) => new Promise((resolve) => { const id = ++msgId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    // 先导航到线上站（同源，带站点真实 Origin/Referer）
    await send('Page.navigate', { url: 'https://hk00jjj.github.io/quiz-platform/' });
    await sleep(6000);
    const r = await send('Runtime.evaluate', {
      returnByValue: true, awaitPromise: true, expression: `(async()=>{
        const out = [];
        for (let i=0;i<3;i++){
          try{
            const t0=Date.now();
            const res = await fetch('https://khtpnbzfjggezlmnnsgt.supabase.co/functions/v1/tts?voice=zh-CN-YunjianNeural&rate=1.1&text=%E6%B5%8B%E8%AF%95');
            const buf = await res.arrayBuffer();
            let body=''; try{ body=new TextDecoder().decode(new Uint8Array(buf.slice(0,200))) }catch(e){}
            out.push({i, status:res.status, type:res.headers.get('content-type'), bytes:buf.byteLength, ms:Date.now()-t0, head:body.slice(0,160)});
          }catch(e){ out.push({i, err:String(e&&e.message||e)}); }
          await new Promise(r=>setTimeout(r,1500));
        }
        // 对照组：Supabase 同域 REST（auth health）——判断是否函数级故障
        try{ const t0=Date.now(); const r2=await fetch('https://khtpnbzfjggezlmnnsgt.supabase.co/auth/v1/health'); out.push({probe:'auth-health', status:r2.status, ms:Date.now()-t0}); }catch(e){ out.push({probe:'auth-health', err:String(e&&e.message||e)}); }
        return out;
      })()`
    });
    console.log(JSON.stringify(r.result && r.result.result ? r.result.result.value : r, null, 1));
    ws.close();
  } finally { chrome.kill(); }
}
main().catch(e => { console.error('FATAL', e && e.message || e); process.exit(1); });

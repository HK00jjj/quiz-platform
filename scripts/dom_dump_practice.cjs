/* dom_dump_practice.cjs — 进练习后 dump 工具条/按钮文本（找刷题 chip 的真实形态） */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = '9255';
const OUT = path.join(__dirname, 'out');
const LIVE = 'https://hk00jjj.github.io/quiz-platform/';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
function readCreds() {
  const txt = fs.readFileSync('C:/Users/青丘白浅/Documents/Qoder/凭据.txt', 'utf8');
  const email = /^.*登录邮箱\s*=\s*(.+)$/m.exec(txt)[1].trim();
  const env = fs.readFileSync('C:/Users/青丘白浅/Documents/QoderCN/2026-09-02/chat-1/app/.env', 'utf8');
  const password = /^E2E_PASSWORD=(.+)$/m.exec(env)[1].trim();
  return { email, password };
}
async function main() {
  const P = (s) => console.log(s);
  const { email, password } = readCreds();
  const profile = path.join(OUT, `profile-domdump-${Date.now()}`);
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profile}`, '--no-sandbox', '--window-size=460,980', 'about:blank'], { stdio: 'ignore' });
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) { await sleep(500); try { targets = await getJSON(`http://127.0.0.1:${PORT}/json`); if (targets && targets.length) break; } catch { } }
    const page = targets.find(t => t.type === 'page');
    const WebSocket = require('ws');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 32 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
    let msgId = 0; const pending = new Map();
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const send = (method, params = {}) => new Promise((resolve) => { const id = ++msgId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200));
      return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const waitSel = async (sel, ms) => { for (let i = 0; i < Math.floor(ms / 500); i++) { await sleep(500); if (await ev(`!!document.querySelector('${sel}')`).catch(() => false)) return true; } return false; };

    await send('Page.navigate', { url: LIVE });
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (await waitSel('input[type="password"]', 20000)) {
        await ev(`(async()=>{const setV=(el,v)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};
          const em=[...document.querySelectorAll('input')].find(i=>i.type==='email'||i.placeholder==='邮箱');const pw=[...document.querySelectorAll('input')].find(i=>i.type==='password');
          setV(em,${JSON.stringify(email)});setV(pw,${JSON.stringify(password)});await new Promise(r=>setTimeout(r,300));
          [...document.querySelectorAll('button')].find(b=>b.textContent.includes('进入')).click();return 1})()`);
      }
      let ok = false;
      for (let i = 0; i < 90; i++) { await sleep(1000); ok = await ev(`!![...document.querySelectorAll('.entry-card')].length`).catch(() => false); if (ok) break; }
      P(`home(${attempt}): ` + ok);
      if (ok) break;
      await send('Page.navigate', { url: LIVE }); await sleep(2000);
    }
    await ev(`(()=>{const c=[...document.querySelectorAll('.entry-card')].find(x=>/随机/.test(x.textContent))||[...document.querySelectorAll('.entry-card')][0];c.click();return 1})()`);
    if (!(await waitSel('.q-card-wrap', 40000))) throw new Error('未进练习');
    await sleep(1500);
    const dump = await ev(`({
      url: location.href,
      buttons: [...document.querySelectorAll('button')].map(b=>({t:b.textContent.trim().slice(0,20), vis:!!b.offsetParent, aria:b.getAttribute('aria-pressed')})).slice(0,40),
      chips: [...document.querySelectorAll('.chip')].map(b=>b.textContent.trim().slice(0,16)),
      hasQcard: !!document.querySelector('.q-card'),
      hash: location.hash
    })`);
    P('DUMP: ' + JSON.stringify(dump, null, 1));
    ws.close();
  } finally { chrome.kill(); }
}
main().catch(e => { console.error('FATAL', e && e.message || e); process.exit(1); });

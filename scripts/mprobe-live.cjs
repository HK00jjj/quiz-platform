/* mprobe-live.cjs — 线上移动端布局取证（登录版）
 * 用法: node mprobe-live.cjs <W>x<H> <tag>   （CDP_PORT 环境变量）
 * 流程: spawn Chrome → 线上站点 → 登录(凭据.txt/​app/.env) → 首页 → 随机练习
 *       → 等 .q-card-wrap → 量测 + 截图 → tools/out/<tag>-{metrics.json,shot.png}
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.CDP_PORT || '9240';
const [viewW, viewH] = (process.argv[2] || '390x844').split('x').map(Number);
const TAG = process.argv[3] || 'live';
const LIVE = 'https://hk00jjj.github.io/quiz-platform/';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
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
  const log = [];
  const P = (s) => { log.push(s); };
  const { email, password } = readCreds();

  const profile = path.join(OUT, `profile-live-${TAG}-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
    '--disable-gpu', `--user-data-dir=${profile}`, '--no-sandbox',
    '--window-size=460,980', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try { targets = await getJSON(`http://127.0.0.1:${PORT}/json`); if (targets && targets.length) break; } catch { }
    }
    if (!targets) throw new Error('CDP 端口未就绪');
    const page = targets.find(t => t.type === 'page');
    const WebSocket = require('ws');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

    let msgId = 0; const pending = new Map();
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const send = (method, params = {}) => new Promise((resolve) => { const id = ++msgId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: viewW, height: viewH, deviceScaleFactor: 2, mobile: true });

    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
      return r.result && r.result.result ? r.result.result.value : undefined;
    };
    const waitSel = async (sel, ms) => {
      for (let i = 0; i < Math.floor(ms / 500); i++) {
        await sleep(500);
        if (await ev(`!!document.querySelector('${sel}')`).catch(() => false)) return true;
      }
      return false;
    };

    await send('Page.navigate', { url: LIVE });
    P('navigated live');
    const hasLogin = await waitSel('input[type="password"]', 30000);
    P('login page: ' + hasLogin);

    if (hasLogin) {
      const r = await ev(`(async()=>{
        const setV=(el,v)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};
        const inputs=[...document.querySelectorAll('input')];
        const em=inputs.find(i=>i.type==='email'||i.placeholder==='邮箱');
        const pw=inputs.find(i=>i.type==='password');
        if(!em||!pw)return 'no-inputs';
        setV(em,${JSON.stringify(email)});setV(pw,${JSON.stringify(password)});
        await new Promise(r=>setTimeout(r,300));
        const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('进入糖果题库'));
        if(!btn)return 'no-btn';
        btn.click();return 'clicked';
      })()`);
      P('login click: ' + r);
      // 慢登录：轮询首页特征，最多 90s
      let homeOK = false;
      for (let i = 0; i < 90; i++) {
        await sleep(1000);
        homeOK = await ev(`!![...document.querySelectorAll('.entry-card')].length`).catch(() => false);
        if (homeOK) break;
      }
      P('home ready: ' + homeOK);
      if (!homeOK) throw new Error('登录后首页未就绪');
    }

    // 点「随机」入口卡
    const clicked = await ev(`(()=>{
      const cards=[...document.querySelectorAll('.entry-card')];
      const card=cards.find(c=>/随机/.test(c.textContent))||cards[1]||cards[0];
      if(!card)return 'no-card';
      card.click();return card.textContent.trim().slice(0,24);
    })()`);
    P('entry: ' + JSON.stringify(clicked));

    if (!(await waitSel('.q-card-wrap', 30000))) throw new Error('q-card-wrap 未出现');
    await sleep(1500);

    const metrics = await ev(`(() => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top:+b.top.toFixed(1), bottom:+b.bottom.toFixed(1), left:+b.left.toFixed(1), right:+b.right.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1) };
      };
      const wrap = document.querySelector('.q-card-wrap');
      const cs = wrap ? getComputedStyle(wrap) : null;
      return {
        vw: innerWidth, vh: innerHeight,
        url: location.hash,
        scrollH: document.documentElement.scrollHeight,
        overflowX: document.documentElement.scrollWidth > innerWidth,
        overflowY: document.documentElement.scrollHeight > innerHeight + 1,
        stage: rect('.practice-stage'),
        practiceTop: rect('.practice-top'),
        wrap: rect('.q-card-wrap'),
        wrapStyle: cs ? { w: cs.width, h: cs.height, mL: cs.marginLeft, mR: cs.marginRight, mB: cs.marginBottom } : null,
      };
    })()`);
    P('metrics: ' + JSON.stringify(metrics, null, 1));

    const d = {};
    if (metrics.wrap) {
      d.hCenterOffset = +(((metrics.wrap.left + metrics.wrap.right) / 2) - metrics.vw / 2).toFixed(1);
      d.gapTopGroup = metrics.practiceTop ? +metrics.practiceTop.top.toFixed(1) : null;
      d.gapBottomCard = +(metrics.vh - metrics.wrap.bottom).toFixed(1);
      if (metrics.practiceTop && metrics.wrap) {
        d.groupCenterOffset = +((metrics.vh - metrics.wrap.bottom) - metrics.practiceTop.top).toFixed(1);
      }
    }
    fs.writeFileSync(path.join(OUT, `${TAG}-metrics.json`), JSON.stringify({ metrics, derived: d, log }, null, 2));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) {
      fs.writeFileSync(path.join(OUT, `${TAG}-shot.png`), Buffer.from(shot.result.data, 'base64'));
      P('screenshot saved');
    }
    ws.close();
    P('DONE');
  } finally {
    chrome.kill();
  }
  fs.writeFileSync(path.join(OUT, `${TAG}-log.txt`), log.join('\n'));
  console.log('LIVE DONE ' + TAG);
}

main().catch(e => {
  try { fs.appendFileSync(path.join(OUT, `${TAG}-log.txt`), '\nFATAL: ' + (e.stack || e.message)); } catch { }
  console.error('LIVE FATAL', e.message);
  process.exit(1);
});

/* tts_timing_probe.cjs — 语音首响时序取证（2026-09-26 修"没有第一时间播放"验证）
 * 流程: Chrome headless → 本地 preview → 登录 → 开插桩 __ttsfxArm → 随机练习
 *       → 读题干开口日志 → 作答提交 → 读揭晓时间线 + TTS 资源请求时间线
 * 判读: ① __ttsfxLog 的 reveal 拍应 ≈ 提交点击时刻（旧版 ≈ +520ms 蜡封动画后）
 *       ② performance 资源里 functions/v1/tts 的判分版请求 startTime ≈ 提交时刻（预载先行）
 * 输出: tools/out/ttsfix-metrics.json / ttsfix-log.txt
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.CDP_PORT || '9241';
const TAG = 'ttsfix';
const LIVE = process.env.TTS_LIVE === '1'
  ? 'https://hk00jjj.github.io/quiz-platform/'
  : 'http://localhost:4176/quiz-platform/';
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
  const P = (s) => { log.push(s); console.log(s); };
  const { email, password } = readCreds();

  const profile = path.join(OUT, `profile-${TAG}-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
    '--disable-gpu', `--user-data-dir=${profile}`, '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
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
    await send('Page.enable'); await send('Runtime.enable');

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
    P('navigated preview');

    /* 登录（含重试：Supabase 偶发慢/失败，最多 3 轮 reload 重登） */
    let homeOK = false;
    for (let attempt = 1; attempt <= 3 && !homeOK; attempt++) {
      const hasLogin = await waitSel('input[type="password"]', 20000);
      P(`login page(${attempt}): ` + hasLogin);
      if (!hasLogin) {
        /* 无登录框：可能已登录（线上 SW 首访加载慢），轮询首页特征 60s */
        for (let i = 0; i < 60; i++) {
          await sleep(1000);
          homeOK = await ev(`!![...document.querySelectorAll('.entry-card')].length`).catch(() => false);
          if (homeOK) break;
        }
        if (homeOK) break;
        if (attempt < 3) { await send('Page.navigate', { url: LIVE }); await sleep(3000); continue }
        break;
      }
      const r = await ev(`(async()=>{
        const setV=(el,v)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};
        const inputs=[...document.querySelectorAll('input')];
        const em=inputs.find(i=>i.type==='email'||i.placeholder==='邮箱');
        const pw=inputs.find(i=>i.type==='password');
        if(!em||!pw)return 'no-inputs';
        setV(em,${JSON.stringify(email)});setV(pw,${JSON.stringify(password)});
        await new Promise(r=>setTimeout(r,300));
        const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('进入'));
        if(!btn)return 'no-btn';
        btn.click();return 'clicked';
      })()`);
      P('login click: ' + r);
      for (let i = 0; i < 90; i++) {
        await sleep(1000);
        homeOK = await ev(`!![...document.querySelectorAll('.entry-card')].length`).catch(() => false);
        if (homeOK) break;
      }
      P(`home ready(${attempt}): ` + homeOK);
      if (!homeOK && attempt < 3) { await send('Page.navigate', { url: LIVE }); await sleep(2000); }
    }
    if (!homeOK) throw new Error('登录后首页未就绪（重试 3 轮）');

    /* 开插桩 + 清资源时间线基线 */
    await ev(`window.__ttsfxArm = true; performance.clearResourceTimings();
      window.__fetchLog = [];
      const __of = window.fetch.bind(window);
      window.fetch = function(u, ...a) {
        const s = String(u);
        if (s.includes('/functions/v1/tts') || s.includes('gettts')) {
          (window.__fetchLog = window.__fetchLog || []).push({ t: Date.now(), head: decodeURIComponent(s).slice(70, 118) });
        }
        return __of(u, ...a);
      };
      'armed'`);

    /* 点「随机」入口卡（走 Learn.run：含首题题干预载 + 手势解锁） */
    const tEntry = Date.now();
    const clicked = await ev(`(()=>{
      const cards=[...document.querySelectorAll('.entry-card')];
      const card=cards.find(c=>/随机/.test(c.textContent))||cards[1]||cards[0];
      if(!card)return 'no-card';
      card.click();return card.textContent.trim().slice(0,24);
    })()`);
    P('entry: ' + JSON.stringify(clicked));

    if (!(await waitSel('.q-card-wrap', 30000))) throw new Error('q-card-wrap 未出现');
    await sleep(800);

    /* 读题干开口尝试日志 */
    const stemLog = await ev(`(window.__stemLoopLog || []).map(x => ({...x, dt: x.t - ${tEntry}}))`);
    P('stemLog: ' + JSON.stringify(stemLog));

    /* 作答：点第一个可用的选项行（.opt-row）或判断卡（.judge-card）→ 填空/主观兜底 */
    const picked = await ev(`(()=>{
      const els = [...document.querySelectorAll('.opt-row, .judge-card')].filter(e => e.offsetParent !== null && !e.disabled && e.getBoundingClientRect().height > 10);
      if (els.length) { els[0].click(); return 'opt-row/judge #' + els.length; }
      const inp = [...document.querySelectorAll('.fill-grid input, textarea')].filter(e => e.offsetParent !== null)[0];
      if (inp) { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(inp, '1'); inp.dispatchEvent(new Event('input', { bubbles: true })); return 'fill-input'; }
      return 'no-option';
    })()`);
    P('picked: ' + JSON.stringify(picked));
    await sleep(400);

    /* 提交（doCheck）——记录点击时刻 */
    const submit = await ev(`(()=>{
      window.__t0 = Date.now();
      const btns=[...document.querySelectorAll('button, .reveal-btn')].filter(b=>/确认|提交|查看解析/.test(b.textContent) && b.offsetParent !== null && !b.disabled);
      if(!btns.length)return 'no-submit';
      btns[0].click();return 'submitted: ' + btns[0].textContent.trim().slice(0,10);
    })()`);
    P('submit: ' + JSON.stringify(submit));
    if (String(submit).includes('no-submit')) throw new Error('找不到提交按钮');

    await sleep(2500);

    /* 揭晓时间线 + TTS 资源请求（含完整 URL 与对错 verdict） */
    const result = await ev(`(() => {
      const fx = (window.__ttsfxLog || []).map(x => ({...x, dt: x.t - window.__t0}));
      const tts = performance.getEntriesByType('resource')
        .filter(e => /functions\\/v1\\/tts|gettts/.test(e.name))
        .map(e => ({ start: Math.round(e.startTime), end: Math.round(e.responseEnd), dur: Math.round(e.duration), url: decodeURIComponent(e.name) }));
      const seal = document.querySelector('.seal-lock') ? document.querySelector('.seal-lock').className : '(none)';
      const verdict = (document.querySelector('.verdict-banner') || {}).textContent || '(none)';
      const revealed = !!document.querySelector('.grade-panel');
      const fetchLog = (window.__fetchLog || []).map(x => ({ ...x, dt: x.t - window.__t0 }));
      return { t0: window.__t0, now: Date.now(), fx, tts, seal, revealed, verdict, fetchLog };
    })()`);
    P('result: ' + JSON.stringify(result, null, 1));

    /* 第二题（翻题预载验证）：找下一题按钮 */
    const nextBtn = await ev(`(()=>{
      const btns=[...document.querySelectorAll('button')].filter(b=>/下一题|下一|继续/.test(b.textContent) && b.offsetParent !== null);
      if(!btns.length)return 'no-next';
      window.__t1 = Date.now();
      btns[0].click();return 'next: ' + btns[0].textContent.trim().slice(0,10);
    })()`);
    P('next: ' + JSON.stringify(nextBtn));
    if (!String(nextBtn).includes('no-next')) {
      await sleep(3000);
      const stemLog2 = await ev(`(window.__stemLoopLog || []).map(x => ({...x, dt: x.t - window.__t1}))`);
      const tts2 = await ev(`performance.getEntriesByType('resource').filter(e => /functions\\/v1\\/tts|gettts/.test(e.name)).map(e => ({ start: Math.round(e.startTime), end: Math.round(e.responseEnd), dur: Math.round(e.duration) }))`);
      P('stemLog2(dt vs t1): ' + JSON.stringify(stemLog2));
      P('tts2: ' + JSON.stringify(tts2));
    }

    fs.writeFileSync(path.join(OUT, `${TAG}-metrics.json`), JSON.stringify({ result, log }, null, 2));
    ws.close();
    P('DONE');
  } finally {
    chrome.kill();
  }
  fs.writeFileSync(path.join(OUT, `${TAG}-log.txt`), log.join('\n'));
  console.log('PROBE DONE ' + TAG);
}

main().catch(e => {
  try { fs.appendFileSync(path.join(OUT, `${TAG}-log.txt`), '\nFATAL: ' + (e.stack || e.message)); } catch { }
  console.error('PROBE FATAL', e.message);
  process.exit(1);
});

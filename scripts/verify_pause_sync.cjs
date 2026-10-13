/* verify_pause_sync.cjs — 修复验证：题干暂停 → 打开解析不得续播（2026-09-28）
 * 根因回顾：GA 云端线"暂停在原处"= AudioContext.suspend() 冻结时间线；而
 * doCheck/展开参考答案/自查按钮的手势内 unlockCloudAudio() 无条件 ctx.resume()
 * 把暂停的题干语音误唤醒 → 进解析页后从暂停点继续播放。
 * 修复：unlockCloudAudio 加守卫——存在暂停中的播报会话（ga.paused / session.paused）
 * 时跳过 resume。
 * 验证四场景：
 *   A 暂停生效前提：题干播报中点 🔊 → ctx.state === 'suspended'
 *   B 核心断言：暂停态下点提交(doCheck) → ctx 仍 'suspended'（修复前会变 running）
 *              且 __ttsfxLog 出现 unlockGuard(pauseHeld=true) 且解析未开口（无新 TTS 请求）
 *   C 不误伤·揭晓后主动开声：解析面板点「继续播报」→ 解析开口（新 TTS 请求）+ ctx 'running'
 *   D 不误伤·同上下文续播：新题暂停后再点开关 → ctx 'running' 且无新 TTS 请求（GA resume 续播）
 * 输出：tools/out/pausesync-log.txt / pausesync-metrics.json
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.CDP_PORT || '9242';
const TAG = 'pausesync';
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

/* 判定结果收集 */
const verdicts = [];
function check(name, cond, detail) {
  verdicts.push({ name, pass: !!cond, detail: String(detail || '') });
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + ' | ' + String(detail || ''));
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

    /* AudioContext 实例捕获：必须在页面任何脚本之前注入（evaluateOnNewDocument）。
       tts.js 的 gaCtxOf() 用 new (window.AudioContext)() —— wrapper 记录每个实例。 */
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      (function(){
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          window.__acs = [];
          const W = function(...a){ const c = new AC(...a); window.__acs.push(c); return c; };
          W.prototype = AC.prototype;
          window.AudioContext = W;
          if (window.webkitAudioContext === AC) window.webkitAudioContext = W;
        } catch (e) {}
      })();` });

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
    P('navigated');

    /* 登录（重试 3 轮，同 tts_timing_probe 惯例） */
    let homeOK = false;
    for (let attempt = 1; attempt <= 3 && !homeOK; attempt++) {
      const hasLogin = await waitSel('input[type="password"]', 20000);
      P(`login page(${attempt}): ` + hasLogin);
      if (!hasLogin) {
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

    /* 开插桩：__ttsfxArm + TTS fetch 日志 */
    await ev(`window.__ttsfxArm = true;
      window.__fetchLog = [];
      const __of = window.fetch.bind(window);
      window.fetch = function(u, ...a) {
        const s = String(u);
        if (s.includes('/functions/v1/tts') || s.includes('gettts')) {
          (window.__fetchLog = window.__fetchLog || []).push({ t: Date.now(), head: decodeURIComponent(s).slice(0, 90) });
        }
        return __of(u, ...a);
      };
      'armed'`);
    await ev(`performance.clearResourceTimings(); 'cleared'`);

    /* 点「随机」入口卡进练习 */
    const clicked = await ev(`(()=>{
      const cards=[...document.querySelectorAll('.entry-card')];
      const card=cards.find(c=>/随机/.test(c.textContent))||cards[1]||cards[0];
      if(!card)return 'no-card';
      card.click();return card.textContent.trim().slice(0,24);
    })()`);
    P('entry: ' + JSON.stringify(clicked));
    if (!(await waitSel('.q-card-wrap', 30000))) throw new Error('q-card-wrap 未出现');

    /* 等题干播报建立 GA 会话（ctx 已创建且 running） */
    let gaReady = false;
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      gaReady = await ev(`(window.__acs||[]).length >= 1 && (window.__acs[0].state === 'running' || window.__acs[0].state === 'suspended')`).catch(() => false);
      const speaking = await ev(`!!(window.__acs||[]).length && window.__acs[0].state === 'running'`).catch(() => false);
      if (speaking) { gaReady = 'speaking'; break }
      if (gaReady && i > 6) break;   // suspended 也可能是浏览器初始挂起后已 resume 失败，继续等
    }
    P('gaReady: ' + JSON.stringify(gaReady));
    const tts0 = await ev(`(window.__fetchLog||[]).length`);
    P('tts requests so far: ' + tts0);
    if (Number(tts0) < 1) throw new Error('题干 TTS 请求未出现（GA 会话未建立）');

    /* ── 场景 A：题干播报中点 🔊 暂停 → ctx 应 suspended ── */
    const paused = await ev(`(()=>{
      const chips=[...document.querySelectorAll('button.chip')].filter(b=>/题干播报|已暂停/.test(b.textContent) && b.offsetParent !== null);
      if(!chips.length)return 'no-toggle';
      chips[0].click();return 'pause-clicked';
    })()`);
    P('A pause: ' + JSON.stringify(paused));
    await sleep(700);
    const stA = await ev(`(window.__acs||[]).length ? window.__acs[0].state : 'no-ctx'`);
    check('A1 题干暂停生效(ctx suspended)', stA === 'suspended', 'ctx.state=' + stA);

    /* ── 场景 B：暂停态下提交判分(doCheck) → ctx 必须仍 suspended、解析不开口 ── */
    const picked = await ev(`(()=>{
      const els = [...document.querySelectorAll('.opt-row, .judge-card')].filter(e => e.offsetParent !== null && !e.disabled && e.getBoundingClientRect().height > 10);
      if (els.length) { els[0].click(); return 'picked'; }
      const inp = [...document.querySelectorAll('.fill-grid input, textarea')].filter(e => e.offsetParent !== null)[0];
      if (inp) { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(inp, '1'); inp.dispatchEvent(new Event('input', { bubbles: true })); return 'fill'; }
      return 'no-option';
    })()`);
    P('B picked: ' + JSON.stringify(picked));
    await sleep(400);
    const nBefore = Number(await ev(`(window.__fetchLog||[]).length`));
    const submit = await ev(`(()=>{
      const btns=[...document.querySelectorAll('button, .reveal-btn')].filter(b=>/确认|提交|查看解析/.test(b.textContent) && b.offsetParent !== null && !b.disabled);
      if(!btns.length)return 'no-submit';
      btns[0].click();return 'submitted';
    })()`);
    P('B submit: ' + JSON.stringify(submit));
    await sleep(1500);
    const stB = await ev(`(window.__acs||[]).length ? window.__acs[0].state : 'no-ctx'`);
    const nAfter = Number(await ev(`(window.__fetchLog||[]).length`));
    const guard = await ev(`(window.__ttsfxLog||[]).filter(x => x.ev === 'unlockGuard').slice(-3)`);
    check('B1 暂停态提交后 ctx 仍 suspended（核心：不被手势解锁唤醒）', stB === 'suspended', 'ctx.state=' + stB);
    check('B2 unlockGuard 守卫命中 pauseHeld=true', guard.some(g => g.pauseHeld === true), JSON.stringify(guard));
    check('B3 提交未触发解析开口（无新 TTS 请求）', nAfter === nBefore, `tts req ${nBefore} -> ${nAfter}`);

    /* ── 场景 C：解析面板主动点「继续播报」→ 解析开口、ctx running（守卫不误伤开声） ── */
    const opened = await ev(`(()=>{
      const chip=[...document.querySelectorAll('button.chip')].filter(b=>/已暂停|播报|×/.test(b.textContent) && b.offsetParent !== null && b.getAttribute('aria-expanded') !== null);
      if(!chip.length)return 'no-panel-chip';
      chip[0].click();return 'panel-opened';
    })()`);
    P('C panel: ' + JSON.stringify(opened));
    await sleep(400);
    const resumeC = await ev(`(()=>{
      const btns=[...document.querySelectorAll('button.chip')].filter(b=>/继续播报|播报开/.test(b.textContent) && b.offsetParent !== null);
      if(!btns.length)return 'no-resume-btn';
      btns[0].click();return 'resume-clicked';
    })()`);
    P('C resume: ' + JSON.stringify(resumeC));
    await sleep(1800);
    const stC = await ev(`(window.__acs||[]).length ? window.__acs[0].state : 'no-ctx'`);
    const nC = Number(await ev(`(window.__fetchLog||[]).length`));
    check('C1 揭晓后主动开声 → 解析开口(新 TTS 请求)', nC > nAfter, `tts req ${nAfter} -> ${nC}`);
    check('C2 ctx 恢复 running（新播报可开口）', stC === 'running', 'ctx.state=' + stC);

    /* ── 场景 D：下一题 → 题干暂停 → 再点开关（同上下文续播）→ ctx running 且无新请求 ── */
    const next = await ev(`(()=>{
      const btns=[...document.querySelectorAll('button')].filter(b=>/下一题|下一|继续/.test(b.textContent) && b.offsetParent !== null);
      if(!btns.length)return 'no-next';
      btns[0].click();return 'next';
    })()`);
    P('D next: ' + JSON.stringify(next));
    if (String(next).includes('no-next')) {
      /* feedback 自评题可能没有下一题按钮则用「我答对了」——探针兜底：直接终止 D 场景 */
      P('D skipped (no next button)');
    } else {
      if (!(await waitSel('.q-card-wrap', 20000))) throw new Error('第二题 q-card 未出现');
      /* 等新题 GA 会话接管（旧会话 done/清场，新会话开口） */
      let ttsD0 = 0;
      for (let i = 0; i < 16; i++) {
        await sleep(500);
        ttsD0 = Number(await ev(`(window.__fetchLog||[]).length`));
        if (ttsD0 > nC) break;
      }
      P('D new-question tts reqs: ' + ttsD0);
      const pauseD = await ev(`(()=>{
        const chips=[...document.querySelectorAll('button.chip')].filter(b=>/题干播报|已暂停/.test(b.textContent) && b.offsetParent !== null);
        if(!chips.length)return 'no-toggle';
        chips[0].click();return 'pause-clicked';
      })()`);
      P('D pause: ' + JSON.stringify(pauseD));
      await sleep(700);
      const stD1 = await ev(`(window.__acs||[]).length ? window.__acs[0].state : 'no-ctx'`);
      check('D1 第二题暂停生效(ctx suspended)', stD1 === 'suspended', 'ctx.state=' + stD1);
      const resumeD = await ev(`(()=>{
        const chips=[...document.querySelectorAll('button.chip')].filter(b=>/题干播报|已暂停/.test(b.textContent) && b.offsetParent !== null);
        if(!chips.length)return 'no-toggle';
        chips[0].click();return 'resume-clicked';
      })()`);
      P('D resume: ' + JSON.stringify(resumeD));
      await sleep(1200);
      const stD2 = await ev(`(window.__acs||[]).length ? window.__acs[0].state : 'no-ctx'`);
      const nD = Number(await ev(`(window.__fetchLog||[]).length`));
      check('D2 同上下文点开关 → ctx 续播 running（守卫不误伤 resumeSpeak）', stD2 === 'running', 'ctx.state=' + stD2);
      check('D3 续播无新 TTS 请求（GA resume 从暂停点接读）', nD === ttsD0, `tts req ${ttsD0} -> ${nD}`);
    }

    const pass = verdicts.filter(v => v.pass).length;
    const summary = { pass, total: verdicts.length, verdicts };
    fs.writeFileSync(path.join(OUT, `${TAG}-metrics.json`), JSON.stringify({ summary, log }, null, 2));
    ws.close();
    P(`SUMMARY: ${pass}/${verdicts.length} PASS`);
  } finally {
    chrome.kill();
  }
  fs.writeFileSync(path.join(OUT, `${TAG}-log.txt`), log.join('\n'));
  console.log('PROBE DONE ' + TAG);
  if (verdicts.some(v => !v.pass)) process.exit(2);
}

main().catch(e => {
  try { fs.appendFileSync(path.join(OUT, `${TAG}-log.txt`), '\nFATAL: ' + (e.stack || e.message)); } catch { }
  console.error('PROBE FATAL', e.message);
  process.exit(1);
});

/* tts_browse_probe.cjs — 刷题模式语音取证（2026-10-12 "刷题模式不出声"）
 * 与 tts_timing_probe.cjs 同骨架，关键差异：
 *  · 不加 --autoplay-policy=no-user-gesture-required（模拟真人浏览器的自动播放策略）
 *  · 全程 trusted 输入（Input.dispatchMouseEvent）点击入口卡/刷题chip/下一题
 *  · 挂钩 AudioContext.resume / HTMLMediaElement.play / speechSynthesis.speak / tts fetch
 *  · 页面内直测 TTS 代理连通性（真实 Chrome 网络栈，绕开沙箱失真）
 *  · 三拍快照：答题期(题干) → 切刷题拍 → 刷题翻题拍
 * 输出: tools/out/ttsbrowse-metrics.json / ttsbrowse-log.txt
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.CDP_PORT || '9251';
const TAG = 'ttsbrowse';
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
  const P = (s) => { log.push(s); console.log(s); };
  const { email, password } = readCreds();

  const profile = path.join(OUT, `profile-${TAG}-${Date.now()}`);
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
    const consoleEvts = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
      if (m.method === 'Runtime.consoleAPICalled') {
        const txt = (m.params.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' ');
        consoleEvts.push({ t: Date.now(), type: m.params.type, txt: txt.slice(0, 240) });
      } else if (m.method === 'Runtime.exceptionThrown') {
        consoleEvts.push({ t: Date.now(), type: 'exception', txt: JSON.stringify(m.params.exceptionDetails).slice(0, 240) });
      }
    });
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
    /* trusted 点击（ granting user activation） */
    const tclick = async (finderExpr) => {
      const pos = await ev(finderExpr);
      if (!pos) return null;
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
      return pos.label || 'clicked';
    };
    const centerOf = (finderBody) => `(()=>{${finderBody}})()`;

    await send('Page.navigate', { url: LIVE });
    P('navigated live');

    /* 登录（JS 点击即可，登录不涉及音频） */
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
    P('== Supabase REST 连通性佐证：登录成功 = REST 可达 ==');

    /* ══ 挂钩插桩（进练习前）══ */
    await ev(`(()=>{
      window.__playLog=[]; window.__resumeLog=[]; window.__speakLog=[]; window.__fetchLog=[];
      window.__ttsfxArm = true;
      performance.clearResourceTimings();
      const _P = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function(...a){
        const p = _P.apply(this,a);
        if (p && p.then) p.then(
          ()=>window.__playLog.push({t:Date.now(),ok:true,src:String(this.currentSrc||'').slice(0,80)}),
          (e)=>window.__playLog.push({t:Date.now(),ok:false,err:e&&e.name||String(e),src:String(this.currentSrc||'').slice(0,80)})
        );
        return p;
      };
      if (window.AudioContext || window.webkitAudioContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        const _R = AC.prototype.resume;
        AC.prototype.resume = function(...a){
          const st0 = this.state;
          const p = _R.apply(this,a);
          if (p && p.then) p.then(
            ()=>window.__resumeLog.push({t:Date.now(),ok:true,from:st0,to:this.state}),
            (e)=>window.__resumeLog.push({t:Date.now(),ok:false,from:st0,err:e&&e.name||String(e)})
          );
          return p;
        };
      }
      if (window.speechSynthesis) {
        const _S = speechSynthesis.speak.bind(speechSynthesis);
        speechSynthesis.speak = (u)=>{ window.__speakLog.push({t:Date.now(),text:String(u.text||'').slice(0,30),rate:u.rate}); try{ _S(u) }catch(e){ window.__speakLog.push({t:Date.now(),err:String(e)}) } };
      }
      const _f = window.fetch.bind(window);
      window.fetch = function(u,...a){
        const s=String(u);
        if (s.includes('/functions/v1/tts')||s.includes('gettts')) (window.__fetchLog=window.__fetchLog||[]).push({t:Date.now(),head:decodeURIComponent(s).slice(0,110)});
        return _f(u,...a);
      };
      return 'armed';
    })()`);

    /* 页面内直测 TTS 代理连通性（真实 Chrome 网络栈） */
    const direct = await ev(`(async()=>{
      try{ const r=await fetch('https://khtpnbzfjggezlmnnsgt.supabase.co/functions/v1/tts?voice=zh-CN-YunjianNeural&rate=1.1&text=%E6%B5%8B%E8%AF%95');
        const b=await r.arrayBuffer(); return {status:r.status,type:r.headers.get('content-type'),bytes:b.byteLength};
      }catch(e){ return {err:String(e&&e.message||e)} }
    })()`);
    P('TTS proxy direct fetch (page ctx): ' + JSON.stringify(direct));

    /* trusted 点「随机」入口卡 */
    const entry = await tclick(centerOf(`
      const cards=[...document.querySelectorAll('.entry-card')];
      const c=cards.find(x=>/随机/.test(x.textContent))||cards[1]||cards[0];
      if(!c)return null; const r=c.getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2,label:'entry:'+c.textContent.trim().slice(0,16)}`));
    P('entry click(trusted): ' + JSON.stringify(entry));
    if (!(await waitSel('.q-card-wrap', 40000))) throw new Error('q-card-wrap 未出现');

    /* ── 拍A：答题期（题干自动朗读窗口）── T0 基线 = 进入练习时刻 */
    await sleep(3000);
    const tEnter = Date.now();
    await ev(`window.__T0BASE = ${tEnter}`);
    const snapRel = () => ev(`({
      fx:(window.__ttsfxLog||[]).map(x=>({dt:x.t-window.__T0BASE,seal:x.seal,phase:x.phase,show:x.showAnswer,idx:x.index,qid:x.qid,ttsOn:x.ttsOn})),
      stem:(window.__stemLoopLog||[]).map(x=>({dt:x.t-window.__T0BASE,key:x.key,blocked:x.blocked})),
      play:(window.__playLog||[]).map(x=>({dt:x.t-window.__T0BASE,ok:x.ok,err:x.err,src:x.src})),
      resume:(window.__resumeLog||[]).map(x=>({dt:x.t-window.__T0BASE,ok:x.ok,from:x.from,to:x.to,err:x.err})),
      speak:(window.__speakLog||[]).map(x=>({dt:x.t-window.__T0BASE,text:x.text,err:x.err})),
      fetch:(window.__fetchLog||[]).map(x=>({dt:x.t-window.__T0BASE,head:x.head})),
      ttsRes: performance.getEntriesByType('resource').filter(e=>/functions\\/v1\\/tts|gettts/.test(e.name)).map(e=>({start:Math.round(e.startTime),dur:Math.round(e.duration),size:e.transferSize,status:e.responseStatus}))
    })`);
    const snapA = await snapRel();
    P('SNAP-A(答题期·题干): ' + JSON.stringify(snapA));

    /* ── trusted 点「刷题/答题」切换 chip（文案=当前模式：未刷题时显示「✍️ 答题」）── */
    const chip = await tclick(centerOf(`
      const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('答题')&&x.getAttribute('aria-pressed')!==null);
      if(!b)return null; const r=b.getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2,label:'chip:'+b.textContent.trim()}`));
    P('browse chip click(trusted): ' + JSON.stringify(chip));
    await sleep(3500);
    const snapB = await snapRel();
    P('SNAP-B(切刷题拍): ' + JSON.stringify(snapB));

    /* ── trusted 点「下一题」 ── */
    const nxt = await tclick(centerOf(`
      const b=[...document.querySelectorAll('button')].filter(x=>x.textContent.includes('下一题')&&x.offsetParent!==null)[0];
      if(!b)return null; const r=b.getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2,label:'next'}`));
    P('next click(trusted): ' + JSON.stringify(nxt));
    await sleep(4000);
    const snapC = await snapRel();
    P('SNAP-C(刷题翻题拍): ' + JSON.stringify(snapC));

    P('CONSOLE(前40): ' + JSON.stringify(consoleEvts.slice(0, 40)));

    fs.writeFileSync(path.join(OUT, `${TAG}-metrics.json`), JSON.stringify({
      direct, snapA, snapB, snapC, consoleEvts: consoleEvts.slice(0, 80), log
    }, null, 2));
    ws.close();
    P('DONE');
  } finally {
    chrome.kill();
  }
  fs.writeFileSync(path.join(OUT, `${TAG}-log.txt`), log.join('\n'));
  console.log('PROBE DONE ' + TAG);
}

main().catch(e => {
  console.error('FATAL', e && e.message || e);
  process.exit(1);
});

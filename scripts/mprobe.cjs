/* mprobe.cjs — quiz-platform 移动端布局取证探针
 * 用法: node mprobe.cjs <W>x<H> <tag>   （CDP_PORT 环境变量指定调试端口）
 * 流程: spawn 系统 Chrome(headless) → CDP 连接 → 禁缓存 → 开 /#/
 *       → 等 entry-grid → 点「随机练习」入口 → 等 .q-card-wrap → 量测+截图
 * 输出: tools/out/<tag>-metrics.json + <tag>-shot.png + <tag>-log.txt
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.CDP_PORT || '9229';
const [viewW, viewH] = (process.argv[2] || '390x844').split('x').map(Number);
const TAG = process.argv[3] || 'probe';
const BASE = 'http://127.0.0.1:5173';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  const log = [];
  const P = (s) => { log.push(s); };

  const profile = path.join(OUT, `profile-${TAG}-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
    '--disable-gpu', `--user-data-dir=${profile}`, '--no-sandbox',
    '--window-size=460,940', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    // 等 CDP 端口就绪
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try { targets = await getJSON(`http://127.0.0.1:${PORT}/json`); if (targets && targets.length) break; } catch { }
    }
    if (!targets) throw new Error('CDP 端口未就绪');
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('无 page target');

    const WebSocket = require('ws');
    const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

    let msgId = 0;
    const pending = new Map();
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    const send = (method, params = {}) => new Promise((resolve) => {
      const id = ++msgId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    // 移动端视口（独立于窗口尺寸，精确控制）
    await send('Emulation.setDeviceMetricsOverride', {
      width: viewW, height: viewH, deviceScaleFactor: 2, mobile: true,
    });

    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', {
        expression: expr, returnByValue: true, awaitPromise: true,
      });
      if (r.result && r.result.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result && r.result.result ? r.result.result.value : undefined;
    };

    // 导航到首页
    await send('Page.navigate', { url: BASE + '/#/' });
    P('navigated /#/');

    // 等 entry-grid（boot 层/数据就绪）
    let ok = false;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      ok = await ev(`!!document.querySelector('.entry-grid')`).catch(() => false);
      if (ok) break;
    }
    P('entry-grid: ' + ok);
    if (!ok) throw new Error('entry-grid 未出现');

    // 点「随机练习」入口卡（含“随机”文案）
    const clicked = await ev(`(() => {
      const cards = [...document.querySelectorAll('.entry-card')];
      const card = cards.find(c => /随机/.test(c.textContent)) || cards[1] || cards[0];
      if (!card) return 'no-card';
      card.click();
      return card.textContent.trim().slice(0, 30);
    })()`);
    P('clicked entry: ' + JSON.stringify(clicked));

    // 等 .q-card-wrap 出现（跳转 /practice + 渲染）
    let wrapOK = false;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      wrapOK = await ev(`!!document.querySelector('.q-card-wrap')`).catch(() => false);
      if (wrapOK) break;
    }
    P('q-card-wrap: ' + wrapOK);
    if (!wrapOK) throw new Error('q-card-wrap 未出现');

    await sleep(1200); // 等入场动画与样式稳定

    // 量测
    const metrics = await ev(`(() => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top:+b.top.toFixed(1), bottom:+b.bottom.toFixed(1), left:+b.left.toFixed(1), right:+b.right.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1) };
      };
      const wrap = document.querySelector('.q-card-wrap');
      const cs = wrap ? getComputedStyle(wrap) : null;
      const stageEl = document.querySelector('.practice-stage');
      return {
        vw: innerWidth, vh: innerHeight,
        dpr: devicePixelRatio,
        scrollH: document.documentElement.scrollHeight,
        scrollW: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth > innerWidth,
        overflowY: document.documentElement.scrollHeight > innerHeight + 1,
        stage: rect('.practice-stage'),
        stageMinH: stageEl ? getComputedStyle(stageEl).minHeight : null,
        practiceTop: rect('.practice-top'),
        wrap: rect('.q-card-wrap'),
        wrapStyle: cs ? { w: cs.width, h: cs.height, mL: cs.marginLeft, mR: cs.marginRight, mT: cs.marginTop, mB: cs.marginBottom } : null,
      };
    })()`);
    P('metrics: ' + JSON.stringify(metrics, null, 1));

    // 派生：居中度
    const d = {};
    if (metrics.wrap) {
      d.hCenterOffset = +(((metrics.wrap.left + metrics.wrap.right) / 2) - metrics.vw / 2).toFixed(1);
      d.gapTopGroup = metrics.practiceTop ? +metrics.practiceTop.top.toFixed(1) : null;
      d.gapBottomCard = +(metrics.vh - metrics.wrap.bottom).toFixed(1);
      d.gapTopCard = +metrics.wrap.top.toFixed(1);
      if (metrics.practiceTop && metrics.wrap) {
        const gTop = metrics.practiceTop.top, gBot = metrics.vh - metrics.wrap.bottom;
        d.groupCenterOffset = +(gBot - gTop).toFixed(1); // >0 = 组偏上（下空隙大）
      }
    }
    fs.writeFileSync(path.join(OUT, `${TAG}-metrics.json`), JSON.stringify({ metrics, derived: d, log }, null, 2));

    // 截图
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
  console.log('MProbe DONE ' + TAG);
}

main().catch(e => {
  try { fs.appendFileSync(path.join(OUT, `${TAG}-log.txt`), '\nFATAL: ' + (e.stack || e.message)); } catch { }
  console.error('MProbe FATAL', e.message);
  process.exit(1);
});

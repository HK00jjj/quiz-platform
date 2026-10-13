/* verify-live.cjs — 线上部署核验：引用集比对 + sha256 全等 + 特征串
 * 用法: node verify-live.cjs <token>
 */
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOKEN = process.argv[2] || '';
const DIST = 'C:/Users/青丘白浅/Documents/QoderCN/2026-09-02/chat-1/app/dist';
const OUT = 'E:/workbuddy-cc/2026-09-17-20-16-34/tools/out';

function get(url, token, binary) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: token ? { Authorization: 'token ' + token, 'User-Agent': 'qp-verify' } : { 'User-Agent': 'qp-verify' } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode + ' ' + url)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout ' + url)); });
  });
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

(async () => {
  const log = [];
  const P = (s) => { log.push(s); console.log(s); };

  // 1. 线上 index.html
  const liveHtml = await get('https://hk00jjj.github.io/quiz-platform/index.html?_=' + Date.now(), null, false);
  const liveRefs = [...liveHtml.matchAll(/assets\/(index-[\w-]+\.(?:js|css))/g)].map(m => m[1]);
  P('live refs: ' + JSON.stringify(liveRefs));

  // 2. 本地 dist/index.html 引用集
  const localHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const localRefs = [...localHtml.matchAll(/assets\/(index-[\w-]+\.(?:js|css))/g)].map(m => m[1]);
  P('local refs: ' + JSON.stringify(localRefs));
  const refSame = JSON.stringify(liveRefs) === JSON.stringify(localRefs);
  P('refs identical: ' + refSame);

  // 3. 逐文件 sha256 对比（引用集 + 404.html）
  const allSame = [];
  const localAssets = fs.readdirSync(path.join(DIST, 'assets')).filter(f => /^index-[\w-]+\.(js|css)$/.test(f));
  P('local asset count: ' + localAssets.length);
  for (const f of localAssets) {
    const liveBuf = await get('https://hk00jjj.github.io/quiz-platform/assets/' + f + '?_=' + Date.now(), null, true);
    const localBuf = fs.readFileSync(path.join(DIST, 'assets', f));
    const same = sha256(liveBuf) === sha256(localBuf);
    allSame.push(same);
    P(f + ' sha256 identical: ' + same + (same ? '' : ` (live ${sha256(liveBuf).slice(0, 12)} vs local ${sha256(localBuf).slice(0, 12)})`));
  }
  const live404 = await get('https://hk00jjj.github.io/quiz-platform/404.html?_=' + Date.now(), null, false);
  P('404.html present: ' + (live404.includes('<div id="root">') ? 'yes(spa-fallback)' : 'NO!'));

  // 4. 特征串（minifier 会改写 inset/拆串，特征仅辅助；主证据 = 全量 sha256 全等）：
  //    在本地 dist 全部 chunk 中找到含 practice-play 的文件，逐个下载线上同名文件做 sha256 对比
  const featLocal = localAssets.filter(f => {
    const c = fs.readFileSync(path.join(DIST, 'assets', f), 'utf8');
    return c.includes('practice-play');
  });
  P('files containing "practice-play": ' + JSON.stringify(featLocal));
  let featLiveAll = featLocal.length > 0;
  for (const f of featLocal) {
    const liveBuf = await get('https://hk00jjj.github.io/quiz-platform/assets/' + f + '?_=' + Date.now(), null, true);
    const ok = sha256(liveBuf) === sha256(fs.readFileSync(path.join(DIST, 'assets', f)));
    P('practice-play carrier ' + f + ' live identical: ' + ok);
    featLiveAll = featLiveAll && ok;
  }

  const pass = refSame && allSame.every(Boolean) && live404.includes('<div id="root">') && featLiveAll;
  P(pass ? 'RESULT: VERIFY-LIVE PASS' : 'RESULT: VERIFY-LIVE FAIL');
  fs.writeFileSync(path.join(OUT, 'verify-live-result.txt'), log.join('\n') + '\n', 'utf8');
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e.message);
  fs.appendFileSync('E:/workbuddy-cc/2026-09-17-20-16-34/tools/out/verify-live-result.txt', 'FATAL ' + e.message + '\n');
  process.exit(2);
});

/* verify-src-readme.cjs — 复核 src 分支 README.md 是否为最新 HANDOFF.md
 * 用法: node verify-src-readme.cjs <token>
 */
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const TOKEN = process.argv[2];
const LOCAL = 'C:/Users/青丘白浅/Documents/QoderCN/2026-09-02/chat-1/HANDOFF.md';

function api(pathname) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      host: 'api.github.com',
      path: pathname,
      headers: { Authorization: 'token ' + TOKEN, 'User-Agent': 'qp-verify', Accept: 'application/vnd.github+json' },
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => resolve({ code: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  const localBuf = fs.readFileSync(LOCAL);
  const localSha = crypto.createHash('sha256').update(localBuf).digest('hex');
  console.log('local HANDOFF.md sha256:', localSha.slice(0, 16), 'len:', localBuf.length);

  const r = await api('/repos/HK00jjj/quiz-platform/contents/README.md?ref=src&t=' + Date.now());
  if (r.code !== 200) { console.log('API', r.code, r.body.slice(0, 200)); process.exit(1); }
  const j = JSON.parse(r.body);
  const remoteBuf = Buffer.from(j.content, 'base64');
  const remoteSha = crypto.createHash('sha256').update(remoteBuf).digest('hex');
  console.log('remote README.md  sha256:', remoteSha.slice(0, 16), 'len:', remoteBuf.length, '(git blob sha1:', j.sha + ')');
  console.log(remoteSha === localSha ? 'MATCH: remote README.md == local HANDOFF.md' : 'MISMATCH: still old or differs');
  console.log('remote tail check:', JSON.stringify(remoteBuf.toString('utf8').slice(-160)));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });

/* edge_ws_ab_proxy.cjs — 经国际出口代理复测微软 WS 握手 A/B（模拟 Vercel 境外网络）
 * ws 库经 HTTP CONNECT 隧道：createConnection 手动建隧道 */
const crypto = require('crypto');
const http = require('http');
const net = require('net');
const tls = require('tls');
const WebSocket = require('ws');

const PROXY = { host: '127.0.0.1', port: 50802 };
const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VER_FULL = '143.0.3650.75';
const VER_MAJOR = '143';
const WIN_EPOCH = 11644473600;
const HOST = 'speech.platform.bing.com';

function secMsGec() {
  let ticks = (Date.now() / 1000) + WIN_EPOCH;
  ticks -= ticks % 300;
  const big = BigInt(Math.round(ticks)) * 10000000n;
  return crypto.createHash('sha256').update(`${big}${TRUSTED}`, 'ascii').digest('hex').toUpperCase();
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function connectTunnel(host, port, cb) {
  const req = http.request({ host: PROXY.host, port: PROXY.port, method: 'CONNECT', path: `${host}:${port}`, headers: { Host: `${host}:${port}` } });
  req.on('connect', (res, socket) => {
    if (res.statusCode !== 200) { cb(new Error('CONNECT ' + res.statusCode)); return; }
    cb(null, socket);
  });
  req.on('error', cb);
  req.end();
}

function synthesize(text, voice, ratePct, withMuid) {
  return new Promise((resolve) => {
    connectTunnel(HOST, 443, (err, socket) => {
      if (err) return resolve({ ok: false, err: 'tunnel: ' + err.message });
      const url = `wss://${HOST}/consumer/speech/synthesize/readaloud/edge/v1`
        + `?TrustedClientToken=${TRUSTED}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=1-${VER_FULL}`;
      const headers = {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${VER_MAJOR}.0.0.0 Safari/537.36 Edg/${VER_MAJOR}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-WebSocket-Version': '13',
      };
      if (withMuid) headers['Cookie'] = `muid=${crypto.randomBytes(16).toString('hex').toUpperCase()};`;
      const ws = new WebSocket(url, { headers, createConnection: () => tls.connect({ socket, servername: HOST }) });
      const parts = []; let audioBytes = 0; let settled = false; let resInfo = null;
      const timer = setTimeout(() => finish(new Error('timeout')), 25000);
      function finish(err2) {
        if (settled) return; settled = true; clearTimeout(timer);
        try { ws.close(); } catch {}
        if (err2) return resolve({ ok: false, err: err2.message, info: resInfo });
        if (!audioBytes) return resolve({ ok: false, err: 'empty audio', info: resInfo });
        resolve({ ok: true, bytes: audioBytes });
      }
      ws.on('unexpected-response', (req, res) => {
        resInfo = { status: res.statusCode, date: res.headers.date, body: '' };
        let d = ''; res.on('data', c => d += c); res.on('end', () => { resInfo.body = d.slice(0, 120); finish(new Error('HTTP ' + res.statusCode)); });
      });
      ws.on('open', () => {
        ws.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`
          + JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } }));
        ws.send(`X-RequestId:${crypto.randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n`
          + `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>`
          + `<voice name='${voice}'><prosody pitch='+0Hz' rate='${ratePct >= 0 ? '+' : ''}${ratePct}%' volume='+0%'>${esc(text)}</prosody></voice></speak>`);
      });
      ws.on('message', (data, isBinary) => {
        if (!isBinary) { if (data.toString().includes('Path:turn.end')) finish(); return; }
        const buf = Buffer.from(data);
        if (buf.length > 2) {
          const headerLen = buf.readUInt16BE(0);
          const start = 2 + headerLen;
          if (start < buf.length) { parts.push(buf.subarray(start)); audioBytes += buf.length - start; }
        }
      });
      ws.on('error', (e) => finish(new Error(e.message)));
      ws.on('close', (c) => { if (audioBytes) finish(); else finish(new Error('ws closed ' + c)); });
    });
  });
}

(async () => {
  const text = '测试语音合成握手';
  const a = await synthesize(text, 'zh-CN-YunjianNeural', 10, false);
  console.log('A2 经代理·无muid(=Vercel现状):', JSON.stringify(a));
  await new Promise(r => setTimeout(r, 1200));
  const b = await synthesize(text, 'zh-CN-YunjianNeural', 10, true);
  console.log('B2 经代理·有muid(新版协议):  ', JSON.stringify(b));
})();

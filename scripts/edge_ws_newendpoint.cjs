/* edge_ws_newendpoint.cjs — 新端点 api.msedgeservices.com 验证（经国际出口）
 * F = 无muid  G = 有muid；成功判据 = 收到音频字节 */
const crypto = require('crypto');
const http = require('http');
const tls = require('tls');
const WebSocket = require('ws');

const PROXY = { host: '127.0.0.1', port: 50802 };
const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const VER = '143.0.3650.75';

function gec() {
  let t = (Date.now() / 1000) + 11644473600;
  t -= t % 300;
  const b = BigInt(Math.round(t)) * 10000000n;
  return crypto.createHash('sha256').update(b.toString() + TRUSTED, 'ascii').digest('hex').toUpperCase();
}
function tunnel(cb) {
  const r = http.request({ host: PROXY.host, port: PROXY.port, method: 'CONNECT', path: 'api.msedgeservices.com:443', headers: { Host: 'api.msedgeservices.com:443' } });
  r.on('connect', (res, s) => { if (res.statusCode !== 200) { cb(new Error('CONNECT ' + res.statusCode)); return; } cb(null, s); });
  r.on('error', cb); r.end();
}
function synth(text, voice, ratePct, withMuid) {
  return new Promise((resolve) => {
    tunnel((err, socket) => {
      if (err) return resolve({ ok: false, err: 'tunnel:' + err.message });
      const url = 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1'
        + '?Ocp-Apim-Subscription-Key=' + TRUSTED
        + '&ConnectionId=' + crypto.randomBytes(16).toString('hex')
        + '&Sec-MS-GEC=' + gec() + '&Sec-MS-GEC-Version=1-' + VER;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-WebSocket-Version': '13',
      };
      if (withMuid) headers['Cookie'] = 'muid=' + crypto.randomBytes(16).toString('hex').toUpperCase() + ';';
      const ws = new WebSocket(url, { headers, createConnection: () => tls.connect({ socket, servername: 'api.msedgeservices.com' }) });
      let bytes = 0, settled = false, info = null;
      const timer = setTimeout(() => fin(new Error('timeout')), 25000);
      function fin(e) {
        if (settled) return; settled = true; clearTimeout(timer);
        try { ws.close(); } catch {}
        if (e) return resolve({ ok: false, err: e.message, info });
        resolve({ ok: bytes > 0, bytes });
      }
      ws.on('unexpected-response', (q, res) => {
        info = { status: res.statusCode };
        let d = ''; res.on('data', c => d += c); res.on('end', () => { info.body = d.slice(0, 100); fin(new Error('HTTP ' + res.statusCode)); });
      });
      ws.on('open', () => {
        ws.send('X-Timestamp:' + new Date().toUTCString() + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n'
          + JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } }) + '\r\n');
        ws.send('X-RequestId:' + crypto.randomUUID().replace(/-/g, '') + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + new Date().toISOString() + '\r\nPath:ssml\r\n\r\n'
          + `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='${voice}'><prosody pitch='+0Hz' rate='${ratePct >= 0 ? '+' : ''}${ratePct}%' volume='+0%'>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</prosody></voice></speak>`);
      });
      ws.on('message', (d, bin) => {
        if (!bin) { if (d.toString().includes('Path:turn.end')) fin(); return; }
        const b = Buffer.from(d);
        if (b.length > 2) { const hl = b.readUInt16BE(0); const st = 2 + hl; if (st < b.length) bytes += b.length - st; }
      });
      ws.on('error', e => fin(new Error(e.message)));
      ws.on('close', () => { if (bytes) fin(); else fin(new Error('closed no audio')); });
    });
  });
}
(async () => {
  const f = await synth('新端点测试语音合成', 'zh-CN-YunjianNeural', 10, false);
  console.log('F 新端点·143版·无muid:', JSON.stringify(f));
  await new Promise(r => setTimeout(r, 1200));
  const g = await synth('新端点测试语音合成', 'zh-CN-YunjianNeural', 10, true);
  console.log('G 新端点·143版·有muid:', JSON.stringify(g));
})();

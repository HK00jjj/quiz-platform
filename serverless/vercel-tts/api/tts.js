/* ─────────────────────────────────────────────────────────────────────────────
   Vercel Serverless（Node 运行时）· 微软 Edge 神经音合成代理
   ─────────────────────────────────────────────────────────────────────────────
   为什么放在这里：Edge Read Aloud 是 WebSocket 接口，握手要带特定 Origin/UA/Pragma 头。
   · 浏览器里 JS 无法自定义 Origin → 直连必败（已实测）
   · Supabase Edge Runtime（Deno 隔离环境）**也不能**自定义 WS 头 → 升级被拒（已实测）
   · Node 运行时可以（ws 包支持 headers）→ 实测成功合成云健音频
   于是：手机 → Supabase 函数（国内可达）→ 本函数（服务端出网）→ 微软 → MP3 原路返回。

   参数：voice（白名单）· rate（倍率，默认 1.35）· text（≤300 字）
   返回：audio/mpeg
   ───────────────────────────────────────────────────────────────────────────── */
const crypto = require('crypto')
const WebSocket = require('ws')

const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const VER_FULL = '143.0.3650.75'      // 版本号过旧会被 403（踩过 130 的坑）
const VER_MAJOR = '143'
const WIN_EPOCH = 11644473600
const MAX_TEXT = 300

const ALLOWED = new Set([
  'zh-CN-YunjianNeural', 'zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural',
  'zh-CN-YunxiNeural', 'zh-CN-YunyangNeural', 'zh-CN-YunxiaNeural',
  'zh-CN-liaoning-XiaobeiNeural', 'zh-CN-shaanxi-XiaoniNeural',
  'zh-HK-HiuMaanNeural', 'zh-TW-HsiaoChenNeural'
])

function secMsGec() {
  let ticks = (Date.now() / 1000) + WIN_EPOCH
  ticks -= ticks % 300
  // 用 BigInt 避免 1.34e17 的浮点精度损失（GEC 必须逐位精确）
  const big = BigInt(Math.round(ticks)) * 10000000n
  return crypto.createHash('sha256').update(`${big}${TRUSTED}`, 'ascii').digest('hex').toUpperCase()
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function synthesize(text, voice, ratePct) {
  return new Promise((resolve, reject) => {
    const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
      + `?TrustedClientToken=${TRUSTED}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=1-${VER_FULL}`
    const ws = new WebSocket(url, {
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${VER_MAJOR}.0.0.0 Safari/537.36 Edg/${VER_MAJOR}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-WebSocket-Version': '13'
      }
    })
    const parts = []
    let audioBytes = 0
    let settled = false
    const timer = setTimeout(() => finish(new Error('synthesis timeout')), 22000)
    function finish(err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch {}
      if (err) return reject(err)
      if (!audioBytes) return reject(new Error('empty audio'))
      resolve(Buffer.concat(parts))
    }
    ws.on('open', () => {
      ws.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`
        + JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } }))
      ws.send(`X-RequestId:${crypto.randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n`
        + `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>`
        + `<voice name='${voice}'><prosody pitch='+0Hz' rate='${ratePct >= 0 ? '+' : ''}${ratePct}%' volume='+0%'>${esc(text)}</prosody></voice></speak>`)
    })
    ws.on('message', (data, isBinary) => {
      if (!isBinary) { if (data.toString().includes('Path:turn.end')) finish(); return }
      const buf = Buffer.from(data)
      if (buf.length > 2) {
        const headerLen = buf.readUInt16BE(0)          // 2 字节头长 + 头文本 + 音频负载
        const start = 2 + headerLen
        if (start < buf.length) { const payload = buf.subarray(start); parts.push(payload); audioBytes += payload.length }
      }
    })
    ws.on('error', (e) => finish(new Error('ws error: ' + e.message)))
    ws.on('close', (c) => { if (audioBytes) finish(); else finish(new Error('ws closed ' + c)) })
  })
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const u = new URL(req.url, 'https://x')
  const q = u.searchParams
  const text = (q.get('text') || '').trim()
  const voice = q.get('voice') || 'zh-CN-YunjianNeural'
  const rate = Number(q.get('rate') || '1.35')
  const key = q.get('k') || ''
  if (process.env.QP_TTS_KEY && key !== process.env.QP_TTS_KEY) {
    res.status(403).json({ error: 'forbidden' })
    return
  }
  if (!text) { res.status(400).json({ error: 'empty text' }); return }
  if (text.length > MAX_TEXT) { res.status(400).json({ error: 'text too long', max: MAX_TEXT }); return }
  if (!ALLOWED.has(voice)) { res.status(400).json({ error: 'voice not allowed' }); return }
  const ratePct = Math.max(-50, Math.min(100, Math.round(((isFinite(rate) ? rate : 1.35) - 1) * 100)))
  try {
    const mp3 = await synthesize(text, voice, ratePct)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', String(mp3.length))
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).send(mp3)
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) })
  }
}

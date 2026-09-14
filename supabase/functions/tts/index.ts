/* ─────────────────────────────────────────────────────────────────────────────
   Supabase Edge Function: tts —— 微软 Edge「大声朗读」神经音的**服务端代理**
   ─────────────────────────────────────────────────────────────────────────────
   为什么必须服务端：Edge Read Aloud 是 WebSocket 接口，其握手校验 Origin；
   浏览器里 Origin 由浏览器写死、JS 无法伪造 → 页面直连必败（2026-09-15 实测 ERROR）。
   服务端没有这个限制（Node/Deno 可自定义头），于是由本函数代取音频再回传给页面，
   页面用 <audio src=".../functions/v1/tts?voice=...&text=..."> 直接播放
   （媒体元素播放不受 CORS 约束，故无需读字节）。

   用途：让手机端也能听到与电脑 Edge 完全一致的音色（云健/晓晓/云希…），
   不再受"手机没装中文语音数据"的限制。

   部署：POST /v1/projects/<ref>/functions {slug,name,verify_jwt:false,entrypoint_path,body}
   （body 即本文件源码；verify_jwt:false 便于 <audio src> 免 token 播放）

   参数：voice（白名单内，默认云健）· rate（倍率，默认 1.35）· text（≤300 字）
   返回：audio/mpeg；失败返回 502 + JSON（客户端据此回落百度云端音）
   ───────────────────────────────────────────────────────────────────────────── */
const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
// 与 rany2/edge-tts 现行常量对齐（版本号过旧会 403——此前踩过 130 的坑）
const VER_FULL = '143.0.3650.75'
const VER_MAJOR = '143'
const WIN_EPOCH = 11644473600
const MAX_TEXT = 300

const ALLOWED = new Set([
  'zh-CN-YunjianNeural',   // 云健（桌面端默认，用户 2026-09-15 指定）
  'zh-CN-XiaoxiaoNeural',  // 晓晓
  'zh-CN-XiaoyiNeural',    // 晓伊
  'zh-CN-YunxiNeural',     // 云希
  'zh-CN-YunyangNeural',   // 云扬
  'zh-CN-YunxiaNeural',    // 云夏
  'zh-CN-liaoning-XiaobeiNeural',   // 东北官话
  'zh-CN-shaanxi-XiaoniNeural',     // 陕西官话
  'zh-HK-HiuMaanNeural',   // 粤语
  'zh-TW-HsiaoChenNeural'  // 台湾
])

async function secMsGec(): Promise<string> {
  let ticks = (Date.now() / 1000) + WIN_EPOCH
  ticks -= ticks % 300                       // 往下取整到 5 分钟
  const toHash = `${Math.round(ticks) * 10000000}${TRUSTED}`   // 100ns 单位
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(toHash))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* 合成一段文本，返回 MP3 字节。二进制帧格式：2 字节大端头长 + 头文本 + 音频负载，
   必须按头长裁剪，否则 MP3 头部混入协议文本（此前 Node 探测只数了字节没校验内容）。 */
function synthesize(text: string, voice: string, ratePct: number): Promise<Uint8Array> {
  return new Promise(async (resolve, reject) => {
    try {
      const gec = await secMsGec()
      const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
        + `?TrustedClientToken=${TRUSTED}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-${VER_FULL}`
      const ws = new WebSocket(url)
      const parts: Uint8Array[] = []
      let audioBytes = 0
      const timer = setTimeout(() => { try { ws.close() } catch { /* ignore */ } reject(new Error('synthesis timeout')) }, 25000)
      const done = (err?: Error) => {
        clearTimeout(timer)
        try { ws.close() } catch { /* ignore */ }
        if (err) return reject(err)
        if (!audioBytes) return reject(new Error('empty audio'))
        const total = parts.reduce((n, p) => n + p.length, 0)
        const out = new Uint8Array(total)
        let off = 0
        for (const p of parts) { out.set(p, off); off += p.length }
        resolve(out)
      }
      ws.onopen = () => {
        ws.send(`X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`
          + JSON.stringify({ context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' }, outputFormat: 'audio-24khz-48kbitrate-mono-mp3' } } } }))
        ws.send(`X-RequestId:${crypto.randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n`
          + `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>`
          + `<voice name='${voice}'><prosody pitch='+0Hz' rate='${ratePct >= 0 ? '+' : ''}${ratePct}%' volume='+0%'>${esc(text)}</prosody></voice></speak>`)
      }
      ws.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data === 'string') {
          if (ev.data.includes('Path:turn.end')) done()
          return
        }
        const raw = new Uint8Array(ev.data as ArrayBuffer)
        if (raw.length > 2) {
          const headerLen = (raw[0] << 8) | raw[1]
          const start = 2 + headerLen
          if (start < raw.length) { const payload = raw.slice(start); parts.push(payload); audioBytes += payload.length }
        }
      }
      ws.onerror = () => done(new Error('ws error'))
      ws.onclose = (e: CloseEvent) => { if (audioBytes) done(); else done(new Error('ws closed ' + e.code)) }
    } catch (e) { reject(e as Error) }
  })
}

Deno.serve(async (req: Request) => {
  const u = new URL(req.url)
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'public, max-age=86400'    // 同一句重复播报不再二次合成（手机流量友好）
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const voice = u.searchParams.get('voice') || 'zh-CN-YunjianNeural'
  const text = (u.searchParams.get('text') || '').trim()
  const rate = Number(u.searchParams.get('rate') || '1.35')
  if (!text) return new Response(JSON.stringify({ error: 'empty text' }), { status: 400, headers: { ...cors, 'content-type': 'application/json' } })
  if (text.length > MAX_TEXT) return new Response(JSON.stringify({ error: 'text too long', max: MAX_TEXT }), { status: 400, headers: { ...cors, 'content-type': 'application/json' } })
  if (!ALLOWED.has(voice)) return new Response(JSON.stringify({ error: 'voice not allowed' }), { status: 400, headers: { ...cors, 'content-type': 'application/json' } })
  const ratePct = Math.max(-50, Math.min(100, Math.round(((isFinite(rate) ? rate : 1.35) - 1) * 100)))
  try {
    const mp3 = await synthesize(text, voice, ratePct)
    return new Response(mp3, { headers: { ...cors, 'content-type': 'audio/mpeg', 'content-length': String(mp3.length) } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 502, headers: { ...cors, 'content-type': 'application/json' } })
  }
})

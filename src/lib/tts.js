/* 解析语音播报（Web Speech API 封装，2026-09-13 增量）
   ─────────────────────────────────────────────────────
   零依赖，只做三件事：

   ① 切块串行：Chrome 桌面版长文本朗读 ~15 秒静默中断，且中断后整个
      speechSynthesis 卡死到浏览器重启（Stack Overflow 21947730 / 57667357，
      多方独立复现）。修法只能切块——Android 的 pause() 等于 cancel()，
      社区流行的「每 14s pause/resume 保活」在安卓必炸，故不采用。
      切块上限按【时长】算而不是字符数：中文 TTS ≈4~5 字/秒，50 字/块在
      1.0~1.25 倍速下 ≤10s，远离 15s 阈值（网上「200 字符」的切块经验来自
      英文文本，中文不能照抄）。

   ② 选声：按公开评测事实排优先级——微软神经语音是中文自然度天花板
      （盲测中 Azure 系稳居前二：晓晓 Xiaoxiao MOS≈4.6 全能温暖向、
      云希 Yunxi≈4.5 解说向；Google TTS 中文明显偏硬，盲测 5.5 分垫底）。
      **可用性事实（2026-09-13 真机对拍本机 Chrome/Edge）**：
        · Chrome 只有 3 个中文音（Huihui/Kangkang/Yaoyao，Windows 老 SAPI5，电子感强），
          无任何神经音 —— 想听"晓晓"必须用 Edge；
        · Edge 暴露 17 个中文音，含晓晓/云希/云扬/晓伊/云夏等 Online (Natural) 神经音
          （还有粤语 zh-HK、台湾 zh-TW、东北/陕西官话等方言变体，需排除）。
      Google 网络音排在本地 SAPI 之前：有据（AI 语音设计指南：未指定模型时浏览器会降级到
      最基础的离线 SAPI，产生强烈机器感；Edge Online 神经音与 Chrome Google 语音最接近真人）。

   ③ 清理：stopSpeak 必须在切题/卸载/静音时调用，否则上一题的声音会串进
      下一题（speechSynthesis 是浏览器全局单例，不随组件卸载而停）。 */

/* 播报语速（用户钦定 1.25；1.2~1.5 是"熟悉内容复听"的舒适区） */
export const TTS_RATE = 1.25

const LS_KEY = 'qp.tts.enabled'

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/* 播报开关（默认开：2026-09-13 用户裁决——点开解析自动播，🔊 一键可关） */
export function ttsEnabled() {
  try { return window.localStorage.getItem(LS_KEY) !== '0' } catch { return true }
}
export function setTtsEnabled(on) {
  try { window.localStorage.setItem(LS_KEY, on ? '1' : '0') } catch { /* 隐私模式等：仅本次会话生效 */ }
  if (!on) stopSpeak()
}

/* 播报前清洗：emoji/装饰符直接删；箭头与换行读成停顿，
   避免引擎把「→」念成「右箭头」。/markdown 记号一并剥掉。 */
export function cleanSpeechText(raw) {
  const s0 = String(raw ?? '').trim()
  if (!s0) return ''                               // 纯空白先归空，防止被换行转换洗成一个孤立「，」
  return s0
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[*_`#>|]/g, '')
    .replace(/→/g, '，')
    .replace(/\s*\n+\s*/g, '，')
    .replace(/，{2,}/g, '，')
    .trim()
}

/* 按句读切块（≤max 字/块）。先在强句读（。！？；!?;）断句，短句就近合并进同块；
   单句超长再在次级断点（，、：）回退切，实在没有断点才硬切。
   返回的块拼起来 = 清洗后的原文（无空格文本下严格成立）。 */
export function chunkSpeechText(raw, max = 50) {
  const text = cleanSpeechText(raw)
  if (!text) return []
  const chunks = []
  let buf = ''
  const flush = () => { const t = buf.trim(); if (t) chunks.push(t); buf = '' }
  for (let sent of text.split(/(?<=[。！？；!?;])/g)) {
    sent = sent.trim()
    if (!sent) continue
    while (sent.length > max) {                      // 单句超长：在次级断点回退切
      const head = sent.slice(0, max)
      let cut = Math.max(head.lastIndexOf('，'), head.lastIndexOf('、'),
        head.lastIndexOf('：'), head.lastIndexOf(','))
      if (cut < Math.floor(max / 3)) cut = max - 1   // 找不到像样断点 → 硬切
      flush()
      chunks.push(sent.slice(0, cut + 1).trim())
      sent = sent.slice(cut + 1)
    }
    if (!sent) continue
    if (buf && buf.length + sent.length > max) flush()
    buf += sent
  }
  flush()
  return chunks
}

/* 选声优先级（依据见文件头注释②，2026-09-13 晚真机对拍后修正）：
   ① 晓晓 Natural（MOS≈4.6 全能） → ② 云希 Natural（≈4.5 解说） →
   ③ 其他 Online/Neural 神经音 → ④ Google 网络音 →
   ⑤ 微软本地 SAPI（Huihui/Yaoyao/Kangkang，电子感强） → ⑥ 任意普通话 → ⑦ null

   为什么 Google 排在本地 SAPI 之前：AI 语音设计指南明确「未指定模型时浏览器会降级调用
   系统最基础的离线语音(如 Windows 旧版 SAPI5)，产生强烈电子机器感；Edge 的 Online 神经音
   与 Chrome 的 Google 语音音质最接近真人，应优先指名」；另有 TTS 工具文档把"Windows 上
   声音机械"直接归因于老 SAPI 并建议改用 Edge。修正前实测在 Chrome 里选中了 Huihui（机械），
   而当时 Google 普通话可选 —— 顺序错了。

   语种收口：只收普通话（zh-CN / zh-Hans），**排除粤语 zh-HK、台湾 zh-TW、方言
   zh-CN-liaoning / zh-CN-shaanxi 等**——/^zh/ 会把它们一起捞进来，念出来是另一种腔调。
   命名收口：Edge 里语音名是**中文本地化**的（"Microsoft 晓晓 Online (Natural)"），
   只匹配 xiaoxiao/yunxi 这类拉丁名会全部落空，故拉丁名与中文名一起匹配。 */
const ZH_MANDARIN = /^zh[-_]?(CN|Hans)/i
const ZH_VARIANT = /[-_](HK|TW|MO)|[-_](liaoning|shaanxi|sichuan|henan|shanxi)(\b|$)/i
const isNatural = (v) => /natural|neural/i.test(v.name)
export function pickVoice(voices) {
  const all = (voices || []).filter((v) => /^zh/i.test(v.lang))
  if (!all.length) return null
  const mandarin = all.filter((v) => ZH_MANDARIN.test(v.lang) && !ZH_VARIANT.test(v.lang))
  const pool = mandarin.length ? mandarin : all      // 一台机器只有粤语/台湾音时也不至于无音可用
  return pool.find((v) => /xiaoxiao|晓晓/i.test(v.name) && isNatural(v))
    || pool.find((v) => /yunxi|云希/i.test(v.name) && isNatural(v))
    || pool.find((v) => isNatural(v) && !/multilingual/i.test(v.name))
    || pool.find((v) => /google/i.test(v.name))
    || pool.find((v) => /xiaoxiao|yunxi|yunyang|yaoyao|huihui|kangkang|tingting|meijia|晓晓|云希|云扬|瑶瑶|慧慧|康康|婷婷/i.test(v.name))
    || pool[0]
}

/* voices 在 Chrome/Edge 都是异步加载（首帧 getVoices() 常为空）。
   若此时不等待就 speak，utterance 会不带 voice → 浏览器按 lang 自选默认音
   （Windows 上默认多半就是 Huihui 这类机械音），"沉浸感最强"的选声会静默落空。
   故首次取不到语音时等 voiceschanged，最多 800ms，宁可晚说半秒也别念错音色。 */
function waitVoice(maxMs = 800) {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve(null)
    const s = window.speechSynthesis
    let done = false
    const finish = () => {
      if (done) return
      done = true
      try { s.removeEventListener('voiceschanged', finish) } catch { /* older impl */ }
      resolve(pickVoice(s.getVoices() || []))
    }
    if (pickVoice(s.getVoices() || [])) return finish()
    try { s.addEventListener('voiceschanged', finish) } catch { setTimeout(finish, maxMs) }
    setTimeout(finish, maxMs)
  })
}

/* 给 UI 用的选声说明：当前环境若没有神经音，提示改用 Edge（有据：Edge 独占 Online 神经音） */
export function voiceNote() {
  if (!ttsSupported()) return '当前浏览器不支持语音合成'
  const v = pickVoice(window.speechSynthesis.getVoices() || [])
  if (!v) return '语音列表尚未加载，首句可能用系统默认音'
  return isNatural(v) ? `语音：${v.name}` : `语音：${v.name}（本机无神经音，用 Edge 打开可听到晓晓自然语音）`
}

/* 串行播报。token 防竞态：新一轮 speak/stopSpeak 递增 token，
   旧块 onend 链发现 token 变了就自动断链，不会把新一轮的块接在后面。 */
let token = 0
export function stopSpeak() {
  token++
  try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
}
export async function speak(raw, { rate = TTS_RATE, onDone } = {}) {
  if (!ttsSupported()) return false
  const chunks = chunkSpeechText(raw)
  if (!chunks.length) return false
  const my = ++token
  const synth = window.speechSynthesis
  /* 先拿到语音再开口（见 waitVoice 注释）；等待期间若被静音/新播报取代，token 已变，直接放弃 */
  const voice = await waitVoice()
  if (my !== token) return false
  let i = 0
  const next = () => {
    if (my !== token) return                        // 已被新播报/静音取代：断链
    if (i >= chunks.length) { if (onDone) onDone(); return }
    const u = new SpeechSynthesisUtterance(chunks[i++])
    if (voice) u.voice = voice
    u.lang = voice?.lang || 'zh-CN'
    u.rate = rate
    u.onend = next
    u.onerror = next                                // cancel 在部分浏览器走 onerror，token 校验兜住
    try { synth.speak(u) } catch { if (onDone) onDone() }
  }
  next()
  return true
}

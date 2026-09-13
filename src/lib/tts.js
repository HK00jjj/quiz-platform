/* 解析语音播报（Web Speech API 封装，2026-09-13 增量）
   ─────────────────────────────────────────────────────
   零依赖，只做三件事：

   ① 切块串行：Chrome 桌面版长文本朗读 ~15 秒静默中断，且中断后整个
      speechSynthesis 卡死到浏览器重启（Stack Overflow 21947730 / 57667357，
      多方独立复现）。修法只能切块——Android 的 pause() 等于 cancel()，
      社区流行的「每 14s pause/resume 保活」在安卓必炸，故不采用。
      切块上限按【时长】算而不是字符数：中文 TTS ≈4~5 字/秒，50 字/块在
      1.0~1.5 倍速下 ≤10s，远离 15s 阈值（网上「200 字符」的切块经验来自
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

/* 播报语速（用户 2026-09-13 晚定稿：**自定义、不要预设档位**）。
   默认 1.35×（用户 1.25 → 1.5 → 1.35 三轮实测后的取值；中文 TTS 基线 ≈4~5 字/秒，
   1.35× ≈ 200~220 wpm 属"熟悉内容复听"舒适区；2.0× 以上理解率下滑——
   Murphy/Hoover/Ritter 2018：叙述文本 2.5× 起理解率骤降）。
   调速与开关合并为一个「声音」控件（解析区点开 → 滑块无级调 + 开关），
   0.5~2.0 之间任意值，0.05 步进，落 localStorage `qp.tts.rate`。 */
export const TTS_RATE = 1.35
export const RATE_MIN = 0.5
export const RATE_MAX = 2
export const RATE_STEP = 0.01   // 滑块步进：真机实测 0.05 会让 1.42 被吸附成 1.40（网格 0.5+0.05n）
const LS_RATE = 'qp.tts.rate'
export function clampRate(v) {
  const n = typeof v === 'number' ? v : parseFloat(v)
  if (!isFinite(n)) return TTS_RATE
  return Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(n * 100) / 100))
}
/* 显示用：去掉浮点尾巴（1.4× 而不是 1.3999999×） */
export function fmtRate(v) {
  return String(Math.round(clampRate(v) * 100) / 100)
}
export function ttsRate() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_RATE) : null
    if (raw === null || raw === '') return TTS_RATE
    return clampRate(raw)
  } catch { return TTS_RATE }   // 隐私模式等：用默认
}
export function setTtsRate(v) {
  const val = clampRate(v)
  try { window.localStorage.setItem(LS_RATE, String(val)) } catch { /* ignore */ }
  /* 只落盘，不在这里停声：正在播报时由调用方防抖重播（内部会 cancel）；
     暂停中则连现场都不动——继续时 resumeSpeak 用新语速从被打断的那块接读。 */
  return val
}

const LS_KEY = 'qp.tts.enabled'

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/* 播报开关（默认开）。**只负责记忆偏好，不再顺手停声**——
   开关的停声语义已升级为"暂停在原处、继续接着读"（见 pauseSpeak/resumeSpeak），
   由调用方决定调 pause 还是 stop。 */
export function ttsEnabled() {
  try { return window.localStorage.getItem(LS_KEY) !== '0' } catch { return true }
}
export function setTtsEnabled(on) {
  try { window.localStorage.setItem(LS_KEY, on ? '1' : '0') } catch { /* 隐私模式等：仅本次会话生效 */ }
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

/* 块长按音色分流：
   · Edge/微软 Online 神经音（云端长文本引擎，Read Aloud 整页朗读同源）→ 180 字/块，
     少切几刀 = 少几次"块边界"= 少几次音色被换的机会；
   · 其余（Chrome Google 网络音 / 本地 SAPI）→ 50 字/块，
     规避 Chrome 桌面长文 ~15s 静默中断（实证阈值 200~300 字符是英文经验，
     中文按 4~5 字/秒折算才安全）。 */
export function chunkMaxFor(voice) {
  const onlineNatural = !!voice && /natural|neural/i.test(voice.name) && voice.localService === false
  return onlineNatural ? 180 : 50
}

/* 串行播报会话。三个抗坑措施（均有公开记录）：
   ① **保活引用**：Chromium 长期 bug——SpeechSynthesisUtterance 在说完前被 GC 会丢
      voice/丢事件，表现为"开头正确、后面变成默认音"。存进 live 数组即可保活。
   ② **块间 120ms 间隙**：背靠背 speak 会让引擎忽略第二句起的 voice
      （SO 36377342 标题就是"第一次女声、第二次男声"）。
   ③ **每次现取 voice**：不缓存 voice 对象（列表 voiceschanged 后会换新对象，
      旧对象可能失效），每块从当前 getVoices() 重新匹配同一音色。
   另加看门狗：Chrome+Google 网络音有"事件不触发、卡在 speaking"的老 bug，
   估算时长+4s 仍无进展就推进下一块，避免整段播报无声挂死。
   token 防竞态：新一轮 speak/stopSpeak 递增 token，旧链自动作废。

   **暂停/续播（2026-09-13 晚第五轮，用户指令"播报开和关都暂停在原处、不重复读"）**：
   播报状态挂在模块级 session 上（chunks + 读到第几块 + 暂停标记），所以开关关掉
   不等于丢掉进度：
   · 桌面 Chrome/Edge 的 pause() 是真暂停 → 恢复时 resume() 原地续上（一个字不重读）；
   · Android 的 pause() 等于 cancel（社区实证）→ 运行时用 `synth.paused` 探测，
     不成立就退回"记住块位置"策略：恢复时从被打断的那一块重新开口（最多重读一句，
     绝不从头重读整段）。 */
let token = 0
let session = null      // { chunks, i, paused, nativePaused, done }
export function stopSpeak() {
  token++
  session = null
  try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
}
/* 暂停在原处：能原生暂停就原生暂停，不能就记住块位置并断链 */
export function pauseSpeak() {
  if (!ttsSupported() || !session || session.done) return false
  const synth = window.speechSynthesis
  session.paused = true
  session.nativePaused = false
  try { synth.pause() } catch { /* ignore */ }
  if (synth.paused) { session.nativePaused = true; return true }
  token++                                   // 原生暂停不可用：断链，位置留在 session.i
  try { synth.cancel() } catch { /* ignore */ }
  return false
}
/* 继续：原生暂停的续上；否则从被打断的那一块接读（新语速即时生效） */
export function resumeSpeak() {
  if (!ttsSupported()) return false
  const synth = window.speechSynthesis
  const s = session
  if (!s || !s.paused || s.done) return false
  if (s.nativePaused && (synth.speaking || synth.pending)) {
    try { synth.resume() } catch { /* ignore */ }
    s.paused = false
    return true
  }
  const rest = sliceForResume(s)
  session = null
  return runChunks(rest, ttsRate()) !== false
}
/* 纯函数（可回归）：被打断块 + 其后的剩余块；i 已自增，故取 i-1 起 */
export function sliceForResume(s) {
  if (!s || !s.chunks || !s.chunks.length) return []
  return s.chunks.slice(Math.max(0, s.i - 1))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CHUNK_GAP = 120
function runChunks(chunks, rate, onDone, my) {
  if (!chunks || !chunks.length) return false
  const tok = my === undefined ? ++token : my
  const synth = window.speechSynthesis
  const sess = { chunks, i: 0, paused: false, nativePaused: false, done: false }
  session = sess
  const live = []                       // ① 保活：防 GC 丢 voice
  let gapTimer = null, watchdog = null
  const clearTimers = () => { clearTimeout(gapTimer); clearTimeout(watchdog) }
  const armWatchdog = (text) => {
    const est = Math.max(5000, (text.length / 4) * 1000) + 4000
    clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      if (tok !== token) return
      if (sess.paused) return armWatchdog(text)                     // 暂停中：不推进
      if (synth.speaking || synth.pending) return armWatchdog(text) // 还在说，继续等
      gapTimer = setTimeout(next, CHUNK_GAP)                        // 事件没来且已停 → 推进
    }, est)
  }
  const next = () => {
    if (tok !== token || sess.paused) return                        // 被取代/暂停：断链
    if (sess.i >= chunks.length) { clearTimers(); live.length = 0; sess.done = true; if (onDone) onDone(); return }
    const text = chunks[sess.i++]
    const v = pickVoice(synth.getVoices() || [])                    // ③ 每块现取
    const u = new SpeechSynthesisUtterance(text)
    if (v) { u.voice = v; u.lang = v.lang } else u.lang = 'zh-CN'
    u.rate = rate
    live.push(u)                                                    // ① 保活
    if (live.length > 60) live.shift()
    u.onend = () => { if (tok === token) gapTimer = setTimeout(next, CHUNK_GAP) }   // ② 块间间隙
    u.onerror = () => { if (tok === token) gapTimer = setTimeout(next, CHUNK_GAP) }
    try { synth.speak(u) } catch { clearTimers(); if (onDone) onDone() }
    armWatchdog(text)
  }
  next()
  return true
}
export async function speak(raw, { rate = ttsRate(), onDone } = {}) {
  if (!ttsSupported()) return false
  const my = ++token
  const synth = window.speechSynthesis
  /* 先拿到语音再开口（见 waitVoice 注释）；等待期间若被静音/新播报取代，直接放弃 */
  const voice = await waitVoice()
  if (my !== token) return false
  const chunks = chunkSpeechText(raw, chunkMaxFor(voice))
  if (!chunks.length) return false
  /* 新一轮开口前一律 cancel：旧链可能正卡在块间隙（此时 speaking/pending 都是 false，
     只看状态就漏 cancel），而 Edge 的云端神经音 cancel 落地有几拍延迟——不 cancel
     就会新旧两条链叠着说。cancel 后留 120ms 让引擎状态复位再开口。 */
  try { synth.cancel() } catch { /* ignore */ }
  session = null
  await sleep(CHUNK_GAP)
  if (my !== token) return false
  return runChunks(chunks, rate, onDone, my)
}

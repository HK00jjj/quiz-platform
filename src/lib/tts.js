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
      注意可用性：带 "Online (Natural)" 的神经音只有 Edge 桌面版开箱即得；
      Chrome 下要在 Windows「语言设置→语音」里装 Neural 语音包才有，
      否则回落到老 SAPI 本地音（Huihui/Yaoyao 等，较机械）。

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

/* 选声优先级（依据见文件头注释②）：
   晓晓(Natural) > 云希(Natural) > 其他 Natural/Neural 网络音 >
   常见微软本地音（晓晓/云希/云扬/瑶瑶/辉辉/康康/婷婷/美佳）>
   任意 zh 音 > null（交浏览器按 lang 默认） */
export function pickVoice(voices) {
  const zh = (voices || []).filter((v) => /^zh/i.test(v.lang))
  if (!zh.length) return null
  return zh.find((v) => /xiaoxiao/i.test(v.name) && /natural/i.test(v.name))
    || zh.find((v) => /yunxi/i.test(v.name) && /natural/i.test(v.name))
    || zh.find((v) => /natural|neural/i.test(v.name))
    || zh.find((v) => /xiaoxiao|yunxi|yunyang|yaoyao|huihui|kangkang|tingting|meijia/i.test(v.name))
    || zh.find((v) => v.localService)
    || zh[0]
}

/* 串行播报。token 防竞态：新一轮 speak/stopSpeak 递增 token，
   旧块 onend 链发现 token 变了就自动断链，不会把新一轮的块接在后面。 */
let token = 0
export function stopSpeak() {
  token++
  try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
}
export function speak(raw, { rate = TTS_RATE, onDone } = {}) {
  if (!ttsSupported()) return false
  const chunks = chunkSpeechText(raw)
  if (!chunks.length) return false
  const my = ++token
  const synth = window.speechSynthesis
  /* voices 在用户手势之后取（点开解析才播），Chrome 异步加载此时基本已就绪；
     取不到就传 null，浏览器按 utterance.lang 自选默认音 */
  const voice = pickVoice(synth.getVoices() || [])
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

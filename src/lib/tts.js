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

/* 能力探测（2026-09-13 晚收严）：不能只看 `'speechSynthesis' in window` ——
   部分安卓 WebView/内置浏览器会挂一个**空壳属性**（存在但 speak 不是函数），
   那样控件会渲染出来却点了没反应。要求属性存在且 speak 可调用。 */
export function ttsSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis
    && typeof window.speechSynthesis.speak === 'function'
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
/* 移动端手势解锁（2026-09-13 晚第六轮，配合"手机版为什么没有"排查）：
   浏览器普遍要求**第一次 speak() 落在用户手势的调用栈里**，iOS Safari 尤其严格；
   而我们的自动播报发生在"查看解析"点击后 520ms（等蜡封动画），已脱离手势 →
   手机上会出现"点了没声音"。做法：在点击处理函数里同步播一个 0 音量空 utterance
   解锁引擎，之后再排队真正的解析播报。幂等，多调无害。 */
let unlocked = false
export function unlockSpeech() {
  if (!ttsSupported() || unlocked) return false
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    u.rate = 2
    window.speechSynthesis.speak(u)
    unlocked = true
    return true
  } catch { return false }
}

/* 播报读法归一化（2026-09-14 晚新增，修"播报有错别音"）——**只作用于送引擎的副本，
   屏幕上的原文一个字不改**（题干/选项/解析的显示与判分完全不受影响）。
   动机（全库送读文本取证，`tts-text-audit.mjs`）：
   · 单位/数学符号 4811 处（Ω ± ≈ × 或 ℃）→ 中文引擎读法不统一，"3750Ω" 有的念"欧"、
     有的念字母 O；
   · 希腊字母 1686 处（τ φ η β）→ 中文引擎对希腊字母基本靠猜；
   · 拉丁缩写 14027 处（PLC/CPU/LVRT）→ 逐字母与否因引擎而异。
   处理原则：**能无歧义读成中文的一律读中文**；有歧义的（缩写）不强改，避免改坏语义。 */
const GREEK_READ = {
  α: '阿尔法', β: '贝塔', γ: '伽马', δ: '德尔塔', Δ: '德尔塔', ε: '艾普西龙',
  η: '伊塔', θ: '西塔', λ: '兰姆达', μ: '缪', ν: '纽', π: '派', ρ: '柔',
  σ: '西格玛', Σ: '西格玛', τ: '套', φ: '斐', ω: '欧米伽', Ω: '欧姆', Ψ: '普赛', ψ: '普赛'
}
export function normalizeSpeech(raw) {
  let s = String(raw ?? '')
  /* ① 复合单位先处理（顺序敏感：kVA/kvar 必须在 kV 之前，否则 "kV·A" 会被拆成"千伏·A"） */
  s = s.replace(/kV\s?[·・]?\s?A\b/g, '千伏安').replace(/kvar\b/gi, '千乏')   // 注意不要用 \bkvar（数字后无词边界）
  s = s.replace(/([kK])\s?Ω/g, '千欧').replace(/([mM])\s?Ω/g, '兆欧')
  s = s.replace(/μ\s?F/g, '微法').replace(/μ\s?A/g, '微安').replace(/μ\s?s/g, '微秒')
    .replace(/μ\s?H/g, '微亨').replace(/μ\s?m/g, '微米')
  s = s.replace(/Ω/g, '欧姆')
  s = s.replace(/(℃|°\s?C)/g, '摄氏度').replace(/℉/g, '华氏度')
  s = s.replace(/([kK])\s?V\b/g, '千伏').replace(/kV/g, '千伏').replace(/[mM]\s?A\b/g, '毫安')
  s = s.replace(/kW|KW/g, '千瓦').replace(/kWh/g, '千瓦时').replace(/Hz/g, '赫兹')
    .replace(/kHz/g, '千赫兹').replace(/MHz/g, '兆赫兹')
  /* ② 数学/关系符号 */
  s = s.replace(/≥/g, '大于等于').replace(/≤/g, '小于等于').replace(/≠/g, '不等于')
    .replace(/≈/g, '约等于').replace(/±/g, '正负').replace(/×/g, '乘').replace(/÷/g, '除以')
    .replace(/√/g, '根号').replace(/∞/g, '无穷大').replace(/∅/g, '空集')
  /* ②-b 真实题库原文里高频出现的"数学排版符号"（seq 181/347 实证）：
     U+2212 减号、上标 ²/³、间隔号 ·、等号 =、变量下标 U_F。
     不处理的话引擎会念成"下划线 F"、"零的二次方"或直接吞掉。 */
  s = s.replace(/\u2212/g, '减').replace(/[–—]/g, '，')
  s = s.replace(/([0-9A-Za-z)）])²/g, '$1平方').replace(/([0-9A-Za-z)）])³/g, '$1立方')
  s = s.replace(/([A-Za-z])_\{?([A-Za-z0-9]+)\}?/g, '$1 $2')          // U_F → U F（不念"下划线"）
  s = s.replace(/([0-9A-Za-z)）])\s*=\s*(?=[0-9A-Za-z(（])/g, '$1 等于 ')   // 公式里的 = → 等于
  /* ③ 希腊字母（工程口语常用译名） */
  s = s.replace(/[Α-Ωα-ω]/g, (c) => GREEK_READ[c] ?? c)
  /* ④ 斜杠组合：AC/DC、I/O 之类中文引擎会念成"斜杠"或吞掉，统一读成"或/斜杠"里更稳的"斜杠" */
  s = s.replace(/([A-Za-z0-9])\s*\/\s*([A-Za-z0-9])/g, '$1 或 $2')
  return s
}

/* 播报前清洗（2026-09-14 晚扩写）：
   ① 剥掉**内部标注**：`[错因:…]`（规则 v6.9 的可选标签，全库 1475 处）绝不该被念出来；
   ② 段落标签 `【概念】`（全库 9318 处）转成"概念，"——保留信息、去掉会被念成"六角括号"的符号；
   ③ `{}` 占位残留剥成其内容（空占位直接删），避免念"大括号"；
   ④ emoji/装饰符、markdown 记号、箭头、换行按原规则处理。 */
export function cleanSpeechText(raw) {
  const s0 = String(raw ?? '').trim()
  if (!s0) return ''                               // 纯空白先归空，防止被换行转换洗成一个孤立「，」
  return normalizeSpeech(s0)
    .replace(/\s*\[[^\]]*[:：][^\]]*\]/g, '')      // [错因:概念缺失] 等内部标注
    .replace(/【([^】]{1,8})】/g, '$1，')           // 【概念】→ 概念，
    .replace(/\{([^{}]*)\}/g, '$1')                // 占位符只留内容（空占位＝删）
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[*_`#>|]/g, '')
    .replace(/→/g, '，')
    .replace(/\s*\n+\s*/g, '，')
    .replace(/，{2,}/g, '，')
    .trim()
}

/* 切块边界保护（2026-09-14 晚新增）：把候选断点往后挪，避免把"词"切断。
   全库实测被抓到的硬 bug（`tts-text-audit.mjs`）：
   · 拉丁词被切两半 13 处：`…与LOPA（La` | `yer of Prote…`（Layer of Protection）；
   · 数字被切碎 27 处：`…= 375` | `0Ω，即3.75kΩ`（3750Ω 被念成"三七五"+"零欧姆"）；
   · 括号跨块 6 处：`…0.9` | `)≥79.8A`。
   规则：断点处若"右侧是拉丁字母/数字，或左侧是拉丁字母"，或**括号不平衡**，则把断点前移到
   该词/数字的起点；找不到安全位置就继续往后找下一个标点（最多多看 12 字，仍不行则按原逻辑硬切）。 */
function safeCutIndex(text, cut, max) {
  const isWordChar = (c) => /[A-Za-z0-9.]/.test(c || '')
  const unbalanced = (s) => (s.split('（').length - s.split('）').length) !== 0
    || (s.split('(').length - s.split(')').length) !== 0
  /* 断点还必须满足：左边不留悬挂算子/左括号，右边不出现孤立的右括号 */
  const okCut = (k) => {
    const left = text[k - 1], right = text[k]
    if (isWordChar(left) && isWordChar(right)) return false
    if (unbalanced(text.slice(0, k))) return false
    if (/[=（(+\-×÷·]$/.test(text.slice(0, k))) return false
    if (/^[)）]/.test(text.slice(k))) return false
    return true
  }
  for (let k = cut; k > 0 && k > cut - 24; k--) if (okCut(k)) return k
  for (let k = cut + 1; k < Math.min(text.length, cut + 24); k++) if (okCut(k)) return k
  return Math.min(cut, max)
}

/* 按句读切块（≤max 字/块）。先在强句读（。！？；!?;）断句，短句就近合并进同块；
   单句超长再在次级断点（，、：）回退切，实在没有断点才硬切。
   返回的块拼起来 = 清洗后的原文（无空格文本下严格成立；边界保护只改断点位置不改内容）。 */
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
      cut = safeCutIndex(sent, cut + 1, max) - 1     // 边界保护：避免切断词/数字/括号
      if (cut < 1) cut = Math.min(max - 1, sent.length - 1)
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

/* 选声优先级（2026-09-15 用户指定：默认改用**云健**）：
   ① 云健 Natural（用户 2026-09-15 钦点为默认） → ② 晓晓 Natural →
   ③ 云希 Natural → ④ 其他 Online/Neural 神经音 → ⑤ Google 网络音 →
   ⑥ 微软本地 SAPI（Huihui/Yaoyao/Kangkang，电子感强） → ⑦ 任意普通话 → ⑧ null

   为什么 Google 排在本地 SAPI 之前：AI 语音设计指南明确「未指定模型时浏览器会降级调用
   系统最基础的离线语音(如 Windows 旧版 SAPI5)，产生强烈电子机器感；Edge 的 Online 神经音
   与 Chrome 的 Google 语音音质最接近真人，应优先指名」；另有 TTS 工具文档把"Windows 上
   声音机械"直接归因于老 SAPI 并建议改用 Edge。修正前实测在 Chrome 里选中了 Huihui（机械），
   而当时 Google 普通话可选 —— 顺序错了。

   ⚠ 用户若在声音面板里**显式选过音色**（`qp.tts.voice`），一律优先尊重其选择，
   本优先级只在"自动"档生效。

   语种收口：只收普通话（zh-CN / zh-Hans），**排除粤语 zh-HK、台湾 zh-TW、方言
   zh-CN-liaoning / zh-CN-shaanxi 等**——/^zh/ 会把它们一起捞进来，念出来是另一种腔调。
   命名收口：Edge 里语音名是**中文本地化**的（"Microsoft 晓晓 Online (Natural)"），
   只匹配 xiaoxiao/yunxi 这类拉丁名会全部落空，故拉丁名与中文名一起匹配。 */
const ZH_MANDARIN = /^zh[-_]?(CN|Hans)/i
const ZH_VARIANT = /[-_](HK|TW|MO)|[-_](liaoning|shaanxi|sichuan|henan|shanxi)(\b|$)/i
const isNatural = (v) => /natural|neural/i.test(v.name)
/* 音色质量分层（UI 提示与块长策略都用它）：
   natural=Edge 云端神经音；network=浏览器自带网络音（Chrome 的 Google 系列）；
   sapi=Windows 老本地音（Huihui/Yaoyao/Kangkang，机械感强）；other=其余普通话音 */
export function voiceQualityOf(v) {
  if (!v) return 'none'
  if (isNatural(v)) return 'natural'
  /* 先按名字认老 SAPI 音（Huihui/Yaoyao/Kangkang…）：它们在某些环境里 localService
     也可能是 false（真机/测试都见过），只靠 localService 会把机械音误判成"网络音"。 */
  if (/huihui|yaoyao|kangkang|tingting|meijia|慧慧|瑶瑶|康康|婷婷/i.test(v.name)) return 'sapi'
  if (/google/i.test(v.name)) return 'network'
  if (v.localService === false) return 'network'
  return 'other'
}
/* 腔调识别（2026-09-14：用户要求"所有中文音色都放进列表，自由选择"，
   所以不再过滤方言，而是**标注**出来让用户自己决定） */
export function voiceAccent(v) {
  const lang = String((v && v.lang) || '').toLowerCase()
  const name = String((v && v.name) || '')
  if (/zh[-_]hk/.test(lang) || /cantonese|粵|粤/i.test(name)) return '粤语'
  if (/zh[-_]tw/.test(lang) || /taiwanese|台灣|台湾/i.test(name)) return '台湾'
  if (/-liaoning/.test(lang) || /northeastern/i.test(name)) return '东北'
  if (/-shaanxi/.test(lang) || /shaanxi|zhongyuan/i.test(name)) return '陕西'
  if (/zh[-_]?(cn|hans)/i.test(lang)) return ''
  return '其它'
}
/* 下拉里显示的名字：去掉厂商与冗长的 " - Chinese (...)" 尾巴，补上腔调/质量标签 */
export function voiceLabel(v) {
  const base = String((v && v.name) || '')
    .replace(/^Microsoft\s+/i, '')
    .replace(/^Google\s+/i, '')
    .replace(/\s*-\s*Chinese\s*\(.*$/i, '')
    .replace(/\s*Online\s*\(Natural\)\s*$/i, '')
    .replace(/\s*\(Natural\)\s*$/i, '')
    .trim()
  const q = voiceQualityOf(v)
  const tags = [
    voiceAccent(v),
    q === 'natural' ? '★自然' : q === 'network' ? '网络' : q === 'sapi' ? '老式' : ''
  ].filter(Boolean)
  return tags.length ? `${base}（${tags.join('·')}）` : base
}
/* 全量中文音色清单（供 UI 自由选择）：收录所有 zh* 音，按
   「普通话优先 → 神经音 > 网络音 > 其他 > 老 SAPI」排序，方言/其它腔调排在最后但**不隐藏**。
   注意：这个排序只影响列表观感；"自动"模式仍走 pickVoice（只用普通话，见上方注释）。 */
export function listVoices(voices) {
  const rankQ = { natural: 0, network: 1, other: 2, sapi: 3 }
  return (voices || [])
    .filter((v) => /^zh/i.test(v.lang))
    .map((v) => {
      const accent = voiceAccent(v)
      const quality = voiceQualityOf(v)
      return { name: v.name, lang: v.lang, quality, accent, label: voiceLabel(v), _r: (accent ? 10 : 0) + rankQ[quality] }
    })
    .sort((a, b) => a._r - b._r || a.label.localeCompare(b.label))
    .map(({ _r, ...rest }) => rest)
}
/* 用户显式指定的音色（localStorage qp.tts.voice，存 name）。null=自动 */
const LS_VOICE = 'qp.tts.voice'
export function ttsVoicePref() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LS_VOICE) : null
    return raw && raw.trim() ? raw : null
  } catch { return null }
}
export function setTtsVoice(name) {
  try {
    if (name) window.localStorage.setItem(LS_VOICE, name)
    else window.localStorage.removeItem(LS_VOICE)
  } catch { /* ignore */ }
  return name || null
}
export function pickVoice(voices) {
  const all = (voices || []).filter((v) => /^zh/i.test(v.lang))
  if (!all.length) return null
  const mandarin = all.filter((v) => ZH_MANDARIN.test(v.lang) && !ZH_VARIANT.test(v.lang))
  const pool = mandarin.length ? mandarin : all      // 一台机器只有粤语/台湾音时也不至于无音可用
  /* ① 用户在面板里点过名 → 就用它（仍可用才生效，换设备/换浏览器后自动回落） */
  const want = ttsVoicePref()
  if (want) {
    const hit = all.find((v) => v.name === want)
    if (hit) return hit
  }
  return pool.find((v) => /yunjian|云健/i.test(v.name) && isNatural(v))   // ① 默认：云健（用户 2026-09-15 指定）
    || pool.find((v) => /xiaoxiao|晓晓/i.test(v.name) && isNatural(v))
    || pool.find((v) => /yunxi|云希/i.test(v.name) && isNatural(v))
    || pool.find((v) => isNatural(v) && !/multilingual/i.test(v.name))
    || pool.find((v) => /google/i.test(v.name))
    || pool.find((v) => /xiaoxiao|yunxi|yunyang|yaoyao|huihui|kangkang|tingting|meijia|晓晓|云希|云扬|瑶瑶|慧慧|康康|婷婷/i.test(v.name))
    || pool[0]
}

/* voices 在 Chrome/Edge 都是异步加载（首帧 getVoices() 常为空）。
   若此时不等待就 speak，utterance 会不带 voice → 浏览器按 lang 自选默认音
   （Windows 上默认多半就是 Huihui 这类机械音），"沉浸感最强"的选声会静默落空。
   **2026-09-14 加严**：不只是"等到有语音"，而是"**等到有非老 SAPI 的语音**"——
   Edge 首帧实测常常只列出 Huihui/Kangkang/Yaoyao 三个老音，再过一拍才补上
   14 个 Online 神经音；如果一看到列表非空就开说，第一段就是机械音。
   策略：最长等 1500ms，期间一旦出现非 SAPI 音立即开说；超时则用当前最优。 */
function waitVoice(maxMs = 1500) {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve(null)
    const s = window.speechSynthesis
    let done = false
    const best = () => pickVoice(s.getVoices() || [])
    const good = () => { const v = best(); return v && voiceQualityOf(v) !== 'sapi' ? v : null }
    const finish = () => {
      if (done) return
      done = true
      try { s.removeEventListener('voiceschanged', onchange) } catch { /* 老实现 */ }
      resolve(best())
    }
    const onchange = () => { if (good()) finish() }
    if (good()) return finish()
    try { s.addEventListener('voiceschanged', onchange) } catch { /* ignore */ }
    const t0 = Date.now()
    const poll = setInterval(() => {
      if (done) { clearInterval(poll); return }
      if (good() || Date.now() - t0 > maxMs) { clearInterval(poll); finish() }
    }, 120)
    setTimeout(finish, maxMs + 200)
  })
}

/* 给 UI 用的选声说明：把"机械感"从模糊感受变成可核对的字面信息
   （哪个音色 / 属于哪一档），并给出改进建议。 */
export function voiceNote() {
  if (!ttsSupported()) return '当前浏览器不支持语音合成'
  const v = pickVoice(window.speechSynthesis.getVoices() || [])
  if (!v) return '语音列表尚未加载，首句可能用系统默认音'
  const q = voiceQualityOf(v)
  const tag = q === 'natural' ? '自然语音' : q === 'network' ? '网络语音' : q === 'sapi' ? '老式本地语音·机器感重' : '本地语音'
  return `语音：${v.name}（${tag}）`
}
/* 给 UI 用的安全取样：拿不到就返回空数组（安卓 WebView 上 speechSynthesis 可能是空壳） */
export function currentVoices() {
  if (!ttsSupported()) return []
  try { return window.speechSynthesis.getVoices() || [] } catch { return [] }
}
/* 移动端"语音列表读不出来"的规避（2026-09-14，用户报"手机端 Edge 不能选择语音"）：
   ① 安卓内核**可能根本不触发 voiceschanged**（官方问答与 WebView 长期 issue 均有记录），
      只监听该事件会在移动端永久拿到空列表 → 下拉只剩"自动"，看起来就是"不能选语音"；
   ② 安卓 Edge 默认走**系统 TTS 引擎**，Edge 自带的微软在线神经音（晓晓/云希）需要用户
      先手动用一次 Edge 的「大声朗读」才会被初始化（微软官方口径：无 JS API 可强制初始化）；
   ③ 首次 speak 之后，部分内核才把语音表补齐。
   故 UI 侧改为"多点触发刷新"：挂载后短轮询 + 面板打开时 + 首次播报后 + 手动 ↻。
   getVoices() 是同步且廉价的内存读取，轮询不构成性能负担。 */
export function voiceGuideText(listLen) {
  if (!ttsSupported()) return '本浏览器内核不支持语音合成：换 Chrome / Edge / Safari 可用'
  if (listLen === 0) {
    return '本机暂未暴露任何语音（移动端常见）。播报仍会用系统默认音色；'
      + '想解锁更多音色：安卓 Edge 请先对任意网页用一次「大声朗读」再回来点 ↻；'
      + '安卓其他浏览器可在 系统设置→无障碍→文字转语音 装中文语音数据。'
  }
  return ''
}
/* 面板里显示的一行建议（无自然语音时明确告知最省事的改善路径） */
export function voiceAdvice() {
  if (!ttsSupported()) return '本浏览器内核不支持语音合成：换 Chrome / Edge / Safari 可用'
  const v = pickVoice(window.speechSynthesis.getVoices() || [])
  const q = voiceQualityOf(v)
  if (q === 'natural') return '自然语音已就位，可在上面选择其它音色'
  if (q === 'network') return '网络语音质量尚可但不稳定；用 Edge 打开可听到晓晓/云希自然语音'
  return '本机只有老式本地语音（机械感重）；用 Edge 打开可听到晓晓/云希自然语音，无需安装任何东西'
}

/* 块长按音色分流（2026-09-14 调整，针对"机械音/碎句感"）：
   · Edge/微软 Online 神经音（云端长文本引擎）→ 180 字/块：少切几刀，语调连贯；
   · 浏览器自带网络音（Chrome 的 Google 系列）→ **70 字/块**：
     原先 50 字切得太碎，中文听感"一顿一顿"更像机器人在念短语；70 字 ≈11s（1.35 倍速
     约 6 字/秒）仍安全落在 Chrome 桌面 ~15s 静默中断阈值之内；
   · 本地 SAPI 等其余 → 50 字/块（这类引擎长句更容易出现音调塌陷，保守切）。 */
export function chunkMaxFor(voice) {
  const q = voiceQualityOf(voice)
  if (q === 'natural') return 180
  if (q === 'network') return 70
  return 50
}

/* 串行播报会话。四个抗坑措施（均有公开记录 / 真机实测）：
   ① **保活引用**：Chromium 长期 bug——SpeechSynthesisUtterance 在说完前被 GC 会丢
      voice/丢事件，表现为"开头正确、后面变成默认音"。存进 live 数组即可保活。
   ② **块间 120ms 间隙**：背靠背 speak 会让引擎忽略第二句起的 voice
      （SO 36377342 标题就是"第一次女声、第二次男声"）。
   ③ **整段锁定同一音色**（2026-09-14 修正）：链开始时解析一次音色并锁定 name，
      之后每块按 name 现取同一音色（对象可换、名字不换），取不到才回退锁定对象。
      此前是"每块各自 pickVoice"，而 Edge/Chrome 的语音列表是**异步补齐**的
      （Edge 首帧常只有 3 个老 SAPI 音，随后才补上 14 个 Online 神经音）
      → 前几块用机械音、后面换成神经音，用户听到的就是"读一半换音色"。
   ④ 看门狗：Chrome+Google 网络音有"事件不触发、卡在 speaking"的老 bug，
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
let session = null      // { chunks, i, paused, nativePaused, done, voiceName }
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
  const keep = s.voiceName
  session = null
  return runChunks(rest, ttsRate(), undefined, undefined, keep) !== false
}
/* 纯函数（可回归）：被打断块 + 其后的剩余块；i 已自增，故取 i-1 起 */
export function sliceForResume(s) {
  if (!s || !s.chunks || !s.chunks.length) return []
  return s.chunks.slice(Math.max(0, s.i - 1))
}
/* 纯函数（可回归）：按名字在当前列表里取同一音色（对象可换、名字不换） */
export function resolveVoiceByName(voices, name) {
  if (!name) return null
  return (voices || []).find((v) => v.name === name) || null
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CHUNK_GAP = 120
function runChunks(chunks, rate, onDone, my, voiceName) {
  if (!chunks || !chunks.length) return false
  const tok = my === undefined ? ++token : my
  const synth = window.speechSynthesis
  const sess = { chunks, i: 0, paused: false, nativePaused: false, done: false, voiceName: voiceName || null }
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
    /* ③ 整段同一音色：优先按锁定 name 现取（列表可能已补齐），取不到再用当前最优 */
    const vs = synth.getVoices() || []
    const v = resolveVoiceByName(vs, sess.voiceName) || pickVoice(vs)
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
  return runChunks(chunks, rate, onDone, my, voice ? voice.name : null)
}

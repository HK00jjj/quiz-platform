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
  /* 2026-09-15（用户实测"220伏读成220v"）：**单独的 V/A/W 是纯拉丁字母，中文引擎按字母念**
     ——必须映射成中文单位。负向断言防误伤：A 后不接字母/型类组（避免 "12AB" 选项串、"2A型"）；
     V/W 要求词边界（"6V6" 电子管型号、"VFD" 缩写不受影响）。 */
  s = s.replace(/(\d(?:\.\d+)?)\s?V\b/g, '$1伏')
  s = s.replace(/(\d(?:\.\d+)?)\s?A(?![A-Za-z型类组项])/g, '$1安')
  s = s.replace(/(\d(?:\.\d+)?)\s?W\b/g, '$1瓦').replace(/(\d(?:\.\d+)?)\s?Wh\b/g, '$1瓦时')
  s = s.replace(/kWh/gi, '千瓦时').replace(/kW/g, '千瓦').replace(/Hz/g, '赫兹')
    .replace(/kHz/g, '千赫兹').replace(/MHz/g, '兆赫兹')
  /* ①-b 电气补充单位（2026-09-15 用户指令"所有电气自动化相关的都映射上去"；
     词形来源=全库缩写清单 acronym_inventory.txt，非拍脑袋）： */
  s = s.replace(/(\d(?:\.\d+)?)\s?kA\b/g, '$1千安').replace(/(\d(?:\.\d+)?)\s?MA\b/g, '$1兆安')
    .replace(/(\d(?:\.\d+)?)\s?mV\b/g, '$1毫伏').replace(/(\d(?:\.\d+)?)\s?MW\b/g, '$1兆瓦')
    .replace(/(\d(?:\.\d+)?)\s?mW\b/g, '$1毫瓦').replace(/(\d(?:\.\d+)?)\s?GW\b/g, '$1吉瓦')
    .replace(/(\d(?:\.\d+)?)\s?nF\b/g, '$1纳法').replace(/(\d(?:\.\d+)?)\s?pF\b/g, '$1皮法')
    .replace(/(\d(?:\.\d+)?)\s?mH\b/g, '$1毫亨').replace(/(\d(?:\.\d+)?)\s?ms\b/g, '$1毫秒')
    .replace(/(\d(?:\.\d+)?)\s?mm\b/g, '$1毫米').replace(/(\d(?:\.\d+)?)\s?cm\b/g, '$1厘米')
    .replace(/(\d(?:\.\d+)?)\s?km\b/g, '$1千米').replace(/(\d(?:\.\d+)?)\s?MPa\b/g, '$1兆帕')
    .replace(/(\d(?:\.\d+)?)\s?kPa\b/g, '$1千帕').replace(/(\d(?:\.\d+)?)\s?Pa\b/g, '$1帕')
    .replace(/(\d(?:\.\d+)?)\s?r\/min\b/gi, '$1转每分').replace(/(\d(?:\.\d+)?)\s?°(?!\s?[CF])/g, '$1度')
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
  /* ②-c 三角函数读法（cosφ/tanφ/sinφ 是全库高频；必须在 ③ 希腊字母替换之前，
     否则会变成"cos斐"。工程口语：cosφ = 功率因数。） */
  s = s.replace(/cos\s?φ/gi, '功率因数').replace(/tan\s?φ/gi, '正切').replace(/sin\s?φ/gi, '正弦')
  /* ③ 希腊字母（工程口语常用译名） */
  s = s.replace(/[Α-Ωα-ω]/g, (c) => GREEK_READ[c] ?? c)
  /* ④ 斜杠组合：AC/DC、I/O 之类中文引擎会念成"斜杠"或吞掉，统一读成"或/斜杠"里更稳的"斜杠" */
  s = s.replace(/([A-Za-z0-9])\s*\/\s*([A-Za-z0-9])/g, '$1 或 $2')
  /* ④-b 连字符与"字母紧贴数字"：TN-S→TN S、RS485→RS 485、L1→L 1、GB50168→GB 50168
     （中文引擎会把 "TN-S" 念成"T N 杠 S"、"L1" 念成整团）。 */
  s = s.replace(/([A-Za-z])\s?-\s?([A-Za-z0-9])/g, '$1 $2')
  s = s.replace(/([A-Za-z])(\d)/g, '$1 $2')
  /* ⑤ 缩写逐字母读（电气口语标准）：PLC→P L C、AC→A C、DC→D C、RCD→R C D…
     词形来源=全库缩写清单（acronym_inventory.txt，PLC 1560 / PE 1288 / NPN 479 …）。
     不在表里的词保持原样（Modbus/Profinet 这类可读成单词的协议名不动）。
     注意：必须放在单位/斜杠/连字符规则之后，否则会被二次拆散。 */
  const TOKEN_READ = {
    PLC: 'P L C', AC: 'A C', DC: 'D C', PE: 'P E', PEN: 'P E N', NPN: 'N P N', PNP: 'P N P',
    TN: 'T N', TT: 'T T', IT: 'I T', KM: 'K M', RCD: 'R C D', RCBO: 'R C B O', MCB: 'M C B', MCCB: 'M C C B',
    SPD: 'S P D', LED: 'L E D', LCD: 'L C D', HMI: 'H M I', SCADA: 'S C A D A', DCS: 'D C S',
    PID: 'P I D', PWM: 'P W M', SPWM: 'S P W M', SVPWM: 'S V P W M', VFD: 'V F D', IGBT: 'I G B T',
    UPS: 'U P S', EMC: 'E M C', EMI: 'E M I', CPU: 'C P U', DSP: 'D S P', MCU: 'M C U',
    IEC: 'I E C', CT: 'C T', PT: 'P T', TTL: 'T T L', MOV: 'M O V', RC: 'R C', IO: 'I O',
    IP: 'I P', RS: 'R S', GTO: 'G T O', SCR: 'S C R', RTU: 'R T U', OPC: 'O P C', MQTT: 'M Q T T',
    AI: 'A I', AO: 'A O', DI: 'D I', DO: 'D O', GB: '国标',
    PNP: 'P N P', SIL: 'S I L', LVD: 'L V D', ELV: 'E L V', SELV: 'S E L V', PELV: 'P E L V'
  }
  s = s.replace(/\b[A-Za-z]{2,8}\b/g, (w) => TOKEN_READ[w.toUpperCase()] ?? w)
  /* ⑥ 轻声弱化保护（2026-09-16，用户实测"'功能'的'能'读不出来"）：
     取证（PCM 包络对比，tools/diag/）：云健把"功能[须|需]"连读里的"能"压成极轻
     轻声——能量仅邻字一半（功 0.15 vs 能 0.04~0.10），1.35x 下 ≈0.15s，手机外放
     听感=吞字；而"功能"后无"须/需"时"能"读原调清晰。插入半角空格后实测："能"
     恢复原调 néng（能量 0.14 与"功"0.18 相当），代价 ~0.22s 微停顿。仅限高风险
     连读（后接 须/需），其余语境的"功能"原样不动。 */
  s = s.replace(/功能(?=[须需])/g, '功 能')
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
   返回的块拼起来 = 清洗后的原文（无空格文本下严格成立；边界保护只改断点位置不改内容）。
   firstMax（2026-09-15）：首块单独上限——首块小=首响快（合成 RTT 与块长正相关），
   后续块加大=块边界少=句号处停顿少（每块是独立合成音频，自带首尾静音，
   块边界≈句号边界，用户实测"每个句号后面顿一下"）。 */
export function chunkSpeechText(raw, max = 50, firstMax = max) {
  const text = cleanSpeechText(raw)
  if (!text) return []
  const chunks = []
  let buf = ''
  let cap = Math.max(1, Math.min(firstMax, max))    // 首块上限；flush 一块后回到 max
  const flush = () => { const t = buf.trim(); if (t) chunks.push(t); buf = ''; cap = max }
  for (let sent of text.split(/(?<=[。！？；!?;])/g)) {
    sent = sent.trim()
    if (!sent) continue
    while (sent.length > cap) {                      // 单句超长：在次级断点回退切
      const head = sent.slice(0, cap)
      let cut = Math.max(head.lastIndexOf('，'), head.lastIndexOf('、'),
        head.lastIndexOf('：'), head.lastIndexOf(','))
      if (cut < Math.floor(cap / 3)) cut = cap - 1   // 找不到像样断点 → 硬切
      cut = safeCutIndex(sent, cut + 1, cap) - 1     // 边界保护：避免切断词/数字/括号
      if (cut < 1) cut = Math.min(cap - 1, sent.length - 1)
      flush()
      chunks.push(sent.slice(0, cut + 1).trim())
      sent = sent.slice(cut + 1)
    }
    if (!sent) continue
    if (buf && buf.length + sent.length > cap) flush()
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
/* ═══ 2026-09-15 手机端「选不了其他语音」修复 ═══
   症状（用户真机）：安卓 Edge 上音色下拉只有「自动」，做过多轮「大声朗读」+ ↻ 依然为空。

   事实边界（Microsoft Q&A 5580838 官方答复）：
   · 安卓 Edge 的 speechSynthesis **默认走安卓系统 TTS 引擎**，不是 Edge 云端的神经音；
   · Edge 云端音需用户手动用一次「大声朗读」初始化，**刷新页面即失效**；
   · **没有 JS API 可强制初始化**（浏览器防后台偷跑流量的设计决策）——所以"手机上凭空出现晓晓"
     在技术上不可能，能修的是"别把手机上真实存在的音色过滤掉"。

   代码侧真凶：语种标签只认 `^zh`。安卓系统 TTS 引擎报告的标签**不保证是 zh 开头**——
   实际存在 `cmn-Hans-CN`（普通话的另一种 BCP-47 写法）、`zh_CN`、甚至空字符串。
   一旦命中这种写法：listVoices 过滤后为空 → 下拉只剩「自动」；pickVoice 返回 null →
   utterance 无 voice、按 lang 兜底 → 听感回落系统默认（用户感知的"机械音"同源）。
   修法：标签优先（zh/cmn/yue），标签缺失或异常时按音色名兜底（中文/普通话/Chinese 系命名）。 */
const ZH_TAG = /^(zh|cmn|yue)/i
const ZH_NAME = /普通话|中文|國語|国语|粤语|粵語|Chinese|Mandarin|Cantonese/i
export const zhLike = (v) => {
  if (!v) return false
  if (ZH_TAG.test(String(v.lang || ''))) return true
  return ZH_NAME.test(String(v.name || ''))
}
/* 腔调/方言（内容侧判定，供"是否普通话"分流用；与 voiceAccent 的展示标签互补） */
const isVariantVoice = (v) => ZH_VARIANT.test(String((v && v.lang) || ''))
  || /粤语|粵語|台湾|台灣|Cantonese|Taiwanese|northeastern|shaanxi|zhongyuan/i.test(String((v && v.name) || ''))
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
  if (/^(cmn|zh[-_]?(cn|hans))/i.test(lang)) return ''   // 普通话（含 cmn-* 写法）
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
    .filter(zhLike)                                  // 2026-09-15：zh* 之外并收 cmn-* / 名字兜底
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
  const all = (voices || []).filter(zhLike)          // 2026-09-15：同 listVoices 拓宽口径
  if (!all.length) return null
  const mandarin = all.filter((v) => !isVariantVoice(v))   // 普通话（含 cmn-*/空标签+中文名）
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
/* 移动端判定（waitVoice 预算用）：安卓/iOS 的语音表要么恒空、要么必超时——
   等 1500ms 纯浪费（engineFor 反正会判 cloud）。桌面保持 1500ms 不变：
   Edge 首帧常只给 3 个老 SAPI 音、约几百 ms 后才补齐神经音，等是值得的。 */
function isMobileUA() {
  try {
    if (typeof navigator === 'undefined') return false
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile
    return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '')
  } catch { return false }
}
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
  const pref = ttsVoicePref()
  if (isCloudVoice(pref)) {
    const v = CLOUD_VOICES.find((x) => x.name === pref)
    return '语音：' + (v ? v.label : pref) + '（云端）'
  }
  if (!ttsSupported()) {
    return cloudSupported() ? '语音：微软云健（本机不支持系统语音，已走云端）' : '当前浏览器不支持语音合成'
  }
  const v = pickVoice(window.speechSynthesis.getVoices() || [])
  if (!v) return cloudSupported() ? '本机无中文系统音 → 自动使用云端微软音色' : '语音列表尚未加载，首句可能用系统默认音'
  const q = voiceQualityOf(v)
  const tag = q === 'natural' ? '自然语音' : q === 'network' ? '网络语音' : q === 'sapi' ? '老式本地语音·机器感重' : '本地语音'
  if (q !== 'natural' && cloudSupported()) return `语音：${v.name}（${tag}）→ 已自动改用云端微软音色`
  return `语音：${v.name}（${tag}）`
}
/* 给 UI 用的安全取样：拿不到就返回空数组（安卓 WebView 上 speechSynthesis 可能是空壳） */
export function currentVoices() {
  if (!ttsSupported()) return []
  try { return window.speechSynthesis.getVoices() || [] } catch { return [] }
}
/* ── 2026-09-15 新增：诊断读数 + 引擎唤醒（手机端排障用） ──
   手机上没有开发者工具，用户报"选不了音色"时无法自查。这里把「引擎到底看到了什么」
   原样摊到面板上（总数/中文数/前几条 lang|name），用户截图即可反馈——避免继续靠猜。
   两个函数都是同步内存读取或无副作用空句，安全。 */
export function voiceDiag() {
  if (!ttsSupported()) return { supported: false, total: 0, zh: 0, sample: [] }
  let all = []
  try { all = window.speechSynthesis.getVoices() || [] } catch { all = [] }
  return {
    supported: true,
    total: all.length,
    zh: all.filter(zhLike).length,
    sample: all.slice(0, 6).map((v) => `${v.lang || '(空标签)'} | ${v.name}`)
  }
}
/* 唤醒系统 TTS：部分安卓内核 getVoices() 在**首次 speak() 之前恒为空**。
   面板打开落在用户手势栈里，此时播一个 0 音量短句即可把引擎"叫醒"，
   随后列表通常才出现（Chromium 已知行为）。幂等，失败静默。 */
let warmed = false
export function warmUpVoices() {
  if (!ttsSupported() || warmed) return false
  try {
    const u = new SpeechSynthesisUtterance('。')
    u.volume = 0
    u.rate = 2
    u.lang = 'zh-CN'
    window.speechSynthesis.speak(u)
    warmed = true
    return true
  } catch { return false }
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
  if (!ttsSupported()) {
    return cloudSupported()
      ? '本机不支持系统语音合成——直接在上方选「微软·云健」即可播报，无需安装任何东西。'
      : '本浏览器内核不支持语音合成：换 Chrome / Edge / Safari 可用'
  }
  if (listLen === 0) {
    /* 2026-09-15 修订（第三版）：现在有了云端微软神经音，本机有没有系统音都不影响出声，
       所以首选建议改成"选云端云健"，系统层安装路径降为可选优化。
       （2026-09-15 口径：按用户要求，不再标注"与电脑端一致"——两端音色本就相同，无需说明。） */
    return '本机没有可用的中文系统语音（移动端常见）。**在音色里选「微软·云健」即可**——'
      + '它不依赖本机语音库；也可只留「自动」：系统没神经音时会自动走云端。'
      + '想让本机系统语音更丰富：安卓 设置→文字转语音→安装中文语音数据；'
      + 'iPhone 设置→辅助功能→朗读内容→声音→中文。'
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
  stopCloud()                                  // 云端可能在播：一并停（单例 <audio>）
}
/* 暂停在原处：能原生暂停就原生暂停，不能就记住块位置并断链 */
export function pauseSpeak() {
  /* 云端分支：<audio>.pause() 是标准原生暂停，安卓也可靠 */
  if (session && session.mode === 'cloud') { session.paused = true; return pauseCloud() }
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
/* 继续：原生暂停的续上；否则从被打断的那一块接读（新语速即时生效）。
   onDone（2026-09-16 可选）：**重建链分支**（原生暂停不可用 → 记块位置断链重开）
   的完成回调——题干循环朗读（Practice）靠它"续播读完 → 接续循环"。原生暂停
   （synth.resume）与 GA suspend 两路的链未断，完成回调仍是 speak 时传入的原闭包，
   无需透传；只有这里重开的新链需要调用方把 onDone 再交回来。 */
export function resumeSpeak(onDone) {
  const sc = session
  /* 云端分支：直接 resume 同一个 <audio>，从原处续上（一个字不重读） */
  if (sc && sc.mode === 'cloud') {
    if (!sc.paused || sc.done) return false
    sc.paused = false
    return resumeCloud()
  }
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
  return runChunks(rest, ttsRate(), onDone, undefined, keep) !== false
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
function runChunks(chunks, rate, onDone, my, voiceName, tag) {
  if (!chunks || !chunks.length) return false
  const tok = my === undefined ? ++token : my
  const synth = window.speechSynthesis
  const sess = { chunks, i: 0, paused: false, nativePaused: false, done: false, voiceName: voiceName || null, tag: tag || '' }
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
export async function speak(raw, { rate = ttsRate(), onDone, tag } = {}) {
  if (!ttsSupported() && !cloudSupported()) return false
  const my = ++token
  /* ① 显式选了云端音色 → 直接走云端（不走系统语音表，手机也能出声）。
     tag：本条播报的上下文键（如 reveal|3|q12 / stem|3|q12），暂停/续播用它与
     当前界面状态对表——不匹配的过期暂停会话由调用方丢弃，防止"续播出上一题的声音"。 */
  const pref = ttsVoicePref()
  if (isCloudVoice(pref)) {
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
    handoverCloud()
    const cm = cloudChunkMaxFor(pref)
    const chunks = chunkSpeechText(raw, cm, CLOUD_CHUNK_MAX)
    if (!chunks.length) return false
    /* 云端分支不再 sleep(120)：stopCloud 是同步 pause，无引擎复位需求；
       这 120ms 原是给系统语音 cancel 落地留的，省掉后首块更快开口 */
    if (my !== token) return false
    return speakCloudLine(chunks, rate, onDone, my, pref, tag)
  }
  const autoCloud = !pref && cloudSupported()
  if (!ttsSupported() || autoCloud) {
    /* ② 无 speechSynthesis 但可播音频（部分 WebView）→ 云端兜底（云健）；
       ③ 自动档 + 云端可用 → **云端优先**（2026-09-15 下午改）：
          桌面 native 把长文切成 180 字块逐 utterance 网络合成，块间隙 0.3~1s
          （块边界≈句号边界，即用户报的"每个句号顿一下"）；GA 管线解码裁静音后
          采样级拼接，零块边界，且同一微软音色、还省掉 waitVoice 至多 1.5s 的等待。
          失败（函数 502/断网）时回落 native，不臆造能力。 */
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
    handoverCloud()
    const cvoice = CLOUD_DEFAULT_VOICE
    const cchunks = chunkSpeechText(raw, cloudChunkMaxFor(cvoice), CLOUD_CHUNK_MAX)
    if (!cchunks.length || !cloudSupported()) return false
    if (my !== token) return false
    const r = await speakCloudLine(cchunks, rate, onDone, my, cvoice, tag)
    if (r) return r
    if (!ttsSupported()) return false          // 没有退路：到此为止
    /* 云端失败 → 继续往下走 native 回落 */
  }
  const synth = window.speechSynthesis
  /* 先拿到语音再开口（见 waitVoice 注释）；等待期间若被静音/新播报取代，直接放弃。
     移动端只等 300ms：语音表要么恒空要么必超时，早降云端省 1.2s+ 首响延迟
     （2026-09-15 下午：自动档已在上方提前走云端，能落到这里的只有显式系统音色
     与云端失败回落，不再经过 engineFor）。 */
  const voice = await waitVoice(isMobileUA() ? 300 : 1500)
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
  return runChunks(chunks, rate, onDone, my, voice ? voice.name : null, tag)
}

/* ═══════════ 云端音色（2026-09-15，修「手机端选不了其他语音」）═══════════
   为什么走到这一步：安卓网页接口默认调**系统 TTS 引擎**，手机没装中文语音数据时
   getVoices() 返回空 → 下拉只剩「自动」、播报也没声（用户真机症状）。设备侧无法解决，
   于是把合成搬到云端：不依赖设备语音库，任何设备都能出声、可切换。

   实测结论（2026-09-15，本机 + 真实浏览器 CDP，证据见 logs/）：
   · 微软 Edge Read Aloud 的 WS 端点：Node 侧 403；**浏览器里必败**——WebSocket 的
     Origin 由浏览器写死、JS 无法伪造，端点拒收本站 Origin（CDP 实测 ERROR）。不采用。
   · 百度 tts.baidu.com：已加白名单 Referer 校验（"Not verified user. err_no=502"）。弃用。
   · **百度翻译发音 fanyi.baidu.com/gettts 可用**：不带 Referer 即返回 audio/mpeg。
     实测：默认 referrer 策略下 <audio> 播放失败（MEDIA_ERR_SRC_NOT_SUPPORTED），
     在页面注入 <meta name="referrer" content="no-referrer"> 后立即成功（2.77s 音频）。
     → 该通路的前置条件是「页面不带 Referer」，已在 index.html 静态声明。
   · spd 有效区间实测：3/5/7 返回音频，0、9、12 返回空 → 语速只映射到这三档。

   播放用 <audio>：原生 pause/resume（安卓 speechSynthesis 的 pause 等于 cancel，
   云端这条反而更稳），且媒体元素播放不受 CORS 约束——fetch 读字节会被拦，故只播不读。 */
export const CLOUD_VOICE_ID = '__cloud_baidu__'
/* ── 微软神经音（与电脑端 Edge 完全一致的音色）· 2026-09-15 新增 ──
   用户要求"手机端换成电脑端一样的声音"（桌面默认云健）。三条路实测：
   · 浏览器直连 Edge 朗读 WS → 必败（Origin 由浏览器写死，JS 无法伪造）
   · Supabase Edge Runtime（Deno 隔离）直连 → 亦败（不能自定义 WS 头，升级被拒）
   · **两跳代理可行**：Supabase 函数（国内可达）→ Vercel Node 代理（可自定义头，实测成功）→ 微软
   故这里直接指向 Supabase 端点（详见 serverless/vercel-tts/ 与 supabase/functions/tts/）。 */
export const TTS_PROXY = 'https://khtpnbzfjggezlmnnsgt.supabase.co/functions/v1/tts'
export const EDGE_VOICES = [
  { id: 'zh-CN-YunjianNeural', label: '云健（男声）' },
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女声·温暖）' },
  { id: 'zh-CN-YunxiNeural', label: '云希（男声·解说）' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊（女声·活泼）' },
  { id: 'zh-CN-YunyangNeural', label: '云扬（男声·新闻）' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', label: '小北（东北官话）' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', label: '小妮（陕西官话）' },
  { id: 'zh-HK-HiuMaanNeural', label: '曉曼（粤语）' },
  { id: 'zh-TW-HsiaoChenNeural', label: '曉臻（台湾）' }
]
/* 自动档回落到云端时用哪个：云健 = 电脑端默认音（用户指定），保证"手机与电脑一致" */
export const CLOUD_DEFAULT_VOICE = 'zh-CN-YunjianNeural'
export const CLOUD_VOICES = [
  ...EDGE_VOICES.map((v) => ({ name: v.id, label: '微软·' + v.label, accent: '', quality: 'neural', cloud: true })),
  { name: CLOUD_VOICE_ID, label: '云端·普通话女声（百度·备用线路）', accent: '', quality: 'cloud', cloud: true }
]
const CLOUD_IDS = new Set(CLOUD_VOICES.map((v) => v.name))
export const isCloudVoice = (name) => !!name && CLOUD_IDS.has(name)
export const isEdgeVoice = (name) => !!name && name.indexOf('zh-') === 0
export const cloudSupported = () => typeof window !== 'undefined' && typeof window.Audio === 'function'
/* 语速 → spd（百度线路只映射到实测可用的三档，避免请求到空音频） */
export function cloudSpd(rate) {
  const r = clampRate(rate)
  if (r <= 0.85) return 3
  if (r <= 1.15) return 5
  return 7
}
/* 云端块长：URL 安全（实测 2000 字会 414），150 字/块 ≈ URL 1.5KB，留足余量 */
export const CLOUD_CHUNK_MAX = 150
/* 2026-09-15（用户实测"句号后面顿一下"）：微软两跳代理线路后端实测上限 max:300
   （450 字返回 {"error":"text too long","max":300}）——后续块提到 300，块边界减半；
   首块仍 150（首响快：合成 RTT 与块长正相关，实测 150 字热合成 ≈2.2s）。
   百度备用线路维持 150。两值经 chunkSpeechText(raw, cm, CLOUD_CHUNK_MAX) 组合：
   首块 ≤150，后续 ≤300。 */
export const CLOUD_CHUNK_MAX_EDGE = 300
/* 云端线路块长决策：微软神经音（zh-* 两跳代理）用大块，百度用小块 */
export const cloudChunkMaxFor = (voice) => isEdgeVoice(voice) ? CLOUD_CHUNK_MAX_EDGE : CLOUD_CHUNK_MAX
export function cloudTtsUrl(text, rate = TTS_RATE, voice = CLOUD_DEFAULT_VOICE) {
  const t = encodeURIComponent(String(text ?? ''))
  if (isEdgeVoice(voice)) {
    return `${TTS_PROXY}?voice=${encodeURIComponent(voice)}&rate=${clampRate(rate)}&text=${t}`
  }
  return 'https://fanyi.baidu.com/gettts?lan=zh&source=web&spd=' + cloudSpd(rate) + '&text=' + t
}
/* ── 云端播放器（双 <audio> 双缓冲，2026-09-15 重构）──
   旧实现是"播完一块才换 src 请求下一块"→ 块间裸等一次完整合成往返（两跳 0.8~3s），
   用户听到"读一段停一下"。重构为双缓冲：A 播本块的同时 B 预载下一块（云端音频有
   24h Cache-Control，预载必命中），A 播完切 B 立即开播 → 块间零网络等待。
   移动端要求"首次播放落在用户手势里"，故 unlockCloudAudio() 把**两个**元素都在手势内
   用静音短片解锁（切元素播放也免拦）；iOS Safari 可能把 preload 降级为 metadata，
   那时预载不生效 → 退化为旧行为（块间停顿），不会更糟。失败静默、绝不抛。 */
let cloudAudio = null       // 播放位
let cloudAudio2 = null      // 预载位（与播放位角色按块互换）
let cloudPlaying = null     // 当前正在播的元素（pause/resume/事件守卫都以它为准）
function ensureCloudEls() {
  if (!cloudSupported()) return null
  if (!cloudAudio) { cloudAudio = new window.Audio(); cloudAudio.preload = 'auto' }
  if (!cloudAudio2) { cloudAudio2 = new window.Audio(); cloudAudio2.preload = 'auto' }
  return [cloudAudio, cloudAudio2]
}
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YQAAAAA='
let cloudUnlocked = false
export function unlockCloudAudio() {
  /* GA（Web Audio）：每次手势都顺手 resume——移动端 AudioContext 必须在手势栈里
     从 suspended 变 running；重复 resume 无害。legacy 元素解锁仍只做一次。 */
  try { const c = gaCtxOf(); if (c && c.state === 'suspended') { const p = c.resume(); if (p && p.catch) p.catch(() => {}) } } catch { /* ignore */ }
  const els = ensureCloudEls()
  if (!els) return false
  if (cloudUnlocked) return true
  try {
    for (const a of els) {              // 两个都解锁：块间会切元素，不能只解锁一个
      a.src = SILENT_WAV; a.volume = 0
      const p = a.play()
      if (p && p.catch) p.catch(() => {})
    }
    cloudUnlocked = true
    setTimeout(() => { try { for (const a of els) { a.pause(); a.volume = 1 } } catch { /* ignore */ } }, 120)
    return true
  } catch { return false }
}
/* ⚠ 三个实测踩中的坑（2026-09-15 E2E 取证）：
   ① `a.src = ''` 会解析成当前页地址 → 加载失败 → 元素派发 error(code 4)——
      若不先解绑 onended/onerror，这个"清场 error"会打进旧会话链误推块指针；
   ② 元素带着 MEDIA_ERROR 时直接换 src 播，部分内核不解码 → 换源后显式 load() 复位；
   ③ onerror 必须守卫"源已被清空"的情形（getAttribute('src') 为空 → 无视）。 */
function cloudDetach(a) { try { a.onended = null; a.onerror = null } catch { /* ignore */ } }
export function stopCloud() {
  stopGASources()                             // GA 会话（若有）：停掉全部已排程源
  cloudPlaying = null
  /* 2026-09-15 取证修正：`a.src=''` 会把 src 解析成当前页地址并派发 error(code 4)
     （E2E elSnap 实证 src=http://localhost:4176/quiz-platform/）。媒体元素"卸载资源"
     的标准姿势是 removeAttribute('src') + load()：src getter 归空、不产生假 error。 */
  for (const a of [cloudAudio, cloudAudio2]) {
    if (!a) continue
    cloudDetach(a)
    try { a.pause(); a.removeAttribute('src'); try { a.load() } catch { /* ignore */ } } catch { /* ignore */ }
  }
}
export function pauseCloud() {
  if (ga) { ga.paused = true; try { gaCtxOf().suspend(); return true } catch { return false } }
  const a = cloudPlaying; if (!a) return false
  try { a.pause(); return true } catch { return false }
}
export function resumeCloud() {
  if (ga) { ga.paused = false; try { const p = gaCtxOf().resume(); if (p && p.catch) p.catch(() => {}); return true } catch { return false } }
  const a = cloudPlaying; if (!a) return false
  try { const p = a.play(); if (p && p.catch) p.catch(() => {}); return true } catch { return false }
}
/* ═══════════ 无缝播放管线 · Web Audio（2026-09-15 下午，"彻底解决卡顿/停顿"）═══════════
   为什么重造播放器：旧双 <audio> 管线里每块是独立合成的 MP3，自带首尾静音（微软神经音
   实测 ~0.1-0.3s），块边界≈句号边界——TAIL_LEAD 提前切播只能盖住一部分，用户真机仍闻
   块间顿挫。GA 管线把"块"从播放概念里彻底抹掉：
     fetch(块URL) → decodeAudioData 解码成 PCM → 【裁掉首尾合成静音】→ 在 AudioContext
     时间线上与上一块【采样级精确拼接】(src.start(when, offset, duration))。
   块间零间隙、零元素切换、零网络等待（下一块在上一块播放期间已解码好排队）；
   句号处只剩微软音色天然的语言韵律停顿（真人也一样），技术性顿挫归零。
   暂停/续播 = ctx.suspend()/resume()：冻结整条时间线（含已排程的未来块），
   位置精确到采样，续播一个字不重——这是"播报关再开从原处继续"的机制级保证。
   降级：不支持 Web Audio 的老内核走旧 <audio> 管线（speakCloud 原样保留）；
   百度备用线路无 CORS（fetch 读不到字节）也走旧管线——只有微软两跳代理
   （Supabase 函数带 Access-Control-Allow-Origin:*）能进 GA。 */
const webAudioOK = () => {
  if (typeof window === 'undefined') return false
  const AC = window.AudioContext || window.webkitAudioContext
  return typeof AC === 'function' && AC.prototype && typeof AC.prototype.decodeAudioData === 'function'
}
let gaCtx = null
function gaCtxOf() {
  if (!webAudioOK()) return null
  try {
    if (!gaCtx) {
      const AC = window.AudioContext || window.webkitAudioContext
      gaCtx = new AC()
    }
    return gaCtx
  } catch { return null }
}
/* 解码缓存（跨会话复用）：重读/同题重出（三遍判定制）时 decode 一次即秒开；
   失败的 url 从缓存剔除，允许下次重试。 */
const gaCache = new Map()
function gaWarm(url) {
  if (gaCache.has(url)) return gaCache.get(url)
  const p = (async () => {
    const ctx = gaCtxOf()
    const r = await fetch(url)
    if (!r.ok) throw new Error('http ' + r.status)
    const ab = await r.arrayBuffer()
    const buf = await (ctx.decodeAudioData(ab.slice(0)))
    return buf
  })()
  gaCache.set(url, p)
  p.catch(() => gaCache.delete(url))
  return p
}
/* 纯函数（可回归）：按振幅找语音实体的 [start,end) 采样区间。
   阈值 1% FS：合成静音 padding 的振幅远低于此，真人气口不至于误裁。
   全静音（合成失败的空音频）→ 返回全区间，不越权删内容。 */
export function gaTrimRange(data, TH = 0.01) {
  const n = data.length
  let start = 0, end = n
  for (let i = 0; i < n; i++) { if (Math.abs(data[i]) >= TH) { start = i; break } }
  for (let i = n - 1; i >= start; i--) { if (Math.abs(data[i]) >= TH) { end = i + 1; break } }
  return { start, end }
}
let ga = null          // { mode:'cloud', ga:true, tok, tag, urls, i, nextAt, sources, paused, done, chunks, voiceName }
function stopGASources() {
  const s = ga
  ga = null
  if (!s) return
  s.done = true
  for (const src of s.sources) { try { src.onended = null; src.stop() } catch { /* ignore */ } }
  try { if (s.master) s.master.disconnect(); if (s.lim) s.lim.disconnect() } catch { /* ignore */ }
  try { if (gaCtx && gaCtx.state === 'suspended') gaCtx.resume().catch?.(() => {}) } catch { /* ignore */ }
}
function gaDecode(url) {
  return gaWarm(url)
}
export function speakCloudGA(chunks, rate, onDone, my, voice, tag) {
  if (!webAudioOK() || !cloudSupported() || !chunks || !chunks.length) return false
  const ctx = gaCtxOf()
  if (!ctx) return false
  const tok = my === undefined ? ++token : my
  const useVoice = isEdgeVoice(voice) ? voice : CLOUD_DEFAULT_VOICE
  stopGASources()                              // 旧 GA 会话（若有）：停源，回调已由 token 短路
  const sess = { mode: 'cloud', ga: true, tok, tag: tag || '', chunks, urls: [], i: 0, nextAt: 0, sources: [], paused: false, done: false, voiceName: useVoice }
  ga = sess
  session = sess
  sess.urls = chunks.map((t) => cloudTtsUrl(t, rate, useVoice))
  /* 响度链（每会话一次）：微软合成 MP3 实测（2026-09-15 傍晚 loudness_probe，150/300 字两样本）
     peak -7.5/-4.9dBFS、RMS ≈-24dBFS——合成响度天然偏轻，用户听感"声音太小"。
     主增益 1.6x(+4.1dB) 补到正常语音响度（最坏峰 0.566×1.6=0.906 不削波），
     限幅器兜底（-1.5dBFS 以上才压，平时直通）防个别更高峰文本爆音。 */
  sess.master = ctx.createGain(); sess.master.gain.value = 1.6
  sess.lim = ctx.createDynamicsCompressor()
  sess.lim.threshold.value = -1.5; sess.lim.knee.value = 0; sess.lim.ratio.value = 20
  sess.lim.attack.value = 0.002; sess.lim.release.value = 0.12
  sess.master.connect(sess.lim); sess.lim.connect(ctx.destination)
  const FADE = 0.005
  /* place(idx, buf)：把已解码的一块钉上时间线。顺序由 schedule 串行链保证，
     绝不并行排程——并行 decode 完成次序不定，谁先到谁先排会把内容排乱。 */
  const place = (idx, buf) => {
    const ch = buf.getChannelData(0)
    const { start, end } = gaTrimRange(ch)
    const sr = buf.sampleRate
    const dur = Math.max(0.02, (end - start) / sr)
    const t = Math.max(sess.nextAt, ctx.currentTime + 0.03)
    let src, g
    src = ctx.createBufferSource(); src.buffer = buf
    g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(1, t + FADE)
    g.gain.setValueAtTime(1, Math.max(t + FADE, t + dur - FADE))
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    src.connect(g); g.connect(sess.master)
    src.start(t, start / sr, dur)
    sess.sources.push(src)
    sess.nextAt = t + dur
    sess.i = idx + 1
    if (idx === sess.urls.length - 1) {
      src.onended = () => {
        if (tok !== token) return
        sess.done = true
        if (ga === sess) ga = null
        if (session === sess) session = null
        if (onDone) onDone()
      }
    }
  }
  /* schedule(idx)：串行接力链——decode 完成即 place，随后 schedule(idx+1)。
     【2026-09-15 下午事故修复】初版只排第一块：排完块 idx 后只"预解码"了下一块、
     没有递归 schedule，中间块又没挂 onended → 首块（以句号收尾）播完即永久静音。
     网络等待由下面的全块并行预取吃掉：预取先到 → gaDecode 命中缓存秒排（无缝）；
     预取未到 → t=currentTime+0.03 接在当前播，块间最多再等一个 RTT。 */
  const schedule = (idx) => {
    if (tok !== token || sess.done) return
    gaDecode(sess.urls[idx]).then((buf) => {
      if (tok !== token || sess.done) return
      try {
        place(idx, buf)
      } catch { if (idx + 1 < sess.urls.length) schedule(idx + 1); return }
      if (idx + 1 < sess.urls.length) schedule(idx + 1)
    }).catch(() => {
      if (tok !== token || sess.done) return
      if (idx + 1 < sess.urls.length) schedule(idx + 1)      // 单块失败跳过，绝不整段挂死
      else { sess.done = true; if (ga === sess) ga = null; if (session === sess) session = null; if (onDone) onDone() }
    })
  }
  try { if (ctx.state === 'suspended') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}) } } catch { /* ignore */ }
  for (let k = 1; k < sess.urls.length; k++) gaDecode(sess.urls[k]).catch(() => {})   // 全块并行预取（塞 gaCache，供串行链秒取）
  schedule(0)
  return true
}
/* 新云端会话接管：GA 旧源直接停；旧元素管线只 pause 不清 src（0c180c9 结论：保手势预载） */
function handoverCloud() {
  if (ga) { stopGASources(); return }
  pauseCloud()
  cloudPlaying = null
}
/* 云端线路分派（2026-09-15 下午）：微软代理线 → GA 无缝管线（CORS 可读字节）；
   百度备用线无 CORS → 旧 <audio> 管线。 */
function speakCloudLine(chunks, rate, onDone, my, voice, tag) {
  if (isEdgeVoice(voice) && webAudioOK()) return speakCloudGA(chunks, rate, onDone, my, voice, tag)
  return speakCloud(chunks, rate, onDone, my, voice)
}
/* 暂停会话的上下文键（Practice 开关续播对表用；Node/无会话 → ''） */
export function currentPauseTag() {
  const s = session
  return (s && s.paused && !s.done) ? (s.tag || '') : ''
}
/* 云端双缓冲逐块播放：单块失败跳过继续，绝不整段挂死。
   voice 决定线路：微软神经音走两跳代理，百度女声走 fanyi（备用）；
   音色在整段开始时锁定一次（与系统语音链同样的"整段同一音色"原则）。
   播放策略：下一块的 URL 已在另一元素缓冲 → 直接切过去播（零等待）；
   否则当场加载（旧行为兜底）。 */
/* ── 尾部提前续播（2026-09-15，修"句号后面顿一下"）──
   每块是独立合成音频，自带 ~0.1-0.3s 首尾静音；块边界≈句号边界，
   "ended 事件派发 → step → play 管线"的串行空隙 + 两段静音 = 用户听到的停顿。
   做法：rAF 轮询播放位，剩 TAIL_LEAD 秒（落在句尾衰减/静音区，无听感）就提前
   step() 切到已预载的下一块——下一块的开头静音正好补齐切换空隙 → 听感连续。
   兜底链：onended（提前切失效时照常推进）→ onerror（单块失败跳过）。
   降级链：无 rAF（Node/老内核）用 60ms 轮询；后台标签页 rAF 暂停 → 自动回落 onended。 */
const TAIL_LEAD = 0.18
const rafOf = (f) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : setTimeout(f, 60))
const cafOf = (h) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(h) : clearTimeout(h))
export function speakCloud(chunks, rate, onDone, my, voice, tag) {
  if (!cloudSupported() || !chunks || !chunks.length) return false
  stopGASources()                              // GA → legacy 接手：先停掉 GA 已排程源
  const tok = my === undefined ? ++token : my
  const els = ensureCloudEls()
  if (!els) return false
  const useVoice = isCloudVoice(voice) ? voice : CLOUD_DEFAULT_VOICE
  const sess = { mode: 'cloud', chunks, i: 0, paused: false, done: false, voiceName: useVoice, tag: tag || '' }
  session = sess
  const urlOf = (t) => cloudTtsUrl(t, rate, useVoice)
  let tailRaf = 0
  const armTail = (el) => {
    cafOf(tailRaf)
    const tick = () => {
      if (tok !== token || el !== cloudPlaying) return        // 会话更替/已切走：停轮询
      if (el.paused) { tailRaf = rafOf(tick); return }        // 暂停中：保持轮询等恢复
      const d = el.duration
      if (isFinite(d) && d > 0 && el.currentTime > 0 && el.currentTime >= d - TAIL_LEAD) {
        step()                                                // 尾部静音区：提前切播预载下一块
        return
      }
      tailRaf = rafOf(tick)
    }
    tailRaf = rafOf(tick)
  }
  const step = () => {
    if (tok !== token || sess.paused) return
    if (sess.i >= chunks.length) {
      sess.done = true
      cloudPlaying = null
      if (onDone) onDone()
      return
    }
    const url = urlOf(chunks[sess.i++])
    let el = cloudPlaying || els[0]
    const idle = el === els[0] ? els[1] : els[0]
    if (idle.src === url) el = idle           // 预载命中：切到已缓冲的元素，零等待接播
    cloudPlaying = el
    try {
      if (el.src !== url) { el.src = url; try { el.load() } catch { /* ignore */ } }  // 幂等 + load() 复位残留错误态
      const p = el.play(); if (p && p.catch) p.catch(() => {})
    } catch { setTimeout(step, 150); return }
    armTail(el)                               // 尾部提前续播轮询（onended 兜底仍在）
    if (sess.i < chunks.length) {             // 立刻预载下一块到空闲元素
      const nxt = urlOf(chunks[sess.i])
      try { if (idle.src !== nxt) idle.src = nxt } catch { /* ignore */ }
    }
  }
  for (const el of els) {
    cloudDetach(el)                           // 先解绑旧会话/清场残留的 handler 再挂新的
    el.onended = () => { if (tok === token && el === cloudPlaying) step() }
    el.onerror = () => {
      if (tok !== token || el !== cloudPlaying) return
      if (!el.getAttribute('src')) return     // src 被清空触发的"清场 error"：无视，不推进
      step()
    }
  }
  step()
  return true
}
/* 手势内预载首块（2026-09-15，修"点开解析要等一会才读"）：
   在「展开参考答案」的点击处理里同步调用——把 520ms 蜡封动画 + speak() 链路的时间
   全部变成首块合成/下载窗口，speakCloud 到达时 idle.src 已命中 → 直接开播。
   音色决策与 speak() 云端分支一致：显式云端音色用它，自动档用云健。幂等，失败静默。 */
export function prefetchCloudFirst(raw, rate = ttsRate()) {
  if (!cloudSupported()) return false
  const pref = ttsVoicePref()
  const useVoice = isCloudVoice(pref) ? pref : CLOUD_DEFAULT_VOICE
  /* 与 speak() 云端分支完全同参切块（cm + firstMax）——chunks[0] 的 URL 必须逐字节一致，
     否则预载命中判定落空 */
  const cm = cloudChunkMaxFor(useVoice)
  const chunks = chunkSpeechText(raw, cm, CLOUD_CHUNK_MAX)
  if (!chunks.length) return false
  /* GA 线（微软代理）：预取 = fetch+decode 进 gaCache，开口时免网络免解码 */
  if (isEdgeVoice(useVoice) && webAudioOK()) {
    try { gaWarm(cloudTtsUrl(chunks[0], rate, useVoice)); return true } catch { return false }
  }
  const els = ensureCloudEls()
  if (!els) return false
  const idle = els[0] === cloudPlaying ? els[1] : els[0]
  const url = cloudTtsUrl(chunks[0], rate, useVoice)
  try { if (idle.src !== url) idle.src = url; return true } catch { return false }
}
/* 答题期后台预载（2026-09-15 晚"点解析/翻题就出声"）：只走 GA 线 fetch+decode 进
   gaCache，不碰 <audio> 元素——不与正在朗读的题干抢双缓冲元素，也不受 stopSpeak
   清场影响（gaCache 是 JS Map）。URL 与 speak() 云端分支逐字节同参（同
   chunkSpeechText(cm, CLOUD_CHUNK_MAX) 切块/同音色决策/同语速），揭晓开口时首块
   gaDecode 直接命中缓存秒排（A9 已实证 gaCache 命中 reqs=0）。幂等：同 URL 并发
   共享同一 promise，不产生重复请求。失败静默。 */
export function prefetchGACache(raw, rate = ttsRate()) {
  if (!cloudSupported() || !webAudioOK()) return false
  const pref = ttsVoicePref()
  const useVoice = isCloudVoice(pref) ? pref : CLOUD_DEFAULT_VOICE
  if (!isEdgeVoice(useVoice)) return false      // GA 管线仅 Edge 神经音；百度线仍由手势 prefetchCloudFirst 兜底
  const cm = cloudChunkMaxFor(useVoice)
  const chunks = chunkSpeechText(raw, cm, CLOUD_CHUNK_MAX)
  if (!chunks.length) return false
  try { gaWarm(cloudTtsUrl(chunks[0], rate, useVoice)); return true } catch { return false }
}
/* 「自动」档的引擎决策（纯函数，可回归）：
   显式选了云端/系统就照办；
   自动档下 2026-09-15 下午起 **云端可用一律走云端**：GA 管线把块解码裁静音后采样级
   拼接，零块边界；而桌面 native 对 Online 神经音是逐 utterance 网络合成（块间隙
   0.3~1s，块边界≈句号边界 = 用户报的卡顿），且 GA 与 native 用的是同一个微软音色，
   音质相同、还省掉 waitVoice 等待。云端不可用才回系统（不臆造能力）。 */
export function engineFor(autoQuality, pref, cloudOK) {
  if (isCloudVoice(pref)) return 'cloud'
  if (pref) return 'sys'
  if (!cloudOK) return 'sys'
  return 'cloud'
}

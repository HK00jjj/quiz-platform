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
   默认 1.10×（2026-10-04 二改，用户报"连续朗读节奏赶、听众觉得赶"）。
   取证（tools/probe_pacing.mjs，本地复刻合成 + mpg123 解码量测，528 字真实解析样本）：
   · 1.35× 云健 = 总时长 76.6s → 折算 ≈6.9 字/秒（413 字/分），比中文旁白基准快 ≈70%；
   · 1.10× 晓晓 = 101.7s ≈5.2 字/秒（311 字/分）；叠加下面的"换行呼吸"后 ≈4.4 字/秒（264 字/分），
     落在舒适叙述区间（研究口径：朗读/教程类 0.85~1.1×；TTS skill 中文默认 4 字/秒；
     Murphy/Hoover/Ritter 2018：叙述文本 2.5× 起理解率骤降——1.35 属"熟悉内容复听"档）。
   调速与开关合并为一个「声音」控件（解析区点开 → 滑块无级调 + 开关），
   0.5~2.0 之间任意值，0.01 步进，落 localStorage `qp.tts.rate`。 */
export const TTS_RATE = 1.10
/* 旧默认（2026-09-13~10-04）。用户存的值恰等于它 = 从未主动调过 → 一次性跟到新默认；
   任何其他值都是主动选择，原样尊重（迁移标记 qp.tts.pacing2，只做一次）。 */
const RATE_PREV_DEFAULT = 1.35
const LS_RATE_MIGRATED = 'qp.tts.pacing2'
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
/* 存量语速存储的读取（纯函数，便于回归断言）：返回 { rate, migrated } */
export function migrateRate(raw, migratedFlag) {
  if (raw === null || raw === '' || raw === undefined) return { rate: TTS_RATE, migrated: false }
  const n = Number(raw)
  if (!isFinite(n)) return { rate: TTS_RATE, migrated: false }
  if (n === RATE_PREV_DEFAULT && !migratedFlag) return { rate: TTS_RATE, migrated: true }
  return { rate: clampRate(n), migrated: false }
}
export function ttsRate() {
  try {
    if (typeof window === 'undefined') return TTS_RATE
    const st = window.localStorage
    const { rate, migrated } = migrateRate(st.getItem(LS_RATE), st.getItem(LS_RATE_MIGRATED))
    if (migrated) { st.setItem(LS_RATE_MIGRATED, '1'); st.setItem(LS_RATE, String(rate)) }
    return rate
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
/* 上标/下标/罗马数字读法表（2026-09-27 公式读音审计新增；数据来源=全库符号扫描 tts_symbol_report.json） */
const SUP_READ = { '⁰': '0', '¹': '1', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
const SUB_READ = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const ROMAN_READ = {
  'Ⅰ': '一', 'Ⅱ': '二', 'Ⅲ': '三', 'Ⅳ': '四', 'Ⅴ': '五', 'Ⅵ': '六',
  'Ⅶ': '七', 'Ⅷ': '八', 'Ⅸ': '九', 'Ⅹ': '十', 'Ⅺ': '十一', 'Ⅻ': '十二'
}
const GREEK_READ = {
  α: '阿尔法', β: '贝塔', γ: '伽马', δ: '德尔塔', Δ: '德尔塔', ε: '艾普西龙',
  ζ: '泽塔', η: '伊塔', θ: '西塔', Θ: '西塔', ι: '约塔', κ: '卡帕',
  λ: '兰姆达', Λ: '兰姆达', μ: '缪', ν: '纽', ξ: '赛', Ξ: '赛',
  π: '派', Π: '派', ρ: '柔', σ: '西格玛', Σ: '西格玛', τ: '陶',
  υ: '宇普西龙', Υ: '宇普西龙', φ: '斐', Φ: '斐', χ: '凯',
  ψ: '普赛', Ψ: '普赛', ω: '欧米伽', Ω: '欧姆'
}
/* 括号读法口径 v3（2026-10-05 晨，用户明确："只要公式才读括号，其他情况不读括号"）：
   v2 的"≤5 字分级"已废——长旁注（（端子松脱导致）（完全相同…））仍会念"括号…括号完"，用户不要。
   新判据：括号内容（此处已经过 normalizeSpeech 前序层变换）含**数学运算符**才视为公式分组：
   (a) 无歧义数学符号（乘除间隔点幂号等号比较符）直接算公式——"kW·h" 除外见数据（间隔点在
       单位里也会命中，如 瓦除以括号平方米乘K括号完，这正是想要的）
   (b) 加号/减号必须一侧紧邻数字——排除 TN-S、FX5U-32MT 这类型号连字符
   (c) 中文算符（加减乘除以等于大于小于）一侧须为数字或字母——排除"减少/减速/衰减/乘法/
       更加/乘客"这类散文词（"减少发热"不含公式，不当公式读）
   全库取证（tools/probe_paren_policy.mjs，31888 对括号）：命中 899 种/1234 次（逐条人审全为
   真公式：1-s、Dp−dp、R1加R2、根号3乘U乘功率因数乘伊塔、0加、m²·h…），其余 30654 次旁注
   全部只读内容。空括号（判断题填空位）仍读一次"括号"——那是作答位提示，不算旁注。 */
const PAREN_MATH = /[×÷*/·^=<>≥≤≈]|\d\s*[+\-−]\s*\S|\S\s*[+\-−]\s*\d|[0-9A-Za-z]\s*(?:加|减|乘|除以|等于|大于|小于)|(?:加|减|乘|除以|等于|大于|小于)\s*[0-9A-Za-z]/
function isFormulaParen(t) {
  return PAREN_MATH.test(t)
}
export function normalizeSpeech(raw) {
  let s = String(raw ?? '')
  /* ⓪ 全角/变体码点归一（2026-09-27 公式读音审计：＝56 处此前完全不读"等于"；
     ＞＜全角 4 处；µ MICRO SIGN(U+00B5) 与 μ 希腊 mu(U+03BC) 双码点防御性归一） */
  s = s.replace(/＝/g, '=').replace(/＞/g, '>').replace(/＜/g, '<').replace(/％/g, '%')
  s = s.replace(/＋/g, '+')                              // 2026-10-04：全角加号 181 处归一，交 ②-c 三分（正/加）
  s = s.replace(/\u0130/g, 'I')                          // 2026-10-04：İ 相量符号（U+0130 带点 I，差动保护 |Σİ| 4 处）→ I
  /* markdown 加粗对先剥离（双星，全库仅 1 处）。单星斜体不设规则：全库扫描 54 处 *
     全为数学乘号（2*pi*R*C 的乘号会被斜体配对误吃），剩余孤立 * 一律转"乘"。
     必须在 normalizeSpeech 内做而非 cleanSpeechText——那边 [*] 一刀切删除会把乘号
     语义一起丢；先剥加粗对再乘化，两个语义都保住。 */
  s = s.replace(/\*{2}([^*\n]{1,32}?)\*{2}/g, '$1')
  s = s.replace(/\s*\*\s*/g, '乘')
  /* |Z| 绝对值竖线（2026-10-04 重写）：原版直接删除丢失绝对值语义（|Σİ|、|U_AB|、|I_N|、
     20lg|G| 共 106 处取证全为绝对值义）→ 配对读前缀"绝对值X"，未配对残留才删除。
     用前缀而非"X的绝对值"：分母语境（U/|Z|）以中文"绝"开头，不会落到 ②-g 5) 的
     字母并列零宽规则（那里会误读"或"），由 8) 收尾前瞻"绝对值"接住 → "U除以绝对值Z" */
  s = s.replace(/\|([^|\n]{1,24})\|/g, '绝对值$1').replace(/\|/g, '')
  s = s.replace(/\u00B5/g, 'μ')
  /* 上标撇号（U₁'、Uo' 一次侧标记）与弧分符号 ′″：删除（"P 1'/(根号3U N)" 的撇号
     会让除法分母判定失配） */
  s = s.replace(/[\u2032\u2033']/g, '')
  /* 变频器/直流母线端子 P/+、N/-（三菱系）：读 "P正 / N负" */
  s = s.replace(/P\s?\/\s?\+/g, 'P正').replace(/N\s?\/\s?-([A-Za-z])/g, 'N负$1')
  /* ⓪-b 罗马数字（全库 38 处：Ⅰ类设备/Ⅱ类工具——引擎对 U+2160 区读法不保证） */
  s = s.replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]/g, (c) => ROMAN_READ[c] ?? c)
  /* ⓪-c 面积/体积单位（2026-09-27 补：mm² 全库 224 处、m³ 29 处——原 ² 规则把它们读成
     "毫米平方"。**必须放在全部单位规则之前**：否则 mm/m 基本单位规则先命中 "2.5mm²" 的
     "mm"（² 是非词字符存在边界），拆成"毫米"+孤立上标。顺序 km→mm→cm→m 长键优先） */
  s = s.replace(/km²/g, '平方千米').replace(/mm²/g, '平方毫米').replace(/cm²/g, '平方厘米').replace(/m²/g, '平方米')
    .replace(/mm³/g, '立方毫米').replace(/cm³/g, '立方厘米').replace(/m³/g, '立方米')
  /* ① 复合单位先处理（顺序敏感：kVA/kvar 必须在 kV 之前，否则 "kV·A" 会被拆成"千伏·A"） */
  s = s.replace(/kV\s?[·・]?\s?A\b/g, '千伏安').replace(/kvar\b/gi, '千乏')   // 注意不要用 \bkvar（数字后无词边界）
  /* 2026-09-27 修正（公式读音审计 INC-20260927-01）：mΩ=毫欧、MΩ=兆欧——原 [mM] 不分
     大小写，全库 4 处接触电阻 0.5mΩ 被读成"兆欧"（差 9 个数量级）；MΩ 139 处绝缘电阻不受影响 */
  s = s.replace(/([kK])\s?Ω/g, '千欧').replace(/M\s?Ω/g, '兆欧').replace(/m\s?Ω/g, '毫欧')
  s = s.replace(/μ\s?F/g, '微法').replace(/μ\s?A/g, '微安').replace(/μ\s?s/g, '微秒')
    .replace(/μ\s?H/g, '微亨').replace(/μ\s?m/g, '微米').replace(/μ\s?V\b/g, '微伏')
  s = s.replace(/Ω/g, '欧姆')
  s = s.replace(/(℃|°\s?C)/g, '摄氏度').replace(/℉/g, '华氏度')
  /* 2026-09-27：mA（毫安，全库 771 处）与 MA（兆安）按大小写区分（原 [mM] 一律读"毫安"） */
  s = s.replace(/([kK])\s?V\b/g, '千伏').replace(/kV/g, '千伏').replace(/m\s?A\b/g, '毫安').replace(/M\s?A\b/g, '兆安')
  /* 2026-09-15（用户实测"220伏读成220v"）：**单独的 V/A/W 是纯拉丁字母，中文引擎按字母念**
     ——必须映射成中文单位。负向断言防误伤：A 后不接字母/型类组（避免 "12AB" 选项串、"2A型"）；
     V/W 要求词边界（"6V6" 电子管型号、"VFD" 缩写不受影响）。 */
  s = s.replace(/(\d(?:\.\d+)?)\s?V\b/g, '$1伏')
  s = s.replace(/(\d(?:\.\d+)?)\s?A(?![A-Za-z型类组项])/g, '$1安')
  s = s.replace(/(\d(?:\.\d+)?)\s?W\b/g, '$1瓦').replace(/(\d(?:\.\d+)?)\s?Wh\b/g, '$1瓦时')
  /* 2026-09-27 两处顺序修正（公式读音审计 INC-20260927-02/03）：
     ① kW·h（全库 45 处）必须先于 kW，否则 · 乘规则把它拆成"千瓦乘h"；
     ② kHz（28 处）/MHz（8 处）必须先于 Hz——原顺序下 /Hz/g 抢先命中，100kHz 读成"100k赫兹" */
  s = s.replace(/kWh/gi, '千瓦时').replace(/kW\s?[·・]\s?h/gi, '千瓦时').replace(/kW/g, '千瓦')
    .replace(/kHz/gi, '千赫兹').replace(/MHz/gi, '兆赫兹').replace(/Hz/g, '赫兹')
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
    /* 2026-10-04 补（全库扫描取证）：视在功率 VA 39 处 / MVA 1 处（"3.5MVA容量"、"55VA"）；
       无功 var 9 处（"2009var"、"单位是 var"，kvar 已先行）；dB 45 处 + dBm 7 处
       （"20lg|G|，单位dB"、TEV 超声检测）；焦耳 J 58 处（"13200J"、"1W×1s=1J"）；
       电感 H 裸用（"L=0.2H"、"1H=1000mH"——lookbehind 排除型号 "A72H"，
       负向断言排除化学式 "2H₂"）；纳秒 ns 11 处（"1ns"、"5/50ns"） */
    .replace(/(\d(?:\.\d+)?)\s?MVA\b/g, '$1兆伏安').replace(/(\d(?:\.\d+)?)\s?VA\b/g, '$1伏安')
    .replace(/(\d(?:\.\d+)?)\s?var\b/g, '$1乏').replace(/\bvar\b/g, '乏')
    .replace(/(\d(?:\.\d+)?)\s?dBm\b/g, '$1分贝毫瓦').replace(/(\d(?:\.\d+)?)\s?dB\b/g, '$1分贝').replace(/\bdB\b/g, '分贝')
    .replace(/(\d(?:\.\d+)?)\s?J\b/g, '$1焦')
    .replace(/(?<![A-Za-z0-9.])(\d(?:\.\d+)?)\s?H(?![₀-₉A-Za-z])\b/g, '$1亨')
    .replace(/(\d(?:\.\d+)?)\s?ns\b/g, '$1纳秒')
    .replace(/(\d(?:\.\d+)?)\s?r\/min\b/gi, '$1转每分').replace(/(\d(?:\.\d+)?)\s?°(?!\s?[CF])/g, '$1度')
  /* ①-c 时间/长度基本单位（2026-09-27 补，全库实测裸用：min 115 / s·h·m 数十处；
     必须排在 ms/Wh/kWh/mΩ/mA 等复合单位之后，min 必须先于 m，否则 "5min" 被拆成"5米in"） */
    .replace(/(\d(?:\.\d+)?)\s?min\b/gi, '$1分钟')
    .replace(/(\d(?:\.\d+)?)\s?s\b/g, '$1秒')
    .replace(/(\d(?:\.\d+)?)\s?h\b/g, '$1小时')
    .replace(/(\d(?:\.\d+)?)\s?m\b/g, '$1米')

  /* ② 数学/关系符号 */
  s = s.replace(/≥/g, '大于等于').replace(/≤/g, '小于等于').replace(/≠/g, '不等于')
    .replace(/≈/g, '约等于').replace(/±/g, '正负').replace(/×/g, '乘').replace(/÷/g, '除以')
    .replace(/√/g, '根号').replace(/∞/g, '无穷大').replace(/∅/g, '空集')
  /* ②-a 比较符（2026-09-27 补：>= 5 处、> 39 处、< 72 处、∝ 20 处此前无规则、读法不保证） */
  s = s.replace(/>=/g, '大于等于').replace(/<=/g, '小于等于')
  s = s.replace(/>/g, '大于').replace(/</g, '小于').replace(/∝/g, '正比于')
  /* ②-b 波浪号区间（2026-09-27 补：~ 740 处 + 全角 76 处，语境全为区间：0~10V → 0到10伏；
     字母范围/装饰性残留（A~B、句尾~）兜底转停顿，避免引擎读"波浪号"） */
  s = s.replace(/(\d)\s*[~～]\s*(\d)/g, '$1到$2').replace(/[~～]/g, '，')
  /* ②-c 加/正/负号（2026-09-27 补：+ 全库 1037 处此前无规则。三分：
     符号位（左邻开头/空白/标点/中文/左括号、右随数字）→"正/负"（+24V 电源正极、U = -36V）；
     L+/M+ 端子 →"正"；其余（R1+R2 串联相加、电源+控制）→"加"。
     数字间紧贴连字符（4-20mA、0-10V、FX5U-32MT、GB50168-2018）保持原样——全库 266 处取证
     全是型号/区间义、没有一处减法，引擎自行读"杠/到"均可懂；真正的公式减号题库一律用
     U+2212（276 处，在⑥转"减"）。 */
  s = s.replace(/(^|[^\dA-Za-z%)）\]])-\s*(?=[0-9.])/g, '$1负')
  s = s.replace(/(^|[^\dA-Za-z%)）\]])\+(?=[0-9Vv])/g, '$1正')
  s = s.replace(/([LlMm])\+(?![0-9A-Za-z])/g, '$1正')
  s = s.replace(/\+/g, '加')
  /* ②-d 间隔号乘号（2026-09-27 补：· 331 处，除 kV·A/kW·h 已先行消化外全为乘：
     W=P·t、Ω·mm²/m、u=L·di/dt；用零宽断言——捕获组版在连续乘号链 U·cosφ·η 中会因
     共享字符被上一匹配消费而漏掉中间的 ·；右侧含中文——mm² 已在 ⓪-c 转成"平方毫米"，
     Ω·平方毫米 的乘义不能丢；两侧非字母数字的残留 ·（人名间隔等）转停顿 */
  s = s.replace(/(?<=[\w)）°%ΩμΑ-Ωα-ω\u4e00-\u9fa5])\s*·\s*(?=[\w(（μΑ-Ωα-ω\u4e00-\u9fa5])/g, '乘').replace(/·/g, '，')
  /* ②-e 百分号前置（2026-09-27 补：% 742 处；裸 % 各引擎读法不一，前置"百分之"最稳；
     数字必须 \d+ 多位——前置插入型规则若只捕获一位数字，"50%" 会被拆成"5百分之0"
     （后缀型 $1单位 靠正则回溯恰好正确，前置型不行）。残留 %（PLC 地址 %I0.0 前缀）
     删除，读 "I 0.0" 反而干净。‰ 9 处同理前置） */
  s = s.replace(/(\d+(?:\.\d+)?)\s?%/g, '百分之$1').replace(/(\d+(?:\.\d+)?)\s?‰/g, '千分之$1')
    .replace(/%/g, '').replace(/‰/g, '')
  /* ②-f0 上标负号（2026-10-04 补，全库 37 处：SIL3 约 10⁻³~10⁻⁴、10⁻⁶F、10⁻⁷Ω·m）——
     原版 ⁻ 不在"的X次方"捕获集也不在残留删除集，"10⁻³" 会读成孤零零的"十"。
     必须先于 ²³ 与孤立上标删除（⁻ 后可跟 ²/³） */
  s = s.replace(/([0-9A-Za-z)）])\u207B([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,
    (m, b, sup) => {
      const M = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
      return `${b}的负${[...sup].map((c) => M[c] ?? '').join('')}次方`
    })
  /* ②-f 上标/下标 Unicode（2026-09-27 补：⁶ 21 处等其余上标此前被引擎吞掉；
     下标 ₁₂₃₀ 共 108 处（U₁、Q₁、tanφ₁）同理。**必须先于斜杠规则**——
     否则 "U²/R" 的分子 "U²" 含 ² 不在分词字符集内，除法判定失配。
     mm²/cm²/m² 已在 ①-d 整体消化为面积单位，不会落到这里） */
  s = s.replace(/([0-9A-Za-z)）])²/g, '$1平方').replace(/([0-9A-Za-z)）])³/g, '$1立方')
  s = s.replace(/([0-9A-Za-z)）])[⁰¹⁴⁵⁶⁷⁸⁹]/g, (m, b) => `${b}的${SUP_READ[m[m.length - 1]]}次方`)
  s = s.replace(/([0-9A-Za-z)）])ⁿ/g, '$1的n次方')
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ\u207B]/g, '')               // 残留孤立上标（引擎读不出）直接删（2026-10-04 补 ⁻）
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => SUB_READ[c])        // U₁ → U1（后续"字母紧贴数字"规则拆成 U 1）
  /* ②-g 斜杠（2026-09-27 重写，INC-20260927-04：全库 / 4051 处原一律读"或"，而
     U/R、220/0.5、40/0.5 这类除法大量存在＝语义错误；但并列义也占多数（380/220V 配电、
     S/S 端子、I/O、N/PE、NO/NC、NPN/PNP、L1/L2、U/V/W 相），不能全改除法。三段式：
     1) GB/T → "GB T"（读"国标 T"，避免"国标或T"）
     2) 微分形式 di/dt、du/dt → 工程术语"电流/电压变化率"
     3) 第一遍：运算符/括号之后（=375/48、×40/0.5、R1R2/(R1+R2)、（2-1.0）/2）→ "除以"
        ——分子允许含已转换的中文与减号（U² /（24−1.2−0.3）均已成形），惰性延伸到 /
     4) 第二遍：无运算符前缀时按形态——数字/数字且后随中文单位 → "或"（380/220伏配电、
        50/60赫兹）；其余数字/数字 → "除以"（375/48）；字母混合 → "或"（并列占绝对多数）
     5) 中文/拉丁单位 → "每"（Ω·平方毫米/m → 平方毫米每米） */
  s = s.replace(/GB\s?\/\s?T\b/g, 'GB T')
  s = s.replace(/\bd([iu\u03C6])\s?\/\s?dt\b/g, (m, x) => (x === 'i' ? '电流变化率' : x === 'u' ? '电压变化率' : '磁通变化率'))
  s = s.replace(/([=+\u2212\-×÷·><≥≤≈±√()（）乘加正负]\s*)((?:[\w)）.．\u4e00-\u9fa5\u0391-\u03C9\u2212\- ]){1,24}?)\s*\/\s*((?:[\w(（.．\u4e00-\u9fa5\u0391-\u03C9])+)/g,
    (m, pre, a, b) => {
      /* 分子为纯中文单位词（不含任何数字/字母，如"平方毫米"）且分母是单位字母 →
         复合单位读"每"（Ω·平方毫米/m → 平方毫米每米）；其余 → 除法"除以" */
      if (!/[0-9A-Za-z\u0391-\u03C9]/.test(a) && /^(mm|cm|km|min|m|s|h)$/.test(b)) {
        return `${pre}${a}每${({ mm: '毫米', cm: '厘米', km: '千米', min: '分钟', m: '米', s: '秒', h: '小时' })[b]}`
      }
      return `${pre}${a}除以${b}`
    })
  s = s.replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?=[\u4e00-\u9fa5])/g, '$1 或 $2')
  s = s.replace(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, '$1除以$2')
  /* 2026-10-04 补（读音错误排查）：数字/字母编号分母（1/C1、1/R1、3/F11 电容串联/分压
     分式）→ "除以"——句首无运算符前缀时会落进 5) 字母并列零宽规则被误读"或"，
     同一公式串里 "+1/C2"（有加号前缀）读"除以"而 "1/C1" 读"或"，前后不一致。
     分母收紧为"字母+数字"编号形态（C1/R1），避开 "380/220V"（数字分母）与单字母分母。 */
  s = s.replace(/(?<=\d)\s*\/\s*(?=[A-Za-z]\d)/g, '除以')
  /* 2026-10-04 补（读音错误排查 · 分母为括号/上标的分式）：左侧为拉丁/数字/上标时，
     下面的链式并列规则（L282 `(?<=[\w)）.．])\s*\/\s*(?=[\w(（.．])` → "或"）会抢先命中，
     把确定无疑的分式读成并列——实测 R1R2/(R1+R2)、1/(2πfC)、U/(4.44fN)、X/(Y+Z)、
     600r/(kW·h) 全部读"或"（语义反了）。这两条必须在链式规则之前：
     ① 斜杠后紧跟括号分组 → 除以（左为 ) 的中文分母如 瓦/(平方米·K) 由 L312 兜住，不冲突）；
     ② 上标已转"平方/立方"后接斜杠 → 除以（U²t/R → U平方t除以R；单位"平方米/秒"
        因"米"不在 [A-Za-z0-9] 内不命中，仍走 L283 的"每"，不受影响）。 */
  s = s.replace(/(?<=[A-Za-z0-9\u00b2\u00b3\u2070\u00b9\u2074\u2075\u2076\u2077\u2078\u2079])\s*\/\s*(?=[（(])/g, '除以')
  s = s.replace(/(平方|立方)([A-Za-z0-9]*)\s*\/\s*(?=[A-Za-z0-9\u0391-\u03C9])/g, '$1$2除以')
  /* 零宽断言版：链式并列 U/V/W、L1/L2/L3、R/S/T 中每个斜杠都要命中（捕获组版会因
     共享字符被上一匹配消费而漏掉中间的斜杠，残留 "/W" 被引擎念成"斜杠"） */
  s = s.replace(/(?<=[\w)）.．])\s*\/\s*(?=[\w(（.．])/g, ' 或 ')
  s = s.replace(/([\u4e00-\u9fa5])\s*\/\s*(mm|cm|km|min|m|s|h)\b/g,
    (m, zh, u) => zh + '每' + ({ mm: '毫米', cm: '厘米', km: '千米', min: '分钟', m: '米', s: '秒', h: '小时' }[u] || u))
  /* 6) 中文/中文斜杠（2026-09-27 全库残留 660 处，全部零宽断言防链式漏配）按右侧词性分流：
     功率单位 → "除以"（功率因数 = 千伏安/千瓦，23 处）；时间/长度/温度/次数单位 → "每"
     （电流上升率 千安/微秒、爬电比距 千伏/毫米）；其余并列词 → "或"（漏型/源型、高/低、
     常开/常闭、交流/直流，占绝大多数） */
  s = s.replace(/(?<=[\u4e00-\u9fa5])\s*\/\s*(?=千伏安|千乏|千瓦|兆瓦)/g, '除以')
  s = s.replace(/(?<=[\u4e00-\u9fa5])\s*\/\s*(?=微秒|毫秒|平方毫米|秒|分钟|分|小时|毫米|厘米|千米|米|摄氏度|年|月|日|天|次|圈|转|格)/g, '每')
  s = s.replace(/(?<=[\u4e00-\u9fa5])\s*\/\s*(?=[\u4e00-\u9fa5])/g, '或')
  /* 7) 混合收尾（2026-09-27 全库复扫后补）：左侧中文（380伏/220伏、5千瓦/380伏、
     10千伏/0.4千伏 全是额定参数并列）→ "或"；左数字右中文（1/根号3 相电压比、
     2/三次方根）→ "除以"；左中文右拉丁（N型/P型）→ "或" */
  s = s.replace(/(?<=[\u4e00-\u9fa5])\s*\/\s*(?=\d)/g, '或')
  s = s.replace(/(?<=\d)\s*\/\s*(?=[\u4e00-\u9fa5√])/g, '除以')
  s = s.replace(/(?<=[\u4e00-\u9fa5])\s*\/\s*(?=[A-Za-z])/g, '或')
  /* 8) 拉丁左侧收尾：数学词右随（Ud/根号2、U/(根号3U N)）→ "除以"；单位复合（V/微秒）
     → "每"；普通中文（KNX/路创、EMC/接地、VOH/耐压）→ "或" */
  s = s.replace(/(?<=[A-Za-z0-9])\s*\/\s*(?=根号|√|加|减|百分之|绝对值|\(|（)/g, '除以')   // 2026-10-04 加"绝对值"（U/|Z| → U除以绝对值Z）
  s = s.replace(/(?<=[A-Za-z])\s*\/\s*(?=微秒|毫秒|秒|毫安|千安|毫米|厘米|米|摄氏度)/g, '每')
  s = s.replace(/(?<=[A-Za-z])\s*\/\s*(?=[\u4e00-\u9fa5])/g, '或')
  /* 9) 希腊字母语境收尾（2026-09-27 全库复扫：Δ/τ/φ 在 ③ 才转中文，斜杠规则需用希腊码点）：
     Y/Δ、Δ/Y 联结组标号 → "或"（Δ/Y11 右侧 Y 后随数字仍命中）；φN/φM 直径标注 → "或"；
     t/τ、PΔ/PY 等变量比 → "除以"；+7%/−10% 容差区间 → "或"；
     中文/左括号（瓦/(平方米·K)、3U²/(2ωL)）→ "除以"；右括号/中文（（端子松脱）/选C）→ "或" */
  s = s.replace(/([YD])\s*\/\s*(\u0394)/g, '$1或$2').replace(/(\u0394)\s*\/\s*([YD](?![A-Za-z]))/g, '$1或$2')
  s = s.replace(/(\u03C6\d+)\s*\/\s*(?=\u03C6)/g, '$1或')
  s = s.replace(/(?<=\d)\s*\/\s*(?=负|正|\u2212)/g, '或')
  s = s.replace(/(?<=[A-Za-z0-9])\s*\/\s*(?=[\u0391-\u03C9])/g, '除以')
  s = s.replace(/(?<=[\u0391-\u03C9])\s*\/\s*(?=[A-Za-z0-9])/g, '除以')
  s = s.replace(/(?<=[\u4e00-\u9fa5])\s*\/\s*(?=\(|（)/g, '除以')
  s = s.replace(/(?<=[)）])\s*\/\s*(?=[\u4e00-\u9fa5])/g, '或')
  /* ②-h 真实题库原文里高频出现的"数学排版符号"（seq 181/347 实证）：
     U+2212 减号、变量下标 U_F、等号 =。
     不处理的话引擎会念成"下划线 F"或直接吞掉。U+2212 必须在斜杠规则之后
     （除法分子允许包含它），＝已在 ⓪ 归一为 =。 */
  s = s.replace(/\u2212/g, '减').replace(/[–—]/g, '，')
  s = s.replace(/([A-Za-z])_\{?([A-Za-z0-9]+)\}?/g, '$1 $2')          // U_F → U F（不念"下划线"）
  s = s.replace(/\s*=\s*/g, ' 等于 ')                                  // 2026-09-27 放宽：全部 = 读"等于"（原仅限右侧为字母数字）
  /* ②-i 三角函数读法（cosφ/tanφ/sinφ 是全库高频；必须在 ③ 希腊字母替换之前，
     否则会变成"cos斐"。工程口语：cosφ = 功率因数。） */
  s = s.replace(/cos\s?φ/gi, '功率因数').replace(/tan\s?φ/gi, '正切').replace(/sin\s?φ/gi, '正弦')
  /* ②-j 杂项数学/标注符号（2026-10-04 全库扫描补：∠18 相量角（220∠0°）、∈1/∩∪⊆ 5（集合）、
     ⊥1/∥1（几何）、∫∮2（积分）、分数 8、⇒3/↔2（推导箭头）、省略号 18、@2（冲击波形
     25kA@8/20μs）、P&ID 6 处（管道仪表流程图，& → 读 "P I D"）、孤立 & 兜底"和"） */
  s = s.replace(/∠/g, '相角').replace(/∈/g, '属于').replace(/∩/g, '交').replace(/∪/g, '并')
    .replace(/[⊆⊂]/g, '包含于').replace(/⊥/g, '垂直于').replace(/∥/g, '平行于').replace(/[∫∮]/g, '积分')
    .replace(/½/g, '二分之一').replace(/¼/g, '四分之一').replace(/¾/g, '四分之三')
    .replace(/⅓/g, '三分之一').replace(/⅔/g, '三分之二').replace(/⅛/g, '八分之一')
    .replace(/⇒/g, '则').replace(/↔/g, '与')
    .replace(/[…‥]/g, '，').replace(/@/g, '，')
    .replace(/P&ID/g, 'PID').replace(/&/g, '和')
  /* ②-k 幂符号 ^（2026-10-04 补，全库 47 处：10^6、CU^2、e^(−τs)、(ΣNt)^(1/3)、e^{−t/τ}）。
     必须在 −→减/下标规则之后（前瞻容忍已成形的"负/减"），在 ③-b 括号读法之前（要抓
     ^(…)/^{…} 的括号内容）；三形各转"的…次方"，残留 ^ 转停顿。
     2026-10-05 起直接产出"括号…括号"词形（收尾同为括号，见 ③-b）（幂内分组永远是公式，不走 ③-b 的旁注判据）。 */
  s = s.replace(/\^\{([^{}\n]{1,24})\}/g, '的括号$1括号次方')
  s = s.replace(/\^\(([^()\n]{1,24})\)/g, '的括号$1括号次方')
  s = s.replace(/\^([负减]?[0-9A-Za-z.\u0391-\u03C9]{1,12})/g, '的$1次方')
  s = s.replace(/\^/g, '，')
  /* ②-l 圆周率拼写 pi（2026-10-04：2*pi*f*C、2*pi*R*C）——小写敏感，先于 TOKEN 词典 */
  s = s.replace(/\bpi\b/g, '派')
  /* ③ 希腊字母（工程口语常用译名，2026-09-27 补全 ζ/Φ/Θ/Λ/∑ 等，τ 修正为"陶"） */
  s = s.replace(/[Α-Ωα-ω]/g, (c) => GREEK_READ[c] ?? c)
  s = s.replace(/∑/g, '西格玛').replace(/△/g, '三角形')                // ∑(U+2211) 不在希腊区、△接法读"三角形"（ΔU 电压增量仍读德尔塔）
  /* ③-b 括号读法（位置约束：必须在斜杠七段式（②-g）/乘号前瞻/正负号/下标/^ 幂等一切
     依赖括号字面的规则完成之后；⓪ 层已把 markdown/【】/{} 之外的括号语义消化完）。
     口径沿革：2026-10-04 首改"括号全部朗读"→ 10-04 二改"≤5 字分级"→ 10-05 三改"只有
     公式才读"→ **10-05 午 四改（现行）**：用户"还是会读括号，帮我去掉，只有公式里才读"
     ——**空括号（判断题填空位"（　）"，全库 2623 处）也不读了**（它不是公式；用户听到的
     "还是会读括号"主要就是判断题尾这声"括号"）。现行规则汇总：
     · 公式括号（isFormulaParen）→ 读"括号…括号"（收尾同形，用户例：（4+6）→括号4加6括号）；
     · 其余（旁注/标签/空括号）→ 一律不读括号本身，只读内容（空括号无内容=整对删除）。
     开/闭同形 → 配对按栈式奇偶（parenPairs）；v3.1 的 U+E000 空括号占位符随之移除
     （空括号不再发声，无需过-blocker）。 */
  s = s.replace(/（[\s\u3000]*）|\(\s*\)/g, '')              // 空括号（判断题填空位）：删除，不读
  s = s.replace(/（([^（）]*)）|\(([^()]*)\)/g, (m, a, b, off, whole) => {
    const t = String(a ?? b ?? '').trim()
    if (!t) return ''
    if (isFormulaParen(t)) return `括号${t}括号`
    /* 旁注：去标记只读内容。补分隔防两类问题：
       ①黏连：（2）（3）→"23"被念成"二十三"、I(A)→"IA"被念成一个词 → 邻接非空白/标点时补空格；
       ②拉丁短语失去括号保护后与前置缩写连成超长英文串（"与LOPA Layer of Protection
         Analysis 方法"），切块在短语内找不到安全断点会硬切词中间 → 拉丁|拉丁 邻接用**逗号**
         分隔（既是自然口语的插入语边界，也给切块留下真断点）。 */
    const alnumStart = /^[A-Za-z0-9]/.test(t)
    const alnumEnd = /[A-Za-z0-9]$/.test(t)
    const before = whole[off - 1] ?? '', after = whole[off + m.length] ?? ''
    const isAlnum = (c) => /[A-Za-z0-9]/.test(c || '')
    const soft = (c) => c !== '' && !/[\s，。、；：？！）】》]/.test(c)
    const sepL = alnumStart ? (isAlnum(before) ? '，' : (soft(before) ? ' ' : '')) : ''
    const sepR = alnumEnd ? (isAlnum(after) ? '，' : (soft(after) ? ' ' : '')) : ''
    return sepL + t + sepR
  })
  s = s.replace(/[（(）)]/g, '')  // 未配对的残留括号字符（截断/嵌套剥完的外壳）：删除，不读
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
    AI: 'A I', AO: 'A O', DI: 'D I', DO: 'D O', GB: '国标', IR: 'I R',   // IR=ΔU=IR 压降（2026-09-27 题库实证）
    PI: 'P I',   // 2026-10-04：PI 调节器逐字母（小写 pi 已在 ②-l 转"派"，两形态都要有读法）
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
    .replace(/\[([^\[\]\n]{1,24})\]/g, '，$1，')   // 2026-10-04：错因剥离后残留的数学方括号（牛[顿]、[f(0+)−f(∞)]）读内容带停顿
    .replace(/【([^】]{1,8})】/g, '$1，')           // 【概念】→ 概念，
    .replace(/\{([^{}]*)\}/g, '$1')                // 占位符只留内容（空占位＝删）
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[*_`#>|]/g, '')
    .replace(/→/g, '，')
    .replace(/\s*\n+\s*/g, '，')
    .replace(/，{2,}/g, '，')
    .trim()
}

/* 括号配对还原（2026-10-04 新增 · 修"读完会读个括号完"的根因）：
   ③-b 把 （） 转成"括号 / 括号完"之后，原先基于括号字面的平衡检查**彻底失效**
   （（）这两个字符已不存在于送引擎文本里，unbalanced() 恒为 false）——切块于是把括号对
   切进两块，听者听到孤立的"括号完"（全库取证：4952 块整块只有"括号完"没有"括号"，
   涉及 2230 题；另有 3539 块孤立"括号"）。
   2026-10-05 起开口/闭口**同形**（都是"括号"，用户指定收尾不读"括号完"）→ 栈式配对天然
   等价于"出现序奇偶配对"：栈空=开口，栈非空=闭口并弹栈配对。2026-10-05 午起空括号整对
   删除不再发声（占位符 U+E000 已随之移除），配对只剩公式对，更干净。 */
function parenPairs(text) {
  const re = /括号/g
  const stack = []
  const pairs = []
  let m
  while ((m = re.exec(text))) {
    if (stack.length) pairs.push([stack.pop(), m.index])
    else stack.push(m.index)
  }
  return pairs
}

/* 切块边界保护（2026-09-14 晚新增）：把候选断点往后挪，避免把"词"切断。
   全库实测被抓到的硬 bug（`tts-text-audit.mjs`）：
   · 拉丁词被切两半 13 处：`…与LOPA（La` | `yer of Prote…`（Layer of Protection）；
   · 数字被切碎 27 处：`…= 375` | `0Ω，即3.75kΩ`（3750Ω 被念成"三七五"+"零欧姆"）；
   · 括号跨块 6 处：`…0.9` | `)≥79.8A`。
   规则：断点处若"右侧是拉丁字母/数字，或左侧是拉丁字母"，或**括号不平衡**（含"括号/
   括号完"词语配对，见 parenPairs），则把断点前移/后移；窗口内找不到安全位置就**扩窗**
   （前移 60 / 后探 80 字）——宁可块略长，也不把括号对切到两块里。 */
function safeCutIndex(text, cut, max) {
  const isWordChar = (c) => /[A-Za-z0-9.]/.test(c || '')
  const unbalanced = (s) => (s.split('（').length - s.split('）').length) !== 0
    || (s.split('(').length - s.split(')').length) !== 0
  const pairs = parenPairs(text)
  /* 配对内部判定：断点 k 表示 head=text.slice(0,k)。开/闭词元各占 2 字（[o,o+2)/[c,c+2)），
     端点必须整词落在同一侧——否则会出现"…公共端括 | 号的接线方向…"这种把"括号"腰斩的块。 */
  const insidePair = (k) => pairs.some(([o, c]) => k > o && k < c + 2)
  /* 断点还必须满足：左边不留悬挂算子/左括号，右边不出现孤立的右括号 */
  const okCut = (k) => {
    const left = text[k - 1], right = text[k]
    /* 2026-10-04 扩词保护：跨过空格仍是同一英文短语的两个方向都拦——
       "of | Protection"（词尾+空格+词）与 "of |Protection"（空格+词首）此前
       靠括号平衡检查间接兜住，括号转读法后暴露为词跨块。 */
    const skipSp = (i, d) => { while (i >= 0 && i < text.length && /\s/.test(text[i])) i += d; return i }
    if (isWordChar(left) && isWordChar(right)) return false
    if (isWordChar(right) && isWordChar(text[skipSp(k - 1, -1)])) return false   // 词␣|词 / 词␣␣|词
    if (isWordChar(left) && isWordChar(text[skipSp(k, 1)])) return false         // 词|␣词
    if (insidePair(k)) return false                                    // 配对内部：绝不切
    if (/括号?$/.test(text.slice(0, k))) return false                  // 左不留"括"/"括号"（开闭同形都拦）
    if (unbalanced(text.slice(0, k))) return false
    if (/[=（(+\-×÷·]$/.test(text.slice(0, k))) return false
    if (/^[)）]/.test(text.slice(k))) return false
    return true
  }
  for (let k = cut; k > 0 && k > cut - 24; k--) if (okCut(k)) return k
  for (let k = cut + 1; k < Math.min(text.length, cut + 24); k++) if (okCut(k)) return k
  for (let k = cut; k > 0 && k > cut - 60; k--) if (okCut(k)) return k
  for (let k = cut + 1; k < Math.min(text.length, cut + 80); k++) if (okCut(k)) return k
  return Math.min(cut, max)
}

/* 呼吸停顿标记（2026-10-04 二改 · 用户："连续朗读节奏放慢一些，避免听众觉得赶"）
   —— 放在**切块层**（送引擎的唯一入口），不动 cleanSpeechText 的通用契约。
   取证（tools/probe_variants.mjs：本地复刻合成 + mpg123 解码量测，两个真实解析样本）：
   · 标点后插半角/全角/窄空格 → **完全无效**（总时长一字不差；引擎不吃空格）；
   · 标点后插换行 → **每个标点实测 +0.3s 真实静音**：419 字样本停顿合计 18.55s→27.84s、
     总时长 +11%（84.19→94.30s）；528 字样本 23.07s→29.40s、停顿 P90 0.43s→0.63s。
   Edge 端点禁止自定义 SSML（rany2/edge-tts README：只允许单 voice + 单 prosody，无 <break>），
   换行即"段落停顿"，是这条链路上唯一可用的加呼吸手段。
   **只加在分句级标点（，；：）**：顿号（、）连接并列表项，停 0.3s 会把"U、V、W"念碎，故排除。 */
export function breathText(text) {
  return String(text ?? '').replace(/([，；：])(?!\n)/g, '$1\n')
}

/* 按句读切块（≤max 字/块）。先在强句读（。！？；!?;）断句，短句就近合并进同块；
   单句超长再在次级断点（，、：）回退切，实在没有断点才硬切。
   返回的块拼起来 = 清洗后的原文（无空格文本下严格成立；边界保护只改断点位置不改内容）。
   firstMax（2026-09-15）：首块单独上限——首块小=首响快（合成 RTT 与块长正相关），
   后续块加大=块边界少=句号处停顿少（每块是独立合成音频，自带首尾静音，
   块边界≈句号边界，用户实测"每个句号后面顿一下"）。 */
export function chunkSpeechText(raw, max = 50, firstMax = max) {
  const text = breathText(cleanSpeechText(raw))
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
  /* 硬保证（2026-10-04）：任何块都不得切开"括号…括号"配对，也不得把"括号"两个字
     腰斩（切块把括号对拆开时，听者会在下一块的头/中部听到孤立或破碎的标记——
     用户报"读完会读个括号完"）。safeCutIndex 已在次级断点处规避，"句读合并 + flush"
     路径这里做兜底：在块的拼接串上按字符区间重新配对（开/闭同形 → 栈式奇偶配对），
     凡配对或词元跨块即合并。2026-10-05 午起空括号整对删除（U+E000 占位符已移除）。 */
  const joined = chunks.join('')
  const bounds = []
  for (let i = 0, p = 0; i < chunks.length; i++) { bounds.push([p, p + chunks[i].length]); p += chunks[i].length }
  const chunkOf = (p) => { for (let i = 0; i < bounds.length; i++) if (p >= bounds[i][0] && p < bounds[i][1]) return i; return bounds.length - 1 }
  const crossing = new Set()
  const mark = (i, j) => { for (let k = i; k < j; k++) crossing.add(k) }
  const toks = []
  const re = /括号/g
  let tm
  while ((tm = re.exec(joined))) toks.push({ s: tm.index, e: tm.index + 2 })
  const stack = []
  for (const t of toks) {
    const ci = chunkOf(t.s), cj = chunkOf(t.e - 1)
    if (ci !== cj) mark(ci, cj)                      // 词元本身被切断（"括"|"号"）
    if (!stack.length) { stack.push(t); continue }
    const o = stack.pop()
    const oi = chunkOf(o.s), oj = chunkOf(t.e - 1)
    if (oi !== oj) mark(oi, oj)                      // 配对跨块
  }
  if (crossing.size) {
    const merged = []
    let acc = ''
    for (let i = 0; i < chunks.length; i++) {
      acc += chunks[i]
      if (!crossing.has(i)) { merged.push(acc); acc = '' }
    }
    if (acc) { if (merged.length) merged[merged.length - 1] += acc; else merged.push(acc) }
    return merged
  }
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
    const chunks = chunkSpeechText(raw, cm, Math.min(CLOUD_FIRST_CHUNK_MAX, cm))
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
    const ccm = cloudChunkMaxFor(cvoice)
    const cchunks = chunkSpeechText(raw, ccm, Math.min(CLOUD_FIRST_CHUNK_MAX, ccm))
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
  { id: 'zh-CN-YunxiaNeural', label: '云夏（男声·轻快）' },   // 2026-10-04 补齐：代理白名单本就有，前端此前漏列
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
   （450 字返回 {"error":"text too long","max":300}）——后续块提到 300，块边界减半。
   百度备用线路维持 150。两值经 chunkSpeechText(raw, cm, CLOUD_FIRST_CHUNK_MAX) 组合：
   首块 ≤70，后续 ≤300。 */
export const CLOUD_CHUNK_MAX_EDGE = 300
/* 首块单独上限（2026-10-04 播放流畅度修复，用户报"无法第一时间开始播放"）：
   合成 RTT 与块长正相关（150 字热合成实测 ≈2.2s），70 字 ≈1.2s——首块越小首响越快；
   首块播放的 ~10s（70 字 @1.35× ≈ 6.7 字/s）足够预取泵在后台备好后续块。
   speak()/prefetchGACache/prefetchCloudFirst 四处切块必须同参（URL 一致性铁律：
   预载命中要求 chunks[0] 的 URL 逐字节一致）。 */
export const CLOUD_FIRST_CHUNK_MAX = 70
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
     从 suspended 变 running；重复 resume 无害。legacy 元素解锁仍只做一次。
     【2026-09-28 修复"题干暂停→开解析续播"】ctx.state==='suspended' 有两种来源：
     ① 浏览器自动挂起（本函数要解锁的情形）② pauseSpeak 的主动 suspend——GA 线
     "暂停在原处"的实现机制，绝不能 resume。存在暂停中的播报会话时必须跳过 resume：
     否则题干里暂停的语音会在「提交判分/展开参考答案/我已回想对答案」等手势里被
     这里误唤醒，进入解析页后从暂停点继续播放（用户实测症状）。真正要恢复播放的
     路径各自有自己的 ctx.resume()（resumeCloud / stopGASources / speakCloudGA 开口处），
     不依赖本函数——守卫不影响续播/重读/新播报任何路径。插桩沿用 __ttsfxArm 惯例。 */
  try {
    const c = gaCtxOf()
    if (c && c.state === 'suspended') {
      const pauseHeld = !!(ga && ga.paused && !ga.done) || !!(session && session.paused && !session.done)
      try { if (window.__ttsfxArm) (window.__ttsfxLog = window.__ttsfxLog || []).push({ t: Date.now(), ev: 'unlockGuard', suspended: true, pauseHeld }) } catch { /* ignore */ }
      if (!pauseHeld) { const p = c.resume(); if (p && p.catch) p.catch(() => {}) }
    }
  } catch { /* ignore */ }
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
/* gaWarm（2026-10-04 重写）：fetch+decode 带 3 次退避重试（800/1600ms）。
   原版一次失败即静默踢出缓存——滚动预取撞限流（429/并发排队）时，串行链播到
   那块才发现缓存没货，现场重新合成 = 一个完整 RTT（2~5s），正是用户听到的
   "每读一段就暂停片刻"。同 URL 并发共享同一 promise（cache 先 set），不重复请求。 */
function gaWarm(url) {
  if (gaCache.has(url)) return gaCache.get(url)
  const attempt = async () => {
    const ctx = gaCtxOf()
    const r = await fetch(url)
    if (!r.ok) throw new Error('http ' + r.status)
    const ab = await r.arrayBuffer()
    const buf = await (ctx.decodeAudioData(ab.slice(0)))
    return buf
  }
  const run = async () => {
    try {
      return await attempt()
    } catch (e1) {
      await sleep(800)
      try {
        return await attempt()
      } catch (e2) {
        await sleep(1600)
        return attempt()
      }
    }
  }
  const p = run()
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
/* 块尾停顿表（2026-10-04 二改，见 place() 注释）：句末/分句/其他 三档，导出便于回归断言 */
export const PAUSE_AFTER_SENT = 0.20
export const PAUSE_AFTER_CLAUSE = 0.14
export const PAUSE_AFTER_OTHER = 0.08
export function chunkTailPause(txt) {
  const s = String(txt ?? '').replace(/[\s\u3000]+$/, '')
  const c = s.slice(-1)
  /* 注意：''.indexOf('') === 0 → 空串会被误判成句末（㉓-3d 断言抓到），必须先判空 */
  if (!c) return PAUSE_AFTER_OTHER
  if ('。！？!?'.indexOf(c) >= 0) return PAUSE_AFTER_SENT
  if ('；;，,、：:'.indexOf(c) >= 0) return PAUSE_AFTER_CLAUSE
  return PAUSE_AFTER_OTHER
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
  const FADE = 0.018
  /* 块间呼吸（2026-10-04 二改）：块由独立音频拼成，边界本身是人造的，没有停顿会"顶字"。
     文本层换行已给分句标点 ≈+0.3s；这里补句子级呼吸——句末 +0.20s（与引擎自带 ~0.6s
     合成 ≈0.8s，正落在研究口径"句号 600~800ms"内），分句 +0.14s，其他 +0.08s。
     注意：这是**显式、固定**的停顿（毫秒级可预测），与 2026-10-04 修的"等合成 RTT 才接上"
     那种不可控长空档（数秒、被误认为"每段一停"）性质相反。 */
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
    sess.nextAt = t + dur + chunkTailPause(sess.chunks[idx])
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
     网络等待由下面的滚动预取泵吃掉：预取先到 → gaDecode 命中缓存秒排（无缝）；
     预取未到 → t=currentTime+0.03 接在当前播，块间最多再等一个 RTT。 */
  const retried = new Set()
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
      /* 2026-10-04 兜底重试：gaWarm 内部已带 3 次退避重试，但端点瞬时抖动（连续
         超时/重启窗口）仍可能全败——原版一次失败即跳块，听感"跳过一段内容"。
         这里 1.2s 后整体再试一轮，仍失败才跳块保连续（取舍：连续性 > 单块内容）。 */
      if (!retried.has(idx)) {
        retried.add(idx)
        sleep(1200).then(() => { if (tok !== token || sess.done) return; schedule(idx) })
        return
      }
      if (idx + 1 < sess.urls.length) schedule(idx + 1)
      else { sess.done = true; if (ga === sess) ga = null; if (session === sess) session = null; if (onDone) onDone() }
    })
  }
  try { if (ctx.state === 'suspended') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}) } } catch { /* ignore */ }
  /* 滚动预取泵（2026-10-04 播放流畅度修复）：原"全块并发预取"在长解析 10+ 块时同一
     时刻打到合成端点 → 限流/并发排队，部分块迟迟不 ready 或 429；被 gaWarm 踢出
     缓存后，串行链播到那块才现场合成 = 用户听到的"每读一段停几秒"。
     改为滚动泵：同时在飞 ≤2，块播放时长（70/300 字 ≈ 10~45s）远大于合成 RTT
     （2~4s），播放进度永远跑在预取前面；与 schedule 共享同一 promise（gaCache
     按 URL 幂等），零重复请求。 */
  let inflight = 0, cursor = 1
  const pump = () => {
    if (tok !== token || sess.done) return
    while (inflight < 2 && cursor < sess.urls.length) {
      const k = cursor++
      inflight++
      gaDecode(sess.urls[k]).catch(() => {}).finally(() => { inflight--; pump() })
    }
  }
  pump()
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
  const chunks = chunkSpeechText(raw, cm, Math.min(CLOUD_FIRST_CHUNK_MAX, cm))
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
  const cm = cloudChunkMaxFor(useVoice)
  const chunks = chunkSpeechText(raw, cm, Math.min(CLOUD_FIRST_CHUNK_MAX, cm))
  if (!chunks.length) return false
  if (!isEdgeVoice(useVoice)) {
    /* AV批 · 百度线补预热（修"点播报要等 2~3s 才出声"）：百度线没有 GA 管线，
       此前本函数对它直接 return false —— 答题期**零预热**，点「题干播报」时才现发
       请求（DNS+TLS+合成 RTT 实测 ≈2~3s，即用户报的"没有第一时间读出声音"）。
       现改为：**当前没有正在朗读**时，把首块预热进双缓冲的空闲元素（与手势内
       prefetchCloudFirst 同参同元素同 URL，开口即命中元素缓存）；
       正在朗读时跳过 —— 不抢正在播的元素、不受 stopSpeak 清场误伤（沿用 A9 注释约束）。
       系统音色线（pref=sys）无 HTTP 可预热，维持现状。 */
    if (cloudPlaying) return false
    const els = ensureCloudEls()
    if (!els) return false
    const idle = els[0] === cloudPlaying ? els[1] : els[0]
    const url = cloudTtsUrl(chunks[0], rate, useVoice)
    try { if (idle.src !== url) idle.src = url; return true } catch { return false }
  }
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

// 导入校验与解析（与线上规则 1:1，题集逐题通道 + 返工话术）
// 2026-09-09 v4.14 死代码清理（用户批准去除包）：生成模式已于 2026-09-09 物理删除、题集通道
//   唯一化后，21 题生成批整批通道（配比/层段/数据刺激/序号语义豁免）在 UI 不可达——相关分支
//   与 PROTOCOL_VERSION 死常量整体移除；validateItems 第二参保留占位（旧 Node 脚本多传的
//   实参被忽略），classifyImport 收敛为 backup/parse-error/items 三分支。
// 2026-09-08 通用性整改（v4.6 同步）：
//   ① 序号 17~21"综合+分析"豁免与填空"序号 1"豁免收敛到整批通道（batchMode 门），逐题通道全序号同口径；
//   ② 批内知识点查重 + 简答方案对比检测升级为通用检查（任意 N 均查，不再限 21 元素整批）；
//   ③ "异常"元素机器化放行：逐题通道仅查序号与题干非空，导入管道自动跳过（替代"导入前人工移除"）；
//   ④ 返工话术去"21 元素"硬编码，改为数量中性表述；方案对比检测降为启发式告警（漏检由闸4 评审兜底）。
// 2026-09-08 增量（通用化收尾 + 跨批撞库产品化）：
//   ⑤ 批内知识点查重的"序号 1 豁免"收敛到 batchMode 门——题集逐题通道全序号同口径查重；
//   ⑥ 新增 crossBatchCheck：导入时与库内已有题做知识点撞名 + 题干近似重复（2-gram 重叠系数）
//      告警，填补"跨批避重只靠台账/precheck 脚本、近似改写不查"的机器盲区（仅告警，保真优先不拦截）。
// 2026-09-09 v4.13 命题侧自适应退役（用户指令"自适应帮我去掉，AI 还是根据我给的源题进行生成"）：
//   v4.12 的 verdict 复算闸（「源题难度/适配决策」三层一致性核对）整体移除——命题端不再做
//   升降档适配，AI 直接按源题档生成；校验器不再核对换挡声明；validateItems 第三参 ctx 废弃
//   （多传的实参被忽略，历史 Node 调用脚本无需改动）。
// 2026-09-08 v4.7 反平庸化（机制整改）：
//   ⑦ checkChoice 新增"四胞胎同构"告警：长度几乎一致+句式同构（开头字相同/同一连接词≥3项）→ 告警，
//      治"为过长度均衡而模板化写作"——均衡性查太悬殊，此检查查太整齐；
//   ⑧ 批内查重与 crossBatchCheck 新增"去修饰同名"告警（kpNorm 剥离高频通用修饰词），
//      反"电气互锁/机械互锁"式改名过闸；均为告警级，人工确认实质重复还是真细分。
// 2026-09-11 v6.8 解析质量提升（用户报障"解析过于简单、题目与选项对不上"）：
//   ⑨ 解析四段结构【概念】→【推导】→【误诊】→【记忆点】全题型必写：取消"非选择题省略【误诊】"
//      告警；单选/多选缺【误诊】维持错误级，其余题型缺【误诊】与全题型缺【概念】为告警级；
//   ⑩ 新设解析正文信息量下限（一般 120 字 / 计算 160 字 / 综合 200 字，剥去标记后计），
//      字数上限由 300/400/500 上调为 600/700/800——旧上限与"概念先行 + 完整结论链"直接冲突。
//      配套展示端修复见 pages/Practice.jsx 的 remapExplLetters（选项洗牌后解析字母同步换算）。
import { DIAGRAM_IDS } from './diagrams.js'
export const TYPE_LIST = ['单选题', '多选题', '判断题', '填空题', '简答题', '计算分析题', '综合设计/故障诊断题']
const DIFFS = ['基础', '应用', '综合']
const COG = ['记忆', '理解', '应用', '分析', '评价', '创造']
const DOMAINS = Array.from({ length: 27 }, (_, i) => `K${i + 1}`)
const META_MAP = { 基础: ['记忆', '理解'], 应用: ['应用', '分析'], 综合: ['评价', '创造'] }
/* v6.8 解析长度口径：上限上调（旧 300/400/500 会扼杀"概念先行 + 完整结论链"），
   同时新设信息量下限——正文（剥去【】标记后）低于下限即判"解析过于简单"。 */
const ANALYSIS_LIMIT = { '综合设计/故障诊断题': 800, 计算分析题: 700 }
const ANALYSIS_LIMIT_DEFAULT = 600
const ANALYSIS_FLOOR = { '综合设计/故障诊断题': 200, 计算分析题: 160 }
const ANALYSIS_FLOOR_DEFAULT = 120
const COMPREHENSIVE_ELEMENTS = ['方案', '选型计算', '控制逻辑', '保护与安全']
/* 反"改名过闸"（2026-09-08 v4.7）：查重是字符串匹配，AI 会学会把同考点换措辞绕过
   （"互锁"被拦 → 拆成"电气互锁""机械互锁"）。此归一剥离高频通用修饰词后比对：
   异名同归 → 告警（不拦截），交人工确认是实质重复还是真细分。 */
const KP_MODIFIERS = /(电气|机械|常用|常见|基本|主要|典型|通用|相应|相关|特殊|类型|功能|特点|作用|原理|定义|方法|步骤|区别|分类|应用|选择|设置|使用|安装|接线|调试|维护|故障|处理|分析|判断|检测|原则|要求|规范|标准|条件|影响|后果|原因|危害|措施|要点|流程|方式|形式|性质|概念|场景|场合|工况)/g
const kpNorm = (s) => String(s ?? '').trim().replace(KP_MODIFIERS, '')

const str = (v) => (v == null ? '' : String(v))
function seqOf(item) {
  const s = item.序号
  if (typeof s === 'number') return Math.round(s)
  const n = parseInt(str(s).trim(), 10)
  return Number.isNaN(n) ? -1 : n
}
const whereOf = (item) => {
  const s = seqOf(item)
  return s < 0 ? '序号?' : `序号${s}`
}
// 题目 id：内容哈希（与线上一致，保证去重与云端主键兼容）
// ⚠ 2026-09-11 审查结论：本函数直接拼原始串，大小写/全半角/空白差异会生成不同 id
//    （判分侧 loose() 却做了归一，两处口径不一致）→ 「PLC」与「plc」会被当成两道题入库，
//    造成题量虚高、跨批「哈希命中自动跳过」失效。
//    **但 hashId 不能就地改**：它是云端主键，现有 1481 题的 id 都按旧算法生成，
//    改算法会让全库题目变成"新题"（需配套全库迁移，风险高、收益低）。
//    故另加一枚**归一化指纹 normId**（qn_ 前缀，绝不与 q_ 主键冲突），
//    只用于"导入去重"判断，不写库、不作主键——既堵住重复入库，又零破坏。
export function hashId(stem, type, answer) {
  const s = stem + '\n' + type + '\n' + answer
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return 'q_' + (h >>> 0).toString(36)
}

/* 文本归一（与判分口径对齐）：全角→半角、去空白、ASCII 小写化。
   loose() 处理的是"答案"，这里处理的是"题干/题型/答案"整体指纹。 */
export function normText(s) {
  return String(s ?? '')
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase()
}

export function normId(stem, type, answer) {
  const s = normText(stem) + '\n' + normText(type) + '\n' + normText(answer)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return 'qn_' + (h >>> 0).toString(36)
}

/* 导入去重（归一化口径）：把「与库内已有题归一化同题」以及「批内归一化同题」的条目剔掉。
   返回 kept（保留）与 dupes（被判为重复而跳过）。
   取 q.stem/q.type/q.answer 与库内 q 同形（库内题目也是这套字段）。 */
export function dropNormalizedDupes(incoming, existing) {
  const have = new Set()
  for (const q of existing ?? []) have.add(normId(q.stem, q.type, q.answer))
  const kept = [], dupes = []
  for (const q of incoming ?? []) {
    const nid = normId(q.stem, q.type, q.answer)
    if (have.has(nid)) { dupes.push(q); continue }
    have.add(nid)   // 批内也按归一化去重
    kept.push(q)
  }
  return { kept, dupes }
}

export class Validator {
  issues = []
  err(where, message) { this.issues.push({ where, level: '错误', message }) }
  warn(where, message) { this.issues.push({ where, level: '告警', message }) }
  run(items) {
    if (items.length === 1 && str(items[0].题型) === '异常') {
      if (items[0].序号 !== 1 && seqOf(items[0]) !== 1) this.err('序号1', '异常输入序号应为1')
      if (!str(items[0].题干).trim()) this.err('序号1', '异常输入题干为空')
      return this.done()
    }
    // 简答方案对比 + 批内知识点查重：通用检查，任意 N 均查
    this.checkBatchRules(items)
    for (const it of items) {
      const type = str(it.题型)
      if (type === '异常') {
        /* 异常元素机器化放行（2026-09-08）：占位守恒语义——仅查序号有效与题干非空，
           其余检查跳过；入库管道 toItem 对"异常"本就 SKIP，无需导入前人工移除。 */
        if (seqOf(it) < 0) this.err(whereOf(it), '异常元素缺少有效序号')
        if (!str(it.题干).trim()) this.err(whereOf(it), '异常元素题干为空')
        continue
      }
      this.checkCommon(it)
      if (TYPE_LIST.includes(type)) {
        this.checkMetaMapping(it)
        this.checkAnalysis(it)
        if (type === '单选题' || type === '多选题') this.checkChoice(it)
        else if (type === '判断题') this.checkJudgement(it)
        else if (type === '填空题') this.checkFillBlank(it)
        else this.checkSubjective(it)
      }
    }
    return this.done()
  }
  /* 机读化收口（2026-09-09 经验对照 #6）：issues 本就是 {where, level, message} 结构
     （reworkTalk 的报错回喂闭环消费方），这里只补一个数值 seq 字段——
     消费方（导入页排序/筛重、AI 闭环按题号聚合）不用再解析「序号N」字符串。
     纯附加字段，不改任何规则判定与文案，回归断言不受影响。 */
  done() {
    for (const i of this.issues) {
      const m = /序号(\d+)/.exec(i.where)
      if (m) i.seq = Number(m[1])
    }
    return this.issues
  }
  checkBatchRules(items) {
    // B类语义下沉为机器检查（2026-09-04）：简答方案对比式设问 + 批内知识点重复。
    // 2026-09-08 通用化：任意 N 均查；方案对比正则为启发式（存在漏检），降为告警级，
    // 漏检与误判由独立评审（SOP 闸4）与人工抽检兜底。
    for (const it of items) {
      const stem = str(it.题干)
      if (str(it.题型) === '简答题' && /(两种|多个|若干)(方案|做法)|(方案|做法)[^。；]{0,6}(取舍|优劣|对比|比较)/.test(stem)) {
        this.warn(whereOf(it), '简答题疑为"方案对比"式设问（启发式检测，请人工确认），建议改为要点式设问')
      }
    }
    const seen = new Map()
    const normSeen = new Map()
    for (const it of items) {
      /* 批内查重全序号同口径（生成批"第 1 题为原题"豁免随整批通道退役而移除） */
      const k = str(it.知识点).trim()
      if (!k) continue
      if (seen.has(k)) this.err(whereOf(it), '知识点「' + k + '」与序号' + seen.get(k) + '重复，批内须避重')
      else seen.set(k, seqOf(it))
      const nk = kpNorm(k)
      if (normSeen.has(nk) && normSeen.get(nk) !== k) {
        this.warn(whereOf(it), `知识点「${k}」与「${normSeen.get(nk)}」去通用修饰后同名，疑似"改名过闸"——请人工确认是实质重复还是真细分`)
      } else if (!normSeen.has(nk)) normSeen.set(nk, k)
    }
  }
  checkCommon(it) {
    const w = whereOf(it)
    for (const f of ['题型', '难度', '知识点', '知识域', '认知层级', '题干', '答案', '解析']) {
      if (it[f] == null) this.err(w, `缺少字段“${f}”`)
    }
    const type = str(it.题型)
    if (!TYPE_LIST.includes(type)) this.err(w, `题型“${type}”非法`)
    const d = str(it.难度)
    if (!DIFFS.includes(d)) this.err(w, `难度“${d}”非法`)
    const dom = str(it.知识域)
    if (!DOMAINS.includes(dom)) this.err(w, `知识域“${dom}”非法，应取K1~K27`)
    const cog = str(it.认知层级)
    if (!COG.includes(cog)) this.err(w, `认知层级“${cog}”非法`)
    if (!str(it.知识点).trim()) this.err(w, '“知识点”为空')
    if (!str(it.题干).trim()) this.err(w, '“题干”为空')
    if (it.image != null && !(typeof it.image === 'string' && DIAGRAM_IDS.includes(it.image.split('|')[0]))) this.err(w, `“image”须为已注册模板ID（${DIAGRAM_IDS.join('/')} ）或省略`)
  }
  checkMetaMapping(it) {
    const d = str(it.难度), cog = str(it.认知层级), seq = seqOf(it)
    if (!META_MAP[d] || !COG.includes(cog)) return
    /* 生成批 17~21"综合+分析"豁免已随整批通道退役移除，全序号同口径 */
    if (!META_MAP[d].includes(cog)) this.err(whereOf(it), `认知层级“${cog}”与难度“${d}”映射不一致`)
  }
  checkAnalysis(it) {
    const w = whereOf(it)
    const a = str(it.解析)
    if (a.includes('\n') || a.includes('\r')) this.err(w, '"解析"含换行符，须为单行字符串')
    const type = str(it.题型)
    const p0 = a.indexOf('【概念】')
    const p1 = a.indexOf('【推导】'), p3 = a.indexOf('【记忆点】')
    if (p1 < 0 || p3 < 0 || p1 > p3) this.err(w, '"解析"须依次包含【推导】【记忆点】标记')
    /* v6.8 四段结构（【概念】→【推导】→【误诊】→【记忆点】）对全七种题型一律必写：
       ① 取消旧版"非选择题应省略【误诊】段"的告警（错因对任何题型同样重要）；
       ② 缺【误诊】对单选/多选维持**错误级**（沿用旧版硬保证，不回退），对其余题型为告警级；
       ③ 缺【概念】段、正文低于信息量下限均为告警级——格式升级不应让存量数据"变砖"，
          但新批次的"告警清零"纪律会逼出合规写法。 */
    if (p0 < 0) this.warn(w, '“解析”缺少【概念】段（v6.8 起全题型必写：先用第一性原理讲清最基础概念，再进本题）')
    else if (p0 > p1) this.warn(w, '【概念】标记须位于【推导】之前')
    const p2 = a.indexOf('【误诊】')
    if (type === '单选题' || type === '多选题') {
      if (p2 < 0) this.err(w, '单选/多选题“解析”须依次包含【概念】【推导】【误诊】【记忆点】四段')
      else if (p2 < p1 || p2 > p3) this.err(w, '【误诊】标记须位于【推导】与【记忆点】之间')
    } else if (p2 < 0) {
      this.warn(w, `“解析”缺少【误诊】段（v6.8 起 ${type} 同样必写：写明典型丢分点与错误写法）`)
    } else if (p2 < p1 || p2 > p3) {
      this.err(w, '【误诊】标记须位于【推导】与【记忆点】之间')
    }
    const limit = ANALYSIS_LIMIT[type] ?? ANALYSIS_LIMIT_DEFAULT
    if (a.length > limit) this.warn(w, `"解析"${a.length}字，超出建议上限${limit}字`)
    const bodyLen = a.replace(/【[^】]*】/g, '').trim().length
    const floor = ANALYSIS_FLOOR[type] ?? ANALYSIS_FLOOR_DEFAULT
    if (bodyLen < floor) this.warn(w, `“解析”正文仅 ${bodyLen} 字，低于 v6.8 信息量下限 ${floor} 字——解析过于简单，须按【概念】【推导】【误诊】【记忆点】四段重写`)
  }
  checkChoice(it) {
    const w = whereOf(it)
    const single = str(it.题型) === '单选题'
    const n = single ? 4 : 5
    const letters = single ? 'ABCD' : 'ABCDE'
    const opts = Array.isArray(it.选项) ? it.选项.map(String) : []
    const ans = str(it.答案)
    if (opts.length !== n) this.err(w, `选项数应为${n}，实际${opts.length}`)
    else for (let i = 0; i < n; i++) {
      const L = letters[i]
      if (!opts[i].startsWith(L + '. ') && !opts[i].startsWith(L + '.')) this.err(w, `第${i + 1}个选项未以“${L}. ”开头`)
    }
    if (single) {
      if (!/^[A-D]$/.test(ans)) this.err(w, `单选题答案应为单个字母A~D，实际“${ans}”`)
    } else if (/^[A-E]{2,4}$/.test(ans)) {
      if ([...ans].sort().join('') !== ans || new Set([...ans]).size !== ans.length) {
        this.err(w, `多选题答案须按字母升序且无重复，实际“${ans}”`)
      }
    } else {
      this.err(w, `多选题答案应为2~4个字母连写，实际“${ans}”`)
    }
    /* §61 语义均衡检查（用户规则：四个选项里正确答案不能太过明显）：
       「最长最详细的就是答案」是 AI 出题最常见的泄露模式。格式校验拦不住它，只能在这里量长度。
       错误级：正确项 ≥ 2×最长干扰项 且 ≥12 字（明显泄露，拦截）；
       告警级：正确项比最长干扰项长 ≥8 字且 ≥12 字（偏明显，提醒均衡）。 */
    const stripped = opts.map((o) => o.replace(/^[A-E][.、]\s*/, ''))
    const maxWrong = Math.max(0, ...[...letters]
      .filter((L) => !ans.includes(L))
      .map((L) => (stripped[letters.indexOf(L)] ?? '').length))
    if (opts.length === n && maxWrong > 0) {
      for (const L of single ? [ans] : [...ans]) {
        const len = (stripped[letters.indexOf(L)] ?? '').length
        if (len >= 12 && len >= 2 * maxWrong) {
          this.err(w, `选项${L}长${len}字，达最长干扰项（${maxWrong}字）的2倍以上——正确答案过于明显，请重写选项使长度/细节度均衡`)
        } else if (len >= 12 && len - maxWrong >= 8) {
          this.warn(w, `选项${L}比最长干扰项长${len - maxWrong}字，正确答案偏明显，建议均衡各选项长度与细节度`)
        }
      }
    }
    /* 反模板检查（2026-09-08 v4.7）：均衡性治"太悬殊"，这里治"太整齐"——
       长度几乎一致 + 句式同构（开头字相同或同一连接词出现在 ≥3 个选项）是
       "四胞胎选项"的写作特征（为过长度均衡而模板化）。合法的好题允许节奏差异，
       故仅告警不拦截，由人工/闸4 评审确认。 */
    if (opts.length === n) {
      const lens = stripped.map((o) => o.length)
      const maxLen = Math.max(...lens), minLen = Math.min(...lens)
      const nearlyEqual = maxLen > 0 && maxLen - minLen <= Math.max(6, Math.round(maxLen * 0.12))
      const sameStart = (() => {
        const heads = stripped.map((o) => o.slice(0, 1))
        return Math.max(...[...new Set(heads)].map((h) => heads.filter((x) => x === h).length))
      })()
      const CONNECTIVES = ['导致', '引起', '使得', '从而', '造成', '因此', '应按', '应当', '需要', '必须', '无法', '不能', '可以', '能够']
      const sameConn = CONNECTIVES.some((c) => stripped.filter((o) => o.includes(c)).length >= (single ? 3 : 4))
      if (nearlyEqual && (sameStart >= (single ? 3 : 4) || sameConn)) {
        this.warn(w, '选项疑似"四胞胎"同构（长度几乎一致且句式雷同）：好题允许节奏差异，请检查是否为凑均衡而模板化写作，必要时改写为句式自然的干扰项')
      }
    }
  }
  checkJudgement(it) {
    const ans = str(it.答案)
    if (ans !== '正确' && ans !== '错误') this.err(whereOf(it), `判断题答案应只填“正确”或“错误”，实际“${ans}”`)
  }
  checkFillBlank(it) {
    const w = whereOf(it)
    const stem = str(it.题干), ans = str(it.答案)
    const blanks = [...stem.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1])
    const parts = ans ? ans.split('|') : []
    /* 全序号同口径（生成批"第 1 题为原题"豁免随整批通道退役而移除） */
    if (stem.trimStart().startsWith('{')) this.err(w, '空位居句首，违反挖空规则')
    if (blanks.length !== parts.length) {
      this.err(w, `题干{}空数${blanks.length}与答案竖线分段数${parts.length}不一致`)
    } else {
      blanks.forEach((b, i) => {
        const bt = b.trim(), pt = parts[i].trim()
        /* 单空多候选（2026-09-11）：答案段可用 / 追加备选（"固体异物/固体物质"），
           主候选必须仍是题干挖空内容——判分端 gradeObjective 按候选任一命中即对。 */
        const cands = pt.split('/').map((s) => s.trim()).filter(Boolean)
        if (!cands.includes(bt)) this.err(w, `第${i + 1}空“${b}”与答案分段“${parts[i]}”不一致`)
        if (bt.length > 10) this.warn(w, `第${i + 1}空答案“${bt}”超过10字`)
      })
    }
    if (blanks.length > 2) this.err(w, `填空题应<=2空，实际${blanks.length}空`)
  }
  checkSubjective(it) {
    const w = whereOf(it)
    const type = str(it.题型), ans = str(it.答案)
    if (ans.includes('\n') || ans.includes('\r')) this.err(w, '主观题“答案”含换行符，须为单行字符串')
    if (type === '简答题') {
      const points = ans.match(/(?:^|[；;])\s*\d+\./g) ?? []
      if (points.length > 5) this.err(w, `简答题分点应<=5个，实际${points.length}个`)
    } else if (type === '计算分析题') {
      for (const mark of ['(1)', '(2)', '(3)']) {
        if (!ans.includes(mark)) { this.warn(w, `答案中未见分问标记${mark}（三问递进）`); break }
      }
    } else if (type === '综合设计/故障诊断题') {
      // 双框架（规则4.7.2）：设计四要素 或 诊断四要素，满足其一即合格
      const DIAG_ELEMENTS = ['现象', '可测证据', '故障定位', '验证方法']
      const missDesign = COMPREHENSIVE_ELEMENTS.filter((e) => !ans.includes(e))
      const missDiag = DIAG_ELEMENTS.filter((e) => !ans.includes(e))
      if (missDesign.length > 0 && missDiag.length > 0) {
        this.err(w, '综合题答案须含设计四要素(方案/选型计算/控制逻辑/保护与安全)或诊断四要素(现象/可测证据/故障定位/验证方法)之一套，当前两套均缺')
      }
    }
  }
}

export const validateItems = (items) => new Validator().run(items)

// 返工话术（数量中性，2026-09-08）：生成批与题集批通用——元素总数与序号由
// 各模式的守恒规则约束，话术不再硬编码"21 元素"。
export function reworkTalk(issues) {
  return [
    '以下是外部校验器对你上一轮输出的报错，请按报错逐题定向修正：',
    '',
    ...issues.filter((i) => i.level === '错误').map((i) => `错误  [${i.where}] ${i.message}`),
    '',
    '修正要求：',
    '1. 只修改报错序号对应的题目，其余题目保持原文一字不动；',
    '2. 修正后重新输出完整的 JSON 数组（元素总数与序号保持不变，不是只输出改动的题）；',
    '3. 输出纯 JSON，不加任何解释文字和 markdown 围栏。'
  ].join('\n')
}

// ── 解析管道 ──
/* §46 围栏只剥首尾：旧版 `replace(/```/g,'')` 是全局替换——题干/解析里合法出现的
   ```（代码段）会被一起删掉，JSON 内容被破坏 → 整批「无法解析」。现改为锚定首尾。 */
function stripFences(text) {
  return text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}
function extractArray(text) {
  const t = stripFences(text)
  const a = t.indexOf('['), b = t.lastIndexOf(']')
  if (a === -1 || b === -1 || b <= a) return null
  return t.slice(a, b + 1)
}
function toItem(raw) {
  const seq = seqOf(raw)
  const type = typeof raw.题型 === 'string' ? raw.题型 : ''
  const stem = typeof raw.题干 === 'string' ? raw.题干.trim() : ''
  const answer = typeof raw.答案 === 'string' ? raw.答案.trim() : ''
  if (seq < 0) return '缺少有效序号'
  if (type === '异常') return 'SKIP'
  if (!TYPE_LIST.includes(type)) return `题型「${type}」不在支持范围`
  if (!stem) return '缺少题干'
  if (!answer) return '缺少答案'
  const q = { id: hashId(stem, type, answer), seq, type, stem, answer }
  if (typeof raw.image === 'string' && DIAGRAM_IDS.includes(raw.image.split('|')[0])) q.image = raw.image
  if (typeof raw.难度 === 'string') q.difficulty = raw.难度
  if (typeof raw.知识点 === 'string') q.knowledgePoint = raw.知识点
  if (typeof raw.知识域 === 'string') q.knowledgeDomain = raw.知识域
  if (typeof raw.认知层级 === 'string') q.cognitiveLevel = raw.认知层级
  if (Array.isArray(raw.选项)) q.options = raw.选项.map(String)
  if (typeof raw.解析 === 'string') q.explanation = raw.解析
  return q
}
export function parseItems(text) {
  const arr = extractArray(text)
  if (!arr) return { items: [], errors: ['未找到 JSON 数组，请确认粘贴的是题库内容'] }
  let parsed
  try { parsed = JSON.parse(arr) } catch (e) {
    return { items: [], errors: ['JSON 解析失败：' + (e instanceof Error ? e.message : String(e))] }
  }
  if (!Array.isArray(parsed)) return { items: [], errors: ['顶层结构必须是 JSON 数组'] }
  const items = [], errors = []
  parsed.forEach((it, i) => {
    if (typeof it === 'object' && it !== null && !Array.isArray(it)) items.push(it)
    else errors.push(`第${i + 1}个元素不是 JSON 对象，已跳过`)
  })
  return { items, errors }
}
function toQuestions(list) {
  const questions = [], errors = [], seen = new Set()
  let skipped = 0
  for (const raw of list) {
    if (typeof raw !== 'object' || raw === null) { errors.push('存在非对象条目，已跳过'); continue }
    const q = toItem(raw)
    if (q === 'SKIP') { skipped++; continue }
    if (typeof q === 'string') { errors.push(`序号 ${raw.序号 ?? '?'}：${q}`); continue }
    if (seen.has(q.id)) { skipped++; continue }
    seen.add(q.id)
    questions.push(q)
  }
  return { questions, skipped, errors }
}
/* 全局入库序：命题协议里每批的「序号」都是 1~21，直接存进 q.seq 会让不同批次的同号题
   在组卷时排到一起——learn / wrong / relearn 三条路径都是 sort((a,b)=>a.seq-b.seq)，
   结果刷题顺序变成「各批的第1题 → 各批的第2题 → …」，把「以原题为圆心的同心圆 + 认知阶梯」
   打散成按难度横向切片。这里在入库前把批内序号改写成全局单调值：已有最大 seq + 批内序号。

   - 已在库里的题沿用库里已有的 seq：重复导入同一批不重排，否则每导一次就往后推一段
   - 新题整批连续排在所有旧题之后，批内相对次序（也就是认知阶梯）原样保留
   - existing 传 Map<id,q> 或数组都行

   ⚠ 必须在校验之后调用：校验器（映射一致性 / 拓展题≤2空）
   用的全是原始 JSON 的序号 seqOf(raw)，不是这里的 q.seq。提前改写会让全部难度层段判定失效。
   同理，备份恢复路径不能用它——备份里带的本来就是存好的全局序。 */
export function assignGlobalSeq(incoming, existing) {
  const byId = existing instanceof Map ? existing : new Map((existing ?? []).map((q) => [q.id, q]))
  let maxSeq = 0
  byId.forEach((q) => { if (Number.isFinite(q?.seq) && q.seq > maxSeq) maxSeq = q.seq })
  return (incoming ?? []).map((q) => {
    const old = byId.get(q.id)
    if (old && Number.isFinite(old.seq)) return { ...q, seq: old.seq }
    const local = Number.isFinite(q.seq) && q.seq > 0 ? q.seq : 0
    return { ...q, seq: maxSeq + local }
  })
}

export function parseBank(text) {
  const arr = extractArray(text)
  if (!arr) return { questions: [], skipped: 0, errors: ['未找到 JSON 数组，请确认粘贴的是题库内容'] }
  let parsed
  try { parsed = JSON.parse(arr) } catch (e) {
    return { questions: [], skipped: 0, errors: ['JSON 解析失败：' + (e instanceof Error ? e.message : String(e))] }
  }
  return Array.isArray(parsed) ? toQuestions(parsed) : { questions: [], skipped: 0, errors: ['顶层结构必须是 JSON 数组'] }
}
const validCard = (c, ids) =>
  typeof c === 'object' && c !== null && typeof c.questionId === 'string' && ids.has(c.questionId) &&
  typeof c.easeFactor === 'number' && typeof c.intervalDays === 'number' && typeof c.reps === 'number' &&
  typeof c.lapses === 'number' && typeof c.dueAt === 'number' && typeof c.learnedAt === 'number'
const validRecord = (r, ids) =>
  typeof r === 'object' && r !== null && typeof r.questionId === 'string' && ids.has(r.questionId) &&
  typeof r.date === 'string' && typeof r.timestamp === 'number' && typeof r.correct === 'boolean' && typeof r.detail === 'string'
/* ── 备份里的书本映射（2026-09-11 审查整改：备份自足化） ──
   旧备份只带「当前书」的题目，且完全不含书本结构，多书并存时换机恢复会：
   ① 丢掉其它书的题；② 全部塌进一本、归书关系（assign）归零。
   现在导出携带 { books, order, activeBookId, assign }，这里做形状校验与清洗。
   铁律：坏备份只能「少恢复」，绝不能写坏书本结构——所以只保留 order 里真实存在的
   书、activeBookId 失配回落第一本、assign 只保留指向真实书本（且题目在本次备份内）的项。 */
export function validBookMap(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return false
  const { books, order, assign } = m
  if (!books || typeof books !== 'object' || Array.isArray(books)) return false
  if (!Array.isArray(order)) return false
  if (!order.some((id) => typeof id === 'string' && books[id] && typeof books[id] === 'object')) return false
  if (assign !== undefined && (assign === null || typeof assign !== 'object' || Array.isArray(assign))) return false
  return true
}

export function normalizeBookMap(m, knownQuestionIds) {
  const ids = m.order.filter((id) => typeof id === 'string' && m.books[id] && typeof m.books[id] === 'object')
  const books = Object.fromEntries(ids.map((id) => [id, m.books[id]]))
  const activeBookId = ids.includes(m.activeBookId) ? m.activeBookId : ids[0]
  const assign = {}
  for (const [qid, bid] of Object.entries(m.assign ?? {})) {
    if (typeof bid !== 'string' || !books[bid]) continue
    if (knownQuestionIds && !knownQuestionIds.has(qid)) continue
    assign[qid] = bid
  }
  return { books, order: ids, activeBookId, assign }
}

/* 备份里的题目是「store/DB 同形」的**英文键**（seq/type/stem/answer/options/difficulty…），
   而 toItem 读的是出题管道的**中文键**契约（序号/题型/题干/答案）。
   把英文键直接喂给 toItem 会全判「缺少有效序号」→ 恢复出来 0 题。
   这是 2026-09-11 实测确认的既有 bug（导出→恢复对不上，备份按钮给的是假安全感）。
   这里只在 parseBackup 内做一次英→中字段映射，**不动 toItem**：出题管道「只认中文键」
   的严格契约必须保留，否则会把下游畸形输入一并放进来。 */
function backupItemToRaw(q) {
  if (typeof q !== 'object' || q === null) return q
  if (typeof q.题干 === 'string') return q   /* 已是中文键（历史备份 / 手工构造） */
  return {
    序号: q.seq, 题型: q.type, 题干: q.stem, 答案: q.answer,
    选项: q.options, 难度: q.difficulty, 知识点: q.knowledgePoint,
    知识域: q.knowledgeDomain, 认知层级: q.cognitiveLevel,
    解析: q.explanation, image: q.image
  }
}

export function parseBackup(text) {
  const t = stripFences(text)   /* §46：同 extractArray，只剥首尾围栏 */
  if (!t.startsWith('{')) return null
  let parsed
  try { parsed = JSON.parse(t) } catch { return null }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  if (!Array.isArray(parsed.questions)) return null
  const { questions } = toQuestions(parsed.questions.map(backupItemToRaw))
  const ids = new Set(questions.map((q) => q.id))
  const cards = Array.isArray(parsed.cards) ? parsed.cards.filter((c) => validCard(c, ids)) : []
  const records = Array.isArray(parsed.records)
    ? parsed.records.filter((r) => validRecord(r, ids)).map(({ id, ...rest }) => rest)
    : []
  const imageMap = (parsed.imageMap && typeof parsed.imageMap === 'object' && !Array.isArray(parsed.imageMap)) ? parsed.imageMap : undefined
  /* books 缺失（旧备份）→ undefined，恢复侧跳过，向后兼容 */
  const books = validBookMap(parsed.books) ? parsed.books : undefined
  return { questions, cards, records, imageMap, books }
}

// ── 客观题作答归一化与判分 ──
/* 多空分隔符：只切「空与空之间」的分隔，不包含 / 与空白。
   旧版 SPLIT = /[、，,;；|/\s]+/ 把 / 和空格也当分隔符，而切标准答案时又不切它们，
   两边规则不对称 → 用户输 I/O 被切成 ["I","O"] 两段、答案仍是 ["I/O"] 一段 → 恒判错。
   受害的是所有含 / 或空格的答案：I/O、AC/DC、MOV DF、输入/输出。 */
const BLANK_SEP = /[、，,;；|\n]+/
export const blanksOf = (stem) => [...stem.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1].trim())

/* 宽松比对用的归一：全角→半角、删全部空白、转小写。
   技术术语里大小写与空格不承载语义：plc = PLC、I O = I/O = Ｉ／Ｏ。 */
function loose(s) {
  return String(s ?? '')
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase()
}
/* 把标准答案按空数切开：优先用 |（导入规则里的多空分隔符，见 checkFillBlank），
   切不出正确空数时再退回其它分隔符，都不行就整串当一空。
   用题干空数做裁判，所以「答案本体含逗号/斜杠」也不会被误切。
   单空多候选（2026-09-11）：段内用 / 分隔（"固体异物/固体物质"），
   checkFillBlank 要求段内主候选 = 题干挖空内容。 */
function splitExpected(q) {
  const n = Math.max(blanksOf(q.stem).length, 1)
  const raw = String(q.answer ?? '')
  const byPipe = raw.split('|').map((p) => p.trim()).filter(Boolean)
  if (byPipe.length === n) return byPipe
  const byAny = raw.split(BLANK_SEP).map((p) => p.trim()).filter(Boolean)
  if (byAny.length === n) return byAny
  return byPipe.length > 0 ? byPipe : [raw.trim()]
}
export function normalizeAnswer(type, input) {
  const t = String(input ?? '').trim()
  if (!t) return null
  switch (type) {
    case '单选题': {
      const m = t.toUpperCase().match(/[A-D]/g)
      return !m || m.length !== 1 ? null : m[0]
    }
    case '多选题': {
      const m = t.toUpperCase().match(/[A-E]/g)
      if (!m) return null
      const s = [...new Set(m)].sort()
      return s.length < 2 ? null : s.join('')
    }
    case '判断题':
      if (/^(正确|对|√|是|T|TRUE|YES)$/i.test(t)) return '正确'
      if (/^(错误|错|×|非|否|F|FALSE|NO)$/i.test(t)) return '错误'
      return null
    case '填空题':
      return t.split(BLANK_SEP).map((p) => p.trim()).filter(Boolean).join(',')
    default:
      return null
  }
}
export function gradeObjective(q, input) {
  if (!isObjType(q.type)) throw new Error(`题型「${q.type}」为主观题，不参与自动判分`)
  const normalized = normalizeAnswer(q.type, input)
  if (q.type === '填空题') {
    const expParts = splitExpected(q)
    /* 单空多候选（2026-09-11）：答案段"甲/乙"按 / 切候选，任一命中即对。
       解决"固体物质 vs 固体异物"类同义表述被严格比对误判——同义误判会污染掌握度统计
       （实证案例：answer_records 里该题作答语义正确却连续计错）。 */
    const expCands = expParts.map((p) => p.split('/').map((s) => s.trim()).filter(Boolean))
    /* 输入按空数切：UI 用 \n 拼接各空（单行 input 里不可能出现换行，是无歧义哨兵）；
       没有 \n 时兼容旧的手打分隔。若切完段数对不上空数，说明答案本体含分隔符，退回整串比。 */
    const raw = String(input ?? '').trim()
    let got = raw.includes('\n')
      ? raw.split('\n').map((p) => p.trim())
      : raw.split(BLANK_SEP).map((p) => p.trim()).filter(Boolean)
    if (got.length !== expCands.length && got.length > 1) got = [raw]
    return {
      correct: got.length === expCands.length && got.every((g, i) => expCands[i].some((c) => loose(g) === loose(c))),
      normalized: got.join(','), expected: expParts.join(','), expectedParts: expParts
    }
  }
  const expected = q.answer.trim().toUpperCase()
  return { correct: normalized !== null && normalized === expected, normalized, expected, expectedParts: [expected] }
}
const isObjType = (t) => ['单选题', '多选题', '判断题', '填空题'].includes(t)

// ── 跨批撞库检查（2026-09-08 新增，仅告警不拦截）──
/* 此前跨批避重只靠命题台账 + 本地 precheck 脚本（流程闸），网站端导入时不与库内已有题
   比对——新会话不走 SOP 时跨批同知识点/近似题干会静默入库。本检查由导入页在
   validateItems 通过后、入库前调用，existing 传 store 的 allQuestions：
   - 知识点撞名：库内已有同名字段 → 告警（保真优先，不拦截）；
   - 题干近似重复：2-gram Jaccard ≥ 0.6 → 告警（填补机器盲区声明"近似改写不查"的空档）；
   已在库内的题（内容哈希命中，即重复导入场景）整题跳过，避免重导同批时的告警噪音。 */
function bigrams(s) {
  const t = String(s ?? '').replace(/\s+/g, '')
  const set = new Set()
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
  return set
}
/* 相似度口径：重叠系数（交集/较短边的 bigram 数）而非 Jaccard——
   "题干A 如何整定" 改写成 "题干A 如何进行整定的方法" 时 Jaccard 被扩写稀释（0.46），
   重叠系数则 0.86 稳定命中；而 "下列关于…说法正确的是" 类通用模板两边都长、互不包含
   （0.77<0.8），配 6-gram 最短护栏后不误报。 */
const SIM_THRESHOLD = 0.8
const SIM_MIN_NGRAMS = 6
function simScore(a, b) {
  let inter = 0
  for (const g of a) if (b.has(g)) inter++
  return inter / Math.min(a.size, b.size)
}
export function crossBatchCheck(items, existing) {
  const warns = []
  const exList = (existing ?? []).filter((q) => q && typeof q.stem === 'string' && q.stem)
  const kpInBank = new Map()
  for (const q of exList) {
    const k = str(q.knowledgePoint).trim()
    if (!k) continue
    const nk = kpNorm(k)
    if (!kpInBank.has(nk)) kpInBank.set(nk, [])
    if (!kpInBank.get(nk).includes(k)) kpInBank.get(nk).push(k)
  }
  const idInBank = new Set(exList.map((q) => q.id))
  const bankStems = exList.map((q) => ({ id: q.id, g: bigrams(q.stem) }))
  for (const it of items) {
    const stem = str(it.题干).trim()
    if (idInBank.has(hashId(stem, str(it.题型), str(it.答案).trim()))) continue
    const w = whereOf(it)
    const kp = str(it.知识点).trim()
    if (kp) {
      const bankNames = kpInBank.get(kpNorm(kp))
      if (bankNames) {
        if (bankNames.includes(kp)) {
          warns.push({ where: w, level: '告警', message: `知识点「${kp}」与库内已有题同名（可能来自历史批次），若考点相同请细化粒度区分，若为重复题请换批避重` })
        } else {
          warns.push({ where: w, level: '告警', message: `知识点「${kp}」与库内「${bankNames[0]}」去通用修饰后同名，疑似"改名过闸"——请人工确认是实质重复还是真细分` })
        }
      }
    }
    const g = bigrams(stem)
    if (g.size >= SIM_MIN_NGRAMS) {
      for (const s of bankStems) {
        if (Math.min(g.size, s.g.size) >= SIM_MIN_NGRAMS && simScore(g, s.g) >= SIM_THRESHOLD) {
          warns.push({ where: w, level: '告警', message: '题干与库内已有题高度相似（疑似近似改写），请人工确认非重复题' })
          break
        }
      }
    }
  }
  return warns
}

// ── 导入分类入口 ──
export function classifyImport(text) {
  const backup = parseBackup(text)
  if (backup) return { kind: 'backup' }
  const { errors } = parseItems(text)
  if (errors.length) return { kind: 'parse-error', errors }
  return { kind: 'items' }
}

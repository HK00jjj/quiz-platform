// 导入校验与解析（与线上规则 1:1，含 21 题批十一类规则与返工话术）
// 版本纪律（2026-09-08 双层规则后修订）：PROTOCOL_VERSION 为生成模式协议版本，与《规则体系》
// （生成模式）头部一致；题集模式协议独立演进（现为 2026-09-08-题集模式-v4.6），不再强绑定。
// 2026-09-08 通用性整改（v4.6 同步）：
//   ① 序号 17~21"综合+分析"豁免与填空"序号 1"豁免收敛到整批通道（batchMode 门），逐题通道全序号同口径；
//   ② 批内知识点查重 + 简答方案对比检测升级为通用检查（任意 N 均查，不再限 21 元素整批）；
//   ③ "异常"元素机器化放行：逐题通道仅查序号与题干非空，导入管道自动跳过（替代"导入前人工移除"）；
//   ④ 返工话术去"21 元素"硬编码，改为数量中性表述；方案对比检测降为启发式告警（漏检由闸4 评审兜底）。
// 2026-09-08 增量（通用化收尾 + 跨批撞库产品化）：
//   ⑤ 批内知识点查重的"序号 1 豁免"收敛到 batchMode 门——题集逐题通道全序号同口径查重；
//   ⑥ 新增 crossBatchCheck：导入时与库内已有题做知识点撞名 + 题干近似重复（2-gram 重叠系数）
//      告警，填补"跨批避重只靠台账/precheck 脚本、近似改写不查"的机器盲区（仅告警，保真优先不拦截）。
// 2026-09-09 v4.12 自适应换挡机器核对（verdict 复算闸）：
//   ⑨ validateItems 新增第三参 ctx={records,questions}（不传则闸不激活，Node 回归脚本行为不变）；
//      传入时逐题复算知识点 verdict（与 fetch_level.mjs / 《规则》2.2 第 0 步三处同口径），
//      核对 AI 声明的「源题难度」+「适配决策」与复算结论及最终难度档的一致性：
//      mastered→禁降阶（升一档或保持）/ weak→降一档（已在基础档则保持）/ middle·unseen→严格保持源题档；
//      声明与复算不符、或换挡动作与声明不符 → 错误拦截；字段缺席 → 批级告警（兼容历史批，不再静默放行）。
// 2026-09-08 v4.7 反平庸化（机制整改）：
//   ⑦ checkChoice 新增"四胞胎同构"告警：长度几乎一致+句式同构（开头字相同/同一连接词≥3项）→ 告警，
//      治"为过长度均衡而模板化写作"——均衡性查太悬殊，此检查查太整齐；
//   ⑧ 批内查重与 crossBatchCheck 新增"去修饰同名"告警（kpNorm 剥离高频通用修饰词），
//      反"电气互锁/机械互锁"式改名过闸；均为告警级，人工确认实质重复还是真细分。
import { DIAGRAM_IDS } from './diagrams.js'
export const PROTOCOL_VERSION = '2026-09-08'
export const TYPE_LIST = ['单选题', '多选题', '判断题', '填空题', '简答题', '计算分析题', '综合设计/故障诊断题']
const DIFFS = ['基础', '应用', '综合']
const COG = ['记忆', '理解', '应用', '分析', '评价', '创造']
const DOMAINS = Array.from({ length: 27 }, (_, i) => `K${i + 1}`)
const META_MAP = { 基础: ['记忆', '理解'], 应用: ['应用', '分析'], 综合: ['评价', '创造'] }
const ANALYSIS_LIMIT = { '综合设计/故障诊断题': 500, 计算分析题: 400 }
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
function diffBand(seq) {
  if (seq >= 2 && seq <= 9) return '基础'
  if (seq >= 10 && seq <= 16) return '应用'
  if (seq >= 17 && seq <= 21) return '综合'
  return null
}

// 题目 id：内容哈希（与线上一致，保证去重与云端主键兼容）
export function hashId(stem, type, answer) {
  const s = stem + '\n' + type + '\n' + answer
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return 'q_' + (h >>> 0).toString(36)
}

export class Validator {
  issues = []
  err(where, message) { this.issues.push({ where, level: '错误', message }) }
  warn(where, message) { this.issues.push({ where, level: '告警', message }) }
  run(items, batchMode, ctx) {
    this.ctx = ctx ?? null
    if (items.length === 1 && str(items[0].题型) === '异常') {
      if (items[0].序号 !== 1 && seqOf(items[0]) !== 1) this.err('序号1', '异常输入序号应为1')
      if (!str(items[0].题干).trim()) this.err('序号1', '异常输入题干为空')
      return this.issues
    }
    if (batchMode && items.length !== 21) this.err('顶层', `数组应为21个元素，实际${items.length}个`)
    if (batchMode && items.length === 21) {
      items.forEach((it, i) => { if (seqOf(it) !== i + 1) this.err(`元素${i + 1}`, `序号应为${i + 1}，实际“${str(it.序号)}”`) })
      this.checkQuota(items)
    }
    if (batchMode) {
      this.checkLayerComposition(items)
      if (items.length === 21) this.checkDataStimulus(items)
    }
    // 简答方案对比 + 批内知识点查重：通用检查，任意 N 均查（2026-09-08 起不再限于整批通道）
    this.checkBatchRules(items, batchMode)
    for (const it of items) {
      const type = str(it.题型)
      if (type === '异常' && !batchMode) {
        /* 异常元素机器化放行（2026-09-08）：占位守恒语义——仅查序号有效与题干非空，
           其余检查跳过；入库管道 toItem 对"异常"本就 SKIP，无需导入前人工移除。 */
        if (seqOf(it) < 0) this.err(whereOf(it), '异常元素缺少有效序号')
        if (!str(it.题干).trim()) this.err(whereOf(it), '异常元素题干为空')
        continue
      }
      this.checkCommon(it)
      if (TYPE_LIST.includes(type)) {
        this.checkMetaMapping(it, batchMode)
        this.checkAnalysis(it)
        if (type === '单选题' || type === '多选题') this.checkChoice(it)
        else if (type === '判断题') this.checkJudgement(it)
        else if (type === '填空题') this.checkFillBlank(it, batchMode)
        else this.checkSubjective(it)
        if (batchMode) {
          const seq = seqOf(it)
          if (seq >= 2) {
            const band = diffBand(seq)
            const d = str(it.难度)
            if (band && d !== band) this.err(whereOf(it), `难度应为“${band}”（按拓展题层段），实际“${d}”`)
          }
        }
      }
    }
    if (this.ctx) this.checkAdaptive(items)
    return this.issues
  }
  checkBatchRules(items, batchMode) {
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
      /* 批内查重的"序号 1 豁免"是生成批（整批通道）"第 1 题为原题"的配套，须有 batchMode 门：
         泄漏进题集逐题通道会让第 1 题与后续题知识点撞名静默放行（2026-09-08 通用化收尾）。 */
      if (batchMode && seqOf(it) < 2) continue
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
  checkMetaMapping(it, batchMode) {
    const d = str(it.难度), cog = str(it.认知层级), seq = seqOf(it)
    if (!META_MAP[d] || !COG.includes(cog)) return
    /* 序号 17~21"综合+分析"豁免是生成批（整批）通道的层段配套设计，须有 batchMode 门：
       泄漏进题集逐题通道会让恰排 17~21 的违规标注静默放行（2026-09-08 通用性整改）。 */
    if (batchMode && d === '综合' && cog === '分析' && seq >= 17 && seq <= 21) return
    if (!META_MAP[d].includes(cog)) this.err(whereOf(it), `认知层级“${cog}”与难度“${d}”映射不一致`)
  }
  checkAnalysis(it) {
    const w = whereOf(it)
    const a = str(it.解析)
    if (a.includes('\n') || a.includes('\r')) this.err(w, '"解析"含换行符，须为单行字符串')
    const p1 = a.indexOf('【推导】'), p3 = a.indexOf('【记忆点】')
    if (p1 < 0 || p3 < 0 || p1 > p3) this.err(w, '"解析"须依次包含【推导】【记忆点】标记')
    // 单选/多选题必含【误诊】段（2026-09-04 新增；2026-09-06 起升级为错误级，对齐规则A类⑦）
    const type = str(it.题型)
    const p2 = a.indexOf('【误诊】')
    if (type === '单选题' || type === '多选题') {
      if (p2 < 0) this.err(w, '单选/多选题“解析”须依次包含【推导】【误诊】【记忆点】三段')
      else if (p2 < p1 || p2 > p3) this.err(w, '【误诊】标记须位于【推导】与【记忆点】之间')
    } else if (p2 >= 0) {
      this.warn(w, '非选择题应省略【误诊】段（仅单选/多选必写）')
    }
    const limit = ANALYSIS_LIMIT[type] ?? 300
    if (a.length > limit) this.warn(w, `"解析"${a.length}字，超出建议上限${limit}字`)
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
  checkFillBlank(it, batchMode) {
    const w = whereOf(it)
    const stem = str(it.题干), ans = str(it.答案)
    const blanks = [...stem.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1])
    const parts = ans ? ans.split('|') : []
    /* "序号 1 不查空位/空数"是生成批"第 1 题为原题"的配套豁免，须有 batchMode 门：
       整批通道保留 seq>=2 限定；题集逐题通道的第 1 题是普通源题，全序号同口径
       （2026-09-08 通用性整改）。 */
    const extended = batchMode ? seqOf(it) >= 2 : true
    if (extended && stem.trimStart().startsWith('{')) this.err(w, '空位居句首，违反挖空规则')
    if (blanks.length !== parts.length) {
      this.err(w, `题干{}空数${blanks.length}与答案竖线分段数${parts.length}不一致`)
    } else {
      blanks.forEach((b, i) => {
        const bt = b.trim(), pt = parts[i].trim()
        if (bt !== pt) this.err(w, `第${i + 1}空“${b}”与答案分段“${parts[i]}”不一致`)
        if (bt.length > 10) this.warn(w, `第${i + 1}空答案“${bt}”超过10字`)
      })
    }
    if (extended && blanks.length > 2) this.err(w, `拓展填空题应<=2空，实际${blanks.length}空`)
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
  checkQuota(items) {
    const rest = items.slice(1)
    const counts = new Map()
    for (const it of rest) {
      const t = str(it.题型)
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    const c = (t) => counts.get(t) ?? 0
    // 区间弹性校验（2026-09-04 修订：固定配比→区间+硬约束）
    const ranges = [
      ['多选题', 2, 3], ['判断题', 2, 3], ['填空题', 1, 2],
      ['简答题', 1, 3], ['计算分析题', 2, 3], ['综合设计/故障诊断题', 1, 1]
    ]
    for (const [t, min, max] of ranges) {
      const n = c(t)
      if (n < min || n > max) this.err('配比', `${t}为${n}道，应在${min === max ? min : min + '~' + max}道区间内`)
    }
    const single = c('单选题')
    const others = c('多选题') + c('判断题') + c('填空题') + c('计算分析题') + c('简答题') + c('综合设计/故障诊断题')
    if (single + others !== 20) this.err('配比', `拓展题总数应为20道，实际单选${single}+其余${others}=${single + others}道`)
    if (single < 6 || single > 11) this.err('配比', `单选题为${single}道，应在6~11道区间内`)
    // 硬约束：计算+简答≤5
    const calcPlusShort = c('计算分析题') + c('简答题')
    if (calcPlusShort > 5) this.err('配比', `计算+简答=${calcPlusShort}道（>5），违反硬约束`)
    // 硬约束：客观题≥14
    const objective = single + c('多选题') + c('判断题') + c('填空题')
    if (objective < 14) this.err('配比', `客观题仅${objective}道（<14），违反客观题>=14红线`)
  }
  // A类⑨ 层内题型构成（2026-09-06 新增）：判断/填空在基础层，多选在应用层，简答/综合在综合层，计算按总数分配
  // 以 seqOf>=2 判定拓展题（不假设首元素为原题，兼容局部粘贴）
  checkLayerComposition(items) {
    let calcTotal = 0, calcInAdv = 0
    const band = (s) => (s >= 2 && s <= 9 ? '基础' : s >= 10 && s <= 16 ? '应用' : s >= 17 && s <= 21 ? '综合' : null)
    for (const it of items) {
      const s = seqOf(it)
      if (s < 2) continue
      const t = str(it.题型), w = whereOf(it), b = band(s)
      if (b === null) continue
      const map = { 判断题: '基础', 填空题: '基础', 多选题: '应用', 简答题: '综合', '综合设计/故障诊断题': '综合' }
      if (map[t] && map[t] !== b) {
        this.err(w, `${t}应全部位于${map[t]}层（序号${map[t] === '基础' ? '2~9' : map[t] === '应用' ? '10~16' : '17~21'}）`)
      }
      if (t === '计算分析题') { calcTotal += 1; if (b === '综合') calcInAdv += 1 }
    }
    // 层内分配：计算=2→全部在应用层；计算=3→应用层2+综合层1
    const expectAdv = Math.max(0, calcTotal - 2)
    if (calcTotal >= 2 && calcTotal <= 3 && calcInAdv !== expectAdv) {
      this.err('层段', `计算分析题共${calcTotal}道，综合层（序号17~21）应有${expectAdv}道，实际${calcInAdv}道`)
    }
  }
  // A类⑩ 结构化数据刺激≥3道（启发式检测，仅告警，需人工确认；仅整批 21 元素时运行）
  checkDataStimulus(items) {
    const UNIT = /\d+(?:\.\d+)?\s*(?:kV|kA|kW|kVA|kΩ|mA|mH|ms|mm²|mm2|r\/min|rpm|MPa|kPa|℃|°C|V|A|Ω|W|Hz|Pa|μF)\b/g
    const TABLE_HINT = /(实测数据|测量数据|数据表|参数表|记录表|工况表|时序表|如下表|数据如下|参数如下)/
    let n = 0
    for (const it of items) {
      if (seqOf(it) < 2) continue
      const stem = str(it.题干)
      if (TABLE_HINT.test(stem)) { n += 1; continue }
      const units = stem.match(UNIT)
      if (units && units.length >= 2) n += 1
    }
    if (n < 3) this.warn('配比', `结构化数据刺激启发式检出${n}道（规则要求≥3道），请人工确认是否达标`)
  }

  // ── v4.12 自适应换挡机器核对（verdict 复算闸）──
  /* verdict 复算口径与 fetch_level.mjs / 《出题规则》2.2 第 0 步三处同口径（改一处必须同步三处）：
     只计客观题作答（单选/多选/判断/填空），逐知识点"总对 + 首答"双轨：
     mastered：n≥3 且 acc≥85% 且首答样本≥2 且首答≥80%（四条件缺一不可）；
     weak：n≥3 且（acc≤50% 或 首答≤40%）；unseen：n=0；middle：其余（含 n<3 样本不足）。
     核对逻辑：AI 每题声明「源题难度」（基础/应用/综合）+「适配决策」（升档/保持/降档），
     本闸复算 verdict 后逐题核对三层一致性——
     ① 声明自洽：决策动作换算出的目标档 === 输出「难度」字段（升档=源+1 / 保持=源 / 降档=源−1；
        综合+升档、基础+降档本身非法）；
     ② 声明与复算一致：mastered 禁降阶；weak（源档≥应用）必须降档；middle/unseen 必须保持；
     ③ 降档落实：降档题解析须含「层级适配」标注（源题原解法已由【推导】段强制承载）。
     违反 = 错误拦截；字段缺席 = 告警（兼容历史批重导与备份恢复，不再静默放行）。 */
  static ADAPT_DIFFS = ['基础', '应用', '综合']
  static ADAPT_DECISIONS = ['升档', '保持', '降档']
  static ADAPT_LV = { 基础: 0, 应用: 1, 综合: 2 }
  static V = { N_MIN: 3, ACC_UP: 0.85, F_UP: 0.8, FN_MIN: 2, ACC_DOWN: 0.5, F_DOWN: 0.4 }
  static verdictOf(s) {
    const { N_MIN, ACC_UP, F_UP, FN_MIN, ACC_DOWN, F_DOWN } = Validator.V
    if (s.n === 0) return 'unseen'
    if (s.n < N_MIN) return 'middle' // 样本不足：宁可不动，不掺水
    const f = s.fN ? s.fC / s.fN : 0
    if (s.c / s.n >= ACC_UP && s.fN >= FN_MIN && f >= F_UP) return 'mastered'
    if (s.c / s.n <= ACC_DOWN || f <= F_DOWN) return 'weak'
    return 'middle'
  }
  checkAdaptive(items) {
    const { records, questions } = this.ctx
    // 画像只认客观题作答（v4.11 去污）：qid → {kp, obj}，来自库内已有题（新批无作答，不进统计）
    const metaOf = new Map()
    for (const q of questions ?? []) {
      if (q && typeof q.id === 'string') metaOf.set(q.id, { kp: str(q.knowledgePoint).trim(), obj: isObjType(q.type) })
    }
    const recByQ = new Map()
    for (const r of records ?? []) {
      if (!r || typeof r.correct !== 'boolean' || typeof r.questionId !== 'string') continue
      const m = metaOf.get(r.questionId)
      if (!m || !m.obj || !m.kp) continue
      if (!recByQ.has(r.questionId)) recByQ.set(r.questionId, [])
      recByQ.get(r.questionId).push({ correct: r.correct, t: typeof r.timestamp === 'number' ? r.timestamp : 0 })
    }
    const kpStats = new Map()
    for (const [qid, rs] of recByQ) {
      rs.sort((a, b) => a.t - b.t)
      const s = kpStats.get(metaOf.get(qid).kp) ?? { n: 0, c: 0, fN: 0, fC: 0 }
      for (const r of rs) { s.n++; if (r.correct) s.c++ }
      s.fN++; if (rs[0].correct) s.fC++
      kpStats.set(metaOf.get(qid).kp, s)
    }
    const verdictFor = (kp) => Validator.verdictOf(kpStats.get(kp) ?? { n: 0, c: 0, fN: 0, fC: 0 })
    const statsDesc = (kp) => {
      const s = kpStats.get(kp)
      if (!s || s.n === 0) return '该知识点无客观作答记录（unseen）'
      const f = s.fN ? Math.round((s.fC / s.fN) * 100) : 0
      return `客观作答 n=${s.n}、总对率 ${Math.round((s.c / s.n) * 100)}%、首答 ${f}%`
    }
    const LV = Validator.ADAPT_LV, DIFFS = Validator.ADAPT_DIFFS, DECS = Validator.ADAPT_DECISIONS
    let declared = 0
    for (const it of items) {
      if (str(it.题型) === '异常' || !TYPE_LIST.includes(str(it.题型))) continue
      const w = whereOf(it)
      const src = str(it.源题难度).trim(), dec = str(it.适配决策).trim()
      if (!src && !dec) continue
      declared++
      if (!DIFFS.includes(src)) this.err(w, `“源题难度”应为 基础/应用/综合 之一，实际“${src || '空'}”`)
      if (!DECS.includes(dec)) this.err(w, `“适配决策”应为 升档/保持/降档 之一，实际“${dec || '空'}”`)
      if (!DIFFS.includes(src) || !DECS.includes(dec)) continue
      const d = str(it.难度)
      // ① 决策动作自洽：目标档换算 + 输出难度核对（难度非法时 checkCommon 已报，此处跳过比对）
      if (dec === '升档' && src === '综合') this.err(w, '源题难度已是「综合」，禁止声明升档（无可升之档）')
      if (dec === '降档' && src === '基础') this.err(w, '源题难度已是「基础」，禁止声明降档（无可降之档）')
      if (DIFFS.includes(d)) {
        const expect = LV[src] + (dec === '升档' ? 1 : dec === '降档' ? -1 : 0)
        if (DIFFS[expect] !== undefined && LV[d] !== expect) this.err(w, `“适配决策：${dec}”与输出难度“${d}”不符（源题难度“${src}”换挡后应为“${DIFFS[expect]}”）`)
      }
      // ② 声明与复算 verdict 一致（kp 为空时 checkCommon 已报，跳过复算）
      const kp = str(it.知识点).trim()
      if (kp) {
        const v = verdictFor(kp)
        if (v === 'mastered' && dec === '降档') {
          this.err(w, `知识点「${kp}」复算为 mastered（${statsDesc(kp)}）——已掌握知识点禁止降阶，应升档或保持`)
        } else if (v === 'weak' && src !== '基础' && dec !== '降档') {
          this.err(w, `知识点「${kp}」复算为 weak（${statsDesc(kp)}）——weak 禁止保持/升档，应声明「适配决策：降档」`)
        } else if ((v === 'middle' || v === 'unseen') && dec !== '保持') {
          this.err(w, `知识点「${kp}」复算为 ${v}（${statsDesc(kp)}）——样本不足/未作答，应严格保持源题档（适配决策：保持）`)
        }
      }
      // ③ 降档落实：解析须带「层级适配」标注（源题原解法由【推导】段承载，checkAnalysis 已强制）
      if (dec === '降档' && !str(it.解析).includes('层级适配')) {
        this.err(w, '降档题解析须含「层级适配」标注并完整写入源题原考点解法（2.2 第 0 步）')
      }
    }
    if (declared === 0 && items.length > 0) {
      this.warn('自适应闸', `本批 ${items.length} 题均未声明「源题难度/适配决策」，换挡合规未做机器核对——v6.2 起《出题规则》要求逐题带出（历史批/备份重导可忽略本告警）`)
    } else if (declared < items.filter((it) => TYPE_LIST.includes(str(it.题型)) && str(it.题型) !== '异常').length) {
      this.warn('自适应闸', '本批部分题目未声明「源题难度/适配决策」，对应题目的换挡未做核对——请逐题补全声明')
    }
  }
}

export const validateItems = (items, batchMode, ctx) => new Validator().run(items, batchMode, ctx)

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

   ⚠ 必须在校验之后调用：校验器（diffBand / 综合层「分析」例外 / 拓展题≤2空 / 序号应为N）
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
export function parseBackup(text) {
  const t = stripFences(text)   /* §46：同 extractArray，只剥首尾围栏 */
  if (!t.startsWith('{')) return null
  let parsed
  try { parsed = JSON.parse(t) } catch { return null }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  if (!Array.isArray(parsed.questions)) return null
  const { questions } = toQuestions(parsed.questions)
  const ids = new Set(questions.map((q) => q.id))
  const cards = Array.isArray(parsed.cards) ? parsed.cards.filter((c) => validCard(c, ids)) : []
  const records = Array.isArray(parsed.records)
    ? parsed.records.filter((r) => validRecord(r, ids)).map(({ id, ...rest }) => rest)
    : []
  const imageMap = (parsed.imageMap && typeof parsed.imageMap === 'object' && !Array.isArray(parsed.imageMap)) ? parsed.imageMap : undefined
  return { questions, cards, records, imageMap }
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
   用题干空数做裁判，所以「答案本体含逗号/斜杠」也不会被误切。 */
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
    /* 输入按空数切：UI 用 \n 拼接各空（单行 input 里不可能出现换行，是无歧义哨兵）；
       没有 \n 时兼容旧的手打分隔。若切完段数对不上空数，说明答案本体含分隔符，退回整串比。 */
    const raw = String(input ?? '').trim()
    let got = raw.includes('\n')
      ? raw.split('\n').map((p) => p.trim())
      : raw.split(BLANK_SEP).map((p) => p.trim()).filter(Boolean)
    if (got.length !== expParts.length && got.length > 1) got = [raw]
    return {
      correct: got.length === expParts.length && got.every((g, i) => loose(g) === loose(expParts[i])),
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
  const { items, errors } = parseItems(text)
  if (errors.length) return { kind: 'parse-error', errors }
  const batchMode = items.length <= 21
  return { kind: 'batch', issues: validateItems(items, batchMode), batchMode }
}

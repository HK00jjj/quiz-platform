// 导入校验与解析（与线上规则 1:1，含 21 题批九类规则与返工话术）
import { DIAGRAM_IDS } from './diagrams.js'
export const TYPE_LIST = ['单选题', '多选题', '判断题', '填空题', '简答题', '计算分析题', '综合设计/故障诊断题']
const DIFFS = ['基础', '应用', '综合']
const COG = ['记忆', '理解', '应用', '分析', '评价', '创造']
const DOMAINS = Array.from({ length: 27 }, (_, i) => `K${i + 1}`)
const META_MAP = { 基础: ['记忆', '理解'], 应用: ['应用', '分析'], 综合: ['评价', '创造'] }
const ANALYSIS_LIMIT = { '综合设计/故障诊断题': 500, 计算分析题: 400 }
const COMPREHENSIVE_ELEMENTS = ['方案', '选型计算', '控制逻辑', '保护与安全']

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
  run(items, batchMode) {
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
    if (batchMode) this.checkBatchRules(items)
    for (const it of items) {
      this.checkCommon(it)
      const type = str(it.题型)
      if (TYPE_LIST.includes(type)) {
        this.checkMetaMapping(it)
        this.checkAnalysis(it)
        if (type === '单选题' || type === '多选题') this.checkChoice(it)
        else if (type === '判断题') this.checkJudgement(it)
        else if (type === '填空题') this.checkFillBlank(it)
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
    return this.issues
  }
  checkBatchRules(items) {
    // B类语义下沉为机器检查（2026-09-04）：简答方案对比式设问 + 批内知识点重复
    for (const it of items) {
      const stem = str(it.题干)
      if (str(it.题型) === '简答题' && /(两种|多个|若干)(方案|做法)|(方案|做法)[^。；]{0,6}(取舍|优劣|对比|比较)/.test(stem)) {
        this.err(whereOf(it), '简答题禁止方案对比式设问（规则4.5.6），请改为要点式设问')
      }
    }
    const seen = new Map()
    for (const it of items) {
      if (seqOf(it) < 2) continue
      const k = str(it.知识点).trim()
      if (!k) continue
      if (seen.has(k)) this.err(whereOf(it), '知识点「' + k + '」与序号' + seen.get(k) + '重复，批内须避重')
      else seen.set(k, seqOf(it))
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
    if (d === '综合' && cog === '分析' && seq >= 17 && seq <= 21) return
    if (!META_MAP[d].includes(cog)) this.err(whereOf(it), `认知层级“${cog}”与难度“${d}”映射不一致`)
  }
  checkAnalysis(it) {
    const w = whereOf(it)
    const a = str(it.解析)
    if (a.includes('\n') || a.includes('\r')) this.err(w, '"解析"含换行符，须为单行字符串')
    const p1 = a.indexOf('【推导】'), p3 = a.indexOf('【记忆点】')
    if (p1 < 0 || p3 < 0 || p1 > p3) this.err(w, '"解析"须依次包含【推导】【记忆点】标记')
    // 单选/多选题须含【误诊】段（2026-09-04 新增）
    const type = str(it.题型)
    if (type === '单选题' || type === '多选题') {
      const p2 = a.indexOf('【误诊】')
      if (p2 < 0) this.warn(w, '单选/多选题解析缺少【误诊】段（建议逐项归因）')
      else if (p2 < p1 || p2 > p3) this.err(w, '【误诊】标记须位于【推导】与【记忆点】之间')
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
    const extended = seqOf(it) >= 2
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
}

export const validateItems = (items, batchMode) => new Validator().run(items, batchMode)

export function reworkTalk(issues) {
  return [
    '以下是外部校验器对你上一轮输出的报错，请按报错逐题定向修正：',
    '',
    ...issues.filter((i) => i.level === '错误').map((i) => `错误  [${i.where}] ${i.message}`),
    '',
    '修正要求：',
    '1. 只修改报错序号对应的题目，其余题目保持原文一字不动；',
    '2. 修正后重新输出完整的 21 元素 JSON 数组（不是只输出改动的题）；',
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

// ── 导入分类入口 ──
export function classifyImport(text) {
  const backup = parseBackup(text)
  if (backup) return { kind: 'backup' }
  const { items, errors } = parseItems(text)
  if (errors.length) return { kind: 'parse-error', errors }
  const batchMode = items.length <= 21
  return { kind: 'batch', issues: validateItems(items, batchMode), batchMode }
}

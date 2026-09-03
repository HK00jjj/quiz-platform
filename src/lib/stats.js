// 统计 / 等级 / 成就 / 会话构建（口径与线上一致）
import { isDue } from './fsrs'
import { daysAgoStr } from './dates'

export const TYPES = ['单选题', '多选题', '判断题', '填空题', '简答题', '计算分析题', '综合设计/故障诊断题']
export const OBJECTIVE_TYPES = ['单选题', '多选题', '判断题', '填空题']
export const DIFFICULTIES = ['基础', '应用', '综合']
/* 难度 → 糖果胶囊配色的 ASCII 类名键（.diff-pill.d-base / .d-apply / .d-adv）。
   不直接拿中文难度名当类名，免得中文类名过压缩器出岔子。 */
export const DIFF_CLS = { 基础: 'base', 应用: 'apply', 综合: 'adv' }
export const DOMAIN_NAMES = {
  K1: '电路与电工基础', K2: '模拟与数字电子技术', K3: '电机与拖动', K4: '电力电子技术',
  K5: '自动控制理论', K6: 'PLC与工业控制', K7: '传感器与检测技术', K8: '供配电与低压电器',
  K9: '运动控制与伺服', K10: '工业自动化系统集成', K11: 'HMI与工业组态', K12: '工业安全与功能安全',
  K13: '电气制图与设计规范', K14: '防爆与特殊环境电气', K15: '调试工具与故障诊断', K16: '气动液压电控接口',
  K17: '项目工程规范', K18: '工业机器人', K19: '机器视觉', K20: '过程仪表与执行端',
  K21: '工业网络安全', K22: '继电保护与二次回路', K23: 'EMC与电能质量', K24: '新能源发电与储能系统',
  K25: '电动汽车与电驱动', K26: '智能电网与能源互联网', K27: '人工智能与电气结合'
}
export const domainLabel = (k) => (k ? DOMAIN_NAMES[k] ?? k : '')
export const isObjective = (type) => OBJECTIVE_TYPES.includes(type)

// ── 等级 ──
const LEVEL_SPAN = 50
export const levelOf = (total) => Math.floor(total / LEVEL_SPAN) + 1
export const levelProgress = (total) => ({ into: total % LEVEL_SPAN, span: LEVEL_SPAN })
const TITLES = [
  { at: 2000, title: '穹顶守望者' },
  { at: 800, title: '大秘法师' },
  { at: 300, title: '秘法师' },
  { at: 100, title: '符文抄录员' },
  { at: 0, title: '抄录学徒' }
]
export function titleFor(total) {
  for (const t of TITLES) if (total >= t.at) return t.title
  return TITLES[TITLES.length - 1].title
}
export const nextTitleFor = (total) => TITLES.find((t) => t.at > total) ?? null

// ── 成就（糖果成就 8 枚）──
export function achievementsOf({ streak, total, days, accuracy }) {
  return [
    { id: 'streak7', title: '初燃', desc: '连续做题 7 天', done: streak >= 7, cat: '修行', rarity: 'common', points: 10, progress: `${Math.min(streak, 7)}/7 天` },
    { id: 'days7', title: '全勤七曜', desc: '做题覆盖 7 个不同日期', done: days >= 7, cat: '修行', rarity: 'rare', points: 25, progress: `${Math.min(days, 7)}/7 天` },
    { id: 'streak30', title: '三十日长明', desc: '连续做题 30 天', done: streak >= 30, cat: '修行', rarity: 'epic', points: 50, progress: `${Math.min(streak, 30)}/30 天` },
    { id: 'streak100', title: '百日长明', desc: '连续做题 100 天', done: streak >= 100, cat: '修行', rarity: 'legend', points: 100, progress: `${Math.min(streak, 100)}/100 天` },
    { id: 'q100', title: '百卷通读', desc: '累计翻阅 100 题', done: total >= 100, cat: '探索', rarity: 'common', points: 10, progress: `${Math.min(total, 100)}/100 题` },
    { id: 'q1000', title: '千卷行者', desc: '累计翻阅 1000 题', done: total >= 1000, cat: '探索', rarity: 'epic', points: 50, progress: `${Math.min(total, 1000)}/1000 题` },
    { id: 'acc90', title: '神准九成', desc: '正确率达到 90%', done: accuracy !== null && accuracy >= 0.9, cat: '特殊', rarity: 'rare', points: 25, progress: accuracy === null ? '未达成' : `${Math.round(accuracy * 100)}%` },
    { id: 'perfect-session', title: '完美一役', desc: '单场练习全部答对', done: accuracy !== null && accuracy >= 1, cat: '特殊', rarity: 'rare', points: 25, progress: accuracy === null ? '未达成' : `${Math.round(accuracy * 100)}%` }
  ]
}
export const RARITY_META = {
  common: { label: '普通', cls: 'r-common' },
  rare: { label: '稀有', cls: 'r-rare' },
  epic: { label: '史诗', cls: 'r-epic' },
  legend: { label: '传说', cls: 'r-legend' }
}

// ── 统计口径 ──
export const accuracyOf = (records) => records.length === 0 ? null : records.filter((r) => r.correct).length / records.length
export function lastResultMap(records) {
  const map = new Map()
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp)
  for (const r of sorted) map.set(r.questionId, r.correct)
  return map
}
export function dailyCounts(records) {
  const map = new Map()
  for (const r of records) map.set(r.date, (map.get(r.date) ?? 0) + 1)
  return map
}
export const uniqueDays = (records) => new Set(records.map((r) => r.date)).size
export const uniqueQuestions = (records) => new Set(records.map((r) => r.questionId)).size
export function weekBars(records, today) {
  const firstSeen = new Map()
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp)
  for (const r of sorted) if (!firstSeen.has(r.questionId)) firstSeen.set(r.questionId, r.timestamp)
  // 近7天：今天往前6天~今天
  const days = Array.from({ length: 7 }, (_, i) => daysAgoStr(today, 6 - i))
  const out = days.map((date) => ({ date, newCount: 0, reviewCount: 0 }))
  const idx = new Map(out.map((d, i) => [d.date, i]))
  for (const r of records) {
    const i = idx.get(r.date)
    if (i !== undefined) {
      if (firstSeen.get(r.questionId) === r.timestamp) out[i].newCount++
      else out[i].reviewCount++
    }
  }
  return out
}
// 分题型正确率
export function byType(records, questions) {
  const typeOf = new Map(questions.map((q) => [q.id, q.type]))
  const acc = new Map()
  for (const t of TYPES) acc.set(t, { total: 0, correct: 0 })
  for (const r of records) {
    const t = typeOf.get(r.questionId)
    if (!t || !acc.has(t)) continue
    const o = acc.get(t)
    o.total++; if (r.correct) o.correct++
  }
  return acc
}
// 知识域掌握度（间隔≥3天视为掌握）
export function domainMastery(questions, cards) {
  const iv = new Map(cards.map((c) => [c.questionId, c.intervalDays]))
  const total = new Map(), mastered = new Map()
  for (const q of questions) {
    const d = q.knowledgeDomain ?? '未分类'
    total.set(d, (total.get(d) ?? 0) + 1)
    const i = iv.get(q.id)
    if (i !== undefined && i >= 3) mastered.set(d, (mastered.get(d) ?? 0) + 1)
  }
  const out = new Map()
  for (const [d, n] of total) out.set(d, (mastered.get(d) ?? 0) / n)
  return out
}

// ── 筛选 + 会话构建 ──
export function filterQuestions(questions, filters) {
  return questions.filter((q) =>
    (!filters.domains?.length || (q.knowledgeDomain && filters.domains.includes(q.knowledgeDomain))) &&
    (!filters.types?.length || filters.types.includes(q.type)) &&
    (!filters.difficulties?.length || (q.difficulty && filters.difficulties.includes(q.difficulty))))
}
function take(list, size) {
  return size > 0 ? list.slice(0, size) : list
}
function shuffle(list, rng = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export const filtersKey = (f) => JSON.stringify({
  domains: [...(f?.domains ?? [])].sort(),
  types: [...(f?.types ?? [])].sort(),
  difficulties: [...(f?.difficulties ?? [])].sort()
})
export function buildSession(questions, cards, records, opts) {
  const rng = opts.rng ?? Math.random
  const filtered = filterQuestions(questions, opts)
  const byId = new Map(filtered.map((q) => [q.id, q]))
  switch (opts.mode) {
    case 'learn': {
      const seen = new Set(cards.map((c) => c.questionId))
      return take(filtered.filter((q) => !seen.has(q.id)).sort((a, b) => a.seq - b.seq), opts.size)
    }
    case 'review':
      return cards.filter((c) => isDue(c, opts.now) && byId.has(c.questionId))
        .sort((a, b) => a.dueAt - b.dueAt).map((c) => byId.get(c.questionId))
    case 'wrong': {
      const last = lastResultMap(records)
      return take(filtered.filter((q) => last.get(q.id) === false).sort((a, b) => a.seq - b.seq), opts.size)
    }
    /* 收藏题集：favIds 由 store 从当前书本的 books[activeBookId].favorites 传入。
       questions 本身已是书本作用域的派生值，所以这里天然只可能命中本书的收藏。 */
    case 'fav': {
      const ids = new Set(opts.favIds ?? [])
      return take(filtered.filter((q) => ids.has(q.id)).sort((a, b) => a.seq - b.seq), opts.size)
    }
    case 'random':
      return take(shuffle(filtered, rng), opts.size)
    case 'relearn':
      return take([...filtered].sort((a, b) => a.seq - b.seq), opts.size)
    default:
      return []
  }
}

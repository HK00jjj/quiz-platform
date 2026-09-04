// 统计 / 等级 / 成就 / 会话构建（口径与线上一致）
/* 显式写 .js 扩展名：ESM 规范本来就这么要求，Vite 两种写法都能解析、打包结果完全一致，
   但 Node 直接 import 本文件时缺扩展名会 ERR_MODULE_NOT_FOUND——
   scripts/t-session.mjs 的组卷回归测试就是这么挂的。lib/validate.js 零依赖所以不受影响。 */
import { isDue } from './fsrs.js'

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

// ── 统计口径 ──
/* 这里原来还有两节加六个统计函数：等级（LEVEL_SPAN/levelOf/levelProgress/TITLES/titleFor/nextTitleFor）、
   成就（achievementsOf/RARITY_META）、以及 accuracyOf/dailyCounts/uniqueDays/weekBars/byType/domainMastery。
   它们全部只被 Stats.jsx（星界观测台）使用，该页已整页下线，所以一并删除，只留 lastResultMap——
   它被 App.jsx 的错题角标、store.js 与下面 buildSession 的 wrong 分支用着。
   要恢复统计页请从提交历史取回，不要在这里留死代码。 */
export function lastResultMap(records) {
  const map = new Map()
  const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp)
  for (const r of sorted) map.set(r.questionId, r.correct)
  return map
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
      /* 原来这是 buildSession 里唯一没走 take() 的分支，hero 传的 size:20 被静默丢掉——
         几天没练、积压 200 张到期卡就会一次性塞 200 题进会话。
         按 dueAt 升序取前 N 张 = 拖欠最久的优先，剩下的明天继续到期、不会丢
         （Anki 的每日复习上限同理）。take 对 size<=0 返回全部，所以不传 size 的调用方行为不变。 */
      return take(cards.filter((c) => isDue(c, opts.now) && byId.has(c.questionId))
        .sort((a, b) => a.dueAt - b.dueAt).map((c) => byId.get(c.questionId)), opts.size)
    case 'wrong': {
      const last = lastResultMap(records)
      return take(filtered.filter((q) => last.get(q.id) === false).sort((a, b) => a.seq - b.seq), opts.size)
    }
    case 'random':
      return take(shuffle(filtered, rng), opts.size)
    case 'relearn':
      return take([...filtered].sort((a, b) => a.seq - b.seq), opts.size)
    default:
      return []
  }
}

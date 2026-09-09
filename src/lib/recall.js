// 自由回忆周检（P2，2026-09-09，engram「自由回忆」机制迁移）：
// 生成效应（retrieval practice）的核心不是再认（选择题）而是提取——每周一次，
// 把近 7 天练过的知识域列出来，用户先在脑中提取要点、再如实自评（讲得清/模糊/想不起来）。
// 自评结果持久化进 settings.recallLog（云同步），薄弱域在 Learn 页给出
// 「练薄弱域」直达入口（走挑题练习的 domains 筛选，复用现有组卷链路，不动选题内核）。
// 提醒节奏：距上次检查 ≥7 天 且 近 7 天有效作答 ≥RECALL_MIN_ANSWERS 条（不活跃不打扰）。

export const RECALL_GAP_MS = 7 * 86400000
export const RECALL_MIN_ANSWERS = 10
export const RECALL_MAX_DOMAINS = 8
export const RECALL_GRADES = ['讲得清', '有点模糊', '想不起来']

/* 是否到期：从未检查过，或距上次检查 ≥7 天；且近 7 天有足够的提取素材。
   lastLog = recallLog 末元素（{ at, items } 或 null）。 */
export function recallDue(lastLog, records, now) {
  const lastAt = lastLog?.at ?? 0
  if (now - lastAt < RECALL_GAP_MS) return false
  const n = (records ?? []).filter((r) => typeof r.correct === 'boolean' && now - (r.timestamp ?? 0) < RECALL_GAP_MS).length
  return n >= RECALL_MIN_ANSWERS
}

/* 构建本周回忆清单：近 7 天作答过的知识域，按作答量降序取前 8。
   questions 传当前书本作用域（与页面其余计数同口径）；对不上当前书的记录天然剔除。 */
export function buildRecallItems(questions, records, now) {
  const domainOf = new Map((questions ?? []).map((q) => [q.id, q.knowledgeDomain ?? null]))
  const stat = new Map()
  for (const r of records ?? []) {
    if (typeof r.correct !== 'boolean') continue
    if (now - (r.timestamp ?? 0) >= RECALL_GAP_MS) continue
    const d = domainOf.get(r.questionId)
    if (!d) continue
    const s = stat.get(d) ?? { domain: d, n: 0 }
    s.n++
    stat.set(d, s)
  }
  return [...stat.values()].sort((a, b) => b.n - a.n).slice(0, RECALL_MAX_DOMAINS)
}

/* 最近一次检查中的薄弱域（自评未达「讲得清」）；跳过项（items 为空）返回空数组。
   顺序保持清单原序（作答量降序）→「练薄弱域」组卷按此优先域筛选。 */
export function weakDomains(lastLog) {
  return (lastLog?.items ?? []).filter((it) => it.grade !== RECALL_GRADES[0]).map((it) => it.domain)
}

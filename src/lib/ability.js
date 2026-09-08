// 自适应难度匹配（2026-09-09：n=1 单用户场景的"合意困难"选题）
// 设计口径：不测"真实能力"（n=1 不可测，个人学习曲线会污染区分度），只调
// "下一题的答对概率"——让单次作答正确率落在 60~80% 学习效率最优区间。
// 三个部件：
//   abilityOf      —— 用户能力指数：EWMA（半衰期 20 次作答），每次作答即时更新，
//                     不等批量；平滑疲劳单日波动，响应水平变化。
//   empDifficulty  —— 逐题经验难度：该题加权正确率的反向，n 小时按自评难度档
//                     的先验收缩（贝叶斯），新题冷启动直接用先验。
//   pickMatched    —— 组卷排序：|经验难度 - 目标难度| 最小的前 K 题内随机取，
//                     目标难度 = clamp(1 - 能力指数)；既不每次同序，也显著偏向匹配区。

const HALF_LIFE = 20
const ALPHA = Math.log(2) / HALF_LIFE
const WINDOW = 60
/* 自评难度档的先验正确率——取 v4.7 数据校准口径的经验中心：
   基础档实测 ~85%、应用 ~70%、综合 ~55%（首轮回流：67/71/88 见分析报告，
   倒挂说明自评粗但可用作先验；数据积累后此处可随闸6 复核更新）。 */
const PRIOR_P = { 基础: 0.85, 应用: 0.7, 综合: 0.55 }
const PRIOR_W = 2

export function abilityOf(records) {
  const xs = (records ?? [])
    .filter((r) => typeof r.correct === 'boolean')
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-WINDOW)
  if (xs.length === 0) return 0.65
  let a = xs.slice(0, 5).reduce((s, r) => s + (r.correct ? 1 : 0), 0) / Math.min(5, xs.length)
  for (const r of xs) a = a + ALPHA * ((r.correct ? 1 : 0) - a)
  return Math.min(1, Math.max(0, a))
}

export function empDifficulty(q, records) {
  let n = 0, c = 0
  for (const r of records ?? []) {
    if (r.questionId === q.id && typeof r.correct === 'boolean') { n++; if (r.correct) c++ }
  }
  const prior = PRIOR_P[q.difficulty] ?? 0.7
  const p = (c + PRIOR_W * prior) / (n + PRIOR_W)
  return 1 - p
}

function shuffle(list, rng) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* 目标难度分：能力越强 → 目标越难；clamp 到 [0.25, 0.75] 保证永远留有
   答错空间（0.25≈85% 答对、0.75≈55% 答对）——合意困难区。 */
export function targetDifficulty(ability) {
  return Math.min(0.75, Math.max(0.25, 1 - ability))
}

export function pickMatched(pool, ability, size, records, rng = Math.random) {
  if (!pool?.length) return []
  if (!size || size <= 0) return pool
  const target = targetDifficulty(ability)
  const scored = pool.map((q) => ({ q, cost: Math.abs(empDifficulty(q, records) - target) }))
  scored.sort((a, b) => a.cost - b.cost)
  /* 候选池 K 随题库规模缩放：大池（400 题、size=20 → K=120）在最优 30% 内保留随机
     避免每次同序；小池（4 题、size=2 → K=2）匹配语义主导，不退化为纯随机。 */
  const k = Math.min(pool.length, Math.max(size, Math.ceil(pool.length * 0.3)))
  return shuffle(scored.slice(0, k).map((s) => s.q), rng).slice(0, Math.min(size, pool.length))
}

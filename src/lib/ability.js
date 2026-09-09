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

/* 能力档（v4.8 规则协议口径，Import 页发"我的水平：XX"用）：
   <55 新手 / 55~78 进阶 / >78 熟练（取整百分比判定）。 */
export function tierOf(a) {
  const p = Math.round(a * 100)
  return p < 55 ? '新手' : p <= 78 ? '进阶' : '熟练'
}

/* 排位段位系统（2026-09-09 深夜：LOL 式定级赛/晋级赛）。
   段位只通过考试获得（settings.rank 持久化官方段位），状态指数只决定"考试门槛"：
   定级赛门槛 85（用户指定），晋级赛门槛 = 下一段位 lo。段位本身不由指数自动升降——
   防 EWMA 波动导致段位漂移。 */
export const RANKS = [
  { name: '黑铁', lo: 0, hi: 19, emoji: '⛓️', color: '#7C848D' },
  { name: '青铜', lo: 20, hi: 34, emoji: '🥉', color: '#B0793C' },
  { name: '白银', lo: 35, hi: 49, emoji: '🥈', color: '#8C9BAB' },
  { name: '黄金', lo: 50, hi: 64, emoji: '🥇', color: '#D4A017' },
  { name: '铂金', lo: 65, hi: 74, emoji: '💠', color: '#3FA7A0' },
  { name: '钻石', lo: 75, hi: 84, emoji: '💎', color: '#5B8DD9' },
  { name: '大师', lo: 85, hi: 92, emoji: '🌟', color: '#9B59D0' },
  { name: '最强王者', lo: 93, hi: 100, emoji: '👑', color: '#D95B5B' }
]
export function rankOf(ability) {
  const p = Math.round(ability * 100)
  return RANKS.find((r) => p >= r.lo && p <= r.hi) ?? RANKS[0]
}
/* 定级赛门槛（用户指定：EWMA 能力指数 ≥0.85 才有资格开考） */
export const PLACEMENT_ABILITY = 85

/* 晋级赛考制（2026-09-09 晨改版：五局三胜 → 百分制）：
   题库刷完一遍后开考，随机抽 SIZE 道客观题（考池不足按池缩容），
   答对 ≥ SIZE×PASS_RATE（即百分制 90 分）晋级一段。 */
export const PROMOTION_EXAM = { SIZE: 100, PASS_RATE: 0.9 }

/* 晋级赛触发之"彻底掌握知识点"量化标准（2026-09-09 晨，用户要求可判定）：
   ① 覆盖率 100%：本轮（自 lastExamAt 起）每题至少作答一次；
   ② 逐题掌握率 ≥95%：每题"本轮最近一次作答"必须答对（错题清零，留 5% 顽固题给考试把关）；
   ③ 知识点达标率 100%：每个本轮作答 ≥KP_MIN 次的知识点，正确率 ≥KP_ACC（<3 次样本不足豁免）；
   ④ 状态指数 ≥ 下一段位门槛（原有）。 */
export const MASTERY = { ITEM_RATE: 0.95, KP_ACC: 0.85, KP_MIN: 3 }

/* 换区建议（题库难度与用户水平的错位检测，Learn 页段位卡的副提示行）。
   样本闸（2026-09-09 用户反馈：原 8 题太少，题库几百题必须有量的积累才可信）：
   近 30 题、≥24 条有效判定。双条件闸防误报——「近期表现」与「EWMA 指数」同时越界：
   too-easy：近 30 题 ≥85% 且能力指数 ≥0.85 → 题库太易，劝导入更高水平源题上分；
   too-hard：近 30 题 ≤45% 且能力指数 ≤0.45 → 题库偏难，劝降阶源题补基础。 */
export function zoneAdvice(records) {
  const xs = (records ?? [])
    .filter((r) => typeof r.correct === 'boolean')
    .sort((a, b) => a.timestamp - b.timestamp)
  const recent = xs.slice(-30)
  const n = recent.length
  const acc = n ? recent.filter((r) => r.correct).length / n : 0
  const ability = abilityOf(records)
  if (n >= 24 && acc >= 0.85 && ability >= 0.85) return { level: 'too-easy', ability, recentAcc: acc, recentN: n }
  if (n >= 24 && acc <= 0.45 && ability <= 0.45) return { level: 'too-hard', ability, recentAcc: acc, recentN: n }
  return { level: 'ok', ability, recentAcc: acc, recentN: n }
}

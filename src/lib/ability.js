// 自适应难度匹配（2026-09-09：n=1 单用户场景的"合意困难"选题）
// 设计口径：不测"真实能力"（n=1 不可测，个人学习曲线会污染区分度），只调
// "下一题的答对概率"——让单次作答正确率落在 60~80% 学习效率最优区间。
// 四个部件（v4.15 = Route B 深化，对照开源调研 Prowise Learn/LearnLoop）：
//   abilityOf      —— 用户能力指数：EWMA（半衰期 20 次作答），每次作答即时更新，
//                     不等批量；平滑疲劳单日波动，响应水平变化。
//   empDifficulty  —— 逐题经验难度：该题加权正确率的反向，n 小时按自评难度档
//                     的先验收缩（贝叶斯），新题冷启动直接用先验；先验权重随
//                     证据量指数衰减（v4.15），n 大后实测完全接管。
//   pickMatched    —— 组卷排序：|经验难度 - 目标难度| 最小为基准，叠加四项修正
//                     （v4.16）：族级薄弱度优先（-0.1）、FSRS 到期轻加权（-0.05）、
//                     未作答探索优先（-0.08，见下）、近期作答冷却期（+0.3），前 K 题内随机取。
//   zoneAdvice     —— 换区建议：双条件闸（近 30 题正确率 × EWMA 指数）检测
//                     题库与水平的错位，v4.15 阈值放宽（原双 85 闸形同虚设）。

import { shuffle } from './util.js'

const HALF_LIFE = 20
const ALPHA = Math.log(2) / HALF_LIFE
const WINDOW = 60
/* 自评难度档的先验正确率——2026-09-09 晚闸6 回流校准（334 条作答、客观题首答 189 题）：
   实测首答正确率 基础 69%(n=143) / 应用 63%(n=38) / 综合 88%(n=8)。
   按数据如实取值（综合以 88% 向全库客观首答率 69% 收缩后取 0.75，不为 n=8 全信）。
   ⚠ 倒挂是实锤：自评"综合"的题首答反而最易——标签与真实难度的相关在当前数据下不成立，
   先验只作冷启动收缩用；nearest-match 的"标签带随能力上移"随之失效（按先验通过率就近选），
   待难度标签按数据回炉后带阶语义才会恢复。数据积累后由闸6 复核继续更新。 */
const PRIOR_P = { 基础: 0.7, 应用: 0.63, 综合: 0.75 }
const PRIOR_W = 2

export function abilityOf(records) {
  const all = (records ?? [])
    .filter((r) => typeof r.correct === 'boolean')
    .sort((a, b) => a.timestamp - b.timestamp)
  /* 2026-09-12 顶尖段适配②（窗口同题降密 · 审查报告 §2 落实）：三遍判定制下 60 条窗口
     常被 ~20 道题的三遍记录占满，热点题（反复刷同一题）更能把窗口灌满——指数对真实
     水平变化的响应被钝化。修法 = **按题去重取最近一条**：从最新往回收集，每题只计
     最近一次作答，集满 60 道不同题为止。每题一票、以最近证据为准——与 empDifficulty
     的"首答主导、重复不掺水"哲学同源（此处取"最近"因能力估计要反映当前状态）。
     半衰期语义从"20 条记录"变为"20 道不同题"，对顶尖段的水平变化感知更灵敏。
     ≤60 条且各题互异的场景数学行为与旧版完全一致（B 段回归值一字未变）。 */
  const picked = []
  const seen = new Set()
  for (let i = all.length - 1; i >= 0 && picked.length < WINDOW; i--) {
    const id = all[i].questionId
    if (seen.has(id)) continue
    seen.add(id)
    picked.push(all[i])
  }
  const xs = picked.reverse()
  if (xs.length === 0) return 0.65
  /* 冷启动种子 = 最早 5 条（不足 5 条则全部）的均值；随后**只对第 6 条起**做 EWMA 迭代。
     2026-09-11 审查修复：旧写法种子用前 5 条均值，紧接着又把这 5 条重新迭代一遍
     （前 5 条被加权两次）。修法保持"热启动"意图不变，只去掉重复计入。 */
  const seedN = Math.min(5, xs.length)
  let a = xs.slice(0, seedN).reduce((s, r) => s + (r.correct ? 1 : 0), 0) / seedN
  for (let i = seedN; i < xs.length; i++) a = a + ALPHA * ((xs[i].correct ? 1 : 0) - a)
  return Math.min(1, Math.max(0, a))
}

/* 逐题经验难度（2026-09-09 v4.10：首答加权口径，不容掺水）。
   首答权重 1、之后每次按 0.5 衰减——首答（第一次接触该题）主导难度判定，
   重复刷题无法把没学懂的题"刷成"易题：首答答错后即使连对四次，
   其经验难度仍高于首答答对后连错三次的题（P6 单测锁定该语义）。
   贝叶斯收缩（v4.15）：n 小向自评难度档先验收缩（基础 0.70/应用 0.63/综合 0.75，
   2026-09-09 晚闸6 回流校准值）；先验权重不再是常数——随**作答条数**按半衰期
   PRIOR_HALF=8 指数衰减，n≥16 后先验近乎让位实测。注意衰减挂"条数"而非加权量 wn：
   wn 因首答加权永远饱和在 2 以内，挂 wn 先验将永不衰减（设计自查纠错）。
   冷启动行为与 v4.14 完全一致（条数=0 时先验权重=PRIOR_W0=2）。
   估计量本身仍首答主导（加权口径不变）——"估计用什么权重"与"先验何时让位"正交。 */
const REPEAT_DECAY = 0.5
const PRIOR_HALF = 8
export function empDifficulty(q, records) {
  const rs = (records ?? [])
    .filter((r) => r.questionId === q.id && typeof r.correct === 'boolean')
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  let wn = 0, wc = 0
  rs.forEach((r, k) => {
    const w = Math.pow(REPEAT_DECAY, k)
    wn += w; if (r.correct) wc += w
  })
  const pw = PRIOR_W * Math.pow(0.5, rs.length / PRIOR_HALF)
  const prior = PRIOR_P[q.difficulty] ?? 0.7
  const p = (wc + pw * prior) / (wn + pw)
  return 1 - p
}

/* shuffle 已收敛到 lib/util.js（2026-09-11 审查整改：此前 stats/ability/Practice/Learn 四处各写一遍，
   改一处不会同步另三处）。这里 import 复用，算法与语义完全不变。 */

/* 目标难度（2026-09-09 重设计，v4.9 口径）：pass 目标随能力从 0.85 线性下移到 0.65。
   原理：难度是"题×人"的函数——empDifficulty 是该题对该用户的通过率预测，
   nearest-match 会自动把命中的标签带随能力上移（新手命中基础带、高手命中综合带）；
   pass 目标本身则随能力下移：新手在 85% 通过率的强化区练基本功（85% rule），
   高手在 65% 的挑战区上分。
   旧公式 clamp(1-ability, .25, .75) 的两处缺陷（2026-09-09 诚实复盘）：
   ① 低段位（指数<0.6）pass 目标被压到 0.6 以下，nearest-match 会把新手推向
      其最难档的题（通过率 40~50%）——掉进挫败区，违反合意困难；
   ② 高段位锁死 0.75，已掌握综合题的高手在匹配练习里无题可长。
   指数增长不依赖匹配练习（匹配会把通过率钉在目标带上，指数会钝化），
   而依赖全库复刷等非匹配作答——晋级赛触发本就强制全库复刷，训练与测量分工。 */
export function targetDifficulty(ability) {
  const t = Math.min(1, Math.max(0, (ability - 0.2) / 0.6))
  /* 2026-09-12 顶尖段适配①（专家段斜率）：旧公式 t∈[0,1] → 难度 ∈[0.15,0.35]，
     是按"能力中段"设计的——对"定义行业未来"的顶尖段，练习必须能下探到
     通过率 40~50% 的题（合意困难上限），否则高手永远被钉在 35% 难度封顶。
     分段：t≤0.8 维持 0.15+0.2t（新手/中段行为一字不变，t=0.8 处连续 =0.31）；
     t>0.8 进专家段，斜率加大到 0.95/单位 t，t=1（ability≥0.8）时难度封顶 0.50
     （通过率 50%——顶尖段的挑战区下限）。 */
  if (t <= 0.8) return 0.15 + 0.2 * t
  return 0.31 + 0.95 * (t - 0.8)
}

export function pickMatched(pool, ability, size, records, rng = Math.random, dueIds = null) {
  if (!pool?.length) return []
  if (!size || size <= 0) return pool
  const target = targetDifficulty(ability)
  /* 冷却期 + 族级薄弱度共用一个「最近窗口」（v4.15.1，审查整改）：
     全量累计口径下，某族早期大量错误会让 weak 长期居高（30 旧错 + 10 新对仍 0.75），
     与"掌握进度"语义脱节——改为只看最近 FAM_WINDOW=30 条有效作答（与 zoneAdvice 同口径），
     旧错随作答积累自然"出窗遗忘"。冷却期（20 条）是同一序列的更短截断，一次排序两处复用。 */
  const FAM_WINDOW = 30
  const COOLDOWN_N = 20
  const COOLDOWN_PENALTY = 0.3
  const recent = (records ?? [])
    .filter((r) => typeof r.correct === 'boolean')
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-FAM_WINDOW)
  const recentIds = new Set(recent.slice(-COOLDOWN_N).map((r) => r.questionId))
  /* 知识点薄弱度优先（v4.15 按 G2-① 改为「族级」统计口径；v4.15.1 收敛到近期窗口）：
     350+ 细粒度 kp 单点作答密度天然不足（实测具备首答资格的 kp 占比 0%），
     归并到知识域 K1~K27（题库现成的 knowledgeDomain 字段 = 同域近邻族的边界），
     单族样本密度立即可用。该族在窗口内客观作答 n≥3 时薄弱度 = 1−正确率（∈[0,1]），
     其题目获得最高 0.1 档的优先提升——"在薄弱知识域由浅入深"参与排序；
     n<3 视为样本不足不参与（宁可不动，不掺水）。 */
  const famOf = new Map(pool.map((q) => [q.id, q.knowledgeDomain ?? null]))
  const stat = new Map()
  for (const r of recent) {
    const fam = famOf.get(r.questionId)
    if (!fam) continue
    const s = stat.get(fam) ?? { n: 0, c: 0 }
    s.n++; if (r.correct) s.c++
    stat.set(fam, s)
  }
  const weak = new Map()
  for (const [fam, s] of stat) if (s.n >= 3) weak.set(fam, 1 - s.c / s.n)
  /* FSRS 到期轻加权（v4.15，融合方案的"调度/选题正交"约束）：
     到期题的主场是 review 模式（用户显式选择），random 匹配练习不动模式分工，
     只给到期题 -0.05 的轻微优先（弱于薄弱度 0.1、远弱于难度匹配主项）——
     同等匹配度下先到期先练，不产生"random 抢走 review 存量"的行为。 */
  const DUE_BONUS = 0.05
  /* 未作答探索优先（v4.16，2026-09-11 校准闭环增益阀①）：
     从未作答的题 empDifficulty 完全落在先验上——先验若偏离目标难度，冷选题会被
     nearest-match 永久挤出候选 K，覆盖率停在低位（实证 24.1%），先验永远无法被
     首答数据替换（empDifficulty 是首答加权口径，首答数据是整个校准飞轮的原料）。
     给未作答题 -0.08 的探索优先（介于到期 0.05 与薄弱度 0.1 之间）：
     难度匹配仍是主项，探索只解决"同等匹配度下先见没见过"——
     思想源自 Sympson-Hetter 曝光控制（开源调研 adaptive-quiz-system-chill）：
     控制每题曝光机会的分配，防止部分题被系统性饿死。 */
  const EXPLORE_BONUS = 0.08
  const answeredIds = new Set((records ?? []).map((r) => r.questionId))
  const scored = pool.map((q) => {
    const famWeak = weak.get(q.knowledgeDomain ?? null) ?? 0
    const cooldown = recentIds.has(q.id) ? COOLDOWN_PENALTY : 0
    const due = dueIds?.has(q.id) ? DUE_BONUS : 0
    const explore = answeredIds.has(q.id) ? 0 : EXPLORE_BONUS
    return { q, cost: Math.abs(empDifficulty(q, records) - target) - 0.1 * famWeak + cooldown - due - explore }
  })
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
   段位本身不由指数自动升降——防 EWMA 波动导致段位漂移。
   ⚠ 2026-09-11 审查整改：定级赛从未实现，其门槛常量 PLACEMENT_ABILITY 与
   rankOf(ability)（按指数反推段位）全仓零引用，已删除；RANKS 的 lo/hi 是
   段位×能力指数参照带，当前同样无调用，但属段位定义的一部分，保留数据。 */
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

/* 晋级赛考制（2026-09-09 晨改版：五局三胜 → 百分制）：
   题库刷完一遍后开考，随机抽 SIZE 道客观题（考池不足按池缩容），
   答对 ≥ SIZE×PASS_RATE（即百分制 90 分）晋级一段。 */
export const PROMOTION_EXAM = { SIZE: 100, PASS_RATE: 0.9 }

/* 晋级赛触发四闸（2026-09-09 午后二改，用户定稿「六闸合取」裁剪版）：
   ① 覆盖率 100%：本轮（自 lastExamAt 起）每题至少作答一次；
   ② 逐题掌握率 ≥ITEM_RATE：每题"本轮最近一次作答"必须答对（错题清零，留 5% 顽固题给考试把关）；
   ③ 知识域达标率 100%：每个本轮作答 ≥KP_MIN 次的知识域，正确率 ≥KP_ACC（<3 次样本不足豁免）；
      聚合键 = knowledgeDomain（K 域族级，2026-09-12 颗粒度对齐，与 pickMatched 薄弱度同口径；
      细粒度 kp 统计密度 ≈1 题/点致该闸空转，裁决记录见 Learn.jsx 闸③注释）；
   ④ 错题清零：上场考试错题已在练习中答对消号（EXAM_WRONGS 机制，见下）。
   两闸已按用户指令取消（2026-09-09 午后二改）：
   - 持久性闸（每题最近一次作答距今 ≥3 天防突击）——删除，刷完即可考；
   - 状态指数 ≥ 下一段位门槛——删除，指数只展示不作门槛。
   补考机会：每周期 EXAM_ATTEMPTS 次，3 次全败周期作废重来（结算在 Learn.finishExam）。 */
export const MASTERY = { ITEM_RATE: 0.95, KP_ACC: 0.95, KP_MIN: 3 }
export const EXAM_ATTEMPTS = 3

/* 晋级赛掌握度三闸计算（2026-09-12 从 Learn.jsx useMemo 提取为纯函数——闸③此前零测试覆盖，
   提取后可回归锁定语义；字段与旧实现一一对应，覆盖/逐题掌握闸的数值行为一字未变）。
   输入 questions（当前书全题）/ records（全部作答）/ since（本轮起点 = lastExamAt）。
   闸③聚合键裁决（2026-09-12 全流程颗粒度对齐 / 全流程闭环审查 P0-1 收尾）：
   旧实现按细粒度 kp 字符串精确聚合——题库 440 题 K8 挂 429 个细分点（≈1 题 1 点），
   KP_MIN=3 门槛下绝大多数 kp 样本不足被豁免，闸③名存实亡（对"域掌握度"零度量力）。
   聚合键改为 knowledgeDomain（K 域族级）后，与 pickMatched 薄弱度（v4.15 G2-①）、
   闸6 校准、K 谱系覆盖矩阵同口径：统计职能归 K 域，细粒度 kp 只保留给查重/变式/检索。
   无域题兜底回落 knowledgePoint（与旧行为等价，防畸形数据制造假闸；
   全库 1531 题已实测全带 K 域标注，此分支纯防御）。KP_MIN / KP_ACC 阈值不变。 */
export function masteryGate(questions, records, since) {
  const latest = new Map()
  const domStats = new Map()
  for (const r of records ?? []) {
    if (r.timestamp <= since) continue
    const prev = latest.get(r.questionId)
    if (!prev || r.timestamp > prev.timestamp) latest.set(r.questionId, r)
  }
  const doneN = questions.filter((q) => latest.has(q.id)).length
  const covered = questions.length > 0 && doneN === questions.length
  const masteredN = questions.filter((q) => latest.get(q.id)?.correct === true).length
  const itemRate = questions.length ? masteredN / questions.length : 0
  const qDom = new Map(questions.map((q) => [q.id, q.knowledgeDomain ?? q.knowledgePoint ?? '未标注']))
  for (const r of records ?? []) {
    if (r.timestamp <= since) continue
    const dom = qDom.get(r.questionId)
    if (!dom) continue
    const s = domStats.get(dom) ?? { n: 0, c: 0 }
    s.n++; if (r.correct) s.c++
    domStats.set(dom, s)
  }
  const kpArr = [...domStats.values()].filter((s) => s.n >= MASTERY.KP_MIN)
  const kpTotal = kpArr.length
  const kpOK = kpArr.filter((s) => s.c / s.n >= MASTERY.KP_ACC).length
  const kpPass = kpTotal === 0 || kpOK === kpTotal
  const masteryReady = itemRate >= MASTERY.ITEM_RATE && kpPass
  return { doneN, covered, masteredN, itemRate, kpTotal, kpOK, kpPass, masteryReady }
}

/* 晋级失败错题重练（2026-09-09 午后 v6.1，取代"失败全库重刷"）：
   考试错题存 localStorage（ExamModal 上报），在练习中答对一次即消；
   全部消完即可再次开考——lastExamAt 不再因失败重置，覆盖/掌握进度保留。 */
export const EXAM_WRONGS_KEY = 'qp-exam-wrongs'

/* 换区建议（题库难度与用户水平的错位检测，Learn 页段位卡的副提示行）。
   样本闸（2026-09-09 用户反馈：原 8 题太少，题库几百题必须有量的积累才可信）：
   近 30 题、≥24 条有效判定。双条件闸防误报——「近期表现」与「EWMA 指数」同时越界。
   阈值放宽（v4.15，机制盘点 G4 裁决：原 0.85/0.85 双 85 闸过严，上线以来几乎不触发）：
   too-easy：近 30 题 ≥80% 且能力指数 ≥0.75 → 题库太易，劝导入更高水平源题上分；
   too-hard：近 30 题 ≤50% 且能力指数 ≤0.55 → 题库偏难，劝降阶源题补基础。 */
export function zoneAdvice(records) {
  const xs = (records ?? [])
    .filter((r) => typeof r.correct === 'boolean')
    .sort((a, b) => a.timestamp - b.timestamp)
  const recent = xs.slice(-30)
  const n = recent.length
  const acc = n ? recent.filter((r) => r.correct).length / n : 0
  const ability = abilityOf(records)
  if (n >= 24 && acc >= 0.80 && ability >= 0.75) return { level: 'too-easy', ability, recentAcc: acc, recentN: n }
  if (n >= 24 && acc <= 0.50 && ability <= 0.55) return { level: 'too-hard', ability, recentAcc: acc, recentN: n }
  return { level: 'ok', ability, recentAcc: acc, recentN: n }
}

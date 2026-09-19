// 路径引擎（2026-09-18 · S3/P2）：把「依赖图 + 作答证据」变成"下一步学什么"
//
// 定位：诊断引擎（diagnosis.js）回答"我哪里强哪里弱"；本模块回答"所以下一步学什么、
// 复习什么"。理论基础是知识空间理论 KST（Doignon & Falmagne）：
//   · **外边缘（outer fringe）** = 前置已掌握、自身未掌握的主题 —— 准备好了、学了最有效
//   · **内边缘（inner fringe）** = 已掌握但出现衰退信号的主题 —— 该巩固了
// 依据文档：《依赖图交付与路径引擎设计_20260918.md》§3。
//
// 诚实边界（写死在代码里，不许界面夸大）：
//   · 依赖图只覆盖 K8/K17/K23 三域 61 主题（实测可挂 980 题 / 全库 32.3%），
//     其余域题目**不参与**路径推荐——learn 模式对它们保持 seq 顺序（stats.js 兜底）。
//   · 依赖图是专家假设（每条边含 rationale/confidence），需数据检验：若学习者反复
//     出现"违反依赖的掌握状态"，记录复核，**不得强行纠正学习者**（KST 原则）。
//   · 属性掌握度复用 diagnosis.js 口径（首答加权 + 样本闸 MIN_Q=3），前置证据不足的
//     主题保守判 locked（宁可不说，不掺水）。
import GRAPH from '../data/pathGraph.js'
import { buildAttrIndex, attrMastery, topicMastery as diagTopicMastery, MASTERED } from './diagnosis.js'

/* 推进线：主题"可推进/已掌握"阈值（比晋级赛 0.95 宽松——路径是学习建议，不是考核）。
   与 diagnosis.js 的 MASTERED=0.8 同值同语义，re-export 保持单一来源。 */
export { MASTERED }
export const PATH_GRAPH = GRAPH

/* ── 图索引（模块级单例：静态数据建一次）──
   prereqOf[t]  = t 的全部前置主题（edge.from → t）
   unlocksOf[t] = t 解锁的后继主题（t → to）
   roots        = 无前置的根节点（入口主题） */
const IDX = (() => {
  const byId = new Map(GRAPH.nodes.map((n) => [n.id, n]))
  const prereqOf = new Map(), unlocksOf = new Map()
  for (const n of GRAPH.nodes) { prereqOf.set(n.id, []); unlocksOf.set(n.id, []) }
  let dangling = 0
  for (const e of GRAPH.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) { dangling++; continue }
    prereqOf.get(e.to).push(e.from)
    unlocksOf.get(e.from).push(e.to)
  }
  const roots = GRAPH.nodes.filter((n) => prereqOf.get(n.id).length === 0).map((n) => n.id)
  return { byId, prereqOf, unlocksOf, roots, dangling }
})()

export function buildGraphIndex() { return IDX }

/* ── 题 → 主题（经 Q 矩阵：question_id → attribute_id → topic_id）──
   一题可属多主题（跨主题题同时进多个候选池）。
   返回 Map<questionId, Set<topicId>> */
export function buildQuestionTopicIndex(questionAttributes, attrs) {
  const attrTopic = new Map((attrs ?? []).map((a) => [a.id, a.topic_id ?? a.topicId]))
  const out = new Map()
  for (const r of questionAttributes ?? []) {
    const t = attrTopic.get(r.attributeId ?? r.attribute_id)
    const q = r.questionId ?? r.question_id
    if (!t || !q) continue
    if (!out.has(q)) out.set(q, new Set())
    out.get(q).add(t)
  }
  return out
}

/* ── 主题掌握度：直接复用 diagnosis.js 的 topicMastery（口径单一来源）──
   返回 Map<topicId, { mastery, mastery0, attrTotal, attrMeasured, uncertainAttrs }> */
export function topicMasteryOf(attrs, attrMasteryMap) {
  return diagTopicMastery(attrs, attrMasteryMap)
}

/* 最近窗口衰退信号（内边缘判据②）：
   主题下作答 ≥ RECENT_N+5 条时，最近 RECENT_N 次正确率比全期低 ≥ DECAY_GAP → 衰退。
   （样本下限防"两次做错就报警"；RECENT_N 与 ability.js 的窗口哲学一致但独立取值） */
const RECENT_N = 10
const DECAY_GAP = 0.15
export function decaySignal(topicQuestionIds, records) {
  const byQ = new Set(topicQuestionIds ?? [])
  const rs = (records ?? [])
    .filter((r) => typeof r.correct === 'boolean' && byQ.has(r.questionId))
    .sort((a, b) => a.timestamp - b.timestamp)
  if (rs.length < RECENT_N + 5) return { decaying: false, recent: rs.length, recentAcc: null, overallAcc: null }
  const acc = (arr) => arr.filter((r) => r.correct).length / arr.length
  const overallAcc = acc(rs)
  const recentAcc = acc(rs.slice(-RECENT_N))
  return { decaying: overallAcc - recentAcc >= DECAY_GAP, recent: rs.length, recentAcc, overallAcc }
}

/* ── 一站式路径状态（Path 页与 learn 选题共用）──
   返回 {
     ready,      // 图与 Q 矩阵是否可用（false → learn 须降级 seq）
     mappedQids, // Set：落在依赖图覆盖主题内的题 id（调用方结合 questions 算覆盖率）
     topic,      // Map<topicId, 状态行>
     outer, inner, mastered, locked, untouched,
     counts,     // { total, mastered, outer, inner, locked }
     graphDomains,
   }
   状态行 status 五值：
     mastered  掌握度 ≥ MASTERED 且无衰退/到期信号
     outer     前置满足、自身未掌握（或无证据）→ 下一步学
     inner     已掌握但有到期卡/衰退信号 → 巩固
     locked    前置未掌握或前置证据不足 → 暂不推荐（区分 reason）
     untouched locked 中完全无证据的子集（Path 页单独展示） */
export function pathState(attrs, qaRows, records, cards, now = Date.now()) {
  const attrIndex = buildAttrIndex(qaRows)
  const am = attrMastery(attrIndex, records)
  const tm = topicMasteryOf(attrs, am)
  const qTopics = buildQuestionTopicIndex(qaRows, attrs)
  const ready = (attrs?.length ?? 0) > 0 && IDX.byId.size > 0
  if (!ready) {
    return { ready: false, mappedQids: new Set(), topic: new Map(), outer: [], inner: [], mastered: [], locked: [], untouched: [], counts: { total: 0, mastered: 0, outer: 0, inner: 0, locked: 0 }, graphDomains: GRAPH.meta.domains }
  }

  /* 到期卡按主题聚合（内边缘判据①；一题多主题时计入首个主题，避免重复计数） */
  const dueByTopic = new Map()
  for (const c of cards ?? []) {
    if ((c.dueAt ?? Infinity) > now) continue
    const ts = qTopics.get(c.questionId)
    const t = ts ? [...ts][0] : null
    if (!t) continue
    dueByTopic.set(t, (dueByTopic.get(t) ?? 0) + 1)
  }

  /* 每主题：题目清单 + 属性清单 */
  const topicQuestions = new Map(), topicAttrs = new Map()
  for (const a of attrs ?? []) {
    if (!topicAttrs.has(a.topic_id)) topicAttrs.set(a.topic_id, [])
    topicAttrs.get(a.topic_id).push(a.id)
  }
  for (const [qid, ts] of qTopics) for (const t of ts) {
    if (!topicQuestions.has(t)) topicQuestions.set(t, [])
    topicQuestions.get(t).push(qid)
  }
  const attrName = new Map((attrs ?? []).map((a) => [a.id, a.name]))
  const weakestAttrOf = (topicId) => {
    const rows = []
    for (const aid of topicAttrs.get(topicId) ?? []) {
      const m = am.get(aid)
      if (!m || m.uncertain || m.mastery == null) continue
      rows.push({ id: aid, name: attrName.get(aid) ?? aid, mastery: m.mastery, n: m.n })
    }
    return rows.sort((x, y) => x.mastery - y.mastery).slice(0, 3)
  }

  /* 逐主题定状态 */
  const topic = new Map()
  for (const n of GRAPH.nodes) {
    const t = tm.get(n.id)
    const prereqs = IDX.prereqOf.get(n.id)
    const mastery = t?.mastery ?? null
    const measured = (t?.attrMeasured ?? 0) > 0
    const dueN = dueByTopic.get(n.id) ?? 0
    /* 前置判定：根节点自动满足；有前置 → 全部前置已测量且 ≥ MASTERED 才放行；
       任一前置无证据 → 保守 locked（不猜）。 */
    let prereqOk = true, prereqUnknown = false
    for (const p of prereqs) {
      const pt = tm.get(p)
      if (!pt || pt.attrMeasured === 0 || pt.mastery == null) { prereqUnknown = true; break }
      if (pt.mastery < MASTERED) { prereqOk = false; break }
    }

    let status, reason
    if (prereqUnknown) {
      status = 'locked'; reason = '前置主题证据不足，暂不推荐（不猜测，先去学前置）'
    } else if (!prereqOk) {
      status = 'locked'; reason = '前置未掌握：' + prereqs
        .filter((p) => (tm.get(p)?.mastery ?? 0) < MASTERED)
        .map((p) => IDX.byId.get(p)?.name ?? p).join('、')
    } else if (!measured || mastery == null) {
      status = 'outer'; reason = prereqs.length ? '前置已掌握，此主题尚无作答证据——正是下一步' : '入口主题，尚无作答证据——从这里开始'
    } else if (mastery < MASTERED) {
      status = 'outer'; reason = `前置已掌握，本主题掌握度 ${mastery.toFixed(2)} < ${MASTERED}`
    } else if (dueN > 0) {
      status = 'inner'; reason = `已掌握但有 ${dueN} 张到期卡——按记忆曲线该巩固了`
    } else if (decaySignal(topicQuestions.get(n.id), records).decaying) {
      status = 'inner'; reason = '已掌握但近期正确率下滑——出现衰退信号'
    } else {
      status = 'mastered'; reason = `掌握度 ${mastery.toFixed(2)} ≥ ${MASTERED}，状态良好`
    }

    topic.set(n.id, {
      ...n, mastery, status, reason, dueN,
      prereq: prereqs.map((p) => ({ id: p, name: IDX.byId.get(p)?.name ?? p })),
      unlocks: IDX.unlocksOf.get(n.id).map((p) => ({ id: p, name: IDX.byId.get(p)?.name ?? p })),
      weakestAttrs: weakestAttrOf(n.id),
      qCount: (topicQuestions.get(n.id) ?? []).length,
    })
  }

  const mappedQids = new Set()
  for (const [qid, ts] of qTopics) if ([...ts].some((t) => IDX.byId.has(t))) mappedQids.add(qid)

  const arr = [...topic.values()]
  const rank = (a, b) => (a.level - b.level) || ((a.mastery ?? 1) - (b.mastery ?? 1))
  const outer = arr.filter((t) => t.status === 'outer').sort(rank)
  const inner = arr.filter((t) => t.status === 'inner').sort((a, b) => b.dueN - a.dueN)
  const mastered = arr.filter((t) => t.status === 'mastered')
  const locked = arr.filter((t) => t.status === 'locked')
  const untouched = locked.filter((t) => t.mastery == null)
  return {
    ready, mappedQids, topic, outer, inner, mastered, locked, untouched,
    counts: { total: arr.length, mastered: mastered.length, outer: outer.length, inner: inner.length, locked: locked.length },
    graphDomains: GRAPH.meta.domains,
  }
}

/* ── learn 模式选题（路径驱动版；返回 null = 调用方降级 seq）──
   常规 learn 语义 = "学新内容"：
   ① 外边缘主题内"未进 SRS 卡"的题优先（没学过的新知识）
   ② 不足再补外边缘主题内已学但最近答错的题（补短板）
   ③ 仍不足由调用方用 seq 兜底（stats.js）
   定向练习（attrIds 限定）语义 = "把这一章练会"：薄弱主题往往全部学过且最近
   已刷对（首答加权的低掌握度是历史证据）——此时 fresh/repair 双空会推出 0 题
   （实测 T-TIMER 24 题全学过 → 0 题），故 attrIds 模式追加 ③已学题全量可重练，
   按"未掌握优先（最近答错在前）+ 层级浅优先"排序。常规 learn 不追加（保持
   学新语义，不把已学题重新推回主学习流）。 */
export function pickByPath({ questions, cards, attributes, questionAttributes, records, size, attrIds = null }) {
  /* size 语义与 stats.js 的 take 对齐：0/undefined = 不限量（"挑题练习"默认全部），
     此时路径模式返回全部路径题，由调用方用 seq 池补足。 */
  if (size != null && size <= 0) return []
  if (!attributes?.length || !IDX.byId.size) return null
  const st = pathState(attributes, questionAttributes, records, [])
  if (!st.ready || !st.outer.length) return null
  const outerIds = new Set(st.outer.map((t) => t.id))
  const qTopics = buildQuestionTopicIndex(questionAttributes, attributes)
  /* 定向练习过滤：attrIds 是【属性 id】集合——题的命中判定须经 Q 矩阵
     （题→属性交集非空），不能拿题目 id 直接对属性集合 has（首版实测 bug）。 */
  const qAttrIds = new Map()
  for (const r of questionAttributes ?? []) {
    const aid = r.attributeId ?? r.attribute_id
    const qid = r.questionId ?? r.question_id
    if (!aid || !qid) continue
    if (!qAttrIds.has(qid)) qAttrIds.set(qid, new Set())
    qAttrIds.get(qid).add(aid)
  }
  const seen = new Set((cards ?? []).map((c) => c.questionId))
  const lastWrong = new Map()
  for (const r of (records ?? []).filter((r) => typeof r.correct === 'boolean')
    .sort((a, b) => a.timestamp - b.timestamp)) lastWrong.set(r.questionId, r.correct === false)

  const fresh = [], repair = [], review = []
  for (const q of questions) {
    if (attrIds) {
      const qa = qAttrIds.get(q.id)
      if (!qa || ![...qa].some((a) => attrIds.has(a))) continue
    }
    const ts = qTopics.get(q.id)
    if (!ts || ![...ts].some((t) => outerIds.has(t))) continue
    if (!seen.has(q.id)) fresh.push(q)
    else if (lastWrong.get(q.id)) repair.push(q)
    else if (attrIds) review.push(q)   // 定向练习专属：已学且最近答对也允许重练
  }
  /* 层级浅的优先（从易到难），同层按 seq 稳定序；定向练习内"最近答错过"排前 */
  const levelOf = (q) => {
    const ts = [...(qTopics.get(q.id) ?? [])].filter((t) => outerIds.has(t))
    return ts.length ? Math.min(...ts.map((t) => IDX.byId.get(t)?.level ?? 9)) : 9
  }
  const byLevel = (list) => list.sort((a, b) => levelOf(a) - levelOf(b) || a.seq - b.seq)
  const merged = [...byLevel(fresh), ...byLevel(repair), ...byLevel(review)]
  return size > 0 ? merged.slice(0, size) : merged
}

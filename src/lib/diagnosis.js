// 诊断引擎（2026-09-18 · P0-S3）：把「作答记录 + Q 矩阵」转换为属性/主题掌握度
//
// 定位：诊断引擎是"看清人"的核心计算单元——站点此前的诊断粒度只能到 K 域族级
// （知识点标签一题一点、统计密度 1 题/点，见 ability.js 注释自陈），本模块基于
// 属性体系（attributes + question_attributes 两张表）把粒度推进到"属性级"：
// 每个属性由 5~16 道题共同测量，掌握度首次具备统计意义。
//
// 口径（与站点既有 empDifficulty 同源，保持全站一致）：
//   · **首答加权**：同一题首次作答权重 1，其后按 0.5^n 衰减——首次接触的表现
//     最能反映真实掌握；重复刷题不应把没学懂的属性"刷成"已掌握。
//   · **样本闸**：某属性下有作答的题数 < MIN_Q（默认 3）→ 标 uncertain，
//     不参与掌握度结论（宁可不说，不掺水）。这与 masteryGate 的 KP_MIN 同哲学。
//   · **属性多归属**：一道题可属多个属性（Q 矩阵多对多），作答证据同时贡献给各属性。
//
// 诚实边界：本模块只做"基于作答证据的推断"，不做能力标定（单用户无法标定
// 群体参数）。uncertain 属性在界面应显示为"证据不足"而非"未掌握"。

export const MIN_Q = 3          // 属性最低有作答题数
export const REPEAT_DECAY = 0.5 // 重复作答权重衰减（与 ability.js 同口径）
export const MASTERED = 0.8     // 掌握判定线（路径引擎"可推进"阈值；晋级仍用严格线）

/* 构建属性 → 题目索引（Q 矩阵反向索引）
   qaRows: [{ question_id, attribute_id, source }]（来自 question_attributes 表）
   返回 Map<attributeId, { questionIds:Set, sources:Set }> */
export function buildAttrIndex(qaRows) {
  const idx = new Map()
  for (const r of qaRows ?? []) {
    const a = r.attribute_id ?? r.attributeId
    const q = r.question_id ?? r.questionId
    if (!a || !q) continue
    if (!idx.has(a)) idx.set(a, { questionIds: new Set(), sources: new Set() })
    const e = idx.get(a)
    e.questionIds.add(q)
    if (r.source) e.sources.add(r.source)
  }
  return idx
}

/* 属性掌握度
   attrIndex: buildAttrIndex 的输出
   records:   [{ questionId, correct, timestamp }]（站点 store.records 已含 timestamp）
   返回 Map<attributeId, { mastery, n, evidence, uncertain }>
     mastery  ∈ [0,1]（首答加权正确率；uncertain 时为 null）
     n        有作答的题数（去重）
     evidence 作答条数（含重复） */
export function attrMastery(attrIndex, records) {
  // 先按题分组（一次遍历，避免 O(属性数 × 记录数)）
  const byQ = new Map()
  for (const r of records ?? []) {
    if (typeof r.correct !== 'boolean') continue
    if (!byQ.has(r.questionId)) byQ.set(r.questionId, [])
    byQ.get(r.questionId).push(r)
  }
  const out = new Map()
  for (const [attrId, { questionIds, sources }] of attrIndex) {
    let wn = 0, wc = 0, n = 0, evidence = 0
    for (const qid of questionIds) {
      const rs = byQ.get(qid)
      if (!rs || !rs.length) continue
      n++
      evidence += rs.length
      const sorted = [...rs].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      sorted.forEach((r, k) => {
        const w = Math.pow(REPEAT_DECAY, k)   // 首答权重 1，其后衰减
        wn += w
        if (r.correct) wc += w
      })
    }
    const uncertain = n < MIN_Q
    out.set(attrId, {
      mastery: uncertain || wn === 0 ? null : wc / wn,
      n, evidence, uncertain,
      sources: [...sources],
    })
  }
  return out
}

/* 主题掌握度 = 其属性掌握度的均值（仅计有证据且非 uncertain 的属性）
   attrs: [{ id, domain, topic_id|topicId, topic_name|topicName, name }]
   字段双兼容（2026-09-19 修复）：REST 原始行为 snake_case（topic_id），
   store 经 db.js toAttr 映射后为 camelCase（topicId）——此前只读 snake_case，
   页面传入 store 数据时主题分组静默退化（全部落进 undefined bucket）、
   weakestAttrs 的主题名渲染为空。兼容读法同时覆盖两路，verify 脚本不受影响。
   返回 Map<topicId, { mastery, attrTotal, attrMeasured, uncertainAttrs, mastery0 }>
     mastery0 通过率：未测量属性按 0 计的保守值（用于路径引擎判断"该主题是否已掌握"） */
export function topicMastery(attrs, attrMasteryMap) {
  const byTopic = new Map()
  for (const a of attrs ?? []) {
    const t = a.topic_id ?? a.topicId
    if (!byTopic.has(t)) byTopic.set(t, { name: a.topic_name ?? a.topicName, domain: a.domain, attrIds: [] })
    byTopic.get(t).attrIds.push(a.id)
  }
  const out = new Map()
  for (const [topicId, info] of byTopic) {
    const vals = [], uncertainAttrs = []
    let measured = 0, sum = 0
    for (const aid of info.attrIds) {
      const m = attrMasteryMap.get(aid)
      if (!m || m.uncertain || m.mastery == null) { uncertainAttrs.push(aid); continue }
      measured++; sum += m.mastery; vals.push(m.mastery)
    }
    const mastery = measured ? sum / measured : null
    out.set(topicId, {
      name: info.name, domain: info.domain,
      mastery,                                   // 已测属性的均值（null=全无证据）
      mastery0: info.attrIds.length ? (sum + 0 * (info.attrIds.length - measured)) / info.attrIds.length : null,
      attrTotal: info.attrIds.length, attrMeasured: measured,
      uncertainAttrs,
    })
  }
  return out
}

/* 薄弱属性排序（用于 Insight 页与"练薄弱"入口）
   attrMasteryMap 之上按 mastery 升序；uncertain 单列（不混入排名） */
export function weakestAttrs(attrs, attrMasteryMap, topN = 10) {
  const nameOf = new Map((attrs ?? []).map(a => [a.id, a]))
  const ranked = [], uncertain = []
  for (const [aid, m] of attrMasteryMap) {
    const meta = nameOf.get(aid)
    if (!meta) continue
    /* 字段双兼容（2026-09-19 修复，同 topicMastery）：REST 行 snake / store 行 camel */
    const row = { id: aid, name: meta.name, topicId: meta.topic_id ?? meta.topicId, topicName: meta.topic_name ?? meta.topicName, domain: meta.domain, ...m }
    if (m.uncertain) uncertain.push(row)
    else ranked.push(row)
  }
  ranked.sort((a, b) => a.mastery - b.mastery || b.n - a.n)
  return { weakest: ranked.slice(0, topN), uncertain }
}

/* 域级汇总（Dashboard 雷达图数据）
   返回 [{ domain, mastered, measured, uncertain, rate, mastery }]
     rate = 已掌握属性数 / 已测量属性数 */
export function domainSummary(attrs, attrMasteryMap) {
  const byDomain = new Map()
  for (const a of attrs ?? []) {
    if (!byDomain.has(a.domain)) byDomain.set(a.domain, { master: 0, measured: 0, uncertain: 0, sum: 0 })
    const s = byDomain.get(a.domain)
    const m = attrMasteryMap.get(a.id)
    if (!m || m.uncertain || m.mastery == null) { s.uncertain++; continue }
    s.measured++; s.sum += m.mastery
    if (m.mastery >= MASTERED) s.master++
  }
  return [...byDomain.entries()].map(([domain, s]) => ({
    domain,
    mastered: s.master,
    measured: s.measured,
    uncertain: s.uncertain,
    rate: s.measured ? s.master / s.measured : null,
    mastery: s.measured ? s.sum / s.measured : null,
  })).sort((a, b) => (b.measured - a.measured) || a.domain.localeCompare(b.domain))
}

/* 一站式诊断报告（供 Dashboard/Insight 单次调用） */
export function diagnosisReport(attrs, qaRows, records, opts = {}) {
  const attrIndex = buildAttrIndex(qaRows)
  const am = attrMastery(attrIndex, records)
  const tm = topicMastery(attrs, am)
  const { weakest, uncertain } = weakestAttrs(attrs, am, opts.topN ?? 10)
  const domains = domainSummary(attrs, am)
  let measuredN = 0, masteredN = 0
  for (const m of am.values()) if (!m.uncertain && m.mastery != null) { measuredN++; if (m.mastery >= MASTERED) masteredN++ }
  /* 口径澄清（v1.1）：属性分三类，须分别计数，不得混算——
       ① measured   有足够证据（≥MIN_Q 题）→ 可下结论
       ② uncertain  有题但证据不足 → 显示"证据不足"
       ③ noQuestion Q 矩阵中无任何题（空属性）→ 属体系缺口，应补题（与"未掌握"无关） */
  const noQuestionN = (attrs ?? []).filter(a => !attrIndex.has(a.id)).length
  const uncertainN = (attrs ?? []).length - measuredN - noQuestionN
  return {
    attr: am, topic: tm, domains, weakest, uncertainAttrs: uncertain,
    summary: {
      attrTotal: attrs?.length ?? 0,
      attrMeasured: measuredN,
      attrMastered: masteredN,
      attrUncertain: uncertainN,
      attrNoQuestion: noQuestionN,
      coverage: attrs?.length ? measuredN / attrs.length : 0,
    },
  }
}

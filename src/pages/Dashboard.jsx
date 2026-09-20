/* Dashboard · 掌握度仪表盘（2026-09-18 · P1 细粒度诊断）
 *
 * 定位：把 diagnosis.js 的属性级诊断结果变成学习者能看懂的界面。
 * 与既有页面的关系：Learn 页给"今天练什么"，本页回答"我到底哪里强、哪里弱"——
 * 诊断粒度从 K 域族级（"K8 域正确率 82%"）下沉到属性级（"延时方式分类 0.10"）。
 *
 * 设计口径：
 *   · 纯展示，不改选题内核（"定向练习"入口待路径引擎 S5 实现，本页先给题目清单与状态）
 *   · 证据不足（属性下作答题数 < MIN_Q）单列，不与"未掌握"混为一谈（诚实边界）
 *   · 无属性数据（DDL 未执行）时降级提示，不报错 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { diagnosisReport, MIN_Q, MASTERED } from '../lib/diagnosis'

const pct = (x) => (x == null ? '—' : (x * 100).toFixed(0) + '%')
const bar = (x) => Math.max(0, Math.min(1, x ?? 0)) * 100

export default function Dashboard() {
  const nav = useNavigate()
  const attributes = useStore((s) => s.attributes)
  const questionAttributes = useStore((s) => s.questionAttributes)
  const records = useStore((s) => s.records)
  const questions = useStore((s) => s.questions)
  const [openAttr, setOpenAttr] = useState(null)

  const rep = useMemo(
    () => diagnosisReport(attributes, questionAttributes, records, { topN: 10 }),
    [attributes, questionAttributes, records]
  )

  /* 成长曲线（P1-1 补齐）：按时间序的「每 10 题滚动正确率」——看得见的进步证据。
     计算口径：最近 120 条客观作答，每 10 条一桶取正确率（O(n)，现算现用）。
     注：能力指数（EWMA）是单值且已在他处展示；此处画的是原始正确率趋势，不重复造指数。 */
  const trend = useMemo(() => {
    const rs = [...records]
      .filter((r) => typeof r.correct === 'boolean')
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-120)
    const pts = []
    for (let i = 9; i < rs.length; i += 5) {
      const bucket = rs.slice(i - 9, i + 1)
      pts.push(bucket.filter((r) => r.correct).length / 10)
    }
    return pts
  }, [records])

  // 属性 → 题目（展开时显示每题的作答状态）
  const qByAttr = useMemo(() => {
    const m = new Map()
    for (const r of questionAttributes) {
      if (!m.has(r.attributeId)) m.set(r.attributeId, [])
      m.get(r.attributeId).push(r.questionId)
    }
    return m
  }, [questionAttributes])
  const lastByQ = useMemo(() => {
    const m = new Map()
    for (const r of records) if (typeof r.correct === 'boolean') m.set(r.questionId, r)   // 按时间序，后者覆盖前者
    return m
  }, [records])
  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])

  if (!attributes.length) {
    return (
      <div className="panel" style={{ margin: '18px auto', maxWidth: 560, padding: 18 }}>
        <h3 style={{ marginBottom: 8 }}>诊断</h3>
        <p style={{ fontSize: 13, lineHeight: 1.7, opacity: .85 }}>
          属性体系尚未就绪（数据库缺少 attributes / question_attributes 两表，或尚未写入数据）。
          刷题、复习、晋级均不受影响；属性体系入库后本页自动可用。
        </p>
      </div>
    )
  }

  const { summary, domains, weakest, uncertainAttrs, attr } = rep
  const measuredDomains = domains.filter((d) => d.measured > 0)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '6px 12px 90px' }}>
      {/* 顶部概况 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ marginBottom: 10, letterSpacing: 2 }}>掌握度仪表盘</h3>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
          <div><b style={{ fontSize: 20 }}>{summary.attrMastered}</b> <span style={{ opacity: .75 }}>个属性已掌握</span></div>
          <div><b style={{ fontSize: 20 }}>{summary.attrMeasured}</b> <span style={{ opacity: .75 }}>个属性有足够证据</span></div>
          <div><b style={{ fontSize: 20 }}>{pct(summary.coverage)}</b> <span style={{ opacity: .75 }}>诊断覆盖率</span></div>
        </div>
        <p style={{ fontSize: 11.5, opacity: .65, marginTop: 10, lineHeight: 1.6 }}>
          口径：属性掌握度按<b>首答加权</b>计算（首次作答权重最高，重复刷题不会把没学懂的属性刷成掌握）；
          同一属性下需 ≥{MIN_Q} 题有作答才纳入结论，掌握线 {MASTERED}。
        </p>
        {trend.length >= 3 && (() => {
          const W = 300, H = 46
          const pts = trend.map((v, i) => [(i / Math.max(1, trend.length - 1)) * (W - 8) + 4, H - 6 - v * (H - 12)])
          const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')
          return (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, opacity: .65, marginBottom: 3 }}>成长曲线（最近作答 · 每 10 题滚动正确率）</div>
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="最近作答正确率趋势">
                <line x1="4" y1={H - 6 - 0.7 * (H - 12)} x2={W - 4} y2={H - 6 - 0.7 * (H - 12)} stroke="rgba(0,0,0,.12)" strokeDasharray="3 3" strokeWidth="1" />
                <path d={path} fill="none" stroke="#3FA77E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="#3FA77E" />}
              </svg>
              <div style={{ fontSize: 10.5, opacity: .55, marginTop: 2 }}>虚线 = 70% 合意困难参考线；只画原始正确率（能力指数为单值不重复展示）。</div>
            </div>
          )
        })()}
      </div>

      {/* 域级画像 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h4 style={{ marginBottom: 10, fontSize: 14 }}>域掌握度（有证据的属性）</h4>
        {measuredDomains.map((d) => (
          <div key={d.domain} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
              <span><b>{d.domain}</b> <span style={{ opacity: .6 }}>{d.measured} 个属性有证据 / 共 {d.measured + d.uncertain}</span></span>
              <span>掌握率 {pct(d.rate)} · 平均掌握度 {d.mastery == null ? '—' : d.mastery.toFixed(2)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 6, background: 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
              <div style={{ width: bar(d.mastery) + '%', height: '100%', background: 'var(--pp-acc, #2F5FD0)' }} />
            </div>
          </div>
        ))}
        {!measuredDomains.length && (
          <p style={{ fontSize: 12.5, opacity: .7 }}>暂无域级证据——继续刷题后本区会自动填充。</p>
        )}
      </div>

      {/* 最薄弱属性 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h4 style={{ marginBottom: 4, fontSize: 14 }}>最薄弱属性 Top {weakest.length}</h4>
        <p style={{ fontSize: 11.5, opacity: .6, marginBottom: 10 }}>按掌握度升序 —— 越靠前越该优先补</p>
        {!weakest.length && <p style={{ fontSize: 12.5, opacity: .7 }}>暂无足够证据的属性。</p>}
        {weakest.map((w, i) => {
          const open = openAttr === w.id
          const qids = qByAttr.get(w.id) ?? []
          return (
            <div key={w.id} style={{ borderTop: i ? '1px solid rgba(0,0,0,.06)' : 'none', padding: '9px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {i + 1}. {w.name}
                  </div>
                  <div style={{ fontSize: 11.5, opacity: .62, marginTop: 2 }}>
                    {w.topicName} · {w.domain} · 证据 {w.n} 题
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 62 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: w.mastery < 0.5 ? '#C0392B' : 'inherit' }}>
                    {w.mastery.toFixed(2)}
                  </div>
                  <button className="chip" style={{ fontSize: 11, padding: '2px 8px', marginTop: 2 }}
                    onClick={() => setOpenAttr(open ? null : w.id)}>
                    {open ? '收起' : '看题目'}
                  </button>
                </div>
              </div>
              {open && (
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7, background: 'rgba(0,0,0,.03)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ opacity: .7, marginBottom: 4 }}>该属性下的题目（共 {qids.length} 道）：</div>
                  {qids.map((qid) => {
                    const q = qById.get(qid); const r = lastByQ.get(qid)
                    const st = r ? (r.correct ? '✅ 上次答对' : '❌ 上次答错') : '⚪ 未作答'
                    return (
                      <div key={qid} style={{ padding: '2px 0', display: 'flex', gap: 6 }}>
                        <span style={{ opacity: .55, minWidth: 52 }}>seq{q?.seq ?? '—'}</span>
                        <span style={{ flex: 1 }}>{String(q?.stem ?? qid).slice(0, 34)}…</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{st}</span>
                      </div>
                    )
                  })}
                  <div style={{ marginTop: 6, opacity: .6, fontSize: 11 }}>
                    想定向练这一章？去「学习路径」页面按主题发起定向练习。
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 证据不足 */}
      <div className="panel" style={{ padding: 16 }}>
        <h4 style={{ marginBottom: 8, fontSize: 14 }}>证据不足的属性（{uncertainAttrs.length}）</h4>
        <p style={{ fontSize: 11.5, opacity: .65, lineHeight: 1.7 }}>
          这些属性下的作答题数少于 {MIN_Q} 题，尚不能下结论（<b>不等于未掌握</b>）。
          继续刷题即可自动纳入诊断。
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {uncertainAttrs.slice(0, 24).map((u) => (
            <span key={u.id} className="chip" style={{ fontSize: 11, padding: '2px 8px', opacity: .8 }}
              title={`${u.topicName} · 证据 ${u.n} 题`}>{u.name}</span>
          ))}
          {uncertainAttrs.length > 24 && <span style={{ fontSize: 11, opacity: .6 }}>… 其余 {uncertainAttrs.length - 24} 个</span>}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="chip" onClick={() => nav('/path')} style={{ fontSize: 13 }}>学习路径（下一步学什么）→</button>
        <button className="chip" onClick={() => nav('/insight')} style={{ fontSize: 13 }}>🔍 错因与干扰项画像 →</button>
      </div>
    </div>
  )
}

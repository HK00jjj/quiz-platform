/* Path · 学习路径（2026-09-18 · S3/P2 路径引擎）
 *
 * 定位：Dashboard 回答"我哪里强哪里弱"，本页回答"所以下一步学什么、该巩固什么"。
 * 理论：知识空间理论 KST 的外边缘（前置已掌握、自身未掌握 = 学了最有效）
 *      与内边缘（已掌握但衰退/到期 = 巩固最高效）。
 *      依据《依赖图交付与路径引擎设计_20260918.md》。
 *
 * 诚实口径（本页最重要的设计约束）：
 *   · 依赖图只覆盖 K8/K17/K23 三域 61 主题（Q 矩阵可挂 980 题，实测约占全库 1/3）；
 *     其余域的题不受路径引擎影响，学习页仍按入库顺序推进——不夸大覆盖面。
 *   · "locked（暂不推荐）"主题显式说明是前置未掌握还是前置证据不足，不猜；
 *     该区不提供定向练习入口（引擎只从外边缘组卷）——想提前学的用户走学习页或题库。
 *   · 前置证据不足的主题不进入推荐（宁可不说，不掺水）。
 *   · 依赖图是专家假设，若你实际会做某主题的题却显示前置未掌握——以你的实际为准，
 *     直接去学习页或题库练（不强行纠正学习者）。
 */
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { pathState, MASTERED, PATH_GRAPH } from '../lib/path'

const pct = (x) => (x == null ? '—' : (x * 100).toFixed(0) + '%')
const LEVEL_NAME = { 1: '入门', 2: '基础', 3: '进阶', 4: '提高', 5: '综合', 6: '高级', 7: '精通' }

/* P2-4 依赖图图谱（SVG 分层渲染）：节点=主题（按五态着色），边=先修关系。
   布局：按 level 分 7 行、同层按依赖序排布；只渲染依赖图覆盖的三域 61 主题。 */
const STATE_COLOR = {
  mastered: '#5FAE8F', outer: '#3B82C4', inner: '#D89B2B', locked: '#B9B2A6', untouched: '#CFC9BF',
}
function GraphView({ st, onPick }) {
  const { nodes, edges } = PATH_GRAPH
  const W = 860, ROW_H = 74, N_W = 128, N_H = 40
  const H = 7 * ROW_H + 30
  /* 同层排序：被同层指向的排后面（简单按 id 分组保稳定） */
  const rows = {}
  for (const n of nodes) (rows[n.level] = rows[n.level] ?? []).push(n)
  const pos = new Map()
  for (const lv of Object.keys(rows).sort((a, b) => a - b)) {
    rows[lv].forEach((n, i) => pos.set(n.id, [14 + i * ((W - 28) / rows[lv].length), 14 + (n.level - 1) * ROW_H]))
  }
  const statusOf = (id) => st.topic.get(id)?.status ?? 'locked'
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 760 }} role="img" aria-label="知识依赖图">
        {edges.map((e, i) => {
          const a = pos.get(e.from), b = pos.get(e.to)
          if (!a || !b) return null
          const x1 = a[0] + N_W / 2, y1 = a[1] + N_H, x2 = b[0] + N_W / 2, y2 = b[1]
          const mid = (y1 + y2) / 2
          return <path key={i} d={`M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`} fill="none" stroke="rgba(0,0,0,.14)" strokeWidth="1.2" />
        })}
        {nodes.map((n) => {
          const [x, y] = pos.get(n.id)
          const st8 = statusOf(n.id)
          const t = st.topic.get(n.id)
          return (
            <g key={n.id} onClick={() => onPick(n.id)} style={{ cursor: 'pointer' }}>
              <title>{`${n.name}｜${n.domain} L${n.level}｜${t?.reason ?? ''}`}</title>
              <rect x={x} y={y} width={N_W} height={N_H} rx="8"
                fill={STATE_COLOR[st8]} opacity={st8 === 'outer' ? 0.92 : 0.55}
                stroke={st8 === 'outer' ? '#23639B' : 'rgba(0,0,0,.18)'} strokeWidth={st8 === 'outer' ? 2 : 1} />
              <text x={x + N_W / 2} y={y + 16} textAnchor="middle" fontSize="10.5" fill="#1F2933" fontWeight="600">
                {n.name.length > 9 ? n.name.slice(0, 9) : n.name}
              </text>
              <text x={x + N_W / 2} y={y + 31} textAnchor="middle" fontSize="9" fill="rgba(0,0,0,.55)">
                {`${n.domain} · ${t?.mastery == null ? '无证据' : t.mastery.toFixed(2)}`}
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ fontSize: 10.5, opacity: .65, display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        {Object.entries({ mastered: '已掌握', outer: '可推进（高亮）', inner: '待巩固', locked: '前置未满', untouched: '无证据' }).map(([k, v]) => (
          <span key={k}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: STATE_COLOR[k], marginRight: 4, verticalAlign: '-1px' }} />{v}</span>
        ))}
        <span style={{ opacity: .8 }}>点节点看理由（悬停看全名与掌握度）</span>
      </div>
    </div>
  )
}

export default function Path() {
  const nav = useNavigate()
  const attributes = useStore((s) => s.attributes)
  const questionAttributes = useStore((s) => s.questionAttributes)
  const records = useStore((s) => s.records)
  const cards = useStore((s) => s.cards)
  const questions = useStore((s) => s.questions)
  const startSession = useStore((s) => s.startSession)
  const [starting, setStarting] = useState(null)   // 正在发起的 topicId（防双击）
  const [showGraph, setShowGraph] = useState(false)
  const [graphPick, setGraphPick] = useState(null)

  const st = useMemo(
    () => pathState(attributes, questionAttributes, records, cards),
    [attributes, questionAttributes, records, cards]
  )

  /* 覆盖度：当前书中落在依赖图主题内的题占比（诚实边界可视化） */
  const cov = useMemo(() => {
    const mapped = questions.filter((q) => st.mappedQids.has(q.id)).length
    return { mapped, total: questions.length, rate: questions.length ? mapped / questions.length : 0 }
  }, [questions, st.mappedQids])

  /* 定向练习：learn 模式 + 属性集合限定（pickByPath 的 attrIds 管道）。
     主题级入口：该主题全部属性的题。会话内仍走三遍判定随机穿插。 */
  async function startTopic(t) {
    if (starting) return
    setStarting(t.id)
    try {
      const attrOfTopic = new Set(
        (attributes ?? []).filter((a) => a.topicId === t.id).map((a) => a.id)
      )
      const n = await startSession('learn', { attrIds: attrOfTopic, size: 15 })
      if (n > 0) nav('/practice')
    } finally {
      setStarting(null)
    }
  }

  if (!st.ready) {
    return (
      <div className="panel" style={{ margin: '18px auto', maxWidth: 560, padding: 18 }}>
        <h3 style={{ marginBottom: 8 }}>🧭 学习路径</h3>
        <p style={{ fontSize: 13, lineHeight: 1.7, opacity: .85 }}>
          属性体系尚未就绪（缺少 attributes / question_attributes 数据），
          路径引擎无法计算。学习页将按入库顺序推进，不受影响。
        </p>
        <div style={{ marginTop: 10 }}>
          <button className="chip" onClick={() => nav('/dashboard')}>← 返回掌握度仪表盘</button>
        </div>
      </div>
    )
  }

  const { counts, outer, inner, mastered, locked, untouched } = st

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '6px 12px 90px' }}>
      {/* 顶部 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ marginBottom: 8, letterSpacing: 2 }}>🧭 学习路径</h3>
        <p style={{ fontSize: 12.5, opacity: .75, lineHeight: 1.7, margin: 0 }}>
          依据知识依赖图与你的作答证据计算：<b>外边缘</b> = 前置已掌握、自身未掌握——下一步学它最有效；
          <b>内边缘</b> = 已掌握但出现到期或衰退——巩固它最高效。
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, marginTop: 10 }}>
          <div><b style={{ fontSize: 20 }}>{counts.mastered}</b> <span style={{ opacity: .75 }}>/ {counts.total} 主题已掌握</span></div>
          <div><b style={{ fontSize: 20, color: '#2E7D32' }}>{counts.outer}</b> <span style={{ opacity: .75 }}>个可推进</span></div>
          <div><b style={{ fontSize: 20, color: '#B8860B' }}>{counts.inner}</b> <span style={{ opacity: .75 }}>个待巩固</span></div>
        </div>
        <p style={{ fontSize: 11.5, opacity: .6, marginTop: 10, lineHeight: 1.6 }}>
          覆盖口径：依赖图覆盖 K8/K17/K23 三域 61 主题；当前书 <b>{cov.mapped}</b>/{cov.total} 题（{pct(cov.rate)}）在图内。
          图外题目的学习顺序保持不变。掌握线 {MASTERED}（晋级赛仍用 0.95 严格线）。
        </p>
        <div style={{ marginTop: 10 }}>
          <button className="chip" style={{ fontSize: 12 }} onClick={() => setShowGraph((v) => !v)}>
            {showGraph ? '▲ 收起依赖图谱' : '▼ 展开依赖图谱（61 主题 · 按掌握状态着色）'}
          </button>
        </div>
        {showGraph && (
          <div style={{ marginTop: 10 }}>
            <GraphView st={st} onPick={(id) => setGraphPick(id)} />
            {graphPick && st.topic.get(graphPick) && (() => {
              const t = st.topic.get(graphPick)
              return (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,.04)', fontSize: 12, lineHeight: 1.7 }}>
                  <b>{t.name}</b>（{t.domain} L{t.level}）｜状态：{t.status}｜掌握度 {t.mastery == null ? '无证据' : t.mastery.toFixed(2)}
                  <br />{t.reason}
                  {t.prereq.length > 0 && <>｜前置：{t.prereq.map((p) => p.name).join('、')}</>}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* 外边缘 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h4 style={{ marginBottom: 4, fontSize: 14 }}>🎯 下一步学什么（外边缘 · {outer.length}）</h4>
        <p style={{ fontSize: 11.5, opacity: .6, marginBottom: 10 }}>按层级升序、同级薄弱优先 —— 点"定向练这章"直接开一场该主题的练习</p>
        {!outer.length && <p style={{ fontSize: 12.5, opacity: .7 }}>暂无可推进主题（可能全部掌握，或证据不足——继续刷题）。</p>}
        {outer.map((t, i) => (
          <div key={t.id} style={{ borderTop: i ? '1px solid rgba(0,0,0,.06)' : 'none', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {t.name}
                  <span className="chip" style={{ fontSize: 10, padding: '1px 6px', marginLeft: 6, opacity: .7 }}>{t.domain} · {LEVEL_NAME[t.level] ?? 'L' + t.level}</span>
                </div>
                <div style={{ fontSize: 11.5, opacity: .65, marginTop: 3, lineHeight: 1.5 }}>{t.reason}</div>
                {t.weakestAttrs.length > 0 && (
                  <div style={{ fontSize: 11.5, marginTop: 4, opacity: .8 }}>
                    薄弱属性：{t.weakestAttrs.map((w) => `${w.name} (${w.mastery.toFixed(2)})`).join(' · ')}
                  </div>
                )}
                {t.unlocks.length > 0 && (
                  <div style={{ fontSize: 11, opacity: .5, marginTop: 3 }}>
                    学完解锁：{t.unlocks.map((u) => u.name).join('、')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', minWidth: 74 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.mastery == null ? '#888' : t.mastery < 0.5 ? '#C0392B' : 'inherit' }}>
                  {t.mastery == null ? '—' : t.mastery.toFixed(2)}
                </div>
                <button className="chip" style={{ fontSize: 11, padding: '3px 9px', marginTop: 4 }}
                  disabled={starting === t.id} onClick={() => startTopic(t)}>
                  {starting === t.id ? '组卷中…' : '定向练这章'}
                </button>
              </div>
            </div>
            {t.qCount > 0 && <div style={{ fontSize: 10.5, opacity: .45, marginTop: 3 }}>题库内该主题 {t.qCount} 题</div>}
          </div>
        ))}
      </div>

      {/* 内边缘 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h4 style={{ marginBottom: 4, fontSize: 14 }}>🔁 该巩固什么（内边缘 · {inner.length}）</h4>
        <p style={{ fontSize: 11.5, opacity: .6, marginBottom: 10 }}>已掌握但出现到期卡或衰退信号 —— 到期题也会照常出现在学习页的「复习」入口</p>
        {!inner.length && <p style={{ fontSize: 12.5, opacity: .7 }}>暂无待巩固主题。</p>}
        {inner.map((t, i) => (
          <div key={t.id} style={{ borderTop: i ? '1px solid rgba(0,0,0,.06)' : 'none', padding: '8px 0', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name} <span style={{ fontSize: 10.5, opacity: .6 }}>{t.domain}</span></div>
              <div style={{ fontSize: 11.5, opacity: .65, marginTop: 2 }}>{t.reason}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t.mastery?.toFixed(2)}</div>
              <button className="chip" style={{ fontSize: 11, padding: '2px 8px', marginTop: 3 }} onClick={() => nav('/')}>去复习</button>
            </div>
          </div>
        ))}
      </div>

      {/* 已掌握概览 */}
      {mastered.length > 0 && (
        <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
          <h4 style={{ marginBottom: 8, fontSize: 14 }}>✅ 已掌握（{mastered.length}）</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {mastered.map((t) => (
              <span key={t.id} className="chip" style={{ fontSize: 11, padding: '2px 8px' }} title={`${t.domain} · ${t.mastery?.toFixed(2)}`}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* locked / untouched */}
      <div className="panel" style={{ padding: 16 }}>
        <h4 style={{ marginBottom: 4, fontSize: 14 }}>🔒 暂未进入推荐（{locked.length}）</h4>
        <p style={{ fontSize: 11.5, opacity: .6, marginBottom: 10, lineHeight: 1.6 }}>
          前置未掌握或前置证据不足。依赖图是学习假设——若你实际已会某主题，直接去练即可（以实际为准）。
        </p>
        {locked.slice(0, 12).map((t, i) => (
          <div key={t.id} style={{ borderTop: i ? '1px solid rgba(0,0,0,.06)' : 'none', padding: '7px 0', fontSize: 12.5 }}>
            <div style={{ fontWeight: 600 }}>{t.name} <span style={{ fontSize: 10.5, opacity: .6 }}>{t.domain} · {LEVEL_NAME[t.level] ?? 'L' + t.level}</span></div>
            <div style={{ fontSize: 11.5, opacity: .65, marginTop: 2 }}>{t.reason}</div>
          </div>
        ))}
        {locked.length > 12 && <div style={{ fontSize: 11, opacity: .55, marginTop: 6 }}>… 其余 {locked.length - 12} 个主题</div>}
        {untouched.length === locked.length && locked.length > 0 && (
          <div style={{ fontSize: 11, opacity: .55, marginTop: 8 }}>当前全部主题都还没有足够作答证据——先从上面的入口主题开始刷题。</div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 14, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="chip" onClick={() => nav('/dashboard')} style={{ fontSize: 13 }}>← 掌握度仪表盘</button>
        <button className="chip" onClick={() => nav('/insight')} style={{ fontSize: 13 }}>错因画像 →</button>
      </div>
    </div>
  )
}

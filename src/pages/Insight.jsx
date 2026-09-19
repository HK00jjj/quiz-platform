/* Insight · 错因与干扰项画像（2026-09-18 · P1 细粒度诊断）
 *
 * 定位：回答"我为什么错"——三块画像：
 *   ① 错题域/主题分布（错在哪个知识面）
 *   ② 错因分布（解析 [错因:xx] 六值标签聚合：概念缺失/公式误用/单位口径/审题偏差/干扰项混淆/工况错配）
 *   ③ 高频混淆点（解析中「（混淆点：…）」的聚合，来自 v7.0 干扰项规范）
 *
 * 诚实口径：
 *   · ②依赖解析尾部标签（v6.9 起引入）——存量题可能无标签，页面显式报告"可标注题数/总错题数"
 *   · ③为**题目级**统计（该题涉及的混淆点集合），不是"你选的那个选项的混淆点"——
 *     精确到选项需要解析结构化，当前解析为文本；页面注明该口径，不夸大精度
 *   · 数据全部来自本机已加载的 records/questions，无新表依赖 */
import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'

const CAUSE_ORDER = ['概念缺失', '公式误用', '单位口径', '审题偏差', '干扰项混淆', '工况错配']

export default function Insight() {
  const nav = useNavigate()
  const records = useStore((s) => s.records)
  const questions = useStore((s) => s.questions)
  const attributes = useStore((s) => s.attributes)

  const data = useMemo(() => {
    const qById = new Map(questions.map((q) => [q.id, q]))
    const attrNameByQ = new Map()   // 题 → 主题名（借 Q 矩阵 + 属性字典）
    const topicOfAttr = new Map(attributes.map((a) => [a.id, a.topicName]))

    const domStat = new Map()      // 域 → {wrong, total}
    const topicStat = new Map()    // 主题 → {wrong, total}
    const causeStat = new Map()    // 错因 → 次数
    const confStat = new Map()     // 混淆点 → {count, topics:Set}
    let wrongTotal = 0, withCauseTag = 0, withConf = 0

    for (const r of records) {
      if (typeof r.correct !== 'boolean') continue
      const q = qById.get(r.questionId)
      if (!q) continue
      const dom = q.knowledgeDomain ?? '未标注'
      const topic = q.knowledgePoint ?? '未标注'
      if (!domStat.has(dom)) domStat.set(dom, { wrong: 0, total: 0 })
      if (!topicStat.has(topic)) topicStat.set(topic, { wrong: 0, total: 0 })
      domStat.get(dom).total++
      topicStat.get(topic).total++
      if (r.correct) continue
      wrongTotal++
      domStat.get(dom).wrong++
      topicStat.get(topic).wrong++
      const ex = q.explanation ?? ''
      const m = ex.match(/\[错因[:：]\s*([^\]\s]+)\s*\]/)
      if (m) { withCauseTag++; causeStat.set(m[1], (causeStat.get(m[1]) ?? 0) + 1) }
      const confs = [...ex.matchAll(/（混淆点[:：]([^）]+)）/g)].map((x) => x[1])
      if (confs.length) {
        withConf++
        for (const c of confs) {
          const key = c.slice(0, 26)
          if (!confStat.has(key)) confStat.set(key, { count: 0, topic })
          confStat.get(key).count++
        }
      }
    }
    return {
      dom: [...domStat.entries()].map(([k, v]) => ({ k, ...v, rate: v.total ? v.wrong / v.total : 0 }))
        .filter((x) => x.total > 0).sort((a, b) => b.wrong - a.wrong).slice(0, 8),
      topic: [...topicStat.entries()].map(([k, v]) => ({ k, ...v }))
        .filter((x) => x.wrong > 0).sort((a, b) => b.wrong - a.wrong).slice(0, 8),
      causes: CAUSE_ORDER.map((c) => ({ name: c, n: causeStat.get(c) ?? 0 })),
      unknownCause: [...causeStat.entries()].filter(([k]) => !CAUSE_ORDER.includes(k)),
      confs: [...confStat.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.count - a.count).slice(0, 10),
      wrongTotal, withCauseTag, withConf, attrNameByQ,
    }
  }, [records, questions, attributes])

  const maxDom = Math.max(1, ...data.dom.map((d) => d.wrong))
  const maxCause = Math.max(1, ...data.causes.map((c) => c.n))

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '6px 12px 90px' }}>
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ marginBottom: 8, letterSpacing: 2 }}>🔍 错因与干扰项画像</h3>
        <p style={{ fontSize: 12, opacity: .7, lineHeight: 1.7 }}>
          基于你的 <b>{data.wrongTotal}</b> 条错题记录生成。目标不是"错了多少"，而是"错在什么地方、
          因为什么错"——找出可复用的纠错动作。
        </p>
      </div>

      {/* ① 错题域分布 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h4 style={{ marginBottom: 10, fontSize: 14 }}>① 错题集中在哪些域</h4>
        {!data.dom.length && <p style={{ fontSize: 12.5, opacity: .7 }}>暂无错题记录。</p>}
        {data.dom.map((d) => (
          <div key={d.k} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
              <span><b>{d.k}</b></span>
              <span style={{ opacity: .75 }}>错 {d.wrong} / 共答 {d.total}（{(d.rate * 100).toFixed(0)}%）</span>
            </div>
            <div style={{ height: 7, borderRadius: 5, background: 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
              <div style={{ width: (d.wrong / maxDom * 100) + '%', height: '100%', background: 'linear-gradient(90deg,#FFB3C1,#E4708A)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* ② 错因分布 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h4 style={{ marginBottom: 4, fontSize: 14 }}>② 错因分布（六值标签聚合）</h4>
        <p style={{ fontSize: 11.5, opacity: .62, marginBottom: 10, lineHeight: 1.6 }}>
          口径：仅统计解析尾部带 <code>[错因:…]</code> 标签的题——当前 <b>{data.withCauseTag}</b> / {data.wrongTotal} 条错题可归类
          （其余为未标注解析的存量题，不参与本图）。
        </p>
        {data.causes.map((c) => (
          <div key={c.name} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
              <span>{c.name}</span><span style={{ opacity: .75 }}>{c.n} 次</span>
            </div>
            <div style={{ height: 7, borderRadius: 5, background: 'rgba(0,0,0,.07)', overflow: 'hidden' }}>
              <div style={{ width: (c.n / maxCause * 100) + '%', height: '100%', background: 'linear-gradient(90deg,#FFE066,#F2B705)' }} />
            </div>
          </div>
        ))}
        {!data.withCauseTag && (
          <p style={{ fontSize: 12, opacity: .7 }}>暂无可归类的错题——继续练习，新题解析带错因标签后本区自动填充。</p>
        )}
      </div>

      {/* ③ 高频混淆点 */}
      <div className="panel" style={{ padding: 16, marginBottom: 12 }}>
        <h4 style={{ marginBottom: 4, fontSize: 14 }}>③ 高频混淆点（你反复踩的坑）</h4>
        <p style={{ fontSize: 11.5, opacity: .62, marginBottom: 10, lineHeight: 1.6 }}>
          口径：<b>题目级</b>统计（该错题所涉及的混淆点集合），非"你选的那个选项的混淆点"——精确到选项需解析结构化，此处不夸大精度。
          当前 <b>{data.withConf}</b> 条错题含混淆点标注。
        </p>
        {!data.confs.length && <p style={{ fontSize: 12.5, opacity: .7 }}>暂无含「混淆点」标注的错题。</p>}
        {data.confs.map((c, i) => (
          <div key={c.k} style={{ borderTop: i ? '1px solid rgba(0,0,0,.06)' : 'none', padding: '7px 0', display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, opacity: .5, minWidth: 22 }}>{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{c.k}</div>
              <div style={{ fontSize: 11.5, opacity: .6, marginTop: 2 }}>{c.topic} · 出现 {c.count} 次</div>
            </div>
          </div>
        ))}
      </div>

      {/* ④ 错题主题 */}
      <div className="panel" style={{ padding: 16 }}>
        <h4 style={{ marginBottom: 10, fontSize: 14 }}>④ 错题最多的知识点</h4>
        {!data.topic.length && <p style={{ fontSize: 12.5, opacity: .7 }}>暂无错题。</p>}
        {data.topic.map((t, i) => (
          <div key={t.k} style={{ borderTop: i ? '1px solid rgba(0,0,0,.06)' : 'none', padding: '6px 0', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span style={{ flex: 1, paddingRight: 8 }}>{t.k}</span>
            <span style={{ opacity: .75, whiteSpace: 'nowrap' }}>错 {t.wrong} / 答 {t.total}</span>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button className="chip" onClick={() => nav('/dashboard')} style={{ fontSize: 13 }}>← 返回掌握度仪表盘</button>
      </div>
    </div>
  )
}

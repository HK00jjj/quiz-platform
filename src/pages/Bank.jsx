import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import { A, TYPE_SEAL_INDEX } from '../assets'
import { GiltBtn, EmptyState } from '../components'
import { TYPES, DIFFICULTIES, domainLabel, lastResultMap } from '../lib/stats'

const PAGE_SIZE = 50

/* 题库页 · 禁书库 */
export default function Bank() {
  const questions = useStore((s) => s.questions)
  const records = useStore((s) => s.records)
  const cards = useStore((s) => s.cards)
  const deleteQuestion = useStore((s) => s.deleteQuestion)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('全部')
  const [domain, setDomain] = useState('全部')
  const [difficulty, setDifficulty] = useState('全部')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const domains = useMemo(() => ['全部', ...[...new Set(questions.map((q) => q.knowledgeDomain).filter(Boolean))].sort()], [questions])
  const lastMap = useMemo(() => lastResultMap(records), [records])
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.questionId, c])), [cards])
  const importedAt = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('qp.importedAt.v1') || '{}') } catch { return {} }
  }, [])

  const filtered = useMemo(() => {
    const kw = search.trim()
    return questions.filter((q) =>
      (type === '全部' || q.type === type) &&
      (domain === '全部' || q.knowledgeDomain === domain) &&
      (difficulty === '全部' || q.difficulty === difficulty) &&
      (kw === '' || q.stem.includes(kw) || (q.knowledgePoint ?? '').includes(kw)))
      .slice()
      .sort((a, b) => (importedAt[b.id] ?? 0) - (importedAt[a.id] ?? 0))
  }, [questions, type, domain, difficulty, search, importedAt])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const view = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const detailRecords = detail ? records.filter((r) => r.questionId === detail.id).slice(-8).reverse() : []

  if (questions.length === 0) {
    return (
      <div className="page-wrap">
        <div className="panel">
          <EmptyState img={A.emptyTable} title="禁书库空空如也" hint="先去誊写厅誊写秘典，封印入库后此处方能陈列。" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap wide">
      <div className="page-head" style={{ backgroundImage: `url(${A.titleDecor})` }}>
        <h1 className="font-gothic"><span className="rune">🃏</span> 禁 书 库</h1>
        <p>封印的秘典在此陈列，窥视需谨慎</p>
      </div>

      <div className="bank-search">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="🔮 以水晶球搜寻题干 / 知识点…" />
      </div>

      <div className="deck-row">
        {[
          { label: '题型 · 切牌', val: type, opts: ['全部', ...TYPES], set: setType },
          { label: '知识域 · 切牌', val: domain, opts: domains, set: setDomain },
          { label: '难度 · 切牌', val: difficulty, opts: ['全部', ...DIFFICULTIES], set: setDifficulty }
        ].map((d) => (
          <select key={d.label} className="deck" value={d.val}
            onChange={(e) => { d.set(e.target.value); setPage(0) }}
            style={{ appearance: 'auto', color: 'var(--teal-lt)', background: 'rgba(21,29,36,.9)' }}
            aria-label={d.label}>
            {d.opts.map((o) => <option key={o} value={o}>{d.label.split(' ')[0]}：{o}</option>)}
          </select>
        ))}
      </div>

      <div className="bank-meta">
        <span>共 {questions.length} 卷秘典 · 筛选后 {filtered.length} 卷</span>
        <span>按誊写时间自新至旧陈列</span>
      </div>

      <div className="bank-list">
        {view.map((q, i) => {
          const last = lastMap.get(q.id)
          const mastered = (cardMap.get(q.id)?.intervalDays ?? 0) >= 3
          const touched = cardMap.has(q.id)
          return (
            <div key={q.id} className="bank-item row-in" style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              onClick={() => { setDetail(q); setConfirmDel(false) }}>
              <div className="state-col">
                <span className={'state-ring' + (mastered ? ' full' : touched ? ' half' : '') + (last === false ? ' polluted' : '')} />
              </div>
              <div className="body">
                <div className="mini-tags">
                  <img className="stamp" style={{ width: 26, height: 26 }} src={A.seals[TYPE_SEAL_INDEX[q.type] ?? 0]} alt={q.type} />
                  {q.knowledgeDomain && <span className="tag">{domainLabel(q.knowledgeDomain)}</span>}
                  {q.difficulty && <span className={'tag ' + (q.difficulty === '基础' ? 'teal' : q.difficulty === '综合' ? 'purple' : '')}>{q.difficulty}</span>}
                  {last === false && <span className="tag red">被污染</span>}
                </div>
                <p className="stem-prev">{q.stem}</p>
              </div>
              <span className="arrow">→</span>
            </div>
          )
        })}
      </div>

      {pages > 1 && (
        <div className="pager">
          <button className="chip" disabled={page === 0} onClick={() => setPage(page - 1)}>← 上一页</button>
          <span>第 {page + 1} / {pages} 页</span>
          <button className="chip" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>下一页 →</button>
        </div>
      )}

      {detail && (
        <div className="modal-veil" onClick={() => setDetail(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetail(null)} aria-label="关闭">✕</button>
            <div className="q-tags" style={{ marginBottom: 10 }}>
              <img className="stamp" src={A.seals[TYPE_SEAL_INDEX[detail.type] ?? 0]} alt={detail.type} />
              <span className="tag">{detail.type}</span>
              {detail.knowledgeDomain && <span className="tag teal">{domainLabel(detail.knowledgeDomain)}</span>}
              {detail.difficulty && <span className="tag">{detail.difficulty}</span>}
            </div>
            <p style={{ lineHeight: 2, color: '#d6c79b', fontSize: 15 }}>{detail.stem}</p>
            <div className="answer-scroll-box ok" style={{ marginTop: 14 }}>
              <h5>◆ 真理原文</h5>
              <p>{detail.answer}</p>
              {detail.explanation && <><p className="lab">【秘典解析】</p><p>{detail.explanation}</p></>}
            </div>
            {detailRecords.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12, letterSpacing: 2, color: 'var(--muted)', marginBottom: 6 }}>参悟记录（近 {detailRecords.length} 次）</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {detailRecords.map((r) => (
                    <span key={r.id} className={'tag ' + (r.correct ? 'teal' : 'red')}>{r.date} {r.correct ? '✓' : '✗'}</span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              {confirmDel ? (
                <>
                  <GiltBtn tone="danger" onClick={async () => { await deleteQuestion(detail.id); setDetail(null) }}>确认销毁此卷</GiltBtn>
                  <GiltBtn tone="ghost" onClick={() => setConfirmDel(false)}>收回成命</GiltBtn>
                </>
              ) : (
                <GiltBtn tone="danger" onClick={() => setConfirmDel(true)}>🗑 销毁此卷</GiltBtn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

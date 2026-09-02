import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import { A, TYPE_SEAL_INDEX } from '../assets'
import { EmptyState } from '../components'
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
  const [openId, setOpenId] = useState(null)      // 当前翻面的塔罗牌
  const [confirmId, setConfirmId] = useState(null) // 牌背上的销毁二次确认

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

      {/* 竖版塔罗牌墙：正面封印谜面，轻触 3D 翻面看此卷全部秘辛 */}
      <div className="bank-list">
        {view.map((q, i) => {
          const last = lastMap.get(q.id)
          const rc = cardMap.get(q.id)
          const mastered = (rc?.intervalDays ?? 0) >= 3
          const touched = cardMap.has(q.id)
          const open = openId === q.id
          const qRecords = open ? records.filter((r) => r.questionId === q.id).slice(-6).reverse() : []
          return (
            <div key={q.id} className={'bank-item row-in' + (open ? ' flipped' : '')}
              style={{ animationDelay: `${Math.min(i * 30, 360)}ms` }}
              onClick={() => { setOpenId(open ? null : q.id); setConfirmId(null) }}>
              <div className="tarot-inner">
                {/* 正面：题型印章 + 谜面 + 签条 */}
                <div className="tarot-face front">
                  <div className="face-in">
                    <img className="tarot-seal" src={A.seals[TYPE_SEAL_INDEX[q.type] ?? 0]} alt={q.type} title={q.type} loading="lazy" decoding="async" />
                    <p className="tarot-stem">{q.stem}</p>
                    <div className="tarot-tags">
                      <span className={'tarot-orb' + (mastered ? ' full' : touched ? ' half' : '') + (last === false ? ' polluted' : '')}
                        title={mastered ? '已掌握' : touched ? '复习中' : '未参悟'} />
                      {q.difficulty && A.gems[q.difficulty] && (
                        <img className="tarot-gem" src={A.gems[q.difficulty]} alt="" title={q.difficulty} loading="lazy" decoding="async" />)}
                      {q.knowledgeDomain && <span className="tag">{domainLabel(q.knowledgeDomain)}</span>}
                      {last === false && <span className="tag red">被污染</span>}
                    </div>
                    <span className="tarot-hint">✦ 轻触翻面 ✦</span>
                  </div>
                </div>

                {/* 背面：此卷全部信息 */}
                <div className="tarot-face back">
                  <div className="face-in">
                    <div className="tarot-scroll" onClick={(e) => e.stopPropagation()}>
                      <h6>◆ 卷宗全录</h6>
                      <div className="tarot-kv"><b>编号</b><span>第 {q.seq ?? '—'} 卷</span></div>
                      <div className="tarot-kv"><b>题型</b><span>{q.type}</span></div>
                      {q.knowledgeDomain && <div className="tarot-kv"><b>知识域</b><span>{domainLabel(q.knowledgeDomain)} · {q.knowledgeDomain}</span></div>}
                      {q.knowledgePoint && <div className="tarot-kv"><b>知识点</b><span>{q.knowledgePoint}</span></div>}
                      {q.difficulty && <div className="tarot-kv"><b>难度</b><span>{q.difficulty}</span></div>}
                      {q.cognitiveLevel && <div className="tarot-kv"><b>认知层</b><span>{q.cognitiveLevel}</span></div>}
                      <div className="tarot-kv"><b>灵知</b><span>{mastered ? `已掌握 · 间隔 ${rc?.intervalDays ?? 0} 日` : touched ? `复习中 · 间隔 ${rc?.intervalDays ?? 0} 日` : '尚未参悟'}</span></div>
                      <h6>◆ 符文谜面</h6>
                      <p>{q.stem}</p>
                      {(q.options ?? []).map((o, k) => <p key={k} className="tarot-opt">{o}</p>)}
                      <h6>◆ 真理原文</h6>
                      <p className="tarot-ans">{q.answer}</p>
                      {q.explanation && <><h6>◆ 秘典解析</h6><p>{q.explanation}</p></>}
                      {qRecords.length > 0 && (
                        <>
                          <h6>◆ 参悟记录（近 {qRecords.length} 次）</h6>
                          <div className="tarot-recs">
                            {qRecords.map((r) => (
                              <span key={r.id} className={'tag ' + (r.correct ? 'teal' : 'red')}>{r.date} {r.correct ? '✓' : '✗'}</span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="tarot-foot" onClick={(e) => e.stopPropagation()}>
                      {confirmId === q.id ? (
                        <>
                          <button className="danger" onClick={async () => {
                            try { await deleteQuestion(q.id) } catch { /* demo 模式无云端 */ }
                            setOpenId(null); setConfirmId(null)
                          }}>确认销毁</button>
                          <button onClick={() => setConfirmId(null)}>收回成命</button>
                        </>
                      ) : (
                        <>
                          <button className="danger" onClick={() => setConfirmId(q.id)}>🗑 销毁此卷</button>
                          <button onClick={() => setOpenId(null)}>合上牌面</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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

    </div>
  )
}

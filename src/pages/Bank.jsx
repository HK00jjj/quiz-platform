import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import { A } from '../assets'
import { EmptyState } from '../components'
import { TYPES, DIFFICULTIES, DIFF_CLS, domainLabel, lastResultMap } from '../lib/stats'

const PAGE_SIZE = 50

/* 题库页 · 糖果书架 */
export default function Bank() {
  const questions = useStore((s) => s.questions)
  const records = useStore((s) => s.records)
  const cards = useStore((s) => s.cards)
  const deleteQuestion = useStore((s) => s.deleteQuestion)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('全部')
  const [domain, setDomain] = useState('全部')
  const [difficulty, setDifficulty] = useState('全部')
  /* 排序：'new' 最近导入（原行为）/ 'seq' 入库序（命题批次先后）/ 'weak' 最该复习的排前面 */
  const [sort, setSort] = useState('new')
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState(null)      // 当前翻开的卡片
  const [confirmId, setConfirmId] = useState(null) // 卡片背面的删除二次确认

  const domains = useMemo(() => ['全部', ...[...new Set(questions.map((q) => q.knowledgeDomain).filter(Boolean))].sort()], [questions])
  const lastMap = useMemo(() => lastResultMap(records), [records])
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.questionId, c])), [cards])
  const importedAt = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('qp.importedAt.v1') || '{}') } catch { return {} }
  }, [])

  /* 概览：掌握度口径与卡片上的 .tarot-orb 完全一致（有卡且间隔≥3天=已掌握、
     有卡但<3天=复习中、无卡=没做过），免得同一页出现两套掌握度定义。
     答错过 = 最近一次作答为错，与「错题重练」的口径同源（lastResultMap）。 */
  const overview = useMemo(() => {
    let mastered = 0, learning = 0, fresh = 0, wrong = 0
    for (const q of questions) {
      const rc = cardMap.get(q.id)
      if (!rc) fresh++
      else if ((rc.intervalDays ?? 0) >= 3) mastered++
      else learning++
      if (lastMap.get(q.id) === false) wrong++
    }
    return { mastered, learning, fresh, wrong }
  }, [questions, cardMap, lastMap])

  const filtered = useMemo(() => {
    const kw = search.trim()
    const list = questions.filter((q) =>
      (type === '全部' || q.type === type) &&
      (domain === '全部' || q.knowledgeDomain === domain) &&
      (difficulty === '全部' || q.difficulty === difficulty) &&
      (kw === '' || q.stem.includes(kw) || (q.knowledgePoint ?? '').includes(kw)))
    /* 三种排序都拿「最近导入」当次级键： seq 跳批次时可能并列（存量数据未迁移，见 §21），
       不给次级键的话并列项的先后就不确定了。filter 已返回新数组，就地 sort 不会改 store。 */
    const byNew = (a, b) => (importedAt[b.id] ?? 0) - (importedAt[a.id] ?? 0)
    if (sort === 'seq') return list.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0) || byNew(a, b))
    if (sort === 'weak') {
      const rank = (q) => { const rc = cardMap.get(q.id); return !rc ? 0 : (rc.intervalDays ?? 0) >= 3 ? 2 : 1 }
      return list.sort((a, b) => rank(a) - rank(b) || byNew(a, b))
    }
    return list.sort(byNew)
  }, [questions, type, domain, difficulty, search, importedAt, sort, cardMap])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const view = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (questions.length === 0) {
    return (
      <div className="page-wrap">
        <div className="panel">
          <EmptyState img={A.emptyTable} title="糖果书架空空如也" hint="去导入页把题库导进来，这里就会陈列出来。" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap wide">
      {/* 原来这里有 style={{ backgroundImage: `url(${A.titleDecor})` }}，但 candy.css L331 的
          .page-head { background-image: none !important } 一直把它压掉——p45.png 因此
          「被引用却从不显示」，白占 dist 体积，而引用式审计（查 assets.js 里有没有 A.titleDecor）
          抓不到这类死素材。删掉内联样式后，titleDecor 键与 p45.png 一并清掉。 */}
      <div className="page-head">
        <h1><span className="rune">🍬</span> 糖 果 书 架</h1>
        <p>导入的题目都收在这里，点开卡片看详情</p>
      </div>

      <div className="bank-search">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="🔍 搜题干或知识点…" />
      </div>

      {/* 筛选区重做。原来是三个浏览器原生 <select> 套在哥特青铜框 .deck 里
          （pages.css L382：border 1px solid rgba(139,115,50,.5)、.deck .val 用 --teal-lt），
          是这页「简陋」的主要来源。现在：
          ① 题型 / 难度 / 排序 → 糖果胶囊 chip，直接复用 FilterModal 同一套 .chip-row/.chip/.chip.on，不新造组件
          ② 知识域 27 项做成 chips 会撑爆版面，所以保留下拉、但换成糖果化的 .deck-candy
             （appearance:none + 自绘 ▾，因为原生箭头在浅色底上几乎看不见） */}
      <div className="bank-filters">
        <div className="bank-fgroup">
          <h5>题型</h5>
          <div className="chip-row">
            {['全部', ...TYPES].map((t) => (
              <button key={t} className={'chip' + (type === t ? ' on' : '')}
                onClick={() => { setType(t); setPage(0) }}>{t.replace(/题$/, '')}</button>
            ))}
          </div>
        </div>
        <div className="bank-fgroup">
          <h5>难度</h5>
          <div className="chip-row">
            {['全部', ...DIFFICULTIES].map((d) => (
              <button key={d} className={'chip' + (difficulty === d ? ' on' : '')}
                onClick={() => { setDifficulty(d); setPage(0) }}>{d}</button>
            ))}
          </div>
        </div>
        <div className="bank-fgroup">
          <h5>排序</h5>
          <div className="chip-row">
            {[['new', '最近导入'], ['seq', '入库序'], ['weak', '最该复习']].map(([k, lab]) => (
              <button key={k} className={'chip' + (sort === k ? ' on' : '')}
                onClick={() => { setSort(k); setPage(0) }}>{lab}</button>
            ))}
          </div>
        </div>
        <div className="bank-fgroup">
          <h5>知识域</h5>
          {/* value 仍是 K1~K27（筛选逻辑认它），显示走 domainLabel 换成中文域名（#8） */}
          <select className="deck-candy" value={domain} aria-label="知识域"
            onChange={(e) => { setDomain(e.target.value); setPage(0) }}>
            {domains.map((d) => <option key={d} value={d}>{d === '全部' ? '全部知识域' : domainLabel(d)}</option>)}
          </select>
        </div>
      </div>

      {/* 概览条：五个数，颜色与卡片上 .tarot-orb 的三态同源（薄荷=已掌握、柠檬=复习中、
          薰衣草=没做过、草莓=答错过），整页不引入新色相 */}
      <div className="bank-overview">
        <span className="ov-cell"><b>{questions.length}</b>总题数</span>
        <span className="ov-cell ov-ok"><b>{overview.mastered}</b>已掌握</span>
        <span className="ov-cell ov-mid"><b>{overview.learning}</b>复习中</span>
        <span className="ov-cell ov-new"><b>{overview.fresh}</b>没做过</span>
        <span className="ov-cell ov-bad"><b>{overview.wrong}</b>答错过</span>
      </div>

      <div className="bank-meta">
        <span>共 {questions.length} 题 · 筛选后 {filtered.length} 题</span>
        <span>{{ new: '按导入时间从新到旧', seq: '按入库序（命题批次先后）', weak: '没做过 → 复习中 → 已掌握' }[sort]}</span>
      </div>

      {/* 竖版卡片墙：正面是题干摘要，点开 3D 翻面看这道题的全部信息 */}
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
                {/* 正面：题干摘要 + 签条行。
                    哥特题型印章位图 A.seals 去掉了——p34-1~7 七个文件内容完全相同，
                    本来就区分不出题型，只是每页白发几十个图片请求；改成文字胶囊放进签条行。 */}
                <div className="tarot-face front">
                  <div className="face-in">
                    <p className="tarot-stem">{q.stem}</p>
                    <div className="tarot-tags">
                      <span className={'tarot-orb' + (mastered ? ' full' : touched ? ' half' : '') + (last === false ? ' polluted' : '')}
                        title={mastered ? '已掌握' : touched ? '复习中' : '还没做'} />
                      <span className="type-candy">{(q.type || '').replace(/题$/, '')}</span>
                      {/* 难度：哥特宝石位图 A.gems 换成糖果胶囊（#3），配色与答题页同一套 */}
                      {q.difficulty && (
                        <span className={'diff-pill tiny d-' + (DIFF_CLS[q.difficulty] ?? 'base')}>{q.difficulty}</span>)}
                      {q.knowledgeDomain && <span className="tag">{domainLabel(q.knowledgeDomain)}</span>}
                      {last === false && <span className="tag red">答错过</span>}
                    </div>
                    <span className="tarot-hint">轻点看详情</span>
                  </div>
                </div>

                {/* 背面：这道题的全部信息 */}
                <div className="tarot-face back">
                  <div className="face-in">
                    <div className="tarot-scroll" onClick={(e) => e.stopPropagation()}>
                      <h6>题目信息</h6>
                      {/* q.seq 已不是命题协议里的批内序号(1~21)，而是入库时改写的全局单调序
                          （见 validate.js 的 assignGlobalSeq），所以标签从「编号」改成「入库序」，
                          否则第三批的第1题会显示成「第43题」而让人以为数据乱了。 */}
                      <div className="tarot-kv"><b>入库序</b><span>第 {q.seq ?? '—'} 题</span></div>
                      <div className="tarot-kv"><b>题型</b><span>{q.type}</span></div>
                      {q.knowledgeDomain && <div className="tarot-kv"><b>知识域</b><span>{domainLabel(q.knowledgeDomain)} · {q.knowledgeDomain}</span></div>}
                      {q.knowledgePoint && <div className="tarot-kv"><b>知识点</b><span>{q.knowledgePoint}</span></div>}
                      {q.difficulty && <div className="tarot-kv"><b>难度</b><span>{q.difficulty}</span></div>}
                      {q.cognitiveLevel && <div className="tarot-kv"><b>认知层</b><span>{q.cognitiveLevel}</span></div>}
                      <div className="tarot-kv"><b>掌握度</b><span>{mastered ? `已掌握 · 间隔 ${rc?.intervalDays ?? 0} 天` : touched ? `复习中 · 间隔 ${rc?.intervalDays ?? 0} 天` : '还没做过'}</span></div>
                      <h6>题干</h6>
                      <p>{q.stem}</p>
                      {(q.options ?? []).map((o, k) => <p key={k} className="tarot-opt">{o}</p>)}
                      <h6>答案</h6>
                      <p className="tarot-ans">{q.answer}</p>
                      {q.explanation && <><h6>解析</h6><p>{q.explanation}</p></>}
                      {qRecords.length > 0 && (
                        <>
                          <h6>做题记录（最近 {qRecords.length} 次）</h6>
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
                          }}>确认删除</button>
                          <button onClick={() => setConfirmId(null)}>取消</button>
                        </>
                      ) : (
                        <>
                          <button className="danger" onClick={() => setConfirmId(q.id)}>🗑 删除</button>
                          <button onClick={() => setOpenId(null)}>收起</button>
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

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { A } from '../assets'
import { GiltBtn, EmptyState, burstParticles, FlameIcon } from '../components'
import { buildSession, lastResultMap, TYPES, DIFFICULTIES } from '../lib/stats'
import { isDue } from '../lib/fsrs'
import { todayStr, streakLength } from '../lib/dates'

const DOMAINS_ALL = Array.from({ length: 27 }, (_, i) => `K${i + 1}`)

function FilterModal({ title, filters, onToggle, onClose, onStart, count, startLabel }) {
  const [dim, setDim] = useState('types')
  const dims = [
    { key: 'types', label: '题型', options: TYPES },
    { key: 'domains', label: '知识域', options: DOMAINS_ALL },
    { key: 'difficulties', label: '难度', options: DIFFICULTIES }
  ]
  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="收起">✕</button>
        <h3 style={{ letterSpacing: 4, color: 'var(--gold-text)', marginBottom: 14, fontSize: 18 }}>{title}</h3>
        <div className="ach-tabs">
          {dims.map((d) => (
            <button key={d.key} className={'chip' + (dim === d.key ? ' on' : '')} onClick={() => setDim(d.key)}>
              {d.label}{filters[d.key]?.length ? ` · ${filters[d.key].length}` : ''}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <div className="chip-row">
            {dims.find((d) => d.key === dim).options.map((o) => (
              <button key={o} className={'chip' + (filters[dim]?.includes(o) ? ' on' : '')} onClick={() => onToggle(dim, o)}>{o}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <GiltBtn size="lg" onClick={onStart} disabled={count === 0}>
            {startLabel}（{count} 题）
          </GiltBtn>
          <GiltBtn tone="ghost" onClick={onClose}>返回阅览厅</GiltBtn>
        </div>
      </div>
    </div>
  )
}

/* 学习页 · 穹顶阅览厅 */
export default function Learn() {
  const navigate = useNavigate()
  const questions = useStore((s) => s.questions)
  const cards = useStore((s) => s.cards)
  const records = useStore((s) => s.records)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const startSession = useStore((s) => s.startSession)
  const [openFilter, setOpenFilter] = useState(null) // 'relearn' | 'learn'

  const now = Date.now()
  const today = todayStr()
  const dates = useMemo(() => [...new Set(records.map((r) => r.date))], [records])
  const streak = streakLength(dates, today)
  const doneToday = records.filter((r) => r.date === today).length
  const dueCount = cards.filter((c) => isDue(c, now)).length
  const newCount = questions.length - cards.length
  const lastMap = useMemo(() => lastResultMap(records), [records])
  const wrongCount = questions.filter((q) => lastMap.get(q.id) === false).length

  const relearnFilters = settings.relearnFilters ?? {}
  const learnFilters = settings.learnFilters ?? {}
  const relearnCount = useMemo(
    () => buildSession(questions, cards, records, { mode: 'relearn', size: 1e5, now, ...relearnFilters }).length,
    [questions, cards, records, now, relearnFilters])
  const randomCount = Math.min(20, questions.length)

  async function run(mode, opts = {}) {
    const n = await startSession(mode, opts)
    if (n > 0) navigate('/practice')
  }
  // 「开始今日练习」优先链：到期复习 → 错题 → 新题 → 随机（按交接要求保留）
  const hero = dueCount > 0
    ? { sub: `${dueCount} 道题到期等待复习`, run: () => run('review', { size: 20 }) }
    : wrongCount > 0
      ? { sub: `${wrongCount} 题酸了符文待净化`, run: () => run('wrong', { size: 20 }) }
      : newCount > 0
        ? { sub: `${newCount} 题新题库待翻阅`, run: () => run('learn') }
        : { sub: '今天也来保持甜蜜值手感', run: () => run('random') }

  function toggleFilter(scope, dim, value) {
    const key = scope === 'relearn' ? 'relearnFilters' : 'learnFilters'
    const cur = { ...(scope === 'relearn' ? relearnFilters : learnFilters) }
    const list = cur[dim] ?? []
    cur[dim] = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    updateSettings({ [key]: cur })
  }

  if (questions.length === 0) {
    return (
      <div className="page-wrap">
        <div className="panel">
          <EmptyState
            img={A.emptyShelf}
            title="题库还是空的"
            hint="把外部 AI 生成的题目 JSON 导入到导入页，就可以开始做题、间隔复习与错题重练。"
            action={<GiltBtn size="lg" onClick={() => navigate('/import')}>🍬 去导入</GiltBtn>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <div className="learn-banner">
        <div className="brand gold-title font-gothic">✦ 糖果题库 ✦</div>
        {doneToday > 0 ? (
          <span className="tag teal" style={{ fontSize: 13, padding: '6px 14px' }}>
            ✦ 今日已做题，甜蜜值延续中 <FlameIcon />
          </span>
        ) : (
          <GiltBtn size="sm" onClick={(e) => {
            burstParticles(e.clientX, e.clientY, 'gold', 14)
            hero.run()
          }}>🔄 延续甜蜜值</GiltBtn>
        )}
      </div>

      {/* 糖果橱窗横幅（取代哥特巫师位图 A.hallVision）：纯 CSS，零位图零请求。
          三颗糖豆 + 一支旋转棒棒糖做氛围，幅度极小，不抢标题注意力 */}
      <div className="learn-vision candy-hero rise">
        <span className="ch-candy c1" aria-hidden="true" />
        <span className="ch-candy c2" aria-hidden="true" />
        <span className="ch-candy c3" aria-hidden="true" />
        <span className="ch-lolli" aria-hidden="true" />
        <span className="cap">糖果橱窗 · 选一个今天的口味</span>
      </div>

      <div className="panel deep" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }} aria-hidden="true">
          <span className="tag teal">🍬</span>
          <span className="tag">今 日 复 习</span>
          <span className="tag teal">🍭</span>
        </div>
        <GiltBtn size="lg" className="block" style={{ maxWidth: 420, margin: '0 auto' }} onClick={hero.run}>
          📖 开始今日练习
        </GiltBtn>
        <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)', letterSpacing: 1 }}>{hero.sub}</p>
        {streak > 0 && (
          <p style={{ marginTop: 6, fontSize: 12, color: 'var(--gold-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <FlameIcon /> 已连续学习 {streak} 天
          </p>
        )}
      </div>

      <div className="entry-grid">
        <div className={'entry-card rise' + (wrongCount > 0 ? ' hot' : '')} style={{ animationDelay: '.08s' }}
          onClick={() => wrongCount > 0 && run('wrong', { size: 0 })}>
          <span className="count-gem">{wrongCount}</span>
          <div className="art"><img src={A.sealedDeck} alt="封印牌叠" /></div>
          <h3>污染重阅</h3>
          <p>被酸糖低语侵蚀的符文，等待重新解读净化</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.16s' }} onClick={() => run('random', { size: 20 })}>
          <span className="count-gem">{randomCount}</span>
          <div className="art"><img src={A.cardPile} alt="塔罗牌堆" /></div>
          <h3>随机翻阅</h3>
          <p>全库无放回抽取 20 卷 · 模拟考试手感 · 共 {questions.length} 题</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.24s' }} onClick={() => newCount > 0 && run('learn')}>
          <span className="count-gem">{newCount}</span>
          <div className="art"><img src={A.magicBook} alt="魔法书" /></div>
          <h3>学习新篇</h3>
          <p>{newCount} 题未做题 · 首次解读建立甜蜜值印记</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.32s' }} onClick={() => setOpenFilter('relearn')}>
          <span className="count-gem">{relearnCount}</span>
          <div className="art"><img src={A.cardTower} alt="卡牌螺旋塔" /></div>
          <h3>全部题库</h3>
          <p>可按题型 / 知识域 / 难度切牌筛选后学习</p>
        </div>
      </div>

      <button className="fab-stats" onClick={() => navigate('/stats')} aria-label="星象观测">
        📊<small>星象</small>
      </button>

      {openFilter === 'relearn' && (
        <FilterModal
          title="🃏 全部题库 · 切牌筛选"
          filters={relearnFilters}
          onToggle={(dim, v) => toggleFilter('relearn', dim, v)}
          onClose={() => setOpenFilter(null)}
          count={relearnCount}
          startLabel="开始解读"
          onStart={() => { setOpenFilter(null); run('relearn', { size: 0, ...relearnFilters }) }}
        />
      )}
    </div>
  )
}

import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { A } from '../assets'
import { GiltBtn, EmptyState, burstParticles, FlameIcon } from '../components'
import { buildSession, lastResultMap, TYPES, DIFFICULTIES, domainLabel } from '../lib/stats'
import { isDue } from '../lib/fsrs'
import { todayStr, streakLength } from '../lib/dates'

const DOMAINS_ALL = Array.from({ length: 27 }, (_, i) => `K${i + 1}`)

function FilterModal({ title, filters, onToggle, onClose, onStart, count, startLabel }) {
  const [dim, setDim] = useState('types')
  const dims = [
    { key: 'types', label: '题型', options: TYPES },
    { key: 'domains', label: '知识域', options: DOMAINS_ALL, text: domainLabel },
    { key: 'difficulties', label: '难度', options: DIFFICULTIES }
  ]
  /* 知识域 chip 的值仍是 K1~K27（筛选逻辑与 settings 里存的过滤器都认它），
     但显示走 text 换成中文域名——光看 K17 谁也不知道是什么（#8）。 */
  const cur = dims.find((d) => d.key === dim)
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
            {cur.options.map((o) => (
              <button key={o} className={'chip' + (filters[dim]?.includes(o) ? ' on' : '')} onClick={() => onToggle(dim, o)}>
                {cur.text ? cur.text(o) : o}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <GiltBtn size="lg" onClick={onStart} disabled={count === 0}>
            {startLabel}（{count} 题）
          </GiltBtn>
          <GiltBtn tone="ghost" onClick={onClose}>返回</GiltBtn>
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
    ? { sub: `${dueCount} 道题到期，该复习了`, run: () => run('review', { size: 20 }) }
    : wrongCount > 0
      ? { sub: `${wrongCount} 道错题等着重练`, run: () => run('wrong', { size: 20 }) }
      : newCount > 0
        ? { sub: `${newCount} 道新题还没做过`, run: () => run('learn') }
        : { sub: '今天也来练几道，保持手感', run: () => run('random') }

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
        {/* 四段文案改成糖果主题的直白说法（#2）：原来的「污染重阅 / 被酸糖低语侵蚀的符文 /
            无放回抽取 20 卷 / 切牌筛选」是哥特卡牌词汇，看不出到底在干什么。
            .art 空 div 一并删掉——哥特插图早没了，留着只白占 150px 高度。 */}
        <div className={'entry-card rise' + (wrongCount > 0 ? ' hot' : '')} style={{ animationDelay: '.08s' }}
          onClick={() => wrongCount > 0 && run('wrong', { size: 0 })}>
          <span className="count-gem">{wrongCount}</span>
          <h3>错题重练</h3>
          <p>{wrongCount > 0 ? `答错过的 ${wrongCount} 道 · 再练一遍就记牢了` : '暂时没有错题，保持住'}</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.16s' }} onClick={() => run('random', { size: 20 })}>
          <span className="count-gem">{randomCount}</span>
          <h3>随机练习</h3>
          <p>从全部 {questions.length} 题里随机抽 {randomCount} 道 · 练考场手感</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.24s' }} onClick={() => newCount > 0 && run('learn')}>
          <span className="count-gem">{newCount}</span>
          <h3>新题上手</h3>
          <p>{newCount > 0 ? `${newCount} 道还没做过 · 做完自动排进复习计划` : '全部题目都做过了'}</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.32s' }} onClick={() => setOpenFilter('relearn')}>
          <span className="count-gem">{relearnCount}</span>
          <h3>挑题练习</h3>
          <p>按题型、知识域、难度筛出想练的题 · 共 {relearnCount} 道</p>
        </div>
      </div>

      {/* 星象悬浮入口已删：📊「星象观测」属于哥特世界观，与糖果主题不符。
          /stats 路由保留，仍可直接访问 #/stats；以后想要统计页就重新给一个糖果入口 */}

      {openFilter === 'relearn' && (
        <FilterModal
          title="🍬 挑题练习 · 按条件筛选"
          filters={relearnFilters}
          onToggle={(dim, v) => toggleFilter('relearn', dim, v)}
          onClose={() => setOpenFilter(null)}
          count={relearnCount}
          startLabel="开始练习"
          onStart={() => { setOpenFilter(null); run('relearn', { size: 0, ...relearnFilters }) }}
        />
      )}
    </div>
  )
}

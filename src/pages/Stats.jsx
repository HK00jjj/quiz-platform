import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import { A } from '../assets'
import { GiltBtn, EmptyState, FlameIcon } from '../components'
import {
  accuracyOf, uniqueDays, levelOf, levelProgress, titleFor, nextTitleFor,
  achievementsOf, RARITY_META, dailyCounts, weekBars, byType, domainMastery,
  domainLabel, TYPES
} from '../lib/stats'
import { todayStr, streakLength, streakSet, fmtDate, daysAgoStr } from '../lib/dates'

/* 环形进度 */
function Ring({ pct, label, value }) {
  const R = 44, C = 2 * Math.PI * R
  return (
    <div className="ring-wrap">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(139,115,50,.4)" strokeWidth="7" />
        <circle cx="55" cy="55" r={R} fill="none" stroke="#5aa89c" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(pct, 1))}
          style={{ filter: 'drop-shadow(0 0 5px rgba(90,168,156,.7))', transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="ring-txt">{value}<small>{label}</small></div>
    </div>
  )
}

export default function Stats() {
  const questions = useStore((s) => s.questions)
  const cards = useStore((s) => s.cards)
  const records = useStore((s) => s.records)
  const settings = useStore((s) => s.settings)
  const [monthOffset, setMonthOffset] = useState(0)
  const [achTab, setAchTab] = useState('全部')
  const [achDetail, setAchDetail] = useState(null)

  const today = todayStr()
  const dates = useMemo(() => [...new Set(records.map((r) => r.date))], [records])
  const streak = streakLength(dates, today)
  const sSet = useMemo(() => streakSet(dates, today), [dates, today])
  const total = records.length
  const accuracy = accuracyOf(records)
  const days = uniqueDays(records)
  const mastered = cards.filter((c) => (c.intervalDays ?? 0) >= 3).length
  const level = levelOf(total)
  const lp = levelProgress(total)
  const nextTitle = nextTitleFor(total)
  const doneToday = records.filter((r) => r.date === today).length
  const goal = settings.dailyGoal ?? 20
  const achievements = useMemo(() => achievementsOf({ streak, total, days, accuracy }), [streak, total, days, accuracy])
  const fameTotal = achievements.reduce((s, a) => s + a.points, 0)
  const fameGot = achievements.filter((a) => a.done).reduce((s, a) => s + a.points, 0)
  const bars = useMemo(() => weekBars(records, today), [records, today])
  const typeStats = useMemo(() => byType(records, questions), [records, questions])
  const domMastery = useMemo(() => domainMastery(questions, cards), [questions, cards])
  const dayCounts = useMemo(() => dailyCounts(records), [records])

  /* 日历 */
  const calBase = new Date()
  calBase.setMonth(calBase.getMonth() - monthOffset, 1)
  const y = calBase.getFullYear(), m = calBase.getMonth()
  const firstWeekday = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const milestones = [7, 30, 100, 365]

  const shownAch = achTab === '全部' ? achievements : achievements.filter((a) => a.cat === achTab)

  return (
    <div className="page-wrap wide">
      <div className="page-head" style={{ backgroundImage: `url(${A.titleDecor})` }}>
        <h1 className="font-gothic"><span className="rune">📊</span> 星 界 观 测 台</h1>
        <p>窥秘人的成长档案 · 深渊见证每一次参悟</p>
      </div>

      {/* ── 身份塔罗牌 ── */}
      <div className="id-card">
        <div className="frame" style={{ backgroundImage: `url(${A.idCardFrame})` }} />
        <div className="inner">
          <div className="id-top">
            <div className="portrait">
              <img className="avatar" src={A.avatar} alt="窥秘人画像" />
              <img className="frame-r" src={A.portraitFrame} alt="" />
            </div>
            <div className="id-info">
              <div className="id-title gold-title font-gothic">{titleFor(total)} · 序列{level}</div>
              <div className="id-seq">奥术典籍馆 · 在籍窥秘人</div>
              <div className="id-crystal">
                <div className="cap"><span>灵知 <b>{lp.into}</b> / {lp.span}</span><span>{Math.round(lp.into / lp.span * 100)}%</span></div>
                <div className="crystal-track"><div className="crystal-fill" style={{ width: `${lp.into / lp.span * 100}%` }} /></div>
                {nextTitle
                  ? <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>距「{nextTitle.title}」还需 {nextTitle.at - total} 次秘典翻阅</p>
                  : <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>已抵达穹顶之巅</p>}
              </div>
              <p className="id-mini">
                累计翻阅 <b>{total}</b> 次 ◆ 已掌握 <b>{mastered}</b> 卷 ◆ 秘典 <b>{questions.length}</b> 卷
              </p>
            </div>
          </div>
          <div className="badge-pair">
            <div className="oath-badge">
              <div className="bframe" style={{ backgroundImage: `url(${A.badgeFrame})` }} />
              <span style={{ fontSize: 22, marginTop: 2 }}><FlameIcon /></span>
              <span className="big teal-glow-text">{streak}</span>
              <span className="lab">天 稳 定</span>
              <span className={'foot ' + (doneToday > 0 ? 'gold-glow-text' : '')}>
                {doneToday > 0 ? '✓ 今日已参悟' : '✗ 今日未参悟'}
              </span>
            </div>
            <div className="oath-badge">
              <div className="bframe" style={{ backgroundImage: `url(${A.badgeFrame})` }} />
              <span style={{ fontSize: 18 }} aria-hidden="true">📖</span>
              <Ring pct={doneToday / goal} label="今日目标" value={`${doneToday}/${goal}`} />
              <span className={'foot ' + (doneToday >= goal ? 'gold-glow-text' : '')}>
                {doneToday >= goal ? '✦ 今日目标已达成' : `还需 ${Math.max(0, goal - doneToday)} 道`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 星象命运之盘 ── */}
      <div className="stat-section">
        <h3>🔮 星象命运之盘</h3>
        <div className="panel deep">
          <div className="astrolabe-wrap">
            <img className="base" src={A.astrolabe} alt="" />
            <div className="astrolabe-center">
              <span className="pct">{accuracy === null ? '—' : Math.round(accuracy * 100) + '%'}</span>
              <small>灵知契合度</small>
            </div>
          </div>
          <div className="domain-bars">
            {[...domMastery.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([dom, v]) => (
              <div className="dom-row" key={dom}>
                <span>{domainLabel(dom)}</span>
                <div className="crystal-track" style={{ height: 10 }}>
                  <div className={'crystal-fill ' + (v >= 0.6 ? '' : v >= 0.4 ? 'gold' : 'red')} style={{ width: `${v * 100}%` }} />
                </div>
                <span style={{ color: v >= 0.6 ? 'var(--teal-lt)' : v >= 0.4 ? 'var(--gold-text)' : '#d98ba0' }}>{Math.round(v * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 奥术修习日历 ── */}
      <div className="stat-section">
        <h3>📅 奥术修习日历</h3>
        <div className="cal-book">
          <div className="cal-head">
            <button className="cal-nav" onClick={() => setMonthOffset(monthOffset + 1)} aria-label="上月">←</button>
            <h4 className="font-gothic">奥术历 · {y}年{m + 1}月</h4>
            <button className="cal-nav" onClick={() => setMonthOffset(Math.max(0, monthOffset - 1))} disabled={monthOffset === 0} aria-label="下月">→</button>
          </div>
          <div className="cal-grid">
            {'日一二三四五六'.split('').map((w) => <span key={w} className="wk">{w}</span>)}
            {Array.from({ length: firstWeekday }).map((_, i) => <span key={'e' + i} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const ds = fmtDate(new Date(y, m, i + 1))
              const cnt = dayCounts.get(ds) ?? 0
              const cls = ['cal-cell',
                cnt > 0 && 'practiced', sSet.has(ds) && 'streak-d', ds === today && 'today'].filter(Boolean).join(' ')
              return (
                <div key={ds} className={cls} title={cnt > 0 ? `${ds} · 作答 ${cnt} 题` : ds}>
                  <span>{i + 1}</span>
                  {cnt > 0 && <span className="cnt">{cnt}题</span>}
                  {sSet.has(ds) && <span className="star">✦</span>}
                </div>
              )
            })}
          </div>
          <div className="cal-legend">
            <span>✦ 稳定日</span><span>▣ 暗金 练习日</span><span>▢ 暗铜 未练习</span><span>◈ 金框 今晨</span>
          </div>
        </div>
      </div>

      {/* ── 周参悟量 ── */}
      <div className="stat-section">
        <h3>🕯 周参悟量 · 近7天</h3>
        <div className="panel deep">
          <div className="week-bars">
            {bars.map((b) => {
              const n = b.newCount + b.reviewCount
              const h = Math.min(120, n * 10)
              return (
                <div key={b.date} className={'wbar' + (b.reviewCount >= b.newCount ? ' review' : '')}>
                  <span className="num">{n || ''}</span>
                  <div className="col" style={{ height: Math.max(3, h) }} />
                  <span className="dl">{b.date.slice(5).replace('-', '/')}</span>
                </div>
              )
            })}
          </div>
          <div className="cal-legend" style={{ justifyContent: 'center', color: 'var(--muted)' }}>
            <span style={{ color: 'var(--teal-lt)' }}>▮ 新学为主</span>
            <span style={{ color: 'var(--gold-text)' }}>▮ 复习为主</span>
          </div>
        </div>
      </div>

      {/* ── 分题型契合度 ── */}
      <div className="stat-section">
        <h3>🃏 分题型契合度</h3>
        <div className="panel deep">
          <div className="type-bars">
            {TYPES.map((t) => {
              const o = typeStats.get(t)
              const pct = o && o.total > 0 ? o.correct / o.total : null
              return (
                <div className="type-row" key={t}>
                  <span>{t.replace('综合设计/故障诊断题', '综合设计')}</span>
                  <div className="crystal-track" style={{ height: 11 }}>
                    {pct !== null && (
                      <div className={'crystal-fill ' + (pct >= 0.6 ? '' : pct >= 0.4 ? 'gold' : 'red')} style={{ width: `${pct * 100}%` }} />
                    )}
                  </div>
                  <span style={{ color: pct === null ? 'var(--muted)' : pct >= 0.6 ? 'var(--teal-lt)' : pct >= 0.4 ? 'var(--gold-text)' : '#d98ba0' }}>
                    {pct === null ? '—' : Math.round(pct * 100) + '%'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 符印之路 ── */}
      <div className="stat-section">
        <h3>🪬 符印之路</h3>
        <div className="panel deep">
          <div className="sigil-path">
            {milestones.map((ms, i) => {
              const state = streak >= ms ? 'done' : (i === 0 || streak >= milestones[i - 1]) && streak < ms ? 'active' : 'locked'
              const img = state === 'done' ? A.milestone.done : state === 'active' ? A.milestone.active : A.milestone.locked
              return (
                <React.Fragment key={ms}>
                  {i > 0 && <div className={'sigil-line' + (streak >= ms ? ' on' : '')} />}
                  <div className="sigil-node">
                    <img src={img} alt="" />
                    <span className={'n1 ' + (state === 'done' ? 'gold-glow-text' : state === 'active' ? 'teal-glow-text' : '')}>{ms} 天</span>
                    <span className="n2">
                      {state === 'done' ? '✦ 已解锁' : state === 'active' ? `${streak}/${ms} · 还差 ${ms - streak} 天` : '未解锁'}
                    </span>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>
            当前连续 <span className="teal-glow-text">{streak}</span> 天 · 已解锁{' '}
            {milestones.filter((ms) => streak >= ms).length}/{milestones.length} 枚符印
          </p>
        </div>
      </div>

      {/* ── 奥术成就殿 ── */}
      <div className="stat-section">
        <h3><img src={A.trophy} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} /> 奥术成就殿</h3>
        <div className="panel deep">
          <div className="ach-summary">
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                奥术声望：<span className="teal-glow-text" style={{ fontSize: 17, fontFamily: 'Cinzel' }}>{fameGot}</span> / {fameTotal} 点
              </p>
              <div className="crystal-track" style={{ height: 12 }}>
                <div className="crystal-fill" style={{ width: `${fameTotal ? fameGot / fameTotal * 100 : 0}%` }} />
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                已解锁：{achievements.filter((a) => a.done).length} / {achievements.length} 项 ·{' '}
                {(['legend', 'epic', 'rare', 'common']).map((r) =>
                  `${RARITY_META[r].label}：${achievements.filter((a) => a.rarity === r && a.done).length}`).join('  ')}
              </p>
            </div>
          </div>
          <div className="ach-tabs">
            {['全部', '修行', '探索', '特殊'].map((t) => (
              <button key={t} className={'chip' + (achTab === t ? ' on' : '')} onClick={() => setAchTab(t)}>{t}</button>
            ))}
          </div>
          <div className="ach-grid">
            {shownAch.map((a) => (
              <div key={a.id} className={'ach-card ' + RARITY_META[a.rarity].cls + (a.done ? '' : ' locked')}
                onClick={() => setAchDetail(a)}>
                <span className={'rarity-tag ' + RARITY_META[a.rarity].cls}>{RARITY_META[a.rarity].label}</span>
                <img className="icon" src={A.achIcons[a.id]} alt="" />
                <span className="nm">{a.title}</span>
                <span className="pts">{a.points} 点</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {achDetail && (
        <div className="modal-veil" onClick={() => setAchDetail(null)}>
          <div className="modal-box" style={{ maxWidth: 400, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAchDetail(null)} aria-label="关闭">✕</button>
            <span className={'rarity-tag ' + RARITY_META[achDetail.rarity].cls} style={{ position: 'static', display: 'inline-block', marginBottom: 10 }}>
              {RARITY_META[achDetail.rarity].label}
            </span>
            <img src={A.achIcons[achDetail.id]} alt=""
              style={{ width: 130, height: 130, objectFit: 'contain', display: 'block', margin: '6px auto', filter: achDetail.done ? 'drop-shadow(0 0 16px rgba(184,150,58,.5))' : 'grayscale(1) brightness(.5)' }} />
            <h3 className="gold-title font-gothic" style={{ fontSize: 22, letterSpacing: 4 }}>{achDetail.title}</h3>
            <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13.5 }}>{achDetail.desc}</p>
            <p style={{ marginTop: 12, fontSize: 13 }}>
              {achDetail.done
                ? <span className="gold-glow-text">✅ 已解锁 · +{achDetail.points} 奥术声望</span>
                : <span style={{ color: 'var(--teal-lt)' }}>进度：{achDetail.progress}</span>}
            </p>
          </div>
        </div>
      )}

      {records.length === 0 && (
        <div className="panel"><EmptyState img={A.emptyCandle} title="观星台尚无记录" hint="完成一次修习后，星象将开始为你记录灵知的轨迹。" /></div>
      )}
    </div>
  )
}

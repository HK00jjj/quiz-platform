import { useEffect, useMemo, useState } from 'react'
import { A } from './assets'

/* 深渊触手轮廓（极淡闪现，不可名状） */
const SILHOUETTE = (
  <svg className="abyss-silhouette" viewBox="0 0 200 160" aria-hidden="true">
    <g fill="none" stroke="rgba(90,168,156,.9)" strokeWidth="2.4" strokeLinecap="round">
      <path d="M30 150 C 40 100, 18 78, 44 46 C 58 28, 52 14, 66 8" />
      <path d="M70 152 C 76 110, 60 92, 82 62 C 96 44, 88 26, 104 16" />
      <path d="M112 152 C 116 116, 104 96, 124 70 C 138 52, 132 34, 148 26" />
      <path d="M152 150 C 158 118, 148 100, 164 78 C 176 62, 170 46, 184 40" />
      <ellipse cx="100" cy="74" rx="26" ry="13" />
      <circle cx="100" cy="74" r="5" fill="rgba(90,168,156,.7)" stroke="none" />
    </g>
  </svg>
)

/* ── 全局动态背景：纹理 + 彩窗光斑 + 烟雾 + 深渊星空 + 凝视 + 暗角 ── */
export function Background({ intensity = 1 }) {
  const stars = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 5,
    wander: i < 4
  })), [])
  const [abyssOn, setAbyssOn] = useState(false)
  useEffect(() => {
    let t = null
    const on = () => {
      setAbyssOn(true)
      if (t) clearTimeout(t)
      t = setTimeout(() => setAbyssOn(false), 1300)
    }
    window.addEventListener('abyss-pulse', on)
    return () => { window.removeEventListener('abyss-pulse', on); if (t) clearTimeout(t) }
  }, [])
  return (
    <div className={'bg-stage' + (abyssOn ? ' abyss-on' : '')} aria-hidden="true">
      <div className="bg-texture" style={{ backgroundImage: `url(${A.bgTexture})` }} />
      <div className="bg-smoke" />
      <div className="bg-stained" />
      <div className="abyss-flash" style={{ position: 'absolute', inset: 0, opacity: 0.05 * intensity }}>
        {stars.map((s) => (
          <span key={s.id} className={'abyss-star' + (s.wander ? ' wander' : '')}
            style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }} />
        ))}
      </div>
      {SILHOUETTE}
      <div className="bg-vignette" />
    </div>
  )
}

/* 触碰符文：一切可点击元素按下时进发墨绿青火花 */
export function TouchRitual() {
  useEffect(() => {
    const on = (e) => {
      const el = e.target?.closest?.('button, .chip, .opt-row, .entry-card, .judge-card, .deck, .nav-item, .bank-item, .ach-card')
      if (el && e.clientX) burstParticles(e.clientX, e.clientY, 'teal', 6)
    }
    document.addEventListener('pointerdown', on)
    return () => document.removeEventListener('pointerdown', on)
  }, [])
  return null
}

/* 灵知火焰（连胜实体） */
export function FlameIcon() {
  return <span className="flame-icon" aria-hidden="true" />
}

/* ── 粒子爆发（暗金星尘 / 墨绿青魔法 / 暗红烟雾） ── */
export function burstParticles(x, y, tone = 'gold', count = 18) {
  const colors = tone === 'gold' ? ['#b8963a', '#c9a84c']
    : tone === 'teal' ? ['#3a8a7e', '#5aa89c']
    : tone === 'red' ? ['#6b1a3a', '#8b2a4a']
    : ['#b8963a', '#5aa89c', '#6b3a8b']
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span')
    p.className = 'particle'
    const size = 2 + Math.random() * 3.5
    const ang = Math.random() * Math.PI * 2
    const dist = 40 + Math.random() * 90
    const dx = Math.cos(ang) * dist
    const dy = Math.sin(ang) * dist - (30 + Math.random() * 60)
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;` +
      `background:${colors[i % colors.length]};box-shadow:0 0 6px ${colors[i % colors.length]};` +
      `transition:transform ${0.7 + Math.random() * 0.6}s cubic-bezier(.2,.6,.4,1),opacity .9s ease;opacity:.85;`
    document.body.appendChild(p)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      p.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 180}deg)`
      p.style.opacity = '0'
    }))
    setTimeout(() => p.remove(), 1500)
  }
}

/* ── 开机仪式（首次进入，约 2.6 秒，可点击跳过） ── */
export function BootRitual({ onDone }) {
  const [hiding, setHiding] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setHiding(true), 2600)
    const t2 = setTimeout(() => onDone?.(), 3400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])
  const skip = () => { setHiding(true); setTimeout(() => onDone?.(), 500) }
  return (
    <div className={'boot-veil' + (hiding ? ' hide' : '')} onClick={skip}>
      <svg className="boot-eye" viewBox="0 0 130 60" aria-hidden="true">
        <path d="M8 30 Q 65 -6 122 30 Q 65 66 8 30 Z" fill="none" stroke="#5aa89c" strokeWidth="2" />
        <circle cx="65" cy="30" r="12" fill="none" stroke="#c9a84c" strokeWidth="1.6" />
        <circle cx="65" cy="30" r="4.5" fill="#5aa89c" />
      </svg>
      <img className="boot-rose" src={A.roseWindow} alt="" />
      <div className="boot-title font-gothic">奥术典籍馆</div>
      <div className="boot-sub">窥秘人的修行之地 · 深渊在凝视</div>
    </div>
  )
}

/* ── 底部导航：穹顶五柱 ── */
const NAV_ITEMS = [
  { key: 'learn', label: '修习', icon: '📖', to: '/' },
  { key: 'bank', label: '秘典', icon: '🃏', to: '/bank' },
  { key: 'import', label: '誊写', icon: '🔮', to: '/import', center: true },
  { key: 'stats', label: '星象', icon: '📊', to: '/stats' },
  { key: 'settings', label: '工坊', icon: '⚙️', to: '/settings' }
]
export function BottomNav({ active, wrongCount, onNav }) {
  return (
    <nav className="bottom-nav" style={{ backgroundImage: undefined }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${A.navBar})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: .35, pointerEvents: 'none' }} />
      {NAV_ITEMS.map((it) => it.center ? (
        <button key={it.key} className={'nav-item nav-center' + (active === it.key ? ' active' : '')} onClick={() => onNav(it.to)}>
          <span className="nav-icon-wrap">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ) : (
        <button key={it.key} className={'nav-item' + (active === it.key ? ' active' : '')} onClick={() => onNav(it.to)}>
          {it.key === 'bank' && wrongCount > 0 && <span className="dot" />}
          <span className="nav-icon">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ── 鎏金按钮 ── */
export function GiltBtn({ tone, size, block, className = '', children, ...rest }) {
  const cls = ['btn', tone === 'ghost' && 'ghost', tone === 'danger' && 'danger', tone === 'teal' && 'teal',
    size === 'lg' && 'lg', size === 'sm' && 'sm', block && 'block', className].filter(Boolean).join(' ')
  return <button className={cls} {...rest}>{children}</button>
}

/* ── 分隔装饰 ── */
export function RuneDivider() {
  return <div className="divider" style={{ backgroundImage: `url(${A.divider})` }} aria-hidden="true" />
}

/* ── 空状态 ── */
export function EmptyState({ img, title, hint, action }) {
  return (
    <div className="empty-state">
      {img && <img src={img} alt="" />}
      <h3 style={{ color: 'var(--gold-text)', letterSpacing: 3, marginBottom: 8 }}>{title}</h3>
      {hint && <p style={{ lineHeight: 1.9, fontSize: 13.5, maxWidth: 400, margin: '0 auto' }}>{hint}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  )
}

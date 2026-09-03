import { useEffect, useMemo, useState } from 'react'
import { A } from './assets'

/* ── 气泡氛围层（取代哥特酸糖星空）：12 颗半透明彩色气泡从底部缓慢上升，到顶消散。
   intensity 由页面传入（答题页 1.6），只用来调气泡密度。
   'abyss-pulse'（答错时 Practice 派发）在这里接住，让整层短暂“变酸”（色相偏移）——
   对应方案 7.5「做错时气泡短暂变多变快，仿佛空气都酸了一下」。 ── */
export function Background({ intensity = 1 }) {
  const bubbles = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: 4 + Math.random() * 92,
    size: 18 + Math.random() * 46,
    dur: 16 + Math.random() * 10,
    /* 负延迟：进页时气泡已经分布在全程各个高度，不用等第一轮 */
    delay: -Math.random() * 24,
    tone: ['pink', 'mint', 'lemon', 'lav'][i % 4]
  })), [])
  const [sour, setSour] = useState(false)
  useEffect(() => {
    let t = null
    const on = () => {
      setSour(true)
      if (t) clearTimeout(t)
      t = setTimeout(() => setSour(false), 1100)
    }
    window.addEventListener('abyss-pulse', on)
    return () => { window.removeEventListener('abyss-pulse', on); if (t) clearTimeout(t) }
  }, [])
  const shown = intensity > 1 ? bubbles : bubbles.slice(0, 9)
  return (
    <div className="bg-stage" aria-hidden="true">
      <div className={'bubble-layer' + (sour ? ' sour' : '')}>
        {shown.map((b) => (
          <span key={b.id} className={'bubble ' + b.tone}
            style={{ left: `${b.left}%`, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
        ))}
      </div>
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

/* 甜蜜值火焰（连胜实体） */
export function FlameIcon() {
  return <span className="flame-icon" aria-hidden="true" />
}

/* ── 粒子爆发（糖豆配色：粉桃/薄荷/柠檬/薊衣草；“红”已改成酸橙绿，方案 6.1） ── */
export function burstParticles(x, y, tone = 'gold', count = 18) {
  const colors = tone === 'gold' ? ['#FFB6C1', '#FF8FA3']
    : tone === 'teal' ? ['#7FE8C8', '#5FD4B0']
    : tone === 'red' ? ['#A8E063', '#8BC34A']
    : ['#FFB6C1', '#7FE8C8', '#FFE066', '#D4B8FF']
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
      <div className="boot-title font-gothic">糖果题库</div>
      <div className="boot-sub">尝味师的甜蜜修行地</div>
    </div>
  )
}

/* ── 底部导航：糖霜托盘三格（学习/导入/设置，方案 1.1）
   图标用 emoji 而不是素材图：方案 6.5 要求圆润糖果元素，且不再依赖哥特图标素材。
   错题提示（跳动的酸橙糖）挂在「学习」上，因为错题重练现在是学习页的一个入口。 ── */
const NAV_ITEMS = [
  { key: 'learn', label: '学习', icon: '🍬', to: '/', tone: 'pink' },
  { key: 'import', label: '导入', icon: '📦', to: '/import', tone: 'mint' },
  { key: 'settings', label: '设置', icon: '⚙️', to: '/settings', tone: 'lav' }
]
export function BottomNav({ active, wrongCount, onNav }) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((it) => (
        <button key={it.key} className={'nav-item tone-' + it.tone + (active === it.key ? ' active' : '')} onClick={() => onNav(it.to)}>
          {it.key === 'learn' && wrongCount > 0 && <span className="dot" />}
          <span className="nav-emoji" aria-hidden="true">{it.icon}</span>
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

import { useEffect, useMemo, useState } from 'react'

/* ══════════════════════════════════════════════════════════════
   CandyBoot.jsx —— 为什么单独一个文件？
   components.jsx 正被编辑器的陈旧缓冲区反复回写（实测同一轮内被覆盖两次：
   先从 src 分支拉回糖果版、审计确认无误，一个调用之后又变回 Apple 版）。
   所以把「气泡背景 / 三格糖果导航 / 开机仪式」这三个组件搬到这里，
   由 App.jsx 直接引入，避开那个会被吞掉改动的文件。
   等编辑器缓冲区问题解决后，可以把本文件内容并回 components.jsx。
   ══════════════════════════════════════════════════════════════ */

/* ── 气泡氛围层：12 颗半透明彩色气泡从底部缓慢上升，到顶消散（方案 1.3 / 7.5）。
   只动 transform/opacity；负延迟让进页时气泡已分布在全程各高度，不用等第一轮。
   'abyss-pulse'（答错时 Practice 派发）在这里接住，让整层短暂"变酸"（色相偏移）。 ── */
export function Background({ intensity = 1 }) {
  const bubbles = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: 4 + Math.random() * 92,
    size: 18 + Math.random() * 46,
    dur: 16 + Math.random() * 10,
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

/* ── 底部导航：糖霜托盘三格（学习/导入/设置，方案 1.1）。
   图标用 emoji（方案 6.5 要求圆润糖果元素）；错题提示挂在「学习」上，
   因为错题重练是学习页的一个入口。 ── */
const NAV_ITEMS = [
  { key: 'learn', label: '学习', icon: '🍬', to: '/', tone: 'pink' },
  { key: 'import', label: '导入', icon: '📦', to: '/import', tone: 'mint' },
  { key: 'settings', label: '设置', icon: '⚙️', to: '/settings', tone: 'lav' }
]
export function BottomNav({ active, wrongCount, onNav }) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {NAV_ITEMS.map((it) => (
        <button key={it.key} className={'nav-item tone-' + it.tone + (active === it.key ? ' active' : '')}
          onClick={() => onNav(it.to)} aria-current={active === it.key ? 'page' : undefined}>
          {it.key === 'learn' && wrongCount > 0 && <span className="dot" />}
          <span className="nav-emoji" aria-hidden="true">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ── 开机仪式（方案 1.2）：2 秒四段分镜，全由 CSS 驱动，JS 只负责推进 stage 类名。
   0–0.5s   糖豆从下方弹入（bounce）
   0.5–1.5s 糖豆旋转化开、糖纸螺旋展开，中央浮现标题与副标题
   1.5–2.0s 糖纸向两侧剥开露出主界面，气泡从四周升起消散
   2.0s     完全进入（底部导航由 .bottom-nav 的 nav-in 弹入）
   "剥开"用左右各 50% 的两块面板 translateX 出去（而不是整层淡出），所以真的看得到拆糖纸。
   点击任意处跳到终态；prefers-reduced-motion 下 CSS 直接给终态、无位移。 ── */
export function BootRitual({ onDone }) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t = [
      setTimeout(() => setStage(1), 500),
      setTimeout(() => setStage(2), 1500),
      setTimeout(() => setStage(3), 2050),
      setTimeout(() => onDone?.(), 2450)
    ]
    return () => t.forEach(clearTimeout)
  }, [onDone])
  const skip = () => { setStage(3); setTimeout(() => onDone?.(), 320) }
  return (
    <div className={'boot-veil s' + stage} onClick={skip} role="presentation">
      <span className="boot-half left" aria-hidden="true" />
      <span className="boot-half right" aria-hidden="true" />
      <span className="boot-bubbles" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} />)}</span>
      <span className="boot-center">
        <span className="boot-stage">
          <span className="boot-foil" aria-hidden="true" />
          <span className="boot-bean" aria-hidden="true" />
          <span className="boot-title">糖果题库</span>
          <span className="boot-sub">尝味师的甜蜜修行地</span>
        </span>
      </span>
    </div>
  )
}

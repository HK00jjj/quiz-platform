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
          {/* 导航「学习」右上角的错题绿点已按用户要求删除：学习页的「错题重练」卡
              已经有草莓红计数徽章，信息重复；而且它用的 --sour-dk 酸橙绿与「错=草莓红」
              的新双通道不同源。wrongCount 这个 prop 保留在签名里（App.jsx 仍在传），无害。 */}
          <span className="nav-emoji" aria-hidden="true">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ── 糖豆爆裂（方案 6.4）：答题后从点击处弹出 14 颗糖豆，抛物线飞出并淡出。
   对：粉桃/薄荷/柠檬三色；错：酸橙绿（方案 2.2 “错了用酸橙绿而不是红色”）。
   一次性动画，不循环；只动 transform/opacity，1.1s 后自行从 DOM 移除。
   附带一次轻振动（支持的设备），与变色/shake 同一帧。 ── */
const CANDY_OK = ['#FF8FA3', '#7FE8C8', '#FFE066', '#D4B8FF']
const CANDY_BAD = ['#A8E063', '#8BC34A', '#C6E86A']
export function burstParticles(x, y, tone = 'gold', count = 14) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(tone === 'red' ? [10, 40, 10] : 10)
  }
  if (typeof document === 'undefined') return
  const bad = tone === 'red'
  const palette = bad ? CANDY_BAD : CANDY_OK
  const host = document.createElement('div')
  host.className = 'burst-host'
  host.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i')
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const dist = 46 + Math.random() * 54
    const size = 6 + Math.random() * 6
    p.className = 'burst-bean'
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;` +
      `background:${palette[i % palette.length]};` +
      `--bx:${Math.cos(ang) * dist}px;--by:${Math.sin(ang) * dist - 26}px;` +
      `animation-delay:${(Math.random() * 60) | 0}ms`
    host.appendChild(p)
  }
  document.body.appendChild(host)
  setTimeout(() => host.remove(), 1200)
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

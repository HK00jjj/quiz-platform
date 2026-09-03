import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { A } from './assets'
import { Background, BottomNav, BootRitual, TouchRitual } from './components'
import { lastResultMap } from './lib/stats'
import Login from './pages/Login'
import Learn from './pages/Learn'
import Practice from './pages/Practice'
import Bank from './pages/Bank'
import Import from './pages/Import'
import Stats from './pages/Stats'
import Settings from './pages/Settings'

function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const phase = useStore((s) => s.phase)
  const abortSession = useStore((s) => s.abortSession)
  const wrongCount = useStore((s) => lastResultMap(s.records))
  const wrongN = [...wrongCount.values()].filter((v) => v === false).length
  const inPractice = location.pathname === '/practice'
  const activeKey = { '/': 'learn', '/bank': 'bank', '/import': 'import', '/stats': 'stats', '/settings': 'settings' }[location.pathname]
  // 法阵转移：页面切换先被烟雾吞没，再凝聚浮现
  const [veil, setVeil] = useState(false)
  function navTo(to) {
    if (to === location.pathname) return
    setVeil(true)
    setTimeout(() => { navigate(to); setTimeout(() => setVeil(false), 260) }, 300)
  }
  // 离开答题页就中止会话：否则 phase 会永远停在 answering/feedback/done，
  // 下次再进答题页会拿到残留会话，且任何依赖 phase 的 UI 都回不到初始态
  useEffect(() => {
    if (!inPractice && phase !== 'idle') abortSession()
  }, [inPractice])
  return (
    <div className="app-shell">
      <Background intensity={inPractice ? 1.6 : 1} />
      {veil && <div className="nav-veil" style={{ '--rose-img': `url(${A.roseWindow})` }} aria-hidden="true" />}
      <Routes>
        <Route path="/" element={<Learn />} />
        <Route path="/bank" element={<Bank />} />
        <Route path="/import" element={<Import />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* 底部导航：除答题页外一律显示（不再受会话 phase 制约），active 由当前路由得出 */}
      {!inPractice && (
        <BottomNav active={activeKey} wrongCount={wrongN} onNav={(to) => navTo(to)} />
      )}
    </div>
  )
}

export default function App() {
  const authStatus = useStore((s) => s.authStatus)
  const ready = useStore((s) => s.ready)
  const init = useStore((s) => s.init)
  const [boot, setBoot] = useState(true)

  useEffect(() => { init() }, [init])

  if (!ready) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh' }}>
        <Background />
        <div style={{ position: 'relative', zIndex: 1, paddingTop: '30vh' }}>
          <div className="loading-orb" />
          <p style={{ textAlign: 'center', color: 'var(--muted)', letterSpacing: 4, fontSize: 13 }}>甜蜜值凝聚中…</p>
        </div>
      </div>
    )
  }

  if (authStatus !== 'signed-in') {
    return (
      <>
        {boot && <BootRitual onDone={() => setBoot(false)} />}
        <Login />
      </>
    )
  }

  return (
    <>
      {boot && <BootRitual onDone={() => setBoot(false)} />}
      <TouchRitual />
      <HashRouter>
        <Shell />
      </HashRouter>
    </>
  )
}

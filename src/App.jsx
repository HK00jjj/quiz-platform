import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { A } from './assets'
import { TouchRitual } from './components'
/* 背景气泡 / 三格糖果导航 / 开机仪式改从 CandyBoot 引入：components.jsx 正被编辑器的
   陈旧缓冲区反复回写（实测同一轮内被覆盖两次），改动会被吞掉，所以拆到新文件里 */
import { Background, BottomNav, BootRitual } from './components/CandyBoot'
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
  /* 页面切换：直接跳转。
     原来的「法阵转移」有两个问题：① 它铺的 .nav-veil 用的是 A.roseWindow（哥特玫瑰彩窗），
     在糖果主题里就是切页时一闪而过的不符图案；② 它先 setTimeout 300ms 才 navigate，
     属于导航输入路径上的无谓延迟（点一下要等半秒才有反应）。
     导航切换属于一天几十次的高频操作，动效门控上只能“几乎察觉不到或干脆没有”。 */
  function navTo(to) {
    if (to === location.pathname) return
    navigate(to)
  }
  // 离开答题页就中止会话：否则 phase 会永远停在 answering/feedback/done，
  // 下次再进答题页会拿到残留会话，且任何依赖 phase 的 UI 都回不到初始态
  useEffect(() => {
    if (!inPractice && phase !== 'idle') abortSession()
  }, [inPractice])
  return (
    <div className="app-shell">
      <Background intensity={inPractice ? 1.6 : 1} />
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

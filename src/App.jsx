import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { A } from './assets'
import { TouchRitual } from './components'
/* 背景气泡 / 三格糖果导航 / 开机仪式改从 CandyBoot 引入：components.jsx 正被编辑器的
   陈旧缓冲区反复回写（实测同一轮内被覆盖两次），改动会被吞掉，所以拆到新文件里 */
import { Background, BottomNav, BootRitual, useScrollReveal } from './components/CandyBoot'
import FestiveDecor from './components/FestiveDecor'
import { lastResultMap } from './lib/stats'
import Login from './pages/Login'
import Learn from './pages/Learn'
import Practice from './pages/Practice'
import Bank from './pages/Bank'
import Import from './pages/Import'
import Settings from './pages/Settings'

function Shell() {
  useScrollReveal()
  const navigate = useNavigate()
  const location = useLocation()
  const phase = useStore((s) => s.phase)
  const abortSession = useStore((s) => s.abortSession)
  const syncError = useStore((s) => s.syncError)
  const clearSyncError = useStore((s) => s.clearSyncError)
  const wrongCount = useStore((s) => lastResultMap(s.records))
  const wrongN = [...wrongCount.values()].filter((v) => v === false).length
  const inPractice = location.pathname === '/practice'
  /* /stats 已整页下线：它的入口（📊 星象）早就按用户要求摘掉了，页面成了只能手打 URL 到达的孤儿，
     而它一个人占着剩余哥特位图（身份证卡/头像框/星盘/奖杯/徽章框）的一大半。
     Route 删除后 #/stats 会被下面的 path="*" 兼到重定向回首页，不会 404。 */
  const activeKey = { '/': 'learn', '/bank': 'bank', '/import': 'import', '/settings': 'settings' }[location.pathname]
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
      {/* 云端同步失败的唯一全局出口（§33）：答题时 persistAnswer 失败、设置/书架保存失败
          都只 set syncError，此前唯一显示点在登录页，登录后用户完全无感。
          role=status 让读屏器播报；点击即收，不阻塞任何操作。 */}
      {syncError && (
        <button type="button" className="sync-toast" role="status" onClick={clearSyncError}>
          {syncError}（点击关闭）
        </button>
      )}
      {/* 背景景深光斑（fixed，z-index 与气泡层同为 0，DOM 在前所以画在气泡之下）。
          放在 Shell 而不是 Background 组件里：Background 也被加载态复用，而登录分支不用 Background。 */}
      <div className="candy-orbs" aria-hidden="true"><i /><i /><i /></div>
      {/* 彩糖针点缀（糖果派对派）：12 根静态小棒、四色循环，fixed z-0 与光斑同层。
          静态零动画，不占每帧合成成本；位置/配色全在 candy.css。 */}
      <span className="candy-sprinkles" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
      </span>
      <Background intensity={inPractice ? 1.6 : 1} />
      {/* §52 节日点缀层：整层点击穿透（pointer-events:none），元素全在页框空隙，
          z-5 压在内容上但低于底部导航/弹窗；登录前不挂（BootRitual/Login 分支保持素净） */}
      <FestiveDecor />
      <Routes>
        <Route path="/" element={<Learn />} />
        <Route path="/bank" element={<Bank />} />
        <Route path="/import" element={<Import />} />
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
        {/* 登录页原来没有气泡层：加载态（L72）与已登录的 Shell（L43）都渲染了 <Background />，
            只有这个分支漏了，所以它只剩一层平渐变、显得空。补回来与其它屏一致。 */}
        <Background />
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

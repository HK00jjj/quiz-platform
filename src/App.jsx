import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { A } from './assets'
import { TouchRitual } from './components'
/* 背景气泡 / 三格糖果导航 / 开机仪式改从 CandyBoot 引入：components.jsx 正被编辑器的
   陈旧缓冲区反复回写（实测同一轮内被覆盖两次），改动会被吞掉，所以拆到新文件里 */
import { Background, BottomNav, BootRitual, useScrollReveal } from './components/CandyBoot'
import FestiveDecor from './components/FestiveDecor'
import { lastResultMap } from './lib/stats'
import { reloadOnceForFreshAssets, clearReloadFlag } from './lib/reload'
import Login from './pages/Login'
import Learn from './pages/Learn'
/* §性能 路由级代码分割：非首屏四个页拆成独立 chunk（首访只下载 Learn+公共件，
   bundle 557KB → 主包约 380KB；切页时按需拉取，gh-pages CDN 单文件 <20KB gzip 无感）。
   chunk 统一命名 index-*.js（vite.config chunkFileNames），纳入 purge-dist 保留窗口，
   避免 Practice-*.js 之类命名游离在清理逻辑外。

   ⚠ 2026-09-14 血泪：**懒加载 chunk 会在部署后 404**（Pages 每代重建产物，旧哈希被删），
   而陈旧的缓存 index.html 仍按旧哈希去取 → "Failed to fetch dynamically imported module"
   → 用户看到的就是"功能全都不见了"（实测 body 全空且永不恢复）。两层兜底：
   ① 每个 lazy 的 import 失败都接一次"整页刷新换新资源"（reloadOnceForFreshAssets，
      30s 内只刷一次防循环）；② 下面包 ErrorBoundary，刷新后仍失败则显示"点此刷新"提示。 */
const lazyPage = (factory) => lazy(() => factory().catch(() => {
  reloadOnceForFreshAssets()          // 拿到新 index.html 与新 chunk
  return new Promise(() => {})        // 保持 pending：交给刷新，别再抛错炸掉整树
}).then((m) => {
  /* 加载成功 → 清掉"已刷过"标记，保证下次真·版本错位还能自愈 */
  clearReloadFlag()
  return m
}))
const Bank = lazyPage(() => import('./pages/Bank'))
const Import = lazyPage(() => import('./pages/Import'))
const Settings = lazyPage(() => import('./pages/Settings'))
const Practice = lazyPage(() => import('./pages/Practice'))
/* 诊断两页（2026-09-18 P1）：Dashboard 掌握度仪表盘 / Insight 错因与干扰项画像。
   同样走 lazyPage（含 chunk 404 自愈兜底），避免给首屏增包。
   Path（2026-09-18 S3）：学习路径（KST 外/内边缘），归诊断家族，入口在 Dashboard。 */
const Dashboard = lazyPage(() => import('./pages/Dashboard'))
const Insight = lazyPage(() => import('./pages/Insight'))
const Path = lazyPage(() => import('./pages/Path'))

/* 兜底 ErrorBoundary：任何页面级异常（含刷新后仍拉不到 chunk）都给出可操作提示，
   不再出现"一片空白、什么都没有"。
   2026-09-16 真机取证增强：此前错误只进 console，文案却写"已记录错误信息"——
   实际用户侧不可观测（手机报障拿不到任何细节），远程排障断链。现在：
   ① componentDidCatch 把错误落到 localStorage('qa_page_err')，含构建标识/UA/堆栈；
   ② 卡片提供「复制错误详情」按钮（clipboard API 优先，execCommand 兜底旧内核）；
   ③ 错误正文可展开查看。真机报"这个页面出了点问题"时一键复制即可回传取证。 */
class PageBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null, copied: false } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) {
    try { console.error('[PageBoundary]', err) } catch { /* ignore */ }
    try {
      const detail = {
        t: new Date().toISOString(),
        build: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown',
        msg: String((err && err.message) || err || ''),
        stack: String((err && err.stack) || ''),
        comp: String((info && info.componentStack) || ''),
        href: String((typeof location !== 'undefined' && location.href) || ''),
        ua: String((typeof navigator !== 'undefined' && navigator.userAgent) || '')
      }
      localStorage.setItem('qa_page_err', JSON.stringify(detail, null, 1))
    } catch { /* ignore */ }
  }
  /* 复制取证文本：clipboard API 需 https 安全上下文（本站满足），旧内核或异常时走 execCommand 兜底 */
  copyDetail() {
    const read = () => {
      try {
        return localStorage.getItem('qa_page_err')
          || String((this.state.err && this.state.err.message) || this.state.err || '')
      } catch { return '' }
    }
    const done = () => this.setState({ copied: true })
    const fallback = () => {
      try {
        const ta = document.createElement('textarea')
        ta.value = read(); ta.setAttribute('readonly', '')
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
        document.body.appendChild(ta); ta.select()
        document.execCommand('copy'); document.body.removeChild(ta); done()
      } catch { /* ignore */ }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(read()).then(done, fallback)
      else fallback()
    } catch { fallback() }
  }
  render() {
    if (!this.state.err) return this.props.children
    const err = this.state.err
    const msg = String((err && err.message) || err || '')
    const stack = String((err && err.stack) || '')
    const isChunk = /dynamically imported module|Loading chunk|import\(\)/i.test(msg)
    return (
      <div className="panel" style={{ margin: '18px auto', maxWidth: 420, padding: '16px 18px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: 8 }}>{isChunk ? '页面资源已更新' : '这个页面出了点问题'}</h3>
        <p style={{ fontSize: 13, lineHeight: 1.6, opacity: .85 }}>
          {isChunk
            ? '本站刚发布过新版本，你手上的页面还是旧的。点下面的按钮刷新即可恢复（不会丢进度）。'
            : '已记录错误信息。刷新一次通常就能恢复；若反复出现，请点「复制错误详情」把内容发给我，便于定位。'}
        </p>
        {!isChunk && stack && (
          <details style={{ margin: '6px 0 0', textAlign: 'left' }}>
            <summary style={{ fontSize: 12, opacity: .7, cursor: 'pointer' }}>查看错误详情</summary>
            <pre style={{ fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 180, overflow: 'auto', opacity: .75 }}>{msg + '\n' + stack}</pre>
          </details>
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="chip" onClick={() => window.location.reload()}>🔄 刷新页面</button>
          {!isChunk && <button className="chip" onClick={() => this.copyDetail()}>{this.state.copied ? '✅ 已复制' : '📋 复制错误详情'}</button>}
        </div>
      </div>
    )
  }
}


function Shell() {
  useScrollReveal()
  const navigate = useNavigate()
  const location = useLocation()
  const phase = useStore((s) => s.phase)
  const abortSession = useStore((s) => s.abortSession)
  const syncError = useStore((s) => s.syncError)
  const clearSyncError = useStore((s) => s.clearSyncError)
  /* §67 性能：原 selector 在 useStore 内跑 lastResultMap（O(全部记录)）且返回新 Map 引用——
     store 任意变化（含答题计时）都会触发 Shell 全树重渲染。改为只订阅 records 数组引用，
     错题计数包 useMemo，记录不变则零重算零重渲染。 */
  const records = useStore((s) => s.records)
  const wrongN = useMemo(() => {
    let n = 0
    for (const v of lastResultMap(records).values()) if (v === false) n++
    return n
  }, [records])
  const inPractice = location.pathname === '/practice'
  /* /stats 已整页下线：它的入口（📊 星象）早就按用户要求摘掉了，页面成了只能手打 URL 到达的孤儿，
     而它一个人占着剩余哥特位图（身份证卡/头像框/星盘/奖杯/徽章框）的一大半。
     Route 删除后 #/stats 会被下面的 path="*" 兼到重定向回首页，不会 404。 */
  const activeKey = { '/': 'learn', '/bank': 'bank', '/import': 'import', '/settings': 'settings', '/dashboard': 'diag', '/insight': 'diag', '/path': 'diag' }[location.pathname]
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
    <div className={'app-shell' + (inPractice ? ' in-practice' : '')}>
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
          z-5 压在内容上但低于底部导航/弹窗；登录前不挂（BootRitual/Login 分支保持素净）。
          沉浸感批1 A1（2026-09-15 用户拍板）：答题页整层不挂——20+ 装饰件与 4 组循环动画
          与答题专注直接竞争注意力（§68 雪花分神的前科），is-compact 半撤方案升级为全撤。 */}
      {!inPractice && <FestiveDecor />}
      <PageBoundary>
        <Suspense fallback={
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '38vh' }}>
            <div className="loading-orb" />
          </div>
        }>
          <Routes>
            <Route path="/" element={<Learn />} />
            <Route path="/bank" element={<Bank />} />
            <Route path="/import" element={<Import />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/insight" element={<Insight />} />
            <Route path="/path" element={<Path />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </PageBoundary>
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
  /* 沉浸批2 B4：boot 仪式每会话一次——sessionStorage 记账，同标签页刷新/路由回访不再重播；
     关掉标签页下次进入仍播（跨会话仪式感保留）。隐私模式读写异常时回退为每次都播。 */
  const [boot, setBoot] = useState(() => {
    try { return !sessionStorage.getItem('bootPlayed') } catch { return true }
  })
  const endBoot = () => {
    try { sessionStorage.setItem('bootPlayed', '1') } catch { /* 隐私模式忽略 */ }
    setBoot(false)
  }

  useEffect(() => { init() }, [init])

  if (!ready) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh' }}>
        <Background />
        <div style={{ position: 'relative', zIndex: 1, paddingTop: '30vh' }}>
          <div className="loading-orb" />
          <p style={{ textAlign: 'center', color: 'var(--muted)', letterSpacing: 4, fontSize: 13 }}>成长档案加载中…</p>
        </div>
      </div>
    )
  }

  if (authStatus !== 'signed-in') {
    return (
      <>
        {boot && <BootRitual onDone={endBoot} />}
        {/* 登录页原来没有气泡层：加载态（L72）与已登录的 Shell（L43）都渲染了 <Background />，
            只有这个分支漏了，所以它只剩一层平渐变、显得空。补回来与其它屏一致。 */}
        <Background />
        <Login />
      </>
    )
  }

  return (
    <>
      {boot && <BootRitual onDone={endBoot} />}
      <TouchRitual />
      <HashRouter>
        <Shell />
      </HashRouter>
    </>
  )
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { reloadOnceForFreshAssets } from './lib/reload'
import './theme/global.css'
import './theme/pages.css'
/* 糖果主题层：必须排在 gothic 两份 CSS 之后，靠层叠顺序覆盖（同特异性时后来者胜） */
import './theme/candy.css'
/* 白瓷答题页皮肤（Pilot 2026-09-19）：作用域限定 .app-shell.in-practice（类由 App.jsx 按路由挂载），
   仅答题页生效；删本行或去掉 App.jsx 的 in-practice 类即回滚。
   ⚠ 2026-09-19 修正：原写成 body.in-practice 而类实际挂在 .app-shell 上 → 规则永不命中（已修）。 */
import './theme/paper.css'

/* 部署后旧标签页自愈：Vite 的动态 import/预加载失败会派发 vite:preloadError，
   这里统一接住 → 整页刷新一次换新资源（细节与防循环见 lib/reload.js 注释）。
   App.jsx 里每个 React.lazy 也接了同一套兜底（双保险），并包了 PageBoundary
   兜住"刷新后仍失败"的情形——绝不再出现一片空白。 */
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    reloadOnceForFreshAssets()
  })
}

/* §性能 Service Worker 预缓存（2026-09-21）：gh-pages 对所有资源只给 max-age=600，
   隔十分钟再进站就得重新下载主包 467KB+CSS 154KB（国内网络常需数秒到十几秒）——
   "每次进网站加载很久"的第一根因。SW 把静态资源缓存到本地：二次进站 0 下载；
   导航走 network-first，新版本照常被发现。生成逻辑见 vite.config.js 的 swPrecache。
   逃生门：URL 带 ?nosw=1 → 不注册、注销已有 SW、清掉本站缓存（排障/兜底用）。 */
if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (new URLSearchParams(location.search).has('nosw')) {
      navigator.serviceWorker.getRegistrations?.().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {})
      caches?.keys().then((ks) => ks.filter((k) => k.startsWith('qp-static-')).forEach((k) => caches.delete(k))).catch(() => {})
      return
    }
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      .catch((e) => console.warn('[sw] 注册失败，站点照常可用', e))
  })
}

createRoot(document.getElementById('root')).render(<App />)

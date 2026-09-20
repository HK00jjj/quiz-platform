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

createRoot(document.getElementById('root')).render(<App />)

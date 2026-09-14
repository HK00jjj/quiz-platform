/* 资源版本错位自愈（2026-09-14 修"功能全都不见了"）
   背景：GitHub Pages 每代部署会重建整个产物，**旧的内容哈希 chunk 被删掉**；
   而用户浏览器/运营商缓存里可能还留着旧 index.html，它按旧哈希去请求那些已不存在的
   文件 → 懒加载 404 → 没有兜底就是"整页空白、永不恢复"（实测复现：body 文本为空 + Uncaught）。

   社区与官方定论（Vite 官方 "Handling load errors"；GitHub 同类 PR：Pages 重新部署后
   懒加载 chunk 404 → 监听 vite:preloadError 刷新一次）：
   · 动态 import 失败 → 整页刷新一次，拿到新 index.html + 新 chunk；
   · sessionStorage 记时间戳，**30 秒内只刷一次**，防止"刷新→仍失败→再刷新"死循环；
   · 加载成功后在 App 里清掉标记，保证下一次真正的版本错位仍能自愈。
   刷新后依然失败（真离线）→ 由 App 的 PageBoundary 显示"点此刷新"，不再无声空白。 */
const RELOAD_FLAG = 'qp.chunkReloadedAt'
const COOLDOWN_MS = 30000

export function reloadOnceForFreshAssets() {
  try {
    const t = Number(sessionStorage.getItem(RELOAD_FLAG) || 0)
    if (t && Date.now() - t < COOLDOWN_MS) return false
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
  } catch { /* 隐私模式拿不到 sessionStorage：仍允许刷一次 */ }
  if (typeof window !== 'undefined' && window.location) window.location.reload()
  return true
}

export function clearReloadFlag() {
  try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* ignore */ }
}

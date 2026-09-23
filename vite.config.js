import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/* GitHub Pages 的 SPA fallback（2026-09-11 审查整改）：
   未知路径会被 Pages 回以 404.html，把 index.html 复制一份过去，死链即可落地进应用。
   原先是部署流程里的**手工步骤**（cp dist/index.html dist/404.html），而 vite 重构建时
   不会生成它——漏做则 fallback 静默失效（直接 404、无任何报错）。
   固化成构建插件后，这一步在物理上不可能再被忘掉。 */
const spa404Fallback = () => {
  let root = process.cwd()
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(c) { root = c.root; outDir = c.build.outDir },
    closeBundle() {
      const out = resolve(root, outDir)
      copyFileSync(resolve(out, 'index.html'), resolve(out, '404.html'))
    }
  }
}

/* §性能 Service Worker 预缓存（2026-09-21）：
   GitHub Pages 对所有资源固定 Cache-Control: max-age=600（实测本站响应头），且不可配置。
   用户隔十分钟以上再进站，浏览器就要重新下载主包 467KB + CSS 154KB——国内网络下
   这就是"每次进网站加载很久"的第一根因。
   本插件在构建末尾生成 dist/sw.js：把当前 index.html 引用集（主包/懒 chunk/CSS）
   + 404.html + favicon + dist/img/* 写进 precache 清单（清单从【构建产物】取，
   不扫旧代孤儿）。运行时策略：
   - 带 hash 的静态资源 → cache-first：命中本地 0 下载；未命中（新版本新 hash）走网络并入库；
   - 导航 / index.html → network-first：新版本 HTML 照常被发现，离线时回退缓存；
   - 跨域（Supabase / 百度语音）一律不拦。
   版本更新：CACHE 名内嵌构建时刻，新 SW activate 时整库轮换，旧 hash 残留自然清空。
   逃生门：URL 带 ?nosw=1 → 页面侧不注册并注销已有 SW + 清缓存（main.jsx）。 */
const swTemplate = (cacheName, precache) => `
/* 由 vite 构建 sw-precache 插件生成——勿手改，每次构建整体重写。
   清单=${precache.length} 项（当前 index.html 引用集 + shell + dist/img）。 */
const CACHE = ${JSON.stringify(cacheName)}
const SCOPE = self.registration.scope
const PRECACHE = ${JSON.stringify(precache)}
const ASSET_RE = /\\.(?:js|css|webp|svg|png|jpe?g|ico|woff2?)$/

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE)
    await Promise.all(PRECACHE.map(async (u) => {
      try { await c.add(new URL(u, SCOPE).href) } catch { /* 单项失败不阻塞安装：运行时按需补拉 */ }
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return          // Supabase / 云端语音不拦
  if (!url.pathname.startsWith(SCOPE)) return
  const rel = url.pathname.slice(SCOPE.length)
  const isNav = req.mode === 'navigate'
  if (isNav || rel === '' || rel === 'index.html') {
    /* network-first：新版本发布后导航请求必须先看网络；离线才回退缓存。
       缓存 key 固定用 scope+index.html，避免 ?query 造出脏 key。 */
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-cache' })
        if (fresh && fresh.ok) {
          const c = await caches.open(CACHE)
          c.put(new URL('index.html', SCOPE).href, fresh.clone())
        }
        return fresh
      } catch {
        const hit = await caches.match(new URL('index.html', SCOPE).href)
        return hit || Response.error()
      }
    })())
    return
  }
  if (PRECACHE.includes(rel) || ASSET_RE.test(rel)) {
    /* cache-first：文件名带内容哈希，命中即零成本返回；未命中拉网络并入库 */
    e.respondWith((async () => {
      const hit = await caches.match(req)
      if (hit) return hit
      const fresh = await fetch(req)
      if (fresh && fresh.ok) {
        const c = await caches.open(CACHE)
        c.put(req, fresh.clone())
      }
      return fresh
    })())
  }
})
`

const swPrecache = () => {
  let root = process.cwd()
  let outDir = 'dist'
  return {
    name: 'sw-precache',
    apply: 'build',
    configResolved(c) { root = c.root; outDir = c.build.outDir },
    closeBundle() {
      const out = resolve(root, outDir)
      let html
      try { html = readFileSync(resolve(out, 'index.html'), 'utf8') } catch { return }
      const precache = new Set(['index.html', 'favicon.svg'])
      for (const m of html.matchAll(/(?:src|href)="([^"]+assets\/[^"]+)"/g)) {
        precache.add(m[1].replace(/^\/quiz-platform\//, '').replace(/^\.?\//, ''))
      }
      /* dist/img 由 purge-dist.mjs 保证只含被引用素材，整目录入清单。
         2026-09-23 修复：只收**文件**——原写法不判 isFile，子目录名（如清空后的 img/ill）
         会混进 PRECACHE，安装期 c.add 对目录 URL 必 404（单项 catch 吞掉不致命，但
         每次装 SW 白打一发 404 请求）。img/ill 子树内的逐题配图不进 precache，
         沿用「运行时按需缓存」通路（fetch 段 ASSET_RE 命中即入库）。 */
      try {
        const imgDir = resolve(out, 'img')
        for (const n of readdirSync(imgDir)) {
          if (statSync(resolve(imgDir, n)).isFile()) precache.add('img/' + n)
        }
      } catch { /* 无 img 目录则跳过 */ }
      const cacheName = 'qp-static-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
      writeFileSync(resolve(out, 'sw.js'), swTemplate(cacheName, [...precache].sort()))
    }
  }
}

export default defineConfig({
  base: '/quiz-platform/',
  plugins: [react(), spa404Fallback(), swPrecache()],
  /* __BUILD_ID__（2026-09-16）：把构建时刻注入产物。部署链走 GitHub Data API、本地无 git
     仓库，此前线上排障无法分辨用户跑的是哪一代构建；现在 PageBoundary 的错误取证记录
     与「复制错误详情」都携带它，报障时一眼对上部署哈希对应的构建。 */
  define: { __BUILD_ID__: JSON.stringify(new Date().toISOString()) },
  // emptyOutDir:false：构建不清空 dist（WorkBuddy 的 safe-delete 垫片会拦截 rmSync 导致构建崩溃）。
  // 孤儿产物统一由 scripts/purge-dist.mjs 的语义不变式闸清理。
  // emptyOutDir:false：构建不清空 dist（WorkBuddy 的 safe-delete 垫片会拦截 rmSync 导致构建崩溃）。
  // 孤儿产物统一由 scripts/purge-dist.mjs 的语义不变式闸清理。
  build: {
    outDir: 'dist', emptyOutDir: false, assetsInlineLimit: 0,
    /* 路由级代码分割（App.jsx React.lazy）后，懒加载 chunk 若用默认命名（Practice-*.js）
       会游离在 purge-dist 的 index-* 清理模式之外：既不会被保留窗口保护、也不会被清点。
       统一命名成 index-<hash>.js，让所有 chunk 与主包一样纳入「HTML 引用集 + RETAIN 保留窗」。 */
    rollupOptions: { output: { chunkFileNames: 'assets/index-[hash].js' } }
  }
})

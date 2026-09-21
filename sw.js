
/* 由 vite 构建 sw-precache 插件生成——勿手改，每次构建整体重写。
   清单=7 项（当前 index.html 引用集 + shell + dist/img）。 */
const CACHE = "qp-static-20260921060058"
const SCOPE = self.registration.scope
const PRECACHE = ["assets/index-D64CG8PS.css","assets/index-DJQoTReo.js","favicon.svg","img/ill","img/p38-1.webp","img/p38-2.webp","index.html"]
const ASSET_RE = /\.(?:js|css|webp|svg|png|jpe?g|ico|woff2?)$/

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

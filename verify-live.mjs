// 线上 Pages 全量可用性校验：HEAD 检查所有文件是否 200，并 GET 校验关键文件内容哈希
// 用法: node verify-live.mjs <distDir>
import { readFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'

const dist = process.argv[2]
const BASE = 'https://hk00jjj.github.io/quiz-platform/'

function walk(dir, base, out) {
  for (const n of readdirSync(dir)) {
    const p = dir + '/' + n
    const rel = base ? base + '/' + n : n
    if (statSync(p).isDirectory()) walk(p, rel, out)
    else out.push({ rel, p })
  }
  return out
}

const files = walk(dist, '', [])
const bad = []
let ok = 0
const t0 = Date.now()

/* ⚠ 到 GitHub Pages CDN 的连接是间歇性的：undici 的 connect timeout 默认 10s，
   而下面各处的 AbortSignal.timeout() 管的是整体超时、管不到 connect 阶段，
   一次抖动就会让整轮验证报 UND_ERR_CONNECT_TIMEOUT 失败（实测发生过）。
   在这里包一层带指数退避的 fetch，所有调用点自动获得重试，不必逐个改。
   只重试网络层错误与 429/5xx；4xx 属业务错误，直接放行给调用方判断。
   本脚本全是只读请求，重放无副作用。 */
const _fetch = globalThis.fetch
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms))
globalThis.fetch = async (...a) => {
  for (let n = 1; n <= 5; n++) {
    const tail = String(a[0]).slice(-58)
    try {
      const r = await _fetch(...a)
      if ((r.status === 429 || r.status >= 500) && n < 5) {
        console.log(`  retry ${n}/4: HTTP ${r.status} ${tail}`)
        await _sleep(Math.min(1000 * 2 ** (n - 1), 15000) + Math.random() * 400); continue
      }
      return r
    } catch (e) {
      const tag = String(e?.cause?.code ?? '') + ' ' + String(e?.message ?? '')
      const isNet = e instanceof TypeError || /UND_ERR|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|fetch failed/i.test(tag)
      if (!isNet || n >= 5) throw e
      console.log(`  retry ${n}/4: ${String(e?.cause?.code ?? e.message).slice(0, 34)} ${tail}`)
      await _sleep(Math.min(1000 * 2 ** (n - 1), 15000) + Math.random() * 400)
    }
  }
}

async function head(rel) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(BASE + rel.split('/').map(encodeURIComponent).join('/'), {
        method: 'HEAD',
        signal: AbortSignal.timeout(30000)
      })
      if (r.ok) { ok++; return }
      if (attempt === 3) bad.push(`${rel} -> HTTP ${r.status}`)
      else await new Promise(s => setTimeout(s, 1200))
    } catch (e) {
      if (attempt === 3) bad.push(`${rel} -> ERR ${e.message}`)
      else await new Promise(s => setTimeout(s, 1200))
    }
  }
}

// 并发 8
const queue = [...files]
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) await head(queue.shift().rel)
}))

console.log(`线上文件检查: ${ok}/${files.length} 个 200 OK, 耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)
if (bad.length) { console.log('异常:'); bad.forEach(x => console.log('  ✗ ' + x)) }

// 关键文件内容比对（从 dist/index.html 自动提取带哈希的产物名，不写死）
const html = readFileSync(dist + '/index.html', 'utf8')
const hashed = [...new Set([...html.matchAll(/assets\/(index-[\w-]+\.(?:js|css))/g)].map(m => 'assets/' + m[1]))]
for (const rel of ['index.html', ...hashed]) {
  const local = readFileSync(dist + '/' + rel)
  const r = await fetch(BASE + rel + '?cb=' + Date.now(), { signal: AbortSignal.timeout(120000) })
  const buf = Buffer.from(await r.arrayBuffer())
  const h = b => createHash('sha256').update(b).digest('hex').slice(0, 16)
  console.log(`${rel}: HTTP ${r.status}, 本地 ${local.length}B/${h(local)} vs 线上 ${buf.length}B/${h(buf)} -> ${h(local) === h(buf) ? 'MATCH' : 'DIFF'}`)
}
console.log(bad.length === 0 ? '\nLIVE RESULT: ALL OK' : '\nLIVE RESULT: HAS FAILURES')

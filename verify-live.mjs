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

/* ── 部署收敛等待（D6 强化 2026-09-21 夜）──
   实测：gh-pages ref 已更新、远端树 127/127 一致（④ verify-deploy IDENTICAL），
   但 Pages 构建/传播期间线上仍是旧 index.html 且新 chunk 全 404，最长滞后数分钟。
   旧脚本对此直接报失败（或旧版干脆假装 ALL OK）——两种都不对。
   现在先轮询 index.html 的内容哈希与本 dist 对齐（每 15s 一次，最多 10 分钟），
   对齐后再做全量检查；未对齐则明确失败（而不是把传播延迟当成功）。 */
const _idx = readFileSync(dist + '/index.html')
const _h = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16)
const INDEX_WAIT_MS = Number(process.env.LIVE_WAIT_MS || 600000)
let converged = false
for (let waited = 0; waited <= INDEX_WAIT_MS; waited += 15000) {
  try {
    const r = await fetch(BASE + 'index.html?cb=' + Date.now(), { signal: AbortSignal.timeout(60000) })
    const buf = Buffer.from(await r.arrayBuffer())
    if (r.status === 200 && _h(buf) === _h(_idx)) { converged = true; console.log(`index.html 已收敛（等待 ${Math.round(waited / 1000)}s，${_h(_idx)}）`); break }
    console.log(`  等待 Pages 收敛… ${Math.round(waited / 1000)}s（线上 ${_h(buf)} ≠ 本地 ${_h(_idx)}）`)
  } catch (e) { console.log(`  等待 Pages 收敛… ${Math.round(waited / 1000)}s（${e.message}）`) }
  if (waited + 15000 > INDEX_WAIT_MS) break
  await new Promise((s) => setTimeout(s, 15000))
}
if (!converged) {
  console.error('\nLIVE RESULT: HAS FAILURES（线上 index.html 在等待窗口内未收敛——部署未生效或 Pages 严重延迟）')
  process.exit(1)
}

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
// 【D6 修复 2026-09-21】比对结果此前只打印、不参与判定——DIFF 也会输出 ALL OK。现在：
//   DIFF 先等 3s 重取一次（容忍 Pages 传播），仍 DIFF 计入 bad；取回失败也计入 bad。
const html = readFileSync(dist + '/index.html', 'utf8')
const hashed = [...new Set([...html.matchAll(/assets\/(index-[\w-]+\.(?:js|css))/g)].map(m => 'assets/' + m[1]))]
const h = b => createHash('sha256').update(b).digest('hex').slice(0, 16)
for (const rel of ['index.html', ...hashed]) {
  const local = readFileSync(dist + '/' + rel)
  let line = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(BASE + rel + '?cb=' + Date.now() + '-' + attempt, { signal: AbortSignal.timeout(120000) })
      const buf = Buffer.from(await r.arrayBuffer())
      const same = r.status === 200 && h(local) === h(buf)
      line = `${rel}: HTTP ${r.status}, 本地 ${local.length}B/${h(local)} vs 线上 ${buf.length}B/${h(buf)} -> ${same ? 'MATCH' : 'DIFF'}`
      if (same) break
      if (attempt === 1) { console.log(line + '（等 3s 复取，容忍传播延迟）'); await new Promise(s => setTimeout(s, 3000)); continue }
      bad.push(`${rel} 内容不一致（本地 vs 线上 SHA 不同）`)
    } catch (e) {
      line = `${rel}: 取回失败 ${e.message}`
      if (attempt === 1) { await new Promise(s => setTimeout(s, 3000)); continue }
      bad.push(`${rel} 取回失败 ${e.message}`)
    }
  }
  console.log(line)
}
/* 结论与退出码必须一致（此前只打印不设码，部署链据此误判成功并跳过重试） */
if (bad.length) {
  console.error(`\nLIVE RESULT: HAS FAILURES（${bad.length} 项）`)
  process.exit(1)
}
console.log('\nLIVE RESULT: ALL OK')
process.exit(0)

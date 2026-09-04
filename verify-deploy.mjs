// 校验 GitHub Pages(gh-pages) 上的文件与本地 dist 是否逐字节一致
// 用法: node verify-deploy.mjs <token> <distDir>
import { readFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'

const token = process.argv[2]
const dist = process.argv[3]
const repo = 'HK00jjj/quiz-platform'
const H = {
  Authorization: `token ${token}`,
  'User-Agent': 'qp-verify',
  Accept: 'application/vnd.github+json'
}

/* ⚠ 到 api.github.com 的连接是间歇性的（undici connect timeout 10s，外层 AbortSignal 管不到），
   一次抖动就会让整轮校验失败。包一层带指数退避的 fetch，所有调用点自动获得重试。
   只重试网络层错误与 429/5xx；4xx 属业务错误，直接放行给调用方判断。
   本脚本全是只读请求，重放无副作用。与 deploy-api.mjs / verify-live.mjs 里的是同一套。 */
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

async function req(path) {
  const r = await fetch('https://api.github.com' + path, { headers: H, signal: AbortSignal.timeout(120000) })
  const t = await r.text()
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${t.slice(0, 300)}`)
  return JSON.parse(t)
}

function walk(dir, base, out) {
  for (const n of readdirSync(dir)) {
    const p = dir + '/' + n
    const rel = base ? base + '/' + n : n
    if (statSync(p).isDirectory()) walk(p, rel, out)
    else out.push({ rel, p })
  }
  return out
}

function blobSha(buf) {
  const h = createHash('sha1')
  h.update(Buffer.from(`blob ${buf.length}\0`, 'binary'))
  h.update(buf)
  return h.digest('hex')
}

const local = walk(dist, '', [])
const localMap = new Map()
let localBytes = 0
for (const f of local) {
  const buf = readFileSync(f.p)
  localBytes += buf.length
  localMap.set(f.rel, { sha: blobSha(buf), size: buf.length })
}

const tree = await req(`/repos/${repo}/git/trees/gh-pages?recursive=1`)
const remote = new Map()
for (const e of tree.tree) if (e.type === 'blob') remote.set(e.path, { sha: e.sha, size: e.size })

const missing = [], differ = [], extra = []
for (const [rel, v] of localMap) {
  const r = remote.get(rel)
  if (!r) missing.push(rel)
  else if (r.sha !== v.sha) differ.push(`${rel} (local ${v.size}B / remote ${r.size}B)`)
}
for (const rel of remote.keys()) if (!localMap.has(rel)) extra.push(rel)

console.log(`本地 dist: ${localMap.size} 个文件, ${(localBytes / 1048576).toFixed(1)} MB`)
console.log(`远端 gh-pages: ${remote.size} 个文件${tree.truncated ? '  [TRUNCATED!]' : ''}`)
console.log(`缺失(远端没有): ${missing.length}`)
missing.slice(0, 40).forEach(x => console.log('  - ' + x))
console.log(`内容不一致: ${differ.length}`)
differ.slice(0, 40).forEach(x => console.log('  ! ' + x))
console.log(`远端多余: ${extra.length}`)
extra.slice(0, 40).forEach(x => console.log('  + ' + x))

const commits = await req(`/repos/${repo}/commits?sha=gh-pages&per_page=5`)
console.log('\n最近提交:')
for (const c of commits) console.log(`  ${c.sha.slice(0, 7)}  ${c.commit.author.date}  ${c.commit.message.split('\n')[0]}`)

console.log(missing.length === 0 && differ.length === 0 ? '\nRESULT: IDENTICAL' : '\nRESULT: MISMATCH')

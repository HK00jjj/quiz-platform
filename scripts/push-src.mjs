// 用 GitHub Git Data API 把源码工程推送为独立分支 src（不依赖 git 直连，支持断点续传）
// 用法: node push-src.mjs <token> <appDir> <toolsDir> <readmePath> [额外文件...]
// 额外文件按文件名放到分支根（用来备份工作区根目录的 verify-*.mjs、HANDOFF.md 等）
import { readFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'

const [, , token, appDir, toolsDir, readmePath, ...extras] = process.argv
const repo = 'HK00jjj/quiz-platform'
const BRANCH = 'src'
const H = {
  Authorization: `token ${token}`,
  'User-Agent': 'qp-src-backup',
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json'
}

async function req(method, path, body, tries = 4) {
  let lastErr
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch('https://api.github.com' + path, {
        method, headers: H,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(300000)
      })
      const t = await r.text()
      if (r.ok) return t ? JSON.parse(t) : null
      // 4xx 除 409/422 外不重试
      if (r.status < 500 && r.status !== 409 && r.status !== 422) throw new Error(`${method} ${path} -> ${r.status}: ${t.slice(0, 200)}`)
      lastErr = new Error(`${method} ${path} -> ${r.status}: ${t.slice(0, 200)}`)
    } catch (e) { lastErr = e }
    if (i < tries) { console.log(`  [retry ${i}] ${lastErr.message}`); await new Promise(s => setTimeout(s, 3000 * i)) }
  }
  throw lastErr
}

function walk(dir, base, out) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n === '.git') continue
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

// ---------- 1. 组装待推送清单 ----------
const files = walk(appDir, '', [])
// 整个 scripts/ 目录都备份。原来这里是一份 8 个文件的硬编码白名单，
// 导致 pull-src.mjs / purge-dist.mjs / candy-copy.mjs / 素材脚本从未进过 src 分支，
// 而它们正是断点续传与回滚时最需要的工具。
walk(toolsDir, 'scripts', files)
files.push({ rel: 'README.md', p: readmePath })
// 额外文件（仓库根目录的 verify-*.mjs、HANDOFF.md 等）：按文件名放到分支根
for (const e of extras) {
  try { if (statSync(e).isFile()) files.push({ rel: e.split(/[\\/]/).pop(), p: e }) }
  catch { console.log(`  [skip] 额外文件不存在: ${e}`) }
}
// 把本脚本自己也备份进分支，下次续传无需重写（rel 重复时下面的 Map 会自然去重）
files.push({ rel: 'scripts/push-src.mjs', p: process.argv[1] })

const local = new Map()
let totalBytes = 0
for (const f of files) {
  const buf = readFileSync(f.p)
  totalBytes += buf.length
  local.set(f.rel, { sha: blobSha(buf), size: buf.length, buf })
}
console.log(`待推送: ${local.size} 个文件, ${(totalBytes / 1048576).toFixed(2)} MB`)

// ---------- 2. 分支是否已存在（续传用） ----------
let parentSha = null
const remote = new Map()
try {
  const ref = await req('GET', `/repos/${repo}/git/ref/heads/${BRANCH}`)
  parentSha = ref.object.sha
  const tree = await req('GET', `/repos/${repo}/git/trees/${BRANCH}?recursive=1`)
  for (const e of tree.tree) if (e.type === 'blob') remote.set(e.path, e.sha)
  console.log(`分支 ${BRANCH} 已存在 (${parentSha.slice(0, 7)})，远端 ${remote.size} 个文件，进入续传模式`)
} catch {
  console.log(`分支 ${BRANCH} 不存在，将创建孤儿分支（独立历史，不继承 gh-pages 的大体积构建产物）`)
}

// ---------- 3. 上传缺失的 blob ----------
const todo = []
for (const [rel, v] of local) if (remote.get(rel) !== v.sha) todo.push(rel)
console.log(`需上传 blob: ${todo.length} 个（已存在且一致: ${local.size - todo.length} 个）`)

let done = 0
const queue = [...todo]
const t0 = Date.now()
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const rel = queue.shift()
    const v = local.get(rel)
    const blob = await req('POST', `/repos/${repo}/git/blobs`, { content: v.buf.toString('base64'), encoding: 'base64' })
    if (blob.sha !== v.sha) throw new Error(`blob sha 不一致: ${rel}`)
    v.uploaded = blob.sha
    if (++done % 10 === 0 || done === todo.length) {
      console.log(`  blobs ${done}/${todo.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }
}))

// ---------- 4. 建 tree / commit / ref ----------
const treeBody = [...local.entries()].map(([rel, v]) => ({ path: rel, mode: '100644', type: 'blob', sha: v.sha }))
const newTree = await req('POST', `/repos/${repo}/git/trees`, { tree: treeBody })
console.log('new tree:', newTree.sha)

const now = new Date().toISOString()
const commit = await req('POST', `/repos/${repo}/git/commits`, {
  message: 'chore: 备份完整源码工程到 src 分支（React 18 + Vite 5 塔罗主题「奥术典籍馆」）',
  tree: newTree.sha,
  parents: parentSha ? [parentSha] : [],
  author: { name: 'HK00jjj', email: 'hk00jjj@users.noreply.github.com', date: now },
  committer: { name: 'HK00jjj', email: 'hk00jjj@users.noreply.github.com', date: now }
})
console.log('new commit:', commit.sha)

if (parentSha) await req('PATCH', `/repos/${repo}/git/refs/heads/${BRANCH}`, { sha: commit.sha })
else await req('POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha })

// ---------- 5. 回读校验 ----------
const check = await req('GET', `/repos/${repo}/git/trees/${BRANCH}?recursive=1`)
const rmap = new Map()
for (const e of check.tree) if (e.type === 'blob') rmap.set(e.path, e.sha)
const miss = [], diff = [], extra = []
for (const [rel, v] of local) {
  if (!rmap.has(rel)) miss.push(rel)
  else if (rmap.get(rel) !== v.sha) diff.push(rel)
}
for (const rel of rmap.keys()) if (!local.has(rel)) extra.push(rel)
console.log(`\n回读校验: 本地 ${local.size} / 远端 ${rmap.size}，缺失 ${miss.length}，不一致 ${diff.length}，多余 ${extra.length}`)
;[...miss, ...diff, ...extra].slice(0, 20).forEach(x => console.log('  ✗ ' + x))
console.log(`分支地址: https://github.com/HK00jjj/quiz-platform/tree/${BRANCH}`)
console.log(miss.length === 0 && diff.length === 0 && extra.length === 0 ? 'RESULT: SRC BACKUP OK' : 'RESULT: SRC BACKUP MISMATCH')

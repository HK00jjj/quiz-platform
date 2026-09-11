// 用 GitHub Git Data API 把源码工程推送为独立分支 src（不依赖 git 直连，支持断点续传）
// 用法: node push-src.mjs <token> <appDir> <toolsDir> <readmePath>
import { readFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'

const [, , token, appDir, toolsDir, readmePath] = process.argv
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
    // 2026-09-11 修：原先「4xx 不重试」的 throw 写在 try 内，被自己的 catch 吞掉，
    // 结果 404 这类确定性错误也白跑 3 轮退避重试，还把真实错误淹在 [retry] 噪音里。
    // 改为先记录 fatal，出 try 后再抛。
    let fatal = null
    try {
      const r = await fetch('https://api.github.com' + path, {
        method, headers: H,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(300000)
      })
      const t = await r.text()
      if (r.ok) return t ? JSON.parse(t) : null
      const e = new Error(`${method} ${path} -> ${r.status}: ${t.slice(0, 200)}`)
      // 4xx 除 409/422 外不重试（网络层抖动才值重试）
      if (r.status < 500 && r.status !== 409 && r.status !== 422) fatal = e
      lastErr = e
    } catch (e) { lastErr = e }
    if (fatal) throw fatal
    if (i < tries) { console.log(`  [retry ${i}] ${lastErr.message}`); await new Promise(s => setTimeout(s, 3000 * i)) }
  }
  throw lastErr
}

/* 备份排除清单（2026-09-11 审查整改新增）——三条各自有硬理由，别随手删：
   ① .env / .env.*：凭据文件。本仓库 public，一旦进备份即等于公开（红线：
      「token 不落盘不进任何会被 push 的文件」）。本地 .env 存 E2E 测试账号口令。
   ② *.timestamp-*.mjs：Vite 配置加载时吐的临时产物（vite.config.js.timestamp-*.mjs），
      一次性、无价值，历史备份里混进过两份。
   ③ .github/workflows/**：GitHub 要求 token 具备 workflow scope 才可写该路径。
      本 token 仅 repo scope，命中即整批 404（实测：单条 .github/workflows/ci.yml
      即失败，删掉它其余 69 条全过）。若要备份 CI 配置，需给 PAT 补 workflow scope。
      例外：设 QP_SRC_INCLUDE_CI=1 可强制纳入（给已补 scope 的 token 用），
      此时若仍 404 则由下方第 4 步的降级层自动剔除并警告。 */
const SKIP_RE = [
  /^\.env(\.|$)/,
  /\.timestamp-\d+[^/]*\.mjs$/,
  ...(process.env.QP_SRC_INCLUDE_CI ? [] : [/^\.github\/workflows\//])
]
const skipped = []

function walk(dir, base, out) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n === '.git') continue
    const rel = base ? base + '/' + n : n
    if (SKIP_RE.some((re) => re.test(rel))) { skipped.push(rel); continue }
    const p = dir + '/' + n
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
for (const t of ['deploy-api.mjs', 'deploy-ghpages.ps1', 'compress-sharp.mjs', 'compress-assets.ps1']) {
  const p = toolsDir + '/' + t
  if (statSync(p).isFile()) files.push({ rel: 'scripts/' + t, p })
}
files.push({ rel: 'README.md', p: readmePath })
// 把本脚本自己也备份进分支，下次续传无需重写
files.push({ rel: 'scripts/push-src.mjs', p: process.argv[1] })

const local = new Map()
let totalBytes = 0
for (const f of files) {
  const buf = readFileSync(f.p)
  totalBytes += buf.length
  local.set(f.rel, { sha: blobSha(buf), size: buf.length, buf })
}
console.log(`待推送: ${local.size} 个文件, ${(totalBytes / 1048576).toFixed(2)} MB`)
if (skipped.length) {
  console.log(`已排除 ${skipped.length} 个（见 SKIP_RE 注释，绝不进备份）:`)
  skipped.forEach((s) => console.log('  - ' + s))
}

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
const buildTreeBody = () => [...local.entries()].map(([rel, v]) => ({ path: rel, mode: '100644', type: 'blob', sha: v.sha }))
let newTree
try {
  newTree = await req('POST', `/repos/${repo}/git/trees`, { tree: buildTreeBody() })
} catch (e) {
  /* 降级层（2026-09-11 补实装；此前 SKILL.md 已声称具备、实际没有——本函数即补上）：
     GitHub 要求 token 具备 workflow scope 才可写 .github/workflows/*。缺该 scope 时
     表现为 POST /git/trees 返回 **404**（blob 却能正常上传，故极难排查，本次实测踩到）。
     把 .github/** 整体剔除后重试一次，并明示警告。回读校验以同一个 local 集合为基准，
     所以这里 delete 之后仍能判 SRC OK，不会出现"本地有、远端无"的假 MISMATCH。 */
  if (!/-> 404\b/.test(String(e.message)) || local.size === 0) throw e
  const drop = [...local.keys()].filter((rel) => rel.startsWith('.github/'))
  if (drop.length === 0) throw e
  console.warn('⚠ POST /git/trees -> 404：按降级策略剔除 .github/** 后重试（token 缺 workflow scope）')
  drop.forEach((rel) => { console.warn('  - ' + rel); local.delete(rel) })
  newTree = await req('POST', `/repos/${repo}/git/trees`, { tree: buildTreeBody() })
}
console.log('new tree:', newTree.sha)

const now = new Date().toISOString()
const commit = await req('POST', `/repos/${repo}/git/commits`, {
  message: 'chore: 备份完整源码工程到 src 分支（React 18 + Vite 5 糖果主题「糖果题库」）',
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

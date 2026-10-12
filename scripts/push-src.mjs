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

async function req(method, path, body, tries = 10) {
  /* 2026-10-02（INC-20261002-01）：代理不稳期 5xx（Server Error）4 连试耗尽实测，4→10 连试；
     Git Data API 各调用幂等（内容寻址 blob / 同 body 同 commit sha / ref PATCH 幂等），重放安全。 */
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

/* SKIP_RE（2026-10-06 复原，INC-20261006-02）：09-11 版曾实装、后在某次改写中丢失
   （skill §3.6 "文档与代码对不上"警告的再次实锤）——app/.env（含密钥）一直被重复
   备份进公开仓库 src 分支。默认排除 .env*、*.timestamp-*.mjs、.github/workflows/**
   （QP_SRC_INCLUDE_CI=1 时尝试纳入 CI，404/422 由下方动态降级兜底）。
   被跳过且远端存在的路径会作为 sha:null 删除条目发出——即备份同时把它们清出
   分支 HEAD（.env 由此从 HEAD 移除；历史 blob 仍需重建历史+轮换密钥才能根治）。 */
const INCLUDE_CI = process.env.QP_SRC_INCLUDE_CI === '1'
const isSkipped = (rel) =>
  /(^|\/)\.env(\.|$)/.test(rel) ||
  /\.timestamp-[^/]*\.mjs$/.test(rel) ||
  (!INCLUDE_CI && /^\.github\/workflows\//.test(rel))
const local = new Map()
let totalBytes = 0
const skipped = []
for (const f of files) {
  if (isSkipped(f.rel)) { skipped.push(f.rel); continue }
  const buf = readFileSync(f.p)
  totalBytes += buf.length
  local.set(f.rel, { sha: blobSha(buf), size: buf.length, buf })
}
if (skipped.length) console.log(`SKIP_RE 跳过 ${skipped.length} 个: ${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? ' …' : ''}`)
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
/* 降级（2026-09-09）：classic PAT 只有 repo scope 时，写 .github/workflows/* 会被
   GitHub 以 404 掩盖（blob 能传、树里含该路径必 404）。此处 404 后自动剔除 .github/**
   重试一次，保证其余源码备份不中断；CI 文件等 token 补上 workflow scope 后重跑即可。 */
/* base_tree 差量建树（2026-10-06，INC-20261006-01）：全量树 POST（~1350 条）实测
   404（scope 掩盖）与 504/502（服务端超时）交替出现，10 连试打穿即崩（当日两轮均败）。
   改为 deploy-api.mjs 同款 base_tree 模式：只发「相对远端 HEAD 的变更条目 + 删除条目
   （sha:null）」，请求体从 1359 条缩到本轮 22 条；未提及的路径经 base_tree 继承，
   与全量树语义等价（含删除语义）。无 base（新建分支）时回退全量，老行为保留。 */
let baseTreeSha = null
const diffEntries = []
if (parentSha && remote.size) {
  const head = await req('GET', `/repos/${repo}/git/commits/${parentSha}`)
  baseTreeSha = head.tree.sha
  for (const [rel, v] of local) if (remote.get(rel) !== v.sha) diffEntries.push({ path: rel, mode: '100644', type: 'blob', sha: v.sha })
  for (const rel of remote.keys()) if (!local.has(rel)) diffEntries.push({ path: rel, mode: '100644', type: 'blob', sha: null })
  const adds = diffEntries.filter((x) => x.sha).length
  console.log(`base_tree 差量建树：base=${baseTreeSha.slice(0, 10)}，变更 ${adds} 条 + 删除 ${diffEntries.length - adds} 条`)
}
const treeBody = baseTreeSha
  ? diffEntries
  : [...local.entries()].map(([rel, v]) => ({ path: rel, mode: '100644', type: 'blob', sha: v.sha }))
let newTree
try {
  /* 2026-10-06 关键修复：差量条目必须携带 base_tree——sha:null 删除项不带 base_tree
     发送 = 确定性 422 GitRPC::BadObjectState（当日 run3/4/5 三连败的真正根因，
     探针带 base_tree 全 201 已对照实锤）。全量模式（新分支）不需要。 */
  newTree = await req('POST', `/repos/${repo}/git/trees`, baseTreeSha ? { base_tree: baseTreeSha, tree: treeBody } : { tree: treeBody })
} catch (e) {
  /* 2026-10-06（INC-20261006-01）：实测 GitHub 对含 .github/workflows 条目的树请求，
     报错会在 404（scope 掩盖）与 422 GitRPC::BadObjectState / 5xx 之间翻转——
     req() 打穿后抛的「末错误」未必是 404，旧正则只认 404 导致降级永不触发。
     现把 422 一并纳入降级判定（剔 .github 重试一次）；剔除后仍失败则如实抛出。 */
  if (!/git\/trees -> (404|422)/.test(String(e?.message ?? e))) throw e
  const kept = treeBody.filter((x) => !x.path.startsWith('.github/'))
  const skipped = treeBody.length - kept.length
  if (kept.length === treeBody.length) throw e
  console.log(`⚠ 建 tree 404/422（token 缺 workflow scope），剔除 ${skipped} 个 .github/ 条目后重试`)
  /* 2026-10-06 修复：降级重试必须保持与主请求同构——差量模式带 base_tree
     （否则「只含 kept 条目的树」会被当完整树提交，src 分支被截断）；全量模式照旧。 */
  newTree = await req('POST', `/repos/${repo}/git/trees`, baseTreeSha ? { base_tree: baseTreeSha, tree: kept } : { tree: kept })
}
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
/* 降级模式下 .github/** 本就不在远端：校验时同样剔除，避免永远 MISMATCH；
   2026-10-06 增补：SKIP_RE 排除路径（.env* 等）若因降级剔除而残留远端 HEAD，
   计入 tolerated 并明示（不静默、也不误报 MISMATCH）。 */
const degraded = newTree.sha !== null && [...local.keys()].some((k) => k.startsWith('.github/')) && ![...rmap.keys()].some((k) => k.startsWith('.github/'))
const want = degraded ? [...local.keys()].filter((k) => !k.startsWith('.github/')) : [...local.keys()]
const miss = [], diff = [], extra = [], tolerated = []
for (const rel of want) {
  if (!rmap.has(rel)) miss.push(rel)
  else if (rmap.get(rel) !== local.get(rel).sha) diff.push(rel)
}
for (const rel of rmap.keys()) {
  if (local.has(rel)) continue
  if (isSkipped(rel) || (degraded && rel.startsWith('.github/'))) { tolerated.push(rel); continue }
  extra.push(rel)
}
if (tolerated.length) console.log(`⚠ 远端残留但不在备份范围（SKIP_RE/降级剔除）: ${tolerated.slice(0, 8).join(', ')}${tolerated.length > 8 ? ' …' : ''}`)
if (degraded) console.log('⚠ 本轮为降级备份：.github/** 未推送（token 缺 workflow scope），补 scope 后重跑 push-src 即可补齐')
console.log(`\n回读校验: 本地 ${local.size} / 远端 ${rmap.size}，缺失 ${miss.length}，不一致 ${diff.length}，多余 ${extra.length}`)
;[...miss, ...diff, ...extra].slice(0, 20).forEach(x => console.log('  ✗ ' + x))
console.log(`分支地址: https://github.com/HK00jjj/quiz-platform/tree/${BRANCH}`)
console.log(miss.length === 0 && diff.length === 0 && extra.length === 0 ? 'RESULT: SRC BACKUP OK' : 'RESULT: SRC BACKUP MISMATCH')

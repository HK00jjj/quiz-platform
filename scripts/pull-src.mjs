// 从 src 分支的某个提交把源码拉回本地工作区（回滚用）。
// 只覆写、不删除：避免误删本地文件；不在树里的本地文件（如 apple.css）会留成孤儿，
// 但因为 main.jsx 已被覆写成 import candy.css，孤儿文件不会进产物。
// 跳过 app/public/img/（本轮从未改动过位图，逐个拉纯属浪费时间）。
// 用法: node scripts/pull-src.mjs <token> <commitSha> [路径过滤正则]
// 第三个参数可选，用来只恢复被编辑器陈旧缓冲区污染的几个文件，不冲掉其他在飞的改动
// 例: node scripts/pull-src.mjs <token> <sha> "^src/(components|main)\\.jsx$"
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const [, , TOKEN, SHA, FILTER] = process.argv
const ONLY = FILTER ? new RegExp(FILTER) : null
if (!TOKEN || !SHA) { console.log('用法: node scripts/pull-src.mjs <token> <commitSha>'); process.exit(1) }
const ROOT = process.cwd()
const API = 'https://api.github.com/repos/HK00jjj/quiz-platform'
const H = { Authorization: `token ${TOKEN}`, 'User-Agent': 'pull-src', Accept: 'application/vnd.github+json' }
// 仓库里的路径没有 app/ 前缀（push-src 已把它映射到根），所以跳过位图要用 public/img/
const SKIP = /^(app\/)?public\/img\//

async function get(url) {
  // 拉 100+ 个 blob 时连接会被对端偶发断开（已实测 UND_ERR_SOCKET），必须重试
  let last
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: H })
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
      return await r.json()
    } catch (e) {
      last = e
      await new Promise(s => setTimeout(s, 1200 * (i + 1)))
    }
  }
  throw last
}

const commit = await get(`${API}/git/commits/${SHA}`)
const tree = await get(`${API}/git/trees/${commit.tree.sha}?recursive=1`)
if (tree.truncated) { console.log('RESULT: ABORT —— 树被截断（文件过多），拒绝半量恢复'); process.exit(1) }

const blobs = tree.tree.filter(e => e.type === 'blob' && !SKIP.test(e.path) && (!ONLY || ONLY.test(e.path)))
console.log(`提交 ${SHA.slice(0, 7)}（${commit.author?.date ?? '?'}）共 ${tree.tree.length} 个 blob，需拉回 ${blobs.length} 个`)

let n = 0, bytes = 0, skipped = 0
for (const e of blobs) {
  // push-src 的映射是：本地 app/<x> → 仓库 <x>；scripts/ 与 README.md 原位。
  // 拉回时必须还原这层，否则会把 app/src 写到工作区根的 src/ 下（已实测踩过）
  const rel = e.path === 'README.md' ? 'src-branch-README.md'
    : e.path.startsWith('scripts/') ? e.path
    : 'app/' + e.path
  const dest = path.resolve(ROOT, rel)
  if (!dest.startsWith(ROOT)) { skipped++; continue }          // 防目录穿越
  const blob = await get(`${API}/git/blobs/${e.sha}`)
  const buf = Buffer.from(blob.content, 'base64')
  mkdirSync(path.dirname(dest), { recursive: true })
  writeFileSync(dest, buf)
  n++; bytes += buf.length
}
console.log(`写回 ${n} 个文件 / ${(bytes / 1024 / 1024).toFixed(2)} MB（路径异常跳过 ${skipped}）`)
console.log(`RESULT: PULL OK <- ${SHA.slice(0, 7)}`)

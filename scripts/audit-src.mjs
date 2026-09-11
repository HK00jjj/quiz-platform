/* 审计：本地 app/** 与 scripts/** 逐文件比对 src 分支的权威备份（git blob SHA1）。
   用途：揪出被编辑器陈旧缓冲区回写成苹果版/哥特版的文件（HANDOFF §3.2 那类污染）。
   用法：node audit-src.mjs <TOKEN>     —— token 只走 argv，不落盘（§1 硬规矩）。
   路径映射按 §6：push-src 把 app/<x> 映射到仓库根，README 与根级 extras 另有其名。 */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [, , token] = process.argv
if (!token) { console.log('用法: node audit-src.mjs <TOKEN>'); process.exit(2) }

const REPO = 'HK00jjj/quiz-platform'
const ROOT = 'C:/Users/青丘白浅/Documents/QoderCN/2026-09-02/chat-1'
/* 根级 extras：push-src 把它们从工作区根直接推到仓库根，不在 app/ 下。
   没列进来的会被归到 app/<name> 而误报「本地缺失」。 */
const EXTRAS = ['HANDOFF.md', 'verify-deploy.mjs', 'verify-live.mjs', 'verify-books.ps1', 'verify-candy.ps1', 'verify-fill.ps1']

const H = { Authorization: `token ${token}`, 'User-Agent': 'audit-src', Accept: 'application/vnd.github+json' }
async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: H })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (e) { if (i === 3) throw e; await new Promise((r) => setTimeout(r, 900 * (i + 1))) }
  }
}
/* git blob SHA1 = sha1("blob <len>\0" + 内容)，与 GitHub 树里的 sha 同口径 */
function blobSha(buf) {
  const h = createHash('sha1')
  h.update(Buffer.from(`blob ${buf.length}\0`, 'ascii'))
  h.update(buf)
  return h.digest('hex')
}
function localOf(p) {
  if (p === 'README.md') return join(ROOT, 'src-branch-README.md')
  if (EXTRAS.includes(p)) return join(ROOT, p)
  if (p.startsWith('scripts/')) return join(ROOT, p)
  return join(ROOT, 'app', p)
}

const ref = await get(`https://api.github.com/repos/${REPO}/git/refs/heads/src`)
const tree = await get(`https://api.github.com/repos/${REPO}/git/trees/${ref.object.sha}?recursive=1`)
if (tree.truncated) console.log('⚠ 树被截断，结果不完整')

let same = 0
const diff = [], missing = []
for (const e of tree.tree) {
  if (e.type !== 'blob') continue
  const lp = localOf(e.path)
  if (!existsSync(lp)) { missing.push(e.path); continue }
  const buf = readFileSync(lp)
  if (blobSha(buf) === e.sha) same++
  else diff.push(`${e.path}  local=${buf.length}B remote=${e.size}B`)
}
console.log(`src HEAD: ${ref.object.sha}`)
console.log(`一致 ${same} / 不一致 ${diff.length} / 本地缺失 ${missing.length}`)
if (diff.length) { console.log('--- 不一致 ---'); diff.forEach((d) => console.log('  ' + d)) }
if (missing.length) { console.log('--- 本地缺失 ---'); missing.forEach((d) => console.log('  ' + d)) }

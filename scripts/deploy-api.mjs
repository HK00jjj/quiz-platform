// GitHub Git Data API 部署：dist → gh-pages（无需 git 直连）
// 用法: node deploy-api.mjs <token> <dist目录> [提交信息]
import { readFileSync, readdirSync, statSync } from 'fs'

const COMMIT_MSG = process.argv[4] || 'chore: 部署构建产物'

const token = process.argv[2]
const repo = 'HK00jjj/quiz-platform'
const H = { Authorization: `token ${token}`, 'User-Agent': 'qp-deploy', 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }
const api = 'https://api.github.com'

async function req(method, path, body, timeoutMs = 300000) {
  const r = await fetch(api + path, {
    method, headers: H,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
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

const dist = process.argv[3] || 'c:/Users/' + decodeURI('%E9%9D%92%E4%B8%98%E7%99%BD%E6%B5%85') + '/Documents/QoderCN/2026-08-28/chat-2/app/dist'
const files = walk(dist, '', [])
console.log('files to upload:', files.length)

const ref = await req('GET', `/repos/${repo}/git/ref/heads/gh-pages`)
const parentSha = ref.object.sha
console.log('parent commit:', parentSha)

const tree = []
let i = 0
for (const f of files) {
  const b64 = readFileSync(f.p).toString('base64')
  const blob = await req('POST', `/repos/${repo}/git/blobs`, { content: b64, encoding: 'base64' })
  tree.push({ path: f.rel, mode: '100644', type: 'blob', sha: blob.sha })
  if (++i % 10 === 0) console.log('blobs:', i, '/', files.length)
}

const newTree = await req('POST', `/repos/${repo}/git/trees`, { tree })
console.log('new tree:', newTree.sha)

const commit = await req('POST', `/repos/${repo}/git/commits`, {
  message: COMMIT_MSG,
  tree: newTree.sha,
  parents: [parentSha],
  author: { name: 'HK00jjj', email: 'hk00jjj@users.noreply.github.com', date: new Date().toISOString() },
  committer: { name: 'HK00jjj', email: 'hk00jjj@users.noreply.github.com', date: new Date().toISOString() }
})
console.log('new commit:', commit.sha)

await req('PATCH', `/repos/${repo}/git/refs/heads/gh-pages`, { sha: commit.sha })
console.log('API DEPLOY DONE')

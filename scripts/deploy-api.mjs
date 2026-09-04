// GitHub Git Data API 部署：dist → gh-pages（无需 git 直连）
// 用法: node deploy-api.mjs <token> <dist目录> [提交信息]
import { readFileSync, readdirSync, statSync } from 'fs'

const COMMIT_MSG = process.argv[4] || 'chore: 部署构建产物'

const token = process.argv[2]
const repo = 'HK00jjj/quiz-platform'
const H = { Authorization: `token ${token}`, 'User-Agent': 'qp-deploy', 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }
const api = 'https://api.github.com'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const backoff = (n) => Math.min(1000 * 2 ** (n - 1), 15000) + Math.floor(Math.random() * 400)
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

/* ⚠ 到 api.github.com 的连接是间歇性的：undici 的 connect timeout 默认 10s，
   而下面 AbortSignal.timeout(300000) 管的是整体超时、管不到 connect 阶段，
   于是会在任意一次请求上抛 TypeError: fetch failed / UND_ERR_CONNECT_TIMEOUT 把整轮部署打断。
   实测过：45 个 blob 与 tree 全部建好了，偏偏最后创建 commit 那一次超时，
   前面五分钟的上传全白费。这里对「网络层错误 + 5xx + 429」做指数退避重试。

   四种调用都可以安全重放：
   - POST /git/blobs 与 /git/trees 是内容寻址的，同内容得同 sha
   - POST /git/commits 的 author/committer date 在调用前就已求值固定，
     同 body 必然得到同一个 commit sha（commit sha 就是其内容的哈希）
   - PATCH /git/refs 设成同一个 sha 幂等
   HTTP 4xx（除 429）属于业务错误，不重试、直接抛。 */
async function req(method, path, body, timeoutMs = 300000, tries = 5) {
  for (let n = 1; n <= tries; n++) {
    try {
      const r = await fetch(api + path, {
        method, headers: H,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs)
      })
      const text = await r.text()
      if (!r.ok) {
        if (RETRYABLE_STATUS.has(r.status) && n < tries) {
          console.log(`  retry ${n}/${tries - 1}: ${method} ${path} -> HTTP ${r.status}`)
          await sleep(backoff(n))
          continue
        }
        throw new Error(`${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`)
      }
      return text ? JSON.parse(text) : null
    } catch (e) {
      const code = String(e?.cause?.code ?? '')
      const msg = String(e?.message ?? '')
      const isNet = e instanceof TypeError ||
        /UND_ERR|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|fetch failed/i.test(code + ' ' + msg)
      if (!isNet || n >= tries) throw e
      console.log(`  retry ${n}/${tries - 1}: ${method} ${path} -> ${code || msg.slice(0, 60)}`)
      await sleep(backoff(n))
    }
  }
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

const dist = process.argv[3]
if (!dist) { console.error('用法: node deploy-api.mjs <token> <dist目录> [提交信息]'); process.exit(1) }
/* §33：原来的兜底默认值指向早已不存在的 2026-08-28/chat-2 旧工作区，纯误导；改为显式报错。 */
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

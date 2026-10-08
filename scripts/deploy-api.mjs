// GitHub Git Data API 部署：dist → gh-pages（无需 git 直连）
// 用法: node deploy-api.mjs <token> <dist目录> [提交信息]
import { readFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'

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
async function req(method, path, body, timeoutMs = 300000, tries = 10) {
  /* 2026-10-02（INC-20261002-01）：沙箱代理对新建 TLS 隧道约 50% RST，5 连试在 ~400 blob 级
     上传中仍会随机耗尽（KPE03 攒批部署实测树请求 5 败后崩）→ 10 连试；单请求成功率
     87.5%→99.9%。四个调用全部内容寻址幂等，重放安全（见上方注释）。 */
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

/* 2026-10-05（当日 GitHub 建树接口间歇 422 timeout，重试成本高）：本地预计算 git blob sha1
   （sha1("blob " + len + "\\0" + content)），与父树的 path→sha 比对，**内容未变化的文件直接
   跳过上传**——重试/攒批场景下 1273 个文件往往只有十几个真变化，重试从 ~25 分钟降到 ~2 分钟。
   父树缺失/truncated 时退回全量上传（安全兜底）。 */
let parentTreeMap = null
try {
  const pt = await req('GET', `/repos/${repo}/git/trees/${(await req('GET', `/repos/${repo}/git/commits/${parentSha}`)).tree.sha}?recursive=1`)
  if (pt && !pt.truncated) {
    parentTreeMap = new Map(pt.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]))
    console.log('parent tree entries:', parentTreeMap.size)
  } else console.log('parent tree truncated/missing → 全量上传')
} catch (e) { console.log('parent tree 获取失败 → 全量上传:', String(e.message).slice(0, 80)) }

const gitBlobSha = (p) => {
  const buf = readFileSync(p)
  return createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex')
}
const changed = parentTreeMap
  ? files.filter((f) => parentTreeMap.get(f.rel) !== gitBlobSha(f.p))
  : files
console.log('changed files:', changed.length, '/', files.length, '（其余内容未变化，跳过上传）')

const tree = []
let i = 0
for (const f of changed) {
  const b64 = readFileSync(f.p).toString('base64')
  const blob = await req('POST', `/repos/${repo}/git/blobs`, { content: b64, encoding: 'base64' })
  tree.push({ path: f.rel, mode: '100644', type: 'blob', sha: blob.sha })
  if (++i % 10 === 0) console.log('blobs:', i, '/', changed.length)
}

/* 2026-10-02（KPE03 攒批部署实测）：dist 增至 1145 文件（231 张 KPE03 图资产 + 历史图库 +
   orphan 保留窗口），单次 trees POST 触发 GitHub 422「request timed out / input too large」。
   按 GitHub 官方建议改增量建树：base_tree 分批链式构建（每批 ~250 条，新树继承 base 全部
   条目并叠加本批），链尾树即完整树——最终仍只产生一个 commit，PATCH ref 幂等不变。 */
const parentCommit = await req('GET', `/repos/${repo}/git/commits/${parentSha}`)
const BATCH = 250
let baseTree = parentCommit.tree.sha
const totalBatches = Math.ceil(tree.length / BATCH)
for (let s = 0; s < tree.length; s += BATCH) {
  const batch = tree.slice(s, s + BATCH)
  const t = await req('POST', `/repos/${repo}/git/trees`, { base_tree: baseTree, tree: batch })
  baseTree = t.sha
  console.log(`trees: batch ${Math.floor(s / BATCH) + 1}/${totalBatches} -> ${t.sha.slice(0, 10)} (${batch.length} entries)`)
}
const newTree = { sha: baseTree }
console.log('new tree:', newTree.sha)

const makeCommit = (treeSha, parent) => req('POST', `/repos/${repo}/git/commits`, {
  message: COMMIT_MSG,
  tree: treeSha,
  parents: [parent],
  author: { name: 'HK00jjj', email: 'hk00jjj@users.noreply.github.com', date: new Date().toISOString() },
  committer: { name: 'HK00jjj', email: 'hk00jjj@users.noreply.github.com', date: new Date().toISOString() }
})
let commit = await makeCommit(newTree.sha, parentSha)
console.log('new commit:', commit.sha)

/* 2026-10-05（INC-20261005-02 固化 · 社区最佳实践佐证）：长部署链（blob 上传可达 30 分钟）
   期间 gh-pages 可能被并发会话推进，PATCH refs 报 422「Update is not a fast forward」/409。
   处置=绝不 force push：现场重读 head → 以新 head 的 tree 为 base 用【同一份 tree 条目】
   （blob 内容寻址全复用，零重传）重建增量树 → 重 commit（parent=新 head）→ 重 PATCH。
   最多收敛 3 轮；成功后回读 ref 校验真的推进了（"verify the push landed"——
   PATCH 200 但 ref 没动是静默失败，无人值守部署必须拦）。 */
const ffPatch = async (sha) => req('PATCH', `/repos/${repo}/git/refs/heads/gh-pages`, { sha })
for (let round = 0; ; round++) {
  try {
    await ffPatch(commit.sha)
    break
  } catch (e) {
    if (!/-> (422|409)\b/.test(String(e.message)) || round >= 2) throw e
    console.log(`ref 冲突（第 ${round + 1} 轮）：远端 head 已被并发部署推进，现场重读并重建增量树…`)
    const head2 = await req('GET', `/repos/${repo}/git/ref/heads/gh-pages`)
    const pc2 = await req('GET', `/repos/${repo}/git/commits/${head2.object.sha}`)
    let bt = pc2.tree.sha
    for (let s = 0; s < tree.length; s += BATCH) {
      const t = await req('POST', `/repos/${repo}/git/trees`, { base_tree: bt, tree: tree.slice(s, s + BATCH) })
      bt = t.sha
    }
    commit = await makeCommit(bt, head2.object.sha)
    console.log(`rebuilt on ${head2.object.sha.slice(0, 8)}: tree ${bt.slice(0, 10)} commit ${commit.sha}`)
  }
}
const after = await req('GET', `/repos/${repo}/git/ref/heads/gh-pages`)
if (after.object.sha !== commit.sha) {
  throw new Error(`部署校验失败：gh-pages=${after.object.sha} 期望=${commit.sha}（ref 未推进，静默失败嫌疑）`)
}
console.log('ref verified:', commit.sha)
console.log('API DEPLOY DONE')

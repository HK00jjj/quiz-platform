/* 「出题 → 入库」全链路机械审计。
   只做机器能判定的部分：死导出 / 多余 export / 未用 import / 幽灵 CSS 选择器 / 零引用资源键 / 孤儿图片文件。
   「冗余」与「规则脱节」两类靠人读，脚本不猜。
   ⚠ 幽灵选择器会有假阳性：动态拼出来的类名（如 'diff-pill d-' + cls、'tone-' + it.tone）
     在源码里不存在完整字面量，脚本会误报，需人工复核后才算数。
   跑法：node scripts/audit-pipeline.mjs */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(here, '..', 'app', 'src')
const PUB = path.join(here, '..', 'app', 'public')

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n)
    if (statSync(p).isDirectory()) walk(p, exts, out)
    else if (exts.some((e) => n.endsWith(e))) out.push(p)
  }
  return out
}
const read = (p) => readFileSync(p, 'utf8')
const rel = (p) => path.relative(path.join(here, '..'), p).replace(/\\/g, '/')
const count = (text, re) => (text.match(re) || []).length

const codeFiles = walk(SRC, ['.js', '.jsx'])
const code = new Map(codeFiles.map((f) => [f, read(f)]))

/* ── 1. 死导出 / 多余 export ── */
console.log('\n=== 1. export 了但没人 import（DEAD=连本文件内也没用；OVER=仅内部用，export 多余）===')
for (const f of codeFiles) {
  const src = code.get(f)
  const names = new Set([
    ...[...src.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]),
    ...[...src.matchAll(/^export\s+const\s+(\w+)/gm)].map((m) => m[1])
  ])
  for (const n of names) {
    const word = new RegExp('\\b' + n + '\\b', 'g')
    let ext = 0
    for (const [g, txt] of code) if (g !== f) ext += count(txt, word)
    const internal = count(src, word) - count(src, new RegExp('^export\\s+(?:async\\s+)?(?:function|const)\\s+' + n + '\\b', 'gm'))
    if (ext === 0) console.log(`  ${internal === 0 ? 'DEAD' : 'OVER'}  ${rel(f)}  ${n}  (外部引用 0, 文件内 ${internal})`)
  }
}

/* ── 2. 未使用的 import 绑定 ── */
console.log('\n=== 2. import 了但文件内没用到的绑定 ===')
for (const f of codeFiles) {
  const src = code.get(f)
  for (const m of src.matchAll(/^import\s+\{([^}]+)\}\s+from\s+'([^']+)'/gm)) {
    const body = src.replace(m[0], '')
    for (const raw of m[1].split(',')) {
      const n = raw.trim().split(/\s+as\s+/).pop().trim()
      if (!n) continue
      if (count(body, new RegExp('\\b' + n + '\\b', 'g')) === 0) console.log(`  UNUSED  ${rel(f)}  ${n}  <- ${m[2]}`)
    }
  }
}

/* ── 3. 幽灵 CSS 选择器（写了类名但 JSX/JS 里 0 次出现）── */
console.log('\n=== 3. 幽灵 CSS 选择器候选（⚠ 需人工排除动态拼接的假阳性）===')
const allCode = [...code.values()].join('\n')
for (const f of walk(path.join(SRC, 'theme'), ['.css'])) {
  const css = read(f)
  /* 只取选择器部分：把 { } 之间的声明块挖掉，避免把属性值里的 .5 之类当成类名 */
  const selOnly = css.replace(/\{[^{}]*\}/g, '{}')
  const classes = new Set([...selOnly.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)].map((m) => m[1]))
  const ghosts = []
  for (const c of classes) {
    if (count(allCode, new RegExp('(?<![\\w-])' + c.replace(/-/g, '\\-') + '(?![\\w-])', 'g')) === 0) ghosts.push(c)
  }
  if (ghosts.length) console.log(`  ${rel(f)} (${ghosts.length}/${classes.size}): ${ghosts.sort().join(', ')}`)
}

/* ── 4. assets.js 零引用键 ── */
console.log('\n=== 4. assets.js 里零引用的资源键 ===')
const assetsPath = path.join(SRC, 'assets.js')
if (existsSync(assetsPath)) {
  const a = read(assetsPath)
  const keys = [...a.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1])
  const rest = [...code.values()].filter((_, i) => codeFiles[i] !== assetsPath).join('\n')
  const dead = keys.filter((k) => count(rest, new RegExp('\\bA\\.' + k + '\\b', 'g')) === 0)
  console.log(`  共 ${keys.length} 键，零引用 ${dead.length} 个${dead.length ? ': ' + dead.join(', ') : ''}`)
  /* 4b. 孤儿图片：public/img 下的文件没被 assets.js 提到 */
  const imgs = walk(path.join(PUB, 'img'), ['.png', '.webp', '.jpg', '.svg']).map((p) => path.basename(p))
  const orphan = imgs.filter((n) => !a.includes(n))
  const sz = (n) => Math.round(statSync(path.join(PUB, 'img', n)).size / 1024)
  console.log(`  public/img 共 ${imgs.length} 个文件，assets.js 未提及 ${orphan.length} 个（合计 ${orphan.reduce((s, n) => s + sz(n), 0)} KB）`)
  if (orphan.length) console.log('    ' + orphan.map((n) => `${n}(${sz(n)}K)`).join(' '))
}

/* ── 5. 入库链路各文件规模 ── */
console.log('\n=== 5. 入库链路文件规模（行数）===')
for (const p of ['lib/validate.js', 'lib/stats.js', 'lib/db.js', 'lib/fsrs.js', 'lib/dates.js', 'store.js', 'pages/Import.jsx', 'pages/Bank.jsx', 'pages/Learn.jsx', 'pages/Practice.jsx', 'assets.js']) {
  const f = path.join(SRC, p)
  if (existsSync(f)) console.log(`  ${p.padEnd(20)} ${read(f).split('\n').length}`)
}
console.log('')

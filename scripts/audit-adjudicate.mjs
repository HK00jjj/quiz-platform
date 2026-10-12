/* 审计第二步：裁决。
   ① 幽灵选择器候选逐个定性——是「真规则」还是「注释里的字面量」还是「动态拼接的假阳性」
   ② Import.jsx / Bank.jsx 里未使用的 useState 与局部函数
   ③ 出题侧 validator（ps1 + schema）与网站侧 validate.js 的规则常量并排打印，供人工比对脱节
   跑法：node scripts/audit-adjudicate.mjs */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(here, '..')
const SRC = path.join(ROOT, 'app', 'src')
/* 出题侧 validator 在 skill 目录之外：附录D 引用的五个文件实际住在这里。
   ⚠ 路径里的中文直接写字面量，不要用 decodeURI('%xx') 拼——
   上一版只解码了用户名、忘了后半段，结果整段报「不存在」。 */
const VAL = 'C:/Users/青丘白浅/Documents/Qoder/命题流水线/validator'
const read = (p) => readFileSync(p, 'utf8')
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n)
    if (statSync(p).isDirectory()) walk(p, exts, out)
    else if (exts.some((e) => n.endsWith(e))) out.push(p)
  }
  return out
}

/* ── ① 幽灵选择器裁决 ── */
console.log('=== ① 幽灵选择器裁决（去注释后仍出现 = 真规则）===')
/* ⚠ 语料必须是 walk 到的全部 src 文件，不能硬编码清单——
   上一版漏了文件，差点把 .book-* 一族 25 个选择器全误判为死代码。 */
const codeFiles = walk(SRC, ['.js', '.jsx'])
console.log('  语料文件数:', codeFiles.length, '->', codeFiles.map((f) => path.relative(SRC, f).replace(/\\/g, '/')).join(', '))
const jsx = codeFiles.map(read).join('\n')
/* 代码里所有 'xxx-' 形式的字符串字面量（允许内部有空格，如 'nav-item tone-'），
   用来识别动态拼接的类名。上一版正则不含空格，把 tone-mint / d-base 全误报了。 */
const dynLits = [...new Set([...jsx.matchAll(/['"]([\w\s-]*-)['"]/g)].map((m) => m[1]))]
console.log('  动态类名字面量:', dynLits.sort().join(' | ') || '(无)')
const maybeDyn = (c) => {
  const head = c.includes('-') ? c.slice(0, c.indexOf('-') + 1) : c
  if (dynLits.some((l) => l.endsWith(head))) return true
  return /^[a-z]{1,3}\d$/.test(c)          // s1 / f2 / c3 这类字母+序号，很可能是拼出来的
}

for (const cssRel of ['theme/candy.css', 'theme/pages.css', 'theme/global.css', 'theme/apple.css']) {
  const f = path.join(SRC, cssRel)
  if (!existsSync(f)) continue
  const raw = read(f)
  /* 把注释内容挖空但保留换行，行号才不错位 */
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const lines = stripped.split('\n')
  const selOnly = stripped.replace(/\{[^{}]*\}/g, '{}')
  const classes = new Set([...selOnly.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)].map((m) => m[1]))
  const real = []
  for (const c of classes) {
    const inCode = new RegExp('(?<![\\w-])' + c + '(?![\\w-])').test(jsx)
    if (inCode) continue
    const hits = []
    lines.forEach((ln, i) => { if (new RegExp('\\.' + c + '(?![\\w-])').test(ln)) hits.push(i + 1) })
    if (hits.length === 0) continue                       // 只活在注释里 → 假阳性，跳过
    const dyn = maybeDyn(c)
    real.push({ c, hits: hits.slice(0, 6), dyn })
  }
  if (!real.length) continue
  const solid = real.filter((r) => !r.dyn)
  const susp = real.filter((r) => r.dyn)
  console.log(`\n  ${cssRel}: 确定幽灵 ${solid.length} 个、疑似动态拼接 ${susp.length} 个`)
  for (const r of solid.sort((a, b) => a.hits[0] - b.hits[0])) console.log(`    确定  .${r.c.padEnd(22)} L${r.hits.join(',L')}`)
  for (const r of susp.sort((a, b) => a.hits[0] - b.hits[0])) console.log(`    动态? .${r.c.padEnd(22)} L${r.hits.join(',L')}`)
}

/* ── ② Import.jsx / Bank.jsx 未使用的 useState 与局部函数 ── */
console.log('\n=== ② 未使用的 useState / 局部函数 ===')
for (const p of ['pages/Import.jsx', 'pages/Bank.jsx']) {
  const f = path.join(SRC, p)
  const src = read(f)
  const names = []
  for (const m of src.matchAll(/const \[(\w+),\s*(\w+)\] = useState/g)) names.push([m[1], 'state'], [m[2], 'setter'])
  for (const m of src.matchAll(/^\s{2}(?:async )?function (\w+)/gm)) names.push([m[1], 'function'])
  for (const m of src.matchAll(/^\s{2}const (\w+) = (?:async )?\(/gm)) names.push([m[1], 'arrow'])
  for (const [n, kind] of names) {
    const uses = (src.match(new RegExp('(?<![\\w.])' + n + '(?![\\w])', 'g')) || []).length
    const declared = 1
    if (uses - declared === 0) console.log(`  UNUSED ${kind.padEnd(9)} ${p}  ${n}`)
  }
}

/* ── ③ 出题侧 validator 的规则常量 ── */
console.log('\n=== ③ 出题侧 validator/question-batch.schema.json 全文 ===')
const schema = VAL + '/question-batch.schema.json'
console.log(existsSync(schema) ? read(schema) : '  (不存在: ' + schema + ')')

console.log('\n=== ③b validate_questions.ps1 里带数字/配比的规则行 ===')
const ps1 = VAL + '/validate_questions.ps1'
if (existsSync(ps1)) {
  read(ps1).split('\n').forEach((ln, i) => {
    if (/配比|红线|区间|上限|<=|>=|-le |-ge |250|375|500|14|20|21|客观题|要素|空|分点/.test(ln) && !/^\s*#/.test(ln)) {
      console.log(`  L${i + 1}: ${ln.trim().slice(0, 150)}`)
    }
  })
} else console.log('  (不存在)')

console.log('\n=== ③c 网站侧 validate.js 的对应常量行 ===')
read(path.join(SRC, 'lib', 'validate.js')).split('\n').forEach((ln, i) => {
  if (/ANALYSIS_LIMIT|const ranges|DIFFS =|COG =|TYPE_LIST|COMPREHENSIVE_ELEMENTS|META_MAP|<=|>=|250|375|500|> 5|> 2|14|20|21/.test(ln) && !/^\s*(\/\/|\*)/.test(ln)) {
    console.log(`  L${i + 1}: ${ln.trim().slice(0, 150)}`)
  }
})
console.log('')

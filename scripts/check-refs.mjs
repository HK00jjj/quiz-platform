// 静态校验：JSX/CSS 里用到的每个 A.<key> 都必须在 assets.js 中存在，且指向的文件真实存在
// 用法: node scripts/check-refs.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import path from 'path'

const appDir = path.resolve('app')
const srcDir = path.join(appDir, 'src')
const imgDir = path.join(appDir, 'public', 'img')
const assetsPath = path.join(srcDir, 'assets.js')

function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    const p = path.join(d, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p, out) } else out.push(p)
  }
  return out
}

const assetsText = readFileSync(assetsPath, 'utf8')
const onDisk = new Set(readdirSync(imgDir))

// assets.js 里导出的顶层键
const exported = new Set([...assetsText.matchAll(/^ {2}(\w+)\s*:/gm)].map(m => m[1]))
// 顶层键 -> 引用的文件
const filesOf = new Map()
let cur = null
for (const line of assetsText.split('\n')) {
  const m = line.match(/^ {2}(\w+)\s*:/)
  if (m) cur = m[1]
  for (const g of line.matchAll(/img\((?:'([^']+)'|`([^`]+)`)\)/g)) {
    let f = g[1] ?? g[2]
    if (!f) continue
    const list = f.includes('${i}') ? [1, 2, 3, 4, 5, 6, 7].map(i => f.replace('${i}', String(i))) : [f]
    filesOf.set(cur, [...(filesOf.get(cur) ?? []), ...list])
  }
}

// 其它源文件里用到的 A.<key>
const others = walk(srcDir).filter(f => f !== assetsPath && /\.(jsx?|css)$/.test(f))
const used = new Map()
for (const f of others) {
  const t = readFileSync(f, 'utf8')
  for (const m of t.matchAll(/\bA\.(\w+)/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set())
    used.get(m[1]).add(path.basename(f))
  }
}

const missingKey = [], missingFile = []
for (const [k, where] of used) {
  if (!exported.has(k)) { missingKey.push(`${k}  <- ${[...where].join(', ')}`); continue }
  for (const f of filesOf.get(k) ?? []) if (!onDisk.has(f)) missingFile.push(`${k} -> ${f}  <- ${[...where].join(', ')}`)
}
const unusedKey = [...exported].filter(k => !used.has(k))

console.log(`assets.js 导出 ${exported.size} 个键，源码用到 ${used.size} 个`)
console.log(`\n[1] 用了但 assets.js 没有的键（会 undefined 崩溃）: ${missingKey.length ? '\n  ✗ ' + missingKey.join('\n  ✗ ') : '无 ✓'}`)
console.log(`\n[2] 键存在但指向的文件不在磁盘（会 404）: ${missingFile.length ? '\n  ✗ ' + missingFile.join('\n  ✗ ') : '无 ✓'}`)
console.log(`\n[3] assets.js 里未被使用的键（死映射，不致命）: ${unusedKey.length ? unusedKey.join(', ') : '无 ✓'}`)

// CSS 里硬编码的 url() 也要可达
const cssRefs = new Set()
for (const f of others.filter(x => x.endsWith('.css'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/url\(['"]?[^)'"]*\/img\/([\w.-]+)['"]?\)/g)) cssRefs.add(m[1])
}
const htmlRefs = [...readFileSync(path.join(appDir, 'index.html'), 'utf8').matchAll(/img\/([\w.-]+)/g)].map(m => m[1])
const badCss = [...cssRefs, ...htmlRefs].filter(f => !onDisk.has(f))
console.log(`\n[4] CSS/index.html 硬编码引用 ${cssRefs.size + htmlRefs.length} 处，不可达: ${badCss.length ? badCss.join(', ') : '无 ✓'}`)

const ok = missingKey.length === 0 && missingFile.length === 0 && badCss.length === 0
console.log(ok ? '\nRESULT: REFS OK' : '\nRESULT: REFS BROKEN')

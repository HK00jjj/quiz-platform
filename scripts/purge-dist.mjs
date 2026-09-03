// 构建后清理：dist/img 里凡是没有被源码引用的文件全部删除
// 用途：public/img 里可能残留被进程内存映射锁住、删不掉的旧素材（如 seal-*.webp），
//       它们不该跟着上线；从 dist 清除即可，public 里的残留等解锁后再删。
// 注意：引用集必须从【源码】取，不能从 bundle 取——assets.js 的路径是 `${BASE_URL}img/${name}`
//       模板拼接，构建后 bundle 里只剩裸文件名 "p2.webp"，按 "img/xxx" 匹配会漏掉绝大多数引用。
// 用法: node scripts/purge-dist.mjs
import { readFileSync, readdirSync, unlinkSync, statSync, existsSync } from 'fs'
import path from 'path'

const appDir = path.resolve('app')
const srcDir = path.join(appDir, 'src')
const distImg = path.join(appDir, 'dist', 'img')
if (!existsSync(distImg)) { console.log('dist/img 不存在，先构建'); process.exit(1) }

function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    const p = path.join(d, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p, out) } else out.push(p)
  }
  return out
}

const refs = new Set()
for (const f of walk(srcDir)) {
  const t = readFileSync(f, 'utf8')
  // assets.js: img('p2.webp') 与 img(`p34-${i}.webp`)
  for (const m of t.matchAll(/img\('([\w.-]+\.(?:webp|png|jpe?g|svg))'\)/g)) refs.add(m[1])
  for (const m of t.matchAll(/img\(`([\w-]+)-\$\{i\}\.(webp|png)`\)/g)) for (let i = 1; i <= 7; i++) refs.add(`${m[1]}-${i}.${m[2]}`)
  // CSS: url('/quiz-platform/img/p2.webp')
  for (const m of t.matchAll(/url\(['"]?[^)'"]*\/img\/([\w.-]+\.(?:webp|png|jpe?g|svg))['"]?\)/g)) refs.add(m[1])
}
// index.html: <link rel="preload" href="./img/p11.webp">
for (const m of readFileSync(path.join(appDir, 'index.html'), 'utf8').matchAll(/img\/([\w.-]+\.(?:webp|png|jpe?g|svg))/g)) refs.add(m[1])

// 保险：引用集异常小就拒绝清理（曾经因正则只匹配 bundle 而误删 86 个文件）
if (refs.size < 25) {
  console.log(`RESULT: ABORT —— 只解析到 ${refs.size} 个引用，明显异常，拒绝清理`); process.exit(1)
}

const files = readdirSync(distImg)
const missing = [...refs].filter(f => !files.includes(f))
if (missing.length) { console.log(`RESULT: ABORT —— 引用了但 dist 里没有（会 404）: ${missing.join(', ')}`); process.exit(1) }

const orphans = files.filter(f => !refs.has(f))
let saved = 0
for (const f of orphans) { const p = path.join(distImg, f); saved += statSync(p).size; unlinkSync(p) }

const left = readdirSync(distImg)
console.log(`源码引用 ${refs.size} 个素材，dist/img 原有 ${files.length} 个`)
console.log(`清除孤儿 ${orphans.length} 个（省 ${(saved / 1024).toFixed(0)}KB）: ${orphans.join(', ') || '无'}`)
console.log(`剩余 ${left.length} 个 / ${(left.reduce((s, f) => s + statSync(path.join(distImg, f)).size, 0) / 1048576).toFixed(2)} MB`)
console.log(orphans.length >= 0 && missing.length === 0 ? 'RESULT: DIST CLEAN' : 'RESULT: DIST BROKEN')

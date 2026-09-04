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

/* 保险一：引用集为空说明 walk 或正则整体失效（当年误删 86 个文件的成因是正则去匹配了 bundle，
   那里只剩裸文件名）。原来这里写的是 `refs.size < 25` 这种魔数阈值——它会随着资产被合法清理而失效：
   本轮删掉 10 个死资源键后真实引用数降到 21，闸门就把一次正确的清理拦下来了。
   魔数换成下面的语义不变式，资产怎么变都不会烂。 */
if (refs.size === 0) {
  console.log('RESULT: ABORT —— 一个引用都没解析到，walk 或正则失效，拒绝清理'); process.exit(1)
}

const files = readdirSync(distImg)
const missing = [...refs].filter(f => !files.includes(f))
if (missing.length) { console.log(`RESULT: ABORT —— 引用了但 dist 里没有（会 404）: ${missing.join(', ')}`); process.exit(1) }

const orphans = files.filter(f => !refs.has(f))

/* 保险二（真正防误删的那道）：用另一种方法独立复核每个「孤儿」。
   把全部源码与 index.html 剔掉注释后拼成一大块，孤儿文件名若仍出现在里面，
   说明上面的引用正则漏了它——立即中止并列出漏掉的文件名。
   剔注释是必须的：Login.jsx 的注释里写着「A.divider(p44.png)」字样，
   不剔就会把已经死掉的 p44.png 误判成还在用（审计脚本已经在这个坑上栽过一次）。 */
const stripped = walk(srcDir).map((f) => readFileSync(f, 'utf8')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/[^\n]*/g, ' ')
  + readFileSync(path.join(appDir, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, ' ')
const missed = orphans.filter((o) => stripped.includes(o))
if (missed.length) {
  console.log(`RESULT: ABORT —— 引用正则漏了 ${missed.length} 个仍在源码里出现的文件，拒绝清理: ${missed.join(', ')}`)
  process.exit(1)
}
let saved = 0
for (const f of orphans) { const p = path.join(distImg, f); saved += statSync(p).size; unlinkSync(p) }

const left = readdirSync(distImg)
console.log(`源码引用 ${refs.size} 个素材，dist/img 原有 ${files.length} 个`)
console.log(`清除孤儿 ${orphans.length} 个（省 ${(saved / 1024).toFixed(0)}KB）: ${orphans.join(', ') || '无'}`)
console.log(`剩余 ${left.length} 个 / ${(left.reduce((s, f) => s + statSync(path.join(distImg, f)).size, 0) / 1048576).toFixed(2)} MB`)
console.log(orphans.length >= 0 && missing.length === 0 ? 'RESULT: DIST CLEAN' : 'RESULT: DIST BROKEN')

// 收尾修正：① WebP 反而变大的素材还原为原 PNG ② 清理 assets.js 死映射 ③ 全量校验引用可达
// 用法: node scripts/fix-assets.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync, unlinkSync, statSync } from 'fs'
import path from 'path'

const appDir = path.resolve('app')
const imgDir = path.join(appDir, 'public', 'img')
const oldImg = path.join(process.env.USERPROFILE, 'Documents/QoderCN/2026-08-28/chat-2/app/public/img')
const assetsPath = path.join(appDir, 'src', 'assets.js')
const cssPath = path.join(appDir, 'src', 'theme', 'pages.css')

/* ① WebP 比原 PNG 还大的：还原 PNG（既更小又更高清），删掉 webp，改回引用 */
const RESTORE = ['p12', 'p45', 'p44']
for (const b of RESTORE) {
  const src = path.join(oldImg, b + '.png')
  const webp = path.join(imgDir, b + '.webp')
  if (!existsSync(src)) { console.log(`跳过 ${b}：原图不存在`); continue }
  copyFileSync(src, path.join(imgDir, b + '.png'))
  if (existsSync(webp)) unlinkSync(webp)
  console.log(`还原 ${b}.png  ${Math.round(statSync(path.join(imgDir, b + '.png')).size / 1024)}KB（原 webp ${existsSync(webp) ? '已删' : '不存在'}）`)
}
for (const f of [assetsPath, cssPath]) {
  const t = readFileSync(f, 'utf8')
  let n = t
  for (const b of RESTORE) n = n.split(`img/${b}.webp`).join(`img/${b}.png`).split(`'${b}.webp'`).join(`'${b}.png'`)
  if (n !== t) { writeFileSync(f, n, 'utf8'); console.log(`引用回改: ${path.relative(appDir, f)}`) }
}

/* ② assets.js 死映射：顶层键下所有文件都不存在 → 整行删除 */
const onDisk = new Set(readdirSync(imgDir))
const lines = readFileSync(assetsPath, 'utf8').split('\n')
const kept = [], dropped = []
for (const line of lines) {
  const m = line.match(/^ {2}(\w+)\s*:/)
  const files = [...line.matchAll(/img\((?:'([^']+)'|`([^`]+)`)\)/g)].map(g => g[1] ?? g[2])
  if (m && files.length) {
    // 模板字面量 p34-${i}.webp 展开成 1..8
    const expanded = files.flatMap(f => f.includes('${i}')
      ? [1, 2, 3, 4, 5, 6, 7, 8].map(i => f.replace('${i}', String(i))) : [f])
    if (expanded.every(f => !onDisk.has(f))) { dropped.push(`${m[1]} (${expanded[0]}${expanded.length > 1 ? ' …' : ''})`); continue }
  }
  kept.push(line)
}
writeFileSync(assetsPath, kept.join('\n'), 'utf8')
console.log(`\nassets.js 删除死映射 ${dropped.length} 条: ${dropped.join(', ')}`)

/* ③ 全量校验：代码里引用的每个素材文件都必须真实存在 */
const texts = [
  [assetsPath, readFileSync(assetsPath, 'utf8')],
  [cssPath, readFileSync(cssPath, 'utf8')],
  [path.join(appDir, 'index.html'), readFileSync(path.join(appDir, 'index.html'), 'utf8')],
  ...readdirSync(path.join(appDir, 'src')).filter(n => n.endsWith('.css')).map(n => [n, readFileSync(path.join(appDir, 'src', n), 'utf8')])
]
const refs = new Set()
for (const [, t] of texts) {
  for (const m of t.matchAll(/img\/([\w.-]+\.(?:webp|png|jpe?g|svg))/g)) refs.add(m[1])
  for (const m of t.matchAll(/img\('([\w.-]+\.(?:webp|png|jpe?g|svg))'\)/g)) refs.add(m[1])
  for (const m of t.matchAll(/img\(`([\w-]+)-\$\{i\}\.(webp|png)`\)/g)) for (let i = 1; i <= 7; i++) refs.add(`${m[1]}-${i}.${m[2]}`)
}
const missing = [...refs].filter(f => !onDisk.has(f))
const orphan = [...onDisk].filter(f => !refs.has(f) && /\.(webp|png|jpe?g)$/i.test(f))
console.log(`\n引用素材 ${refs.size} 个，磁盘 ${onDisk.size} 个`)
console.log(`缺失（引用了但文件不存在）: ${missing.length ? missing.join(', ') : '无 ✓'}`)
console.log(`孤儿（文件在但没人引用）: ${orphan.length ? orphan.join(', ') : '无 ✓'}`)

const total = [...onDisk].reduce((s, f) => s + statSync(path.join(imgDir, f)).size, 0)
console.log(`\npublic/img 最终: ${onDisk.size} 张 / ${(total / 1048576).toFixed(2)} MB`)
console.log(missing.length === 0 ? 'RESULT: ASSETS OK' : 'RESULT: ASSETS BROKEN')

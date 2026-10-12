// 素材优化：分级降采样 + WebP 转码 + 清理未引用素材 + 自动改写引用
// 用法: node scripts/optimize-assets.mjs
import { readFileSync, readdirSync, writeFileSync, unlinkSync, statSync, existsSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

const appDir = path.resolve('app')
const imgDir = path.join(appDir, 'public', 'img')
const srcDir = path.join(appDir, 'src')

/* 零感知损失原则：采样上限 = 实际显示尺寸 × 2（2× DPR 视网膜余量），小图标再给到 8× 余量。
   不做任何低于显示需求的降采样，因此肉眼画质与原来无差。 */
const TIER = {
  // 小图标（显示 ≤130px，给到 3~8 倍余量）
  'p10': 320, 'p13': 384, 'p14': 384, 'p22': 128, 'p26': 320, 'p28': 256,
  'p29': 320, 'p30': 320, 'p31': 320, 'p32': 320, 'p36': 384,
  'p23-1': 256, 'p23-2': 256, 'p23-3': 256,
  'p40-1': 256, 'p40-2': 256, 'p40-3': 256,
  'p42-1': 320, 'p42-2': 320, 'p42-3': 320,
  'p34-1': 384, 'p34-2': 384, 'p34-3': 384, 'p34-4': 384, 'p34-5': 384, 'p34-6': 384, 'p34-7': 384,
  'p38-1': 384, 'p38-2': 384, 'p38-3': 384,
  'p43-1': 384, 'p43-2': 384, 'p43-3': 384, 'p43-4': 384, 'p43-5': 384, 'p43-6': 384, 'p43-7': 384, 'p43-8': 384,
  'p54-1': 448, 'p54-2': 448, 'p54-3': 448, 'p54-4': 448,
  'p20': 448,
  // 中等插画（显示 150~400px，给 2× 余量）
  'p15': 700, 'p16': 700, 'p17': 700, 'p18': 700,
  'p19': 800, 'p21': 800, 'p24': 800, 'p25': 640, 'p27': 640,
  'p4': 640, 'p46': 640, 'p37': 800, 'p41': 800,
  'p35': 1000, 'p39': 1000, 'p44': 1200,
  // 卡牌框 / 登录框（2× DPR 余量）
  'p2': 1280, 'p6': 1280, 'p7': 900, 'p13b': 1000,
  'p12': 1280, 'p12b': 1280
}
const DEFAULT_MAX = 1600 // 全屏背景与宽幅装饰条：不降采样，保持原尺寸
/* 雕花金线/细边框类：用更高质量的 q95，避免细线周围出现压缩振铃 */
const HIGHQ = new Set(['p2', 'p6', 'p8', 'p27', 'p35', 'p37', 'p39', 'p44', 'p45', 'p46', 'p33', 'p36', 'p34-1', 'p34-2', 'p34-3', 'p34-4', 'p34-5', 'p34-6', 'p34-7'])

/* ── 1. 扫描引用：assets.js 顶层键 + CSS/index.html 硬编码文件名 ── */
function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    const p = path.join(d, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p, out) } else out.push(p)
  }
  return out
}
const srcFiles = walk(srcDir)
const assetsPath = path.join(srcDir, 'assets.js')
const assetsText = readFileSync(assetsPath, 'utf8')
const otherTexts = srcFiles.filter(f => f !== assetsPath).map(f => readFileSync(f, 'utf8'))
const indexHtmlPath = path.join(appDir, 'index.html')
const indexHtml = readFileSync(indexHtmlPath, 'utf8')

const fileToTop = new Map()
let topKey = null
for (const line of assetsText.split('\n')) {
  const m = line.match(/^ {2}(\w+)\s*:/)
  if (m) topKey = m[1]
  for (const g of line.matchAll(/img\((?:'([^']+)'|`([^`]+)`)\)/g)) {
    let name = g[1] ?? g[2]
    if (!name) continue
    if (name.includes('${i}')) { for (let i = 1; i <= 8; i++) fileToTop.set(name.replace('${i}', String(i)), topKey) }
    else fileToTop.set(name, topKey)
  }
}

const allImgs = readdirSync(imgDir).filter(n => /\.(png|jpe?g|webp)$/i.test(n))
const used = [], unused = []
for (const f of allImgs) {
  const top = fileToTop.get(f)
  const inCssOrHtml = otherTexts.some(t => t.includes('img/' + f)) || indexHtml.includes(f)
  const keyUsed = top ? otherTexts.some(t => new RegExp('\\.' + top + '\\b').test(t)) : false
  if (top && (keyUsed || inCssOrHtml)) used.push(f)
  else unused.push({ f, top: top ?? '(assets.js 无映射)', inCssOrHtml })
}

const kb = f => Math.round(statSync(path.join(imgDir, f)).size / 1024)
const beforeTotal = allImgs.reduce((s, f) => s + statSync(path.join(imgDir, f)).size, 0)
console.log(`扫描：${allImgs.length} 张，已引用 ${used.length} 张，未引用 ${unused.length} 张`)
console.log('未引用（将删除）:')
unused.forEach(u => console.log(`  - ${u.f}  ${kb(u.f)}KB  顶层键=${u.top} css/html=${u.inCssOrHtml}`))

/* ── 2. 已引用素材：分级降采样 + WebP ── */
let afterTotal = 0
const rows = []
for (const f of used) {
  const base = f.replace(/\.(png|jpe?g)$/i, '')
  const max = TIER[base] ?? DEFAULT_MAX
  const src = path.join(imgDir, f)
  const out = path.join(imgDir, base + '.webp')
  const info = await sharp(src).resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: HIGHQ.has(base) ? 95 : 92, effort: 6, alphaQuality: 100, smartSubsample: true }).toFile(out)
  const oldSize = statSync(src).size
  afterTotal += info.size
  rows.push({ f, out: base + '.webp', oldKB: Math.round(oldSize / 1024), newKB: Math.round(info.size / 1024), w: info.width, h: info.height, max })
  unlinkSync(src)
}
rows.sort((a, b) => b.oldKB - a.oldKB)
console.log('\n转码明细（按原体积降序）:')
rows.forEach(r => console.log(`  ${r.f.padEnd(14)} ${String(r.oldKB).padStart(5)}KB -> ${r.out.padEnd(15)} ${String(r.newKB).padStart(4)}KB  ${r.w}x${r.h} (上限${r.max})  ${Math.round(r.newKB / r.oldKB * 100)}%`))

/* ── 3. 删除未引用素材 ── */
for (const u of unused) { unlinkSync(path.join(imgDir, u.f)); afterTotal += 0 }

/* ── 4. 改写引用：assets.js（img('pX.png')）/ css、index.html（img/pX.png）── */
for (const f of [assetsPath, indexHtmlPath, ...srcFiles.filter(x => x.endsWith('.css'))]) {
  const t = readFileSync(f, 'utf8')
  const n = f === assetsPath
    ? t.replace(/\.png'/g, ".webp'")                       // assets.js 里全是 img('pX.png') 单引号形式
    : t.replace(/img\/(p[\w-]+)\.png/g, 'img/$1.webp')      // css / html 里是路径形式
  if (n !== t) { writeFileSync(f, n, 'utf8'); console.log(`\n已改写引用: ${path.relative(appDir, f)}（${(t.match(/\.png/g) || []).length} 处）`) }
}
// 兵险：全工程不能再残留任何 pX.png 引用
const leftover = [...walk(srcDir).map(f => [f, readFileSync(f, 'utf8')]), [indexHtmlPath, indexHtml]]
  .flatMap(([f, t]) => (t.match(/p[\w-]+\.png/g) || []).map(m => `${path.basename(f)}: ${m}`))
console.log(`\n残留 .png 引用: ${leftover.length ? leftover.join(' | ') : '无 ✓'}`)

const finalFiles = readdirSync(imgDir)
console.log(`\n=== 结果 ===`)
console.log(`优化前: ${allImgs.length} 张 / ${(beforeTotal / 1048576).toFixed(1)} MB`)
console.log(`优化后: ${finalFiles.length} 张 / ${(afterTotal / 1048576).toFixed(2)} MB`)
console.log(`压缩率: ${(afterTotal / beforeTotal * 100).toFixed(1)}%（省下 ${((beforeTotal - afterTotal) / 1048576).toFixed(1)} MB）`)
console.log(`剩余非 webp 文件: ${finalFiles.filter(x => !x.endsWith('.webp')).join(', ') || '(无)'}`)

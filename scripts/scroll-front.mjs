// 为"答题页正面改羊皮纸卷轴"准备 p19：从原图重取到 1600 宽（整卡拉伸需要足够纹理分辨率），
// 并量出左右龙首杆的宽度与上下焦边高度，用来定 border-image 九切片值。
// 用法: node scripts/scroll-front.mjs
import path from 'path'
import { readdirSync, statSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const IMG = path.resolve('app/public/img')
const OLD = path.join(process.env.USERPROFILE, 'OneDrive/Desktop/奥术典籍馆素材 - 副本/图片')
const Q = { quality: 95, effort: 6, alphaQuality: 100, smartSubsample: true }

function findSrc(prefix) {
  for (const d of readdirSync(OLD)) {
    if (!d.startsWith(prefix)) continue
    const full = path.join(OLD, d)
    if (!statSync(full).isDirectory()) continue
    const f = readdirSync(full).find(n => /\.(png|jpe?g|webp)$/i.test(n))
    if (f) return path.join(full, f)
  }
  return null
}

const src = findSrc('P19 ')
const meta = await sharp(src).metadata()
console.log(`P19 原图: ${meta.width}x${meta.height} (${(statSync(src).size / 1024).toFixed(0)}KB)`)
const buf = await sharp(src).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp(Q).toBuffer()
writeFileSync(path.join(IMG, 'p19.webp'), buf)
const out = await sharp(path.join(IMG, 'p19.webp')).metadata()
console.log(`重取 p19.webp: ${out.width}x${out.height} / ${(buf.length / 1024).toFixed(0)}KB（比例 ${(out.width / out.height).toFixed(4)}）`)

/* 剖面：逐列/逐行统计「不透明度」与「暖金占比」，找杆与羊皮纸的分界 */
const { data, info } = await sharp(path.join(IMG, 'p19.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info
function profile(axis, buckets) {
  const n = axis === 'row' ? H : W
  const gold = new Float64Array(n), opq = new Float64Array(n), dark = new Float64Array(n), cnt = new Float64Array(n)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C, a = data[i + 3], k = axis === 'row' ? y : x
    cnt[k]++
    if (a > 40) {
      opq[k]++
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (r - b > 42 && r > 90) gold[k]++
      if ((r + g + b) / 3 < 110) dark[k]++     // 暗部：龙首/藤蔓的阴刻，羊皮纸主体不会有
    }
  }
  const step = Math.max(1, Math.floor(n / buckets)), rows = []
  for (let s = 0; s < n; s += step) {
    let g = 0, o = 0, d = 0, c = 0
    for (let k = s; k < Math.min(s + step, n); k++) { g += gold[k]; o += opq[k]; d += dark[k]; c += cnt[k] }
    rows.push({ pct: +(s / n * 100).toFixed(1), px: s, opq: +(o / c * 100).toFixed(1), gold: +(g / c * 100).toFixed(1), dark: +(d / c * 100).toFixed(1) })
  }
  return rows
}
const bar = p => '█'.repeat(Math.round(p / 100 * 30)).padEnd(30, '·')
console.log('\n=== 横向剖面（找左右杆的内缘 → border-image 左右切片）===')
for (const p of profile('col', 30)) console.log(`x=${String(p.pct).padStart(5)}% (${String(p.px).padStart(4)}px)  不透明${String(p.opq).padStart(5)}% ${bar(p.opq)} 暖金${String(p.gold).padStart(5)}% 暗部${String(p.dark).padStart(5)}%`)
console.log('\n=== 纵向剖面（找上下焦边 → border-image 上下切片）===')
for (const p of profile('row', 20)) console.log(`y=${String(p.pct).padStart(5)}% (${String(p.px).padStart(4)}px)  不透明${String(p.opq).padStart(5)}% ${bar(p.opq)} 暖金${String(p.gold).padStart(5)}% 暗部${String(p.dark).padStart(5)}%`)

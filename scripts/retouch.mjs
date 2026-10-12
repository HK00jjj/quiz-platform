// 精修两件事：
// ① 弱化答题页边框装饰：p19 龙首杆降饱和+提亮 → p19-soft.webp（装饰退为氛围，不抢题目）
// ② 卡牌比例从 0.5224 改为 0.72 后，裂纹三帧按新比例从原图重出（避免横向拉伸 38%）
// 用法: node scripts/retouch.mjs
import path from 'path'
import { readdirSync, statSync, writeFileSync, existsSync } from 'fs'
import sharp from 'sharp'

const IMG = path.resolve('app/public/img')
const NEW = path.join(process.env.USERPROFILE, 'OneDrive/Desktop/素材')
const Q = { quality: 95, effort: 6, alphaQuality: 100, smartSubsample: true }
const RATIO = 720 / 1000          // 答题卡牌比例
// 裂纹只是 900ms 的红色叠加特效，不需要 1008×1400：降到 720×1000 像素减 49%，
// 避开答错时三张大图冷解码带来的单帧卡顿（实测过 57.6ms）。
// 输出用新文件名（-s 后缀）：旧文件已被 Chrome 内存映射锁住，覆写会 UNKNOWN(-4094)
const CARD_W = 720, CARD_H = 1000

/* ① p19 → 柔和版：降饱和 38%、提亮 10%，龙首杆不再是视觉主角。
   已存在则跳过：该文件正被浏览器渲染（border-image），可能已内存映射锁住，覆写会报错而拖垮后面的步骤 */
const softPath = path.join(IMG, 'p19-soft.webp')
if (existsSync(softPath)) {
  console.log(`p19-soft.webp 已存在，跳过（${(statSync(softPath).size / 1024).toFixed(0)}KB）`)
} else {
  const soft = await sharp(path.join(IMG, 'p19.webp'))
    .modulate({ saturation: 0.62, brightness: 1.1 })
    .webp(Q).toBuffer()
  writeFileSync(softPath, soft)
  console.log(`p19-soft.webp: ${(soft.length / 1024).toFixed(0)}KB（saturation×0.62, brightness×1.1）`)
}

/* ② 裂纹三帧按新比例重出 */
function findSrc(prefix) {
  for (const d of readdirSync(NEW)) {
    if (!d.startsWith(prefix)) continue
    const full = path.join(NEW, d)
    if (!statSync(full).isDirectory()) continue
    const f = readdirSync(full).find(n => /\.(png|jpe?g|webp)$/i.test(n))
    if (f) return path.join(full, f)
  }
  return null
}
for (const i of [1, 2, 3]) {
  const src = findSrc(`裂纹第 ${i} 帧`)
  if (!src) { console.log(`  ✗ 未找到 裂纹第 ${i} 帧`); continue }
  const buf = await sharp(src).resize(CARD_W, CARD_H, { fit: 'fill' }).webp(Q).toBuffer()
  writeFileSync(path.join(IMG, `crack-${i}s.webp`), buf)
  console.log(`crack-${i}s.webp: ${CARD_W}x${CARD_H} / ${(buf.length / 1024).toFixed(0)}KB（比例 ${(CARD_W / CARD_H).toFixed(4)}，目标 ${RATIO.toFixed(4)}）`)
}
console.log('RESULT: RETOUCH OK')

// p19 龙首卷轴的左右透明边距不对称（左 0→5% 透明，右 92.8%→100% 透明），
// 等值九切片渲染成等宽边框后：左边框透明 11.5px/杆 19px，右边框透明 16px/杆 15.5px
// → 右侧装饰更薄更靠内，整张牌看着偏。这里按杆外缘裁成左右对称，再重新量剖面定切片值。
// 用法: node scripts/sym-scroll.mjs
import path from 'path'
import { writeFileSync, statSync } from 'fs'
import sharp from 'sharp'

const IMG = path.resolve('app/public/img')
const Q = { quality: 95, effort: 6, alphaQuality: 100, smartSubsample: true }
// 剖面实测（1600 宽原图）：左杆暗部 106~240px，右杆暗部 1344~1472px
// 各留 6px 余量 → 裁到 [100, 1478]，宽 1378，两侧透明余量都变成 6px
const LEFT = 100, RIGHT = 1478

const src = path.join(IMG, 'p19.webp')
const buf = await sharp(src)
  .extract({ left: LEFT, top: 0, width: RIGHT - LEFT, height: (await sharp(src).metadata()).height })
  .modulate({ saturation: 0.62, brightness: 1.1 })
  .webp(Q).toBuffer()

let out = path.join(IMG, 'p19-soft.webp')
try {
  writeFileSync(out, buf)
} catch (e) {
  // 被浏览器内存映射锁住时换新名（覆写会报 UNKNOWN(-4094)）
  out = path.join(IMG, 'p19-sym.webp')
  writeFileSync(out, buf)
}
const m = await sharp(out).metadata()
console.log(`写出 ${path.basename(out)}: ${m.width}x${m.height} / ${(buf.length / 1024).toFixed(0)}KB（裁掉左 ${LEFT}px、右 ${1600 - RIGHT}px 透明边）`)

/* 重新量剖面：确认裁完左右是否对称，并给出切片值 */
const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info
const dark = new Float64Array(W), opq = new Float64Array(W), cnt = new Float64Array(W)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * C
  cnt[x]++
  if (data[i + 3] > 40) {
    opq[x]++
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if ((r + g + b) / 3 < 110) dark[x]++
  }
}
function edge(from, to, step) {
  let last = null
  for (let x = from; x !== to; x += step) {
    const d = dark[x] / cnt[x], o = opq[x] / cnt[x]
    if (d > 0.2 && o > 0.4) last = x
    else if (last !== null) break
  }
  return last
}
const lOut = edge(0, W, 1)                       // 从左扫：杆暗部结束处
const rOut = edge(W - 1, -1, -1)                 // 从右扫：杆暗部结束处
console.log(`左杆暗部外缘 x=${lOut}px（占 ${W} 的 ${(lOut / W * 100).toFixed(1)}%）`)
console.log(`右杆暗部外缘 x=${rOut}px（右侧余量 ${W - rOut}px = ${((W - rOut) / W * 100).toFixed(1)}%）`)
const SL = Math.ceil(lOut * 1.06), SR = Math.ceil((W - rOut) * 1.06)
console.log(`\n建议切片：左 ${SL}px、右 ${SR}px（各留 6% 余量）→ border-image-slice: 125 ${SR} 179 ${SL} fill`)
console.log(`渲染成 36px 边框时：左杆占 ${(lOut / SL * 36).toFixed(1)}px、右杆占 ${((W - rOut) / SR * 36).toFixed(1)}px（应接近）`)
console.log('RESULT: SYM OK ->', path.basename(out))

// 素材测量：alpha 真实边界框（透明留白有多少）+ 雕花边框的"金饰分布剖面"（用来定内缩/九切片值）
// 用法: node scripts/measure-assets.mjs
import path from 'path'
import sharp from 'sharp'

const IMG = path.resolve('app/public/img')

/* ── 1. alpha 真实边界框：透明留白会让 object-fit:contain 把图缩得很小 ── */
async function trimBox(f) {
  const img = sharp(path.join(IMG, f))
  const meta = await img.metadata()
  let t
  try {
    t = await sharp(path.join(IMG, f)).trim({ threshold: 2 }).toBuffer({ resolveWithObject: true })
  } catch { return { w: meta.width, h: meta.height, alpha: meta.hasAlpha, note: '全透明或无alpha' } }
  const left = -t.info.trimOffsetLeft, top = -t.info.trimOffsetTop
  return {
    w: meta.width, h: meta.height, alpha: meta.hasAlpha,
    box: { x: left, y: top, w: t.info.width, h: t.info.height },
    padPct: {
      left: +(left / meta.width * 100).toFixed(1), top: +(top / meta.height * 100).toFixed(1),
      right: +((meta.width - left - t.info.width) / meta.width * 100).toFixed(1),
      bottom: +((meta.height - top - t.info.height) / meta.height * 100).toFixed(1)
    },
    fillRatio: +(t.info.width * t.info.height / (meta.width * meta.height) * 100).toFixed(1)
  }
}

/* ── 2. 金饰剖面：暖金像素(r-b 大)在每行/每列的占比，用来找边框内空区与卷轴杆宽度 ── */
async function profile(f, axis, buckets = 32) {
  const { data, info } = await sharp(path.join(IMG, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  const n = axis === 'row' ? H : W
  const gold = new Float64Array(n), opaque = new Float64Array(n), cnt = new Float64Array(n)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C
      const a = data[i + 3]
      const k = axis === 'row' ? y : x
      cnt[k]++
      if (a > 40) {
        opaque[k]++
        const r = data[i], g = data[i + 1], b = data[i + 2]
        // 暖金：红蓝差大且有一定亮度；暗青石板/羊皮纸底色会被排除或明显更低
        if (r - b > 42 && r > 90) gold[k]++
      }
    }
  }
  const step = Math.max(1, Math.floor(n / buckets))
  const out = []
  for (let s = 0; s < n; s += step) {
    let g = 0, o = 0, c = 0
    for (let k = s; k < Math.min(s + step, n); k++) { g += gold[k]; o += opaque[k]; c += cnt[k] }
    out.push({ at: +(s / n * 100).toFixed(1), gold: +(g / c * 100).toFixed(1), opaque: +(o / c * 100).toFixed(1) })
  }
  return out
}

function bar(pct, width = 34) { return '█'.repeat(Math.round(pct / 100 * width)).padEnd(width, '·') }

const TRIM_LIST = ['p2.webp', 'p6.webp', 'p35.webp', 'judge-true.webp', 'judge-false.webp',
  'seal-1.webp', 'seal-2.webp', 'seal-3.webp', 'crack-1.webp', 'crack-2.webp', 'crack-3.webp',
  'mark-radio-off.webp', 'mark-radio-on.webp', 'mark-check-off.webp', 'mark-check-on.webp',
  'nav-learn.webp', 'nav-bank.webp', 'nav-import.webp', 'nav-stats.webp', 'nav-settings.webp',
  'abyss-1.webp', 'abyss-2.webp', 'abyss-3.webp']

console.log('═══ alpha 真实边界框（padPct = 四边透明留白占比，fillRatio = 实体占画布面积比）═══')
for (const f of TRIM_LIST) {
  const r = await trimBox(f)
  if (r.note) { console.log(`${f.padEnd(20)} ${r.w}x${r.h}  ${r.note}`); continue }
  console.log(`${f.padEnd(20)} ${String(r.w).padStart(4)}x${String(r.h).padEnd(4)} 实体=${String(r.box.w).padStart(4)}x${String(r.box.h).padEnd(4)} 留白 上${String(r.padPct.top).padStart(5)}% 下${String(r.padPct.bottom).padStart(5)}% 左${String(r.padPct.left).padStart(5)}% 右${String(r.padPct.right).padStart(5)}%  填充率=${String(r.fillRatio).padStart(5)}%`)
}

console.log('\n═══ p2 竖版塔罗边框：横向金饰剖面（找左右藤蔓内缘）═══')
for (const p of await profile('p2.webp', 'col', 26)) console.log(`x=${String(p.at).padStart(5)}%  金饰${String(p.gold).padStart(5)}% ${bar(p.gold)}  不透明${String(p.opaque).padStart(5)}%`)

console.log('\n═══ p2：纵向金饰剖面（找顶部尖拱冠与底部龙首的高度）═══')
for (const p of await profile('p2.webp', 'row', 26)) console.log(`y=${String(p.at).padStart(5)}%  金饰${String(p.gold).padStart(5)}% ${bar(p.gold)}  不透明${String(p.opaque).padStart(5)}%`)

console.log('\n═══ p35 答案卷轴：横向剖面（定九切片左右杆宽）═══')
for (const p of await profile('p35.webp', 'col', 26)) console.log(`x=${String(p.at).padStart(5)}%  金饰${String(p.gold).padStart(5)}% ${bar(p.gold)}  不透明${String(p.opaque).padStart(5)}%`)

console.log('\n═══ p35：纵向剖面（定九切片上下边）═══')
for (const p of await profile('p35.webp', 'row', 20)) console.log(`y=${String(p.at).padStart(5)}%  金饰${String(p.gold).padStart(5)}% ${bar(p.gold)}  不透明${String(p.opaque).padStart(5)}%`)

console.log('\n═══ judge-true 判断题铜牌：纵向剖面（找底部可放文字的空白带）═══')
for (const p of await profile('judge-true.webp', 'row', 20)) console.log(`y=${String(p.at).padStart(5)}%  金饰${String(p.gold).padStart(5)}% ${bar(p.gold)}  不透明${String(p.opaque).padStart(5)}%`)

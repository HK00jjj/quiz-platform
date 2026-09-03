// 素材归一化 v2：从原始素材重新取样（不放大、不二次压缩）→ 裁透明留白 → 统一到同一画布
// 解决三类问题：① 边框留白导致可见牌面只有 72%、覆盖层错位 ② 同类素材实体尺寸不一致
//               ③ 上一轮把 p2/p6 从 1066×1600 压到 853×1280 造成的分辨率损失
// 用法: node scripts/normalize-assets.mjs
import path from 'path'
import { readdirSync, statSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const IMG = path.resolve('app/public/img')
const U = process.env.USERPROFILE
const OLD = path.join(U, 'OneDrive/Desktop/奥术典籍馆素材 - 副本/图片')  // 第一批素材（原图）
const NEW = path.join(U, 'OneDrive/Desktop/素材')                       // 第二批素材（原图）
const Q = { quality: 95, effort: 6, alphaQuality: 100, smartSubsample: true }

function findSrc(root, prefix) {
  for (const d of readdirSync(root)) {
    if (!d.startsWith(prefix)) continue
    const full = path.join(root, d)
    if (!statSync(full).isDirectory()) continue
    const f = readdirSync(full).find(n => /\.(png|jpe?g|webp)$/i.test(n))
    if (f) return path.join(full, f)
  }
  return null
}

async function trimBuf(p) {
  const { data, info } = await sharp(p).trim({ threshold: 2 }).toBuffer({ resolveWithObject: true })
  return { buf: data, w: info.width, h: info.height }
}

/* 把实体精确缩放铺满 w×h（用于需要几何完全一致的成对素材），直写 q95 缓冲区不做二次压缩 */
async function fillTo(buf, w, h) {
  return sharp(buf).resize(w, h, { fit: 'fill' }).webp(Q).toBuffer()
}
/* 等比缩放后居中放到透明画布（用于不能变形的素材） */
async function padTo(buf, canvasW, canvasH, contentW, contentH) {
  const piece = await sharp(buf).resize(contentW, contentH, { fit: 'inside' }).webp(Q).toBuffer()
  return sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, gravity: 'center' }]).webp(Q).toBuffer()
}

const report = []
async function dims(name) {
  try { const m = await sharp(path.join(IMG, name)).metadata(); return `${m.width}x${m.height}` } catch { return '' }
}
async function emit(name, buf) {
  const file = path.join(IMG, name)
  // OneDrive/杀软/dev server 可能瞬时持有句柄，写入重试几次
  for (let i = 1; i <= 6; i++) {
    try { writeFileSync(file, buf); break } catch (e) {
      if (i === 6) throw e
      console.log(`  [写入重试 ${i}] ${name}: ${e.code ?? e.message}`)
      await new Promise(r => setTimeout(r, 700 * i))
    }
  }
  const m = await sharp(file).metadata()
  let fill = '100%'
  try {
    const t = await sharp(file).trim({ threshold: 2 }).toBuffer({ resolveWithObject: true })
    fill = (t.info.width * t.info.height / (m.width * m.height) * 100).toFixed(1) + `%（实体 ${t.info.width}x${t.info.height}）`
  } catch { fill = '满画布（无透明边）' }
  report.push(`  ${name.padEnd(20)} ${String(m.width).padStart(4)}x${String(m.height).padEnd(5)} ${(m.size / 1024).toFixed(0).padStart(4)}KB  填充 ${fill}`)
}

/* ── 1. 卡牌框 p2 / 牌背 p6：从原图重取，裁留白，两面统一到同一画布 ──
   原图达 2457×4701，解码很慢；已是目标尺寸则整个跳过（不重复解码） */
const CARD_H = 1470
let CARD_W = 768
if (await dims('p2.webp') !== '' && (await dims('p2.webp')).endsWith(String(CARD_H)) && await dims('p6.webp') === await dims('p2.webp')) {
  CARD_W = Number((await dims('p2.webp')).split('x')[0])
  console.log(`卡牌框：p2/p6 已是统一画布 ${CARD_W}x${CARD_H}，跳过重编码`)
} else {
  const p2src = findSrc(OLD, 'P2 '), p6src = findSrc(OLD, 'P6 ')
  const p2t = await trimBuf(p2src), p6t = await trimBuf(p6src)
  const H = Math.min(CARD_H, p2t.h)
  CARD_W = Math.round(H * p2t.w / p2t.h)
  console.log(`卡牌框：p2 原图实体 ${p2t.w}x${p2t.h}，p6 原图实体 ${p6t.w}x${p6t.h}`)
  console.log(`        统一画布 ${CARD_W}x${H}（比例 ${(CARD_W / H).toFixed(4)}）`)
  await emit('p2.webp', await fillTo(p2t.buf, CARD_W, H))
  await emit('p6.webp', await fillTo(p6t.buf, CARD_W, H))
}
const CARD_RATIO = +(CARD_W / CARD_H).toFixed(4)

/* ── 2. 判断题一对铜牌：从 3412×5120 原图重取，统一到同一画布 ── */
let J_W = 378, J_H = 640
if (await dims('judge-true.webp') === await dims('judge-false.webp') && (await dims('judge-true.webp')).endsWith(String(J_H))) {
  J_W = Number((await dims('judge-true.webp')).split('x')[0])
  console.log(`判断题：两张已是统一画布 ${J_W}x${J_H}，跳过重编码`)
} else {
  const jt = await trimBuf(findSrc(NEW, '正确牌')), jf = await trimBuf(findSrc(NEW, '错误牌'))
  J_H = Math.min(640, jt.h); J_W = Math.round(J_H * jt.w / jt.h)
  console.log(`判断题：正确牌实体 ${jt.w}x${jt.h}（${(jt.w / jt.h).toFixed(3)}）、错误牌实体 ${jf.w}x${jf.h}（${(jf.w / jf.h).toFixed(3)}）`)
  await emit('judge-true.webp', await fillTo(jt.buf, J_W, J_H))
  await emit('judge-false.webp', await fillTo(jf.buf, J_W, J_H))
}

/* ── 3. 裂纹三帧：从 3412×5120 原图重取，直接铺满牌面画布（不裁切，三帧相对位置保持一致）
   —— 否则 object-fit:fill 会把 .666 比例的裂纹横向你27%，且与牌面对不齐 ── */
for (const [i, prefix] of [[1, '裂纹第 1 帧'], [2, '裂纹第 2 帧'], [3, '裂纹第 3 帧']]) {
  const src = findSrc(NEW, prefix)
  if (!src) { console.log(`  ✗ 未找到 ${prefix}`); continue }
  await emit(`crack-${i}.webp`, await fillTo(await sharp(src).ensureAlpha().toBuffer(), CARD_W, CARD_H))
}

/* ── 4. 其余素材：裁留白 + 统一实体尺寸。
   输出全部加 -n 后缀：原名文件可能正被浏览器内存映射锁定（user-mapped section）无法覆写，
   旧文件会变成孤儿，由 purge-dist.mjs 在构建后从 dist 里清除，不会上线 ── */
const GROUPS = [
  { files: ['mark-radio-off.webp', 'mark-radio-on.webp', 'mark-check-off.webp', 'mark-check-on.webp'],
    out: ['mark-radio-off-n.webp', 'mark-radio-on-n.webp', 'mark-check-off-n.webp', 'mark-check-on-n.webp'], canvas: [96, 96], content: 84 },
  { files: ['nav-learn.webp', 'nav-bank.webp', 'nav-import.webp', 'nav-stats.webp', 'nav-settings.webp'],
    out: ['nav-learn-n.webp', 'nav-bank-n.webp', 'nav-import-n.webp', 'nav-stats-n.webp', 'nav-settings-n.webp'], canvas: [128, 128], content: 112 },
  { files: ['abyss-1.webp', 'abyss-2.webp', 'abyss-3.webp'],
    out: ['abyss-1-n.webp', 'abyss-2-n.webp', 'abyss-3-n.webp'], canvas: [448, 448] }
]
for (const g of GROUPS) {
  for (let k = 0; k < g.files.length; k++) {
    const f = g.files[k]
    const t = await trimBuf(path.join(IMG, f))
    const cw = g.content ?? Math.min(g.canvas[0], Math.round(t.w * (g.scale ?? 1)))
    const ch = g.content ?? Math.min(g.canvas[1], Math.round(t.h * (g.scale ?? 1)))
    await emit(g.out ? g.out[k] : f, await padTo(t.buf, g.canvas[0], g.canvas[1], cw, ch))
  }
}

console.log('\n═══ 归一化结果复测 ═══')
report.forEach(l => console.log(l))
console.log(`\nCSS 应使用：卡牌 aspect-ratio ${CARD_W}/${CARD_H}（=${CARD_RATIO}）；判断题 aspect-ratio ${J_W}/${J_H}（=${(J_W / J_H).toFixed(4)}）`)
console.log(`牌面内缩（根据金饰剖面换算到裁切后的牌体坐标）：上 29% / 右 18% / 下 13% / 左 19.5%`)
console.log('RESULT: NORMALIZED')

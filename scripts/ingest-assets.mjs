// 摄入用户新提供的素材：按显示尺寸分级降采样 + WebP（细线/雕花类 q95 + alphaQuality 100）
// 用法: node scripts/ingest-assets.mjs
import { readdirSync, statSync, existsSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

const SRC = path.join(process.env.USERPROFILE, 'OneDrive/Desktop/素材')
const OUT = path.resolve('app/public/img')

/* [源文件夹名前缀, 输出名, 最长边上限, 质量] */
const MAP = [
  ['修习', 'nav-learn', 128, 95],
  ['秘典', 'nav-bank', 128, 95],
  ['誊写', 'nav-import', 128, 95],
  ['星象', 'nav-stats', 128, 95],
  ['工坊', 'nav-settings', 128, 95],
  ['圆形单选框（未选中', 'mark-radio-off', 96, 95],
  ['圆形单选框（选中', 'mark-radio-on', 96, 95],
  ['方形复选框（未选中', 'mark-check-off', 96, 95],
  ['方形复选框（选中', 'mark-check-on', 96, 95],
  ['正确牌', 'judge-true', 512, 95],
  ['错误牌', 'judge-false', 512, 95],
  ['蜡封完整态', 'seal-1', 256, 95],
  ['蜡封半碎裂态', 'seal-2', 256, 95],
  ['蜡封碎裂态', 'seal-3', 256, 95],
  ['裂纹第 1 帧', 'crack-1', 1024, 95],
  ['裂纹第 2 帧', 'crack-2', 1024, 95],
  ['裂纹第 3 帧', 'crack-3', 1024, 95],
  ['深渊剪影 1', 'abyss-1', 448, 92],
  ['深渊剪影 2', 'abyss-2', 448, 92],
  ['深渊剪影 3', 'abyss-3', 448, 92]
]

function findImage(prefix) {
  for (const d of readdirSync(SRC)) {
    if (!d.startsWith(prefix)) continue
    const full = path.join(SRC, d)
    if (!statSync(full).isDirectory()) continue
    const f = readdirSync(full).find(n => /\.(png|jpe?g|webp)$/i.test(n))
    if (f) return { dir: d, file: path.join(full, f) }
  }
  return null
}

let totalIn = 0, totalOut = 0
console.log('摄入素材（显示尺寸的 3~5 倍余量，细线类 q95）:')
for (const [prefix, name, max, q] of MAP) {
  const hit = findImage(prefix)
  if (!hit) { console.log(`  ✗ 未找到: ${prefix}`); continue }
  const srcSize = statSync(hit.file).size
  const out = path.join(OUT, name + '.webp')
  const info = await sharp(hit.file)
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: q, effort: 6, alphaQuality: 100, smartSubsample: true })
    .toFile(out)
  totalIn += srcSize; totalOut += info.size
  console.log(`  ${name.padEnd(16)} ${hit.dir.slice(0, 22).padEnd(24)} ${Math.round(srcSize / 1024)}KB -> ${Math.round(info.size / 1024)}KB  ${info.width}x${info.height}  alpha=${info.hasAlpha}`)
}
console.log(`\n源图合计 ${(totalIn / 1048576).toFixed(1)} MB -> 输出 ${(totalOut / 1048576).toFixed(2)} MB`)
const all = readdirSync(OUT)
console.log(`public/img 现有 ${all.length} 张 / ${(all.reduce((s, f) => s + statSync(path.join(OUT, f)).size, 0) / 1048576).toFixed(2)} MB`)

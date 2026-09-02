// 用 sharp 压缩全部素材：最长边 1600，无透明转 JPEG q80
import sharp from 'sharp'
import { readdirSync, statSync, existsSync, mkdirSync } from 'fs'
import { join, basename } from 'path'

const SRC = process.argv[2]
const DST = process.argv[3]
if (!existsSync(DST)) mkdirSync(DST, { recursive: true })

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.toLowerCase().endsWith('.png')) out.push(p)
  }
  return out
}

function shortName(file) {
  const dir = basename(file.replace(/\\/g, '/').split('/').slice(0, -1).join('/'))
  const m1 = dir.match(/P(\d+)-(\d)/)
  if (m1) return `p${m1[1]}-${m1[2]}`
  const m2 = dir.match(/P(\d+[A-B]?)/)
  if (!m2) return basename(file, '.png')
  return 'p' + m2[1].toLowerCase()
}

const files = walk(SRC)
const used = new Set()
let ok = 0, fail = 0
for (const f of files) {
  let name = shortName(f)
  if (used.has(name)) name = name + '-b'
  used.add(name)
  try {
    const img = sharp(f, { limitInputPixels: 300e6 })
    const meta = await img.metadata()
    const resized = sharp(f, { limitInputPixels: 300e6 }).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    const hasAlpha = meta.hasAlpha === true
    if (hasAlpha) {
      await resized.png({ quality: 88 }).toFile(join(DST, name + '.png'))
    } else {
      await resized.flatten({ background: { r: 13, g: 17, b: 23 } }).jpeg({ quality: 80 }).toFile(join(DST, name + '.jpg'))
    }
    ok++
    console.log('ok', name, meta.width + 'x' + meta.height)
  } catch (e) {
    fail++
    console.log('FAIL', name, String(e.message).slice(0, 80))
  }
}
console.log(`DONE ok=${ok} fail=${fail}`)

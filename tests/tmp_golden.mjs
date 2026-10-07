// 临时工具（2026-10-06 审查 P3）：normalizeSpeech 表驱动重构的行为等价性闸。
// dump：对 bank.json 全部题面文本（stem/options/explanation）计算 normalizeSpeech
//       输出的 sha256 指纹，存 tmp_golden.json（必须在重构前跑）。
// check：重构后重算并逐条对比，任何一条 DIFF 即退出码 1（禁止部署）。
// 用法：node tests/tmp_golden.mjs dump|check ；用完删除本文件。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { normalizeSpeech } from '../src/lib/tts.js'

const bankPath = new URL('../public/data/bank.json', import.meta.url)
const goldenPath = new URL('./tmp_golden.json', import.meta.url)
const bank = JSON.parse(readFileSync(bankPath, 'utf8'))
const mode = process.argv[2] || 'check'

const texts = []
for (const q of bank.rows) {
  if (q.stem) texts.push([q.id + '|stem', q.stem])
  if (q.options) texts.push([q.id + '|opts', q.options.join('\n')])
  if (q.explanation) texts.push([q.id + '|expl', q.explanation])
}
const h = (s) => createHash('sha256').update(normalizeSpeech(s), 'utf8').digest('hex').slice(0, 16)

if (mode === 'dump') {
  const map = {}
  for (const [k, t] of texts) map[k] = h(t)
  writeFileSync(goldenPath, JSON.stringify({ rev: bank.rev, count: texts.length, map }))
  console.log(`GOLDEN DUMP OK rev=${bank.rev} texts=${texts.length}`)
} else {
  if (!existsSync(goldenPath)) { console.log('NO GOLDEN（先在重构前跑 dump）'); process.exit(1) }
  const g = JSON.parse(readFileSync(goldenPath, 'utf8'))
  let diff = 0
  for (const [k, t] of texts) {
    const v = h(t)
    if (g.map[k] !== v) { if (diff < 5) console.log('DIFF', k, 'old=' + g.map[k], 'new=' + v); diff++ }
  }
  const okAll = diff === 0 && texts.length === g.count
  console.log(okAll ? `GOLDEN CHECK OK texts=${texts.length}（golden rev=${g.rev} count=${g.count}）` : `GOLDEN DIFF=${diff}/${texts.length}（golden count=${g.count} rev=${g.rev}）`)
  process.exit(okAll ? 0 : 1)
}

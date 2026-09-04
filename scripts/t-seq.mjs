/* 全局入库序 assignGlobalSeq 的回归测试。
   直接 import 真实源码（比照 t-fill.mjs 的做法），不复制逻辑——复制的话测的就不是上线的东西。
   跑法：node scripts/t-seq.mjs      退出码 0=全过，1=有失败 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const { assignGlobalSeq } = await import(
  pathToFileURL(path.join(here, '..', 'app', 'src', 'lib', 'validate.js')).href
)

let pass = 0
const fails = []
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++
  else fails.push(`  FAIL ${name}\n    got  ${g}\n    want ${w}`)
}
const seqs = (a) => a.map((q) => q.seq)
const ids = (a) => a.map((q) => q.id)
/* 造一批题：批内序号 1..n、id 带批次前缀，模拟命题协议里每批序号都从 1 开始 */
const batch = (tag, n = 21) => Array.from({ length: n }, (_, i) => ({ id: `${tag}_${i + 1}`, seq: i + 1, stem: `${tag} 第${i + 1}题` }))
const seqList = (n, from = 1) => Array.from({ length: n }, (_, i) => from + i)

/* ① 空库导第一批：批内序原样保留（maxSeq = 0） */
const afterA = assignGlobalSeq(batch('A'), [])
t('① 空库导第一批 21 题，seq 原样 1..21', seqs(afterA), seqList(21))

/* ② 库里已有 A(1..21)，再导 B：整批接到 22..42 */
t('② 已有 A 后导 B，B 得到 22..42', seqs(assignGlobalSeq(batch('B'), afterA)), seqList(21, 22))

/* ③ 重复导入同一批：已在库里的题沿用原 seq，不往后推 */
t('③ 重复导入 A，seq 仍是 1..21（不重排）', seqs(assignGlobalSeq(batch('A'), afterA)), seqList(21))

/* ④ 三批连续导入后按 seq 排序，必须是 A 全部 → B 全部 → C 全部。
      这是本次改动的真正目的：组卷 learn/wrong/relearn 三条路径都 sort by seq，
      改之前会得到「各批第1题、各批第2题…」把命题协议的认知阶梯打散。 */
const afterB = afterA.concat(assignGlobalSeq(batch('B'), afterA))
const afterC = afterB.concat(assignGlobalSeq(batch('C'), afterB))
const ordered = [...afterC].sort((a, b) => a.seq - b.seq)
t('④ 三批共 63 题按 seq 排序 = A→B→C 完整分段',
  ids(ordered), [...ids(batch('A')), ...ids(batch('B')), ...ids(batch('C'))])
t('④b 全局 seq 恰好是 1..63，无重复无空洞', seqs(ordered), seqList(63))

/* ⑤ 部分重复：库里只有 A 的前 5 题，再导整批 A */
const partial = afterA.slice(0, 5)
const merged = assignGlobalSeq(batch('A'), partial)
t('⑤ 已存在的 5 题保持 1..5', seqs(merged).slice(0, 5), seqList(5))
t('⑤b 其余 16 题接在 maxSeq(5) 之后 = 11..26', seqs(merged).slice(5), seqList(16, 11))
t('⑤c 新题全部严格大于所有已有 seq',
  merged.filter((q) => !partial.some((p) => p.id === q.id)).every((q) => q.seq > 5), true)

/* ⑥ existing 传 Map 与传数组必须等价（store.js 传的是 Map） */
const asMap = new Map(afterA.map((q) => [q.id, q]))
t('⑥ existing 传 Map 与传数组等价',
  seqs(assignGlobalSeq(batch('B'), asMap)), seqs(assignGlobalSeq(batch('B'), afterA)))

/* ⑦ 边界：existing 为 undefined / null 都不能炸 */
t('⑦ existing=undefined 不炸', seqs(assignGlobalSeq(batch('D'), undefined)), seqList(21))
t('⑦b existing=null 不炸', seqs(assignGlobalSeq(batch('D'), null)), seqList(21))

/* ⑧ 边界：incoming 的 seq 非法。校验器理论上会拦掉（缺少有效序号），但函数本身不能产出 NaN */
t('⑧ seq 缺失 / 为 -1 时退化成 maxSeq+0，不产生 NaN',
  seqs(assignGlobalSeq([{ id: 'x1' }, { id: 'x2', seq: -1 }], afterA)), [21, 21])
t('⑧b incoming=undefined 返回空数组', assignGlobalSeq(undefined, afterA), [])

/* ⑨ 删题后 maxSeq 回落：库里只剩 seq 1..5，新批应接在 6 之后 */
t('⑨ 删到只剩 5 题后导新批，得到 6..26',
  seqs(assignGlobalSeq(batch('E'), partial)), seqList(21, 6))

/* ⑩ 不可变性：返回新对象，入参数组与入参对象都不能被就地改掉
      （store.js 里 parsed.questions 之后还要参与 added 统计与返回值） */
const srcBatch = batch('F')
const out = assignGlobalSeq(srcBatch, [{ id: 'F_1', seq: 99 }])
t('⑩ 原批次数组的 seq 未被就地修改', seqs(srcBatch), seqList(21))
t('⑩b 返回的是新对象而非同一引用', out[1] === srcBatch[1], false)

console.log(`\n通过 ${pass} / ${pass + fails.length}`)
if (fails.length > 0) { console.log(fails.join('\n')); process.exit(1) }
console.log('ALL PASS')

// 全站文案清理：只处理「哥特残留」——第一轮 codemod 漏掉的那些。
//
// ⚠️ 教训（本文件被重写过一次）：之前把第二轮"糖果→直白中文"的映射也留在 MAP 里"以备再用"，
// 结果在已回滚到糖果版的工作区上重跑，把 16 个文件 156 处糖果文案又改成了直白版，
// 等于悄悄推翻了用户明确要求的回滚。codemod 的 MAP 必须只包含"当前这一轮真正想要的方向"，
// 历史映射要删掉而不是注释保留——脚本是可重复执行的，留着就会被执行。
//
// 用法: node scripts/candy-copy.mjs          （加 --dry 只报告不写）
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import path from 'path'

const DRY = process.argv.includes('--dry')
const ROOTS = ['app/src']
const EXT = /\.(jsx?|css|html)$/

/* 只保留：哥特残留 → 糖果版应有的措辞（依据《果冻糖果.txt》5.4 / 5.5 / 5.7 / 4.10）
   有序：长句在前，否则会被后面的短词先改写导致整句匹配不上。 */
const MAP = [
  ['把「命题流水线」产出的题库 JSON 导入到导入厅，即可开始翻阅题库、间隔参悟与污染净化。',
    '把外部 AI 生成的题目 JSON 导入到导入页，就可以开始做题、间隔复习与错题重练。'],
  ['典籍馆设置 · 调配你的修行器具', '题库设置 · 整理你的糖果抽屉'],
  ['清空题库、复习卡片与全部参悟记录。此操作不可撤销，请先封印记忆（导出备份）。',
    '清空当前题库的题目、复习卡片与全部做题记录。此操作不可撤销，请先封装记忆（导出备份）。'],
  ['炼 金 工 坊', '糖 果 抽 屉'],
  ['炼金熔炉', '糖果熔炉'],
  ['典籍馆尚无题库', '题库还是空的'],
  ['🔮 前往导入厅', '🍬 去导入'],
  ['题到期符文等待参悟', '道题到期等待复习'],
  ['甜蜜值已稳定燃烧', '已连续学习'],
  ['参悟目标', '每日目标'],
  ['间隔参悟', '间隔复习'],
  ['参悟记录', '做题记录'],
  ['参悟', '做题'],
  ['污染净化', '错题重练'],
  ['翻阅次数', '做题次数'],
  ['翻阅题库', '做题'],
  ['导入厅', '导入页'],
  ['回溯通道', '备份恢复'],
  ['封印记忆', '封装记忆'],
  ['已封印导出', '已导出'],
  ['命题流水线', '外部 AI'],
  ['守秘人', '尝味师'],
  // 注意：不要加 ['典籍馆','xxx'] 这类短词——会把品牌名「奥术典籍馆」改成「奥术xxx」。
  // 需要改的「典籍馆尚无题库」「典籍馆设置」已由上面的长句精确命中。
]

/* 「卷」只在计数语境替换（第 N 卷 / 共 N 卷），不碰 卷轴/卷宗/卷起 */
const RE = [
  [/(第\s*[^卷\s]{1,6}\s*)卷/g, '$1题'],
  [/(\}\s*)卷/g, '$1题'],
  [/卷(\s*\/\s*共)/g, '题$1'],
  [/(共\s*[^卷\s]{1,8}\s*)卷/g, '$1题'],
]

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) { if (name !== 'node_modules' && name !== 'dist') yield* walk(full) }
    else if (EXT.test(name)) yield full
  }
}

const hits = new Map()
let files = 0, total = 0
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const before = readFileSync(file, 'utf8')
    let after = before
    const per = []
    for (const [from, to] of MAP) {
      const n = after.split(from).length - 1
      if (n) { after = after.split(from).join(to); per.push(`${from}→${to} ×${n}`); total += n }
    }
    for (const [re, to] of RE) {
      const n = (after.match(re) || []).length
      if (n) { after = after.replace(re, to); per.push(`${re} ×${n}`); total += n }
    }
    if (after !== before) {
      files++
      hits.set(file, per)
      if (!DRY) writeFileSync(file, after)
    }
  }
}
for (const [f, per] of hits) console.log(`${f}\n   ${per.join('\n   ')}`)
console.log(`\n${DRY ? '[DRY] ' : ''}改动 ${files} 个文件，共 ${total} 处`)
console.log('RESULT: COPY OK')

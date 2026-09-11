// v6.9 错因标签回归锁（2026-09-11）：[错因:…] 可选、枚举内放行、枚举外报错、多于一个报错
// 运行：node tests/expl-cause.regression.mjs （在 app 目录下）
import { validateItems } from '../src/lib/validate.js'

let pass = 0, fail = 0
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log('  PASS ' + name) }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' :: ' + detail : '')) }
}
const errs = (issues) => issues.filter((i) => i.level === '错误')

const base = (over = {}) => ({
  序号: 1, 题型: '单选题', 难度: '基础', 知识点: 'k', 知识域: 'K1', 认知层级: '记忆',
  题干: '题干？', 选项: ['A. a', 'B. b', 'C. c', 'D. d'], 答案: 'A',
  解析: '【推导】x【误诊】选B者误以为y【记忆点】z', ...over
})

// ① 无标签：行为不变（存量题不失效），且不得出现"错因"相关错误
{
  const r = validateItems([base()], false)
  check('no tag: no cause-related error', r.every((i) => !i.message.includes('错因')))
}

// ② 合法枚举标签：放行
{
  const r = validateItems([base({ 解析: '【推导】x【误诊】选B者误以为y【记忆点】z[错因:概念缺失]' })], false)
  check('valid tag passes', errs(r).length === 0, JSON.stringify(r.map((i) => i.message)))
}

// ③ 全角冒号兼容：[错因：公式误用] 放行
{
  const r = validateItems([base({ 解析: '【推导】x【误诊】选B者误以为y【记忆点】z[错因：公式误用]' })], false)
  check('fullwidth colon passes', errs(r).length === 0, JSON.stringify(r.map((i) => i.message)))
}

// ④ 枚举外标签：错误
{
  const r = validateItems([base({ 解析: '【推导】x【误诊】选B者误以为y【记忆点】z[错因:粗心大意]' })], false)
  check('off-enum tag = error', errs(r).some((i) => i.message.includes('错因')))
}

// ⑤ 两个标签：错误
{
  const r = validateItems([base({ 解析: '【推导】x【误诊】选B者误以为y【记忆点】z[错因:概念缺失][错因:公式误用]' })], false)
  check('two tags = error', errs(r).some((i) => i.message.includes('最多附一个')))
}

console.log(`\nexpl-cause regression: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

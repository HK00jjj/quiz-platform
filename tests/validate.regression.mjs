// 校验器回归基准（替代已退役的 sample-valid/invalid.json，直接对网页端 validate.js 断言）
// 运行：node tests/validate.regression.mjs （在 app 目录下）
import { validateItems, parseBackup } from '../src/lib/validate.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name) }
  else { fail++; console.log('  FAIL ' + name) }
}
const errs = (issues) => issues.filter((i) => i.level === '错误')
const warns = (issues) => issues.filter((i) => i.level === '告警')

const base = (over = {}) => ({
  序号: 1, 题型: '单选题', 难度: '基础', 知识点: 'k', 知识域: 'K1', 认知层级: '记忆',
  题干: '题干？', 选项: ['A. a', 'B. b', 'C. c', 'D. d'], 答案: 'A',
  解析: '【推导】x【误诊】选B者误以为y【记忆点】z', ...over
})

check('valid single-choice no error', errs(validateItems([base()], false)).length === 0)
{
  const r = validateItems([base({ 解析: '【推导】x【记忆点】z' })], false)
  check('missing 误诊 = warn not error', errs(r).length === 0 && warns(r).some((w) => w.message.includes('误诊')))
}
check('unknown image id = error', errs(validateItems([base({ image: 'tpl_nope' })], false)).length > 0)
check('image id|params accepted', errs(validateItems([base({ image: 'tpl_din_wiring|24|4.8' })], false)).length === 0)
check('judge bad answer = error', errs(validateItems([base({ 题型: '判断题', 选项: undefined, 答案: '对', 解析: '【推导】x【记忆点】z' })], false)).length > 0)
check('fillblank mismatch = error', errs(validateItems([base({ 题型: '填空题', 选项: undefined, 题干: 'a{b}c', 答案: 'b|extra', 解析: '【推导】x【记忆点】z' })], false)).length > 0)
check('analysis missing 记忆点 = error', errs(validateItems([base({ 解析: '【推导】x【误诊】y' })], false)).length > 0)
check('multi answer unsorted = error', errs(validateItems([base({ 题型: '多选题', 选项: ['A. a', 'B. b', 'C. c', 'D. d', 'E. e'], 答案: 'BA' })], false)).length > 0)
{
  const bk = parseBackup(JSON.stringify({ questions: [{ id: 'q1', seq: 1, type: '单选题', stem: 's', answer: 'A' }], cards: [], records: [], imageMap: { q1: 'tpl_din_wiring' } }))
  check('parseBackup carries imageMap', bk && bk.imageMap && bk.imageMap.q1 === 'tpl_din_wiring')
}
// 2026-09-04 新增：B类语义下沉机器检查（按消息精确断言，避免被“数组应为21元素”等顶层错误污染）
const hasMsg = (issues, kw) => issues.some((i) => i.message.includes(kw))
check('short-answer scheme-comparison = error', hasMsg(validateItems([base({ 题型: '简答题', 选项: undefined, 题干: '给出两种方案并说明取舍', 答案: '1.a；2.b', 解析: '【推导】x【记忆点】z' })], true), '方案对比'))
check('short-answer point-style ok', !hasMsg(validateItems([base({ 题型: '简答题', 选项: undefined, 题干: '列出分组直连的适用条件与接线要点', 答案: '1.a；2.b', 解析: '【推导】x【记忆点】z' })], true), '方案对比'))
check('duplicate 知识点 in batch = error', hasMsg(validateItems([base({ 序号: 2, 知识点: 'dup' }), base({ 序号: 3, 知识点: 'dup' })], true), '批内须避重'))
check('distinct 知识点 in batch ok', !hasMsg(validateItems([base({ 序号: 2, 知识点: 'a' }), base({ 序号: 3, 知识点: 'b' })], true), '批内须避重'))
// 2026-09-04 新增：综合题双框架（设计四要素 或 诊断四要素）
check('comprehensive diagnosis-four-elements ok', !hasMsg(validateItems([base({ 题型: '综合设计/故障诊断题', 选项: undefined, 难度: '综合', 认知层级: '创造', 答案: '现象：x；可测证据：y；故障定位：z；验证方法：w', 解析: '【推导】a【记忆点】b' })], false), '两套均缺'))
check('comprehensive design-four-elements ok', !hasMsg(validateItems([base({ 题型: '综合设计/故障诊断题', 选项: undefined, 难度: '综合', 认知层级: '创造', 答案: '1.方案：a；2.选型计算：b；3.控制逻辑：c；4.保护与安全：d', 解析: '【推导】a【记忆点】b' })], false), '两套均缺'))
check('comprehensive missing both = error', hasMsg(validateItems([base({ 题型: '综合设计/故障诊断题', 选项: undefined, 难度: '综合', 认知层级: '创造', 答案: '随便答', 解析: '【推导】a【记忆点】b' })], false), '两套均缺'))

console.log(`\nregression: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)

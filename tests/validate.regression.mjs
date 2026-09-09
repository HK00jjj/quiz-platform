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
  // 2026-09-08 期望对齐：v2026-09-06 校验器（完整11类规则）把单选/多选缺【误诊】段从告警升级为错误，
  // 与规则第六章"单选/多选必须三段齐全"（纪律9）一致；旧期望"warn not error"为 9/4 版过期基准。
  const r = validateItems([base({ 解析: '【推导】x【记忆点】z' })], false)
  check('missing 误诊 = error (aligned 2026-09-06 validator)', errs(r).length > 0 && r.some((i) => i.message.includes('误诊')))
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
// 2026-09-08 通用性整改：方案对比降为启发式告警（漏检由闸4 评审兜底）——断言级别为告警且无错误级
check('short-answer scheme-comparison = warning', (() => {
  const iss = validateItems([base({ 题型: '简答题', 选项: undefined, 题干: '给出两种方案并说明取舍', 答案: '1.a；2.b', 解析: '【推导】x【记忆点】z' })], true)
  return iss.some((i) => i.level === '告警' && i.message.includes('方案对比')) &&
         !iss.some((i) => i.level === '错误' && i.message.includes('方案对比'))
})())
check('short-answer point-style ok', !hasMsg(validateItems([base({ 题型: '简答题', 选项: undefined, 题干: '列出分组直连的适用条件与接线要点', 答案: '1.a；2.b', 解析: '【推导】x【记忆点】z' })], true), '方案对比'))
check('duplicate 知识点 in batch = error', hasMsg(validateItems([base({ 序号: 2, 知识点: 'dup' }), base({ 序号: 3, 知识点: 'dup' })], true), '批内须避重'))
check('distinct 知识点 in batch ok', !hasMsg(validateItems([base({ 序号: 2, 知识点: 'a' }), base({ 序号: 3, 知识点: 'b' })], true), '批内须避重'))
// 2026-09-04 新增：综合题双框架（设计四要素 或 诊断四要素）
check('comprehensive diagnosis-four-elements ok', !hasMsg(validateItems([base({ 题型: '综合设计/故障诊断题', 选项: undefined, 难度: '综合', 认知层级: '创造', 答案: '现象：x；可测证据：y；故障定位：z；验证方法：w', 解析: '【推导】a【记忆点】b' })], false), '两套均缺'))
check('comprehensive design-four-elements ok', !hasMsg(validateItems([base({ 题型: '综合设计/故障诊断题', 选项: undefined, 难度: '综合', 认知层级: '创造', 答案: '1.方案：a；2.选型计算：b；3.控制逻辑：c；4.保护与安全：d', 解析: '【推导】a【记忆点】b' })], false), '两套均缺'))
check('comprehensive missing both = error', hasMsg(validateItems([base({ 题型: '综合设计/故障诊断题', 选项: undefined, 难度: '综合', 认知层级: '创造', 答案: '随便答', 解析: '【推导】a【记忆点】b' })], false), '两套均缺'))

// ── 2026-09-09 v4.12 自适应换挡机器核对（verdict 复算闸）──
// ctx 数据构造：kp「已掌握点」→ mastered（n=4 acc=100% fN=2 f=100%）；
//               kp「薄弱点」→ weak（n=4 acc=50% 首答错）；
//               kp「中间点」→ middle（n=2 样本不足）；其余 kp → unseen。
const gateCtx = () => ({
  questions: [
    { id: 'qm1', type: '单选题', knowledgePoint: '已掌握点' },
    { id: 'qm2', type: '判断题', knowledgePoint: '已掌握点' },
    { id: 'qw1', type: '单选题', knowledgePoint: '薄弱点' },
    { id: 'qmid1', type: '判断题', knowledgePoint: '中间点' }
  ],
  records: [
    { questionId: 'qm1', correct: true, timestamp: 1 }, { questionId: 'qm1', correct: true, timestamp: 2 }, { questionId: 'qm1', correct: true, timestamp: 3 },
    { questionId: 'qm2', correct: true, timestamp: 4 },
    { questionId: 'qw1', correct: false, timestamp: 1 }, { questionId: 'qw1', correct: true, timestamp: 2 }, { questionId: 'qw1', correct: false, timestamp: 3 }, { questionId: 'qw1', correct: true, timestamp: 4 },
    { questionId: 'qmid1', correct: true, timestamp: 1 }, { questionId: 'qmid1', correct: false, timestamp: 2 }
  ]
})
const noCtxMsg = (issues) => !issues.some((i) => i.where === '自适应闸')

check('gate inactive without ctx (backward compat)', noCtxMsg(validateItems([base({ 源题难度: '应用', 适配决策: '降档', 难度: '基础' })], false)))
check('gate: all fields absent = batch warning', hasMsg(validateItems([base({ 知识点: '新点' })], false, gateCtx()), '换挡合规未做机器核对'))
check('gate: mastered kp + 降档 = error', hasMsg(validateItems([base({ 知识点: '已掌握点', 源题难度: '应用', 适配决策: '降档', 难度: '基础' })], false, gateCtx()), '禁止降阶'))
check('gate: weak kp + 保持 = error', hasMsg(validateItems([base({ 知识点: '薄弱点', 源题难度: '应用', 适配决策: '保持', 难度: '应用' })], false, gateCtx()), '禁止保持/升档'))
check('gate: weak kp + 降档 with 层级适配 = ok', (() => {
  const iss = validateItems([base({ 知识点: '薄弱点', 源题难度: '应用', 适配决策: '降档', 难度: '基础', 解析: '【推导】层级适配：……【误诊】y【记忆点】z' })], false, gateCtx())
  return !iss.some((i) => i.level === '错误' && (i.message.includes('weak') || i.message.includes('适配决策') || i.message.includes('层级适配')))
})())
check('gate: middle kp + 升档 = error', hasMsg(validateItems([base({ 知识点: '中间点', 源题难度: '基础', 适配决策: '升档', 难度: '应用' })], false, gateCtx()), '严格保持源题档'))
check('gate: unseen kp + 保持 = ok (no adaptive error)', (() => {
  const iss = validateItems([base({ 知识点: '全新点', 源题难度: '基础', 适配决策: '保持', 难度: '基础' })], false, gateCtx())
  return !iss.some((i) => i.level === '错误' && i.message.includes('复算'))
})())
check('gate: decision vs final difficulty mismatch = error', hasMsg(validateItems([base({ 知识点: '全新点', 源题难度: '应用', 适配决策: '保持', 难度: '综合' })], false, gateCtx()), '与输出难度'))
check('gate: 降档 without 层级适配 marker = error', hasMsg(validateItems([base({ 知识点: '薄弱点', 源题难度: '应用', 适配决策: '降档', 难度: '基础' })], false, gateCtx()), '层级适配'))
check('gate: 综合+升档 declared = error', hasMsg(validateItems([base({ 知识点: '全新点', 源题难度: '综合', 适配决策: '升档', 难度: '综合', 认知层级: '创造' })], false, gateCtx()), '禁止声明升档'))

console.log(`\nregression: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)

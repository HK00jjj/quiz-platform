/* 2026-09-11 全量审查整改 · 回归锁
   锁定本轮修复的确定性行为，防止回退。跑法：node tests/review-20260911.regression.mjs
   覆盖：
   A. normId / dropNormalizedDupes —— 归一化去重（大小写、全半角），且**不改 hashId 主键**
   B. abilityOf —— EWMA 前 5 条不再被双重计入（含 n≤5 的边界语义）
   C. shuffle / shuffledOrder —— 收敛到 util.js 后语义不变（排列性、可注入 rng、不改入参）
   D. 备份自足化 —— 英文键备份可恢复（修复前恒 0 题）、书本结构随包透传、坏 map 只少恢复不写坏
   ⚠ 未能覆盖的部分（诚实声明）：考试续考上界判定（Learn.jsx 组件内）、离线待补传队列与
   store.applyBookMap 的落库动作（store.js 依赖 supabase client，Node 直跑需 mock），
   二者靠人工真机验证；本文件只锁纯函数层（parseBackup / validBookMap / normalizeBookMap）。 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
/* 本文件位于 app/tests/，源码在 app/src/（注意与 chat-1/scripts/t-*.mjs 的 ../app/src 不同） */
const url = (p) => pathToFileURL(path.join(here, '..', 'src', p)).href
const { normText, normId, hashId, dropNormalizedDupes, parseBackup, validBookMap, normalizeBookMap } = await import(url('lib/validate.js'))
const { abilityOf } = await import(url('lib/ability.js'))
const { shuffle, shuffledOrder } = await import(url('lib/util.js'))

let pass = 0
const fails = []
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++
  else fails.push(`  FAIL ${name}\n    got  ${g}\n    want ${w}`)
}
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fails.push(`  FAIL ${name} ${detail}`)
}

/* ── A：归一化去重 ── */
const Q = (stem, type, answer) => ({ stem, type, answer })
const STEM = 'PLC的中文全称是{可编程逻辑控制器}'
const A_BASE = Q(STEM, '填空题', '可编程逻辑控制器')

t('A1 normText 全角转半角 + 小写化', normText('ＰＬＣ１２３'), 'plc123')
t('A2 normText 去空白（含全角空格）',
  normText('P L C\u3000I/O'), 'plci/o')
ok('A3 normId 对大小写差异同值（这是 hashId 做不到的）',
  normId(STEM, '填空题', '可编程逻辑控制器') === normId('plc的中文全称是{可编程逻辑控制器}', '填空题', '可编程逻辑控制器'))
ok('A4 normId 对全角差异同值',
  normId(STEM, '填空题', '可编程逻辑控制器') === normId('ＰＬＣ的中文全称是｛可编程逻辑控制器｝', '填空题', '可编程逻辑控制器'))
ok('A5 hashId 保持不变（主键算法不动，避免全库 1481 题失效）',
  hashId(STEM, '填空题', '可编程逻辑控制器')
  !== hashId('plc的中文全称是{可编程逻辑控制器}', '填空题', '可编程逻辑控制器'),
  '——若此断言失败说明有人改了 hashId，必须同时提供全库迁移方案')
ok('A6 normId 带 qn_ 前缀，与主键 q_ 互不冲突',
  normId(STEM, '填空题', 'x').startsWith('qn_') && hashId(STEM, '填空题', 'x').startsWith('q_'))

{
  const r = dropNormalizedDupes([A_BASE, Q('plc的中文全称是{可编程逻辑控制器}', '填空题', '可编程逻辑控制器')], [])
  t('A7 批内归一化重复只留一题', [r.kept.length, r.dupes.length], [1, 1])
}
{
  const r = dropNormalizedDupes(
    [Q('plc的中文全称是{可编程逻辑控制器}', '填空题', '可编程逻辑控制器')], [A_BASE])
  t('A8 与库内归一化同题被剔除', [r.kept.length, r.dupes.length], [0, 1])
}
{
  const r = dropNormalizedDupes([Q('变频器的额定输出频率范围是多少', '单选题', 'B')], [A_BASE])
  t('A9 真正不同的题不被误杀', [r.kept.length, r.dupes.length], [1, 0])
}

/* ── B：EWMA 不双重计入 ── */
/* 2026-09-12 窗口语义升级为"按题去重取最近一条"（顶尖段适配②）后，构造器改为
   逐条不同 questionId——同题记录在新语义下会被去重成一票，无法再锁"记录数"口径。
   全部断言期望值一字未变（各题互异时新旧行为数学等价）。 */
const recs = (arr) => arr.map((c, i) => ({ questionId: `q${i}`, correct: c, timestamp: 1000 + i }))
t('B1 空记录 → 0.65（默认值不变）', abilityOf([]), 0.65)
t('B2 无对错字段 → 0.65（过滤口径不变）', abilityOf([{ questionId: 'q', timestamp: 1 }]), 0.65)
/* n≤5 时不再迭代 → 指数 = 前 n 条的简单比例。旧实现会给出 0.49939943…（前 5 条被算两遍） */
t('B3 n=2（1对1错）→ 恰为 0.5，证明前 5 条未被重复计入', abilityOf(recs([true, false])), 0.5)
/* 30 条：前 2 对、其余 28 错。新实现 0.16561407…；旧实现 0.16420654…（差 1.4e-3，超容差即可判回退） */
{
  const p3 = Array(30).fill(false).map((_, i) => i < 2)
  const got = abilityOf(recs(p3))
  ok('B4 30 条混合样本锁在新口径值（旧双重计入口径会差 1.4e-3 而被判失败）',
    Math.abs(got - 0.16561407620920798) < 1e-9, `got ${got}`)
}
{
  const xs = recs(Array(30).fill(true))
  ok('B5 30 条全对仍收敛到 1（上界钳制不变）', abilityOf(xs) === 1, `got ${abilityOf(xs)}`)
}
{
  /* 窗口口径不变：61 条里最早一条是"错"，只取最近 60 条 → 窗口内 60 条全对 → 恰为 1。
     若不截窗口（61 条全参与），种子会含那条"错"，结果约 0.9723（≠1）→ 该断言可判回退。 */
  const many = recs([false, ...Array(60).fill(true)])
  ok('B6 窗口仍是最近 60 条（最早一条被挤出 → 恰为 1）', abilityOf(many) === 1, `got ${abilityOf(many)}`)
}

/* ── C：洗牌收敛后语义不变 ── */
{
  const src = [1, 2, 3, 4, 5]
  const out = shuffle(src, () => 0.9)
  t('C1 shuffle 是排列（元素不多不少）', [...out].sort((a, b) => a - b), [1, 2, 3, 4, 5])
  ok('C2 shuffle 不修改入参', JSON.stringify(src) === JSON.stringify([1, 2, 3, 4, 5]))
  t('C3 shuffle 注入 rng 后可复现', shuffle(src, () => 0.9), shuffle(src, () => 0.9))
  t('C4 shuffledOrder(n) 是 0..n-1 的排列', [...shuffledOrder(5, () => 0.3)].sort((a, b) => a - b), [0, 1, 2, 3, 4])
  t('C5 shuffledOrder(0) → 空数组（不越界）', shuffledOrder(0), [])
  t('C6 shuffle([]) → 空数组', shuffle([]), [])
}

/* ── D：备份自足化（全库导出 + 书本结构随包 + 英/中字段键打通） ── */
{
  const QEN = (seq, stem, type, answer) => ({ id: hashId(stem, type, answer), seq, type, stem, answer })
  const A_ID = hashId('甲', '填空题', 'A')
  const B_ID = hashId('乙', '判断题', '正确')
  const BOOKS = {
    books: { b1: { name: '第一本' }, b2: { name: '第二本' } },
    order: ['b1', 'b2'],
    activeBookId: 'b2',
    assign: { [A_ID]: 'b1', [B_ID]: 'b2' }
  }
  /* 导出实际形状：英文键（与 store/DB 同形），两本书各一题 */
  const BACKUP = JSON.stringify({
    exportedAt: '2026-09-11T00:00:00.000Z',
    questions: [QEN(1, '甲', '填空题', 'A'), QEN(2, '乙', '判断题', '正确')],
    cards: [], records: [], imageMap: {}, books: BOOKS
  })

  const r = parseBackup(BACKUP)
  /* D1 是最重要的一条回归锁：修复前导出的备份恢复出来恒为 0 题
     （导出写英文键 stem/type/answer，toItem 只认中文键 题干/题型/答案）。 */
  t('D1 英文键备份能恢复出题（修复前恒为 0 题）', r.questions.length, 2)
  t('D2 恢复保留全局 seq（不按批内序号重排）', r.questions.map((q) => q.seq), [1, 2])
  ok('D3 恢复出的主键与 hashId 一致（主键算法未被动过）', r.questions.some((q) => q.id === A_ID))
  {
    const restored = new Set(r.questions.map((q) => q.id))
    const covered = [...new Set(Object.values(BOOKS.assign))]
      .filter((bid) => Object.entries(BOOKS.assign).some(([qid, b]) => b === bid && restored.has(qid)))
    t('D4 恢复的题目覆盖两本书（旧实现只导当前书 → 只能覆盖一本）', covered.length, 2)
  }
  ok('D5 书本结构随包透传（books/order/activeBookId/assign 齐全）',
    !!r.books && r.books.order.length === 2 && r.books.activeBookId === 'b2' && r.books.assign[A_ID] === 'b1')

  /* 中文键的历史/手工备份必须继续可用，且无 books 字段不得报错 */
  const cn = parseBackup(JSON.stringify({ questions: [{ 序号: 1, 题型: '判断题', 题干: '乙', 答案: '正确' }] }))
  t('D6 中文键旧格式仍可恢复（向后兼容）', cn.questions.length, 1)
  ok('D7 无 books 字段的旧备份不报错（books === undefined → 恢复侧跳过）', cn.books === undefined)
}
{
  ok('D8 validBookMap 拒绝垃圾（null / 空 order / 非对象）',
    !validBookMap(null) && !validBookMap({ books: {}, order: [] }) && !validBookMap('x'))
  ok('D9 validBookMap 接受合法 map',
    validBookMap({ books: { b1: { name: 'A' } }, order: ['b1'], activeBookId: 'b1', assign: {} }))
  const n = normalizeBookMap(
    { books: { b1: { name: 'A' } }, order: ['b1', 'bGONE'], activeBookId: 'bGONE', assign: { qX: 'b1', qY: 'bZ' } },
    new Set(['qX']))
  t('D10 归一化丢弃 order 里不存在的书', n.order, ['b1'])
  t('D11 activeBookId 失配回落第一本', n.activeBookId, 'b1')
  t('D12 assign 只保留指向真实书本的项（qY→bZ 被剔）', Object.keys(n.assign), ['qX'])
  const n2 = normalizeBookMap(
    { books: { b1: { name: 'A' } }, order: ['b1'], activeBookId: 'b1', assign: { qX: 'b1' } },
    new Set(['qOTHER']))
  t('D13 assign 只保留本次备份内存在的题（防坏备份指向幽灵题）', Object.keys(n2.assign), [])
}

console.log(`\n通过 ${pass} / ${pass + fails.length}`)
if (fails.length > 0) { console.log(fails.join('\n')); process.exit(1) }
console.log('ALL PASS')

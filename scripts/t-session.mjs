/* buildSession 组卷行为回归测试。
   重点覆盖本轮修的 A：review 分支原来是五条路径里唯一没走 take() 的，hero 传的 size:20 被静默丢掉。
   顺带把五种 mode 的筛选口径与排序口径全部钉住——这些是用户明确关心过的行为，
   以后谁改动 stats.js 都能立刻看出来碰坏了哪条。
   直接 import 真实源码，不复制逻辑（复制的话测的就不是上线的东西）。
   跑法：node scripts/t-session.mjs      退出码 0=全过，1=有失败 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = (p) => pathToFileURL(path.join(here, '..', 'app', 'src', p)).href
const { buildSession } = await import(url('lib/stats.js'))
const { newCard } = await import(url('lib/fsrs.js'))

let pass = 0
const fails = []
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++
  else fails.push(`  FAIL ${name}\n    got  ${g}\n    want ${w}`)
}
const ids = (a) => a.map((q) => q.id)
const seqs = (a) => a.map((q) => q.seq)

const DAY = 86400000
const NOW = 1800000000000
/* 30 道题，seq 1..30（模拟 assignGlobalSeq 之后的全局入库序）。
   题型交替，便于验证筛选。 */
const TYPES = ['单选题', '多选题', '判断题']
const questions = Array.from({ length: 30 }, (_, i) => ({
  id: 'q' + (i + 1), seq: i + 1, type: TYPES[i % 3], stem: 's' + i, difficulty: '基础', knowledgeDomain: 'K1'
}))
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => 'q' + (from + i))

/* 30 张到期卡：q1 拖欠最久（NOW-30天），q30 最近（NOW-1天）。
   newCard 的 dueAt 就是传入的 now，所以直接拿它造历史到期时间。 */
const dueCards = questions.map((q, i) => newCard(q.id, NOW - (30 - i) * DAY))

/* ── A：review 必须遵守 size，且优先取拖欠最久的 ── */
t('A1 review size:20 → 只给 20 道（原来会给满 30）',
  ids(buildSession(questions, dueCards, [], { mode: 'review', size: 20, now: NOW })), range(1, 20))
t('A2 review 排序 = dueAt 升序，拖欠最久的 q1 在最前',
  ids(buildSession(questions, dueCards, [], { mode: 'review', size: 3, now: NOW })), ['q1', 'q2', 'q3'])
t('A3 review size:0 → 全部 30 道（take 对 size<=0 返回全部）',
  buildSession(questions, dueCards, [], { mode: 'review', size: 0, now: NOW }).length, 30)
t('A4 review 不传 size → 全部 30 道（向后兼容，行为不变）',
  buildSession(questions, dueCards, [], { mode: 'review', now: NOW }).length, 30)
t('A5 review 只取已到期的：把 q21~q30 改成未来到期 → 只剩 20 张',
  buildSession(questions, dueCards.slice(0, 20).concat(
    questions.slice(20).map((q) => ({ ...newCard(q.id, NOW), dueAt: NOW + 5 * DAY }))),
    [], { mode: 'review', size: 0, now: NOW }).length, 20)
t('A6 review 不传 now → 空（isDue 需要 now，调用方漏传会静默返回空会话）',
  buildSession(questions, dueCards, [], { mode: 'review', size: 20 }).length, 0)

/* ── learn：新题 = cards 里没有复习卡的题，按 seq 升序 ── */
const someCards = questions.slice(0, 10).map((q) => newCard(q.id, NOW))
t('B1 learn 排除已有复习卡的题，返回 q11~q30',
  ids(buildSession(questions, someCards, [], { mode: 'learn', size: 0, now: NOW })), range(11, 30))
t('B2 learn 按 seq 升序（= 全局入库序）',
  seqs(buildSession(questions, someCards, [], { mode: 'learn', size: 0, now: NOW })), range(11, 30).map((_, i) => i + 11))
t('B3 learn size:5 → 只取最靠前的 5 道新题',
  ids(buildSession(questions, someCards, [], { mode: 'learn', size: 5, now: NOW })), range(11, 15))

/* ── wrong：口径是「最近一次作答错误」，不是「曾经错过」 ── */
const records = [
  { questionId: 'q1', correct: false, timestamp: NOW - 5 * DAY, date: '2026-08-30' },
  { questionId: 'q1', correct: true, timestamp: NOW - 1 * DAY, date: '2026-09-03' },  // 后来答对 → 不算错题
  { questionId: 'q2', correct: true, timestamp: NOW - 5 * DAY, date: '2026-08-30' },
  { questionId: 'q2', correct: false, timestamp: NOW - 1 * DAY, date: '2026-09-03' }, // 后来答错 → 算
  { questionId: 'q7', correct: false, timestamp: NOW - 3 * DAY, date: '2026-09-01' }
]
t('C1 wrong 只取最近一次答错的（q1 已翻正不计、q2 翻错要计）',
  ids(buildSession(questions, [], records, { mode: 'wrong', size: 0, now: NOW })), ['q2', 'q7'])
t('C2 wrong 按 seq 升序，不是按错题产生的时间',
  ids(buildSession(questions, [], [
    { questionId: 'q20', correct: false, timestamp: NOW - 1 * DAY, date: 'x' },
    { questionId: 'q3', correct: false, timestamp: NOW - 9 * DAY, date: 'x' }
  ], { mode: 'wrong', size: 0, now: NOW })), ['q3', 'q20'])

/* ── random：Fisher-Yates，从筛选后的全库抽，不排除做过的/错过的 ── */
const rnd = buildSession(questions, someCards, records, { mode: 'random', size: 20, now: NOW, rng: () => 0.5 })
t('D1 random size:20 → 恰好 20 道', rnd.length, 20)
t('D2 random 抽出的都是库里的题（无凭空 id）',
  rnd.every((q) => questions.some((p) => p.id === q.id)), true)
t('D3 random 不排除做过的题（q1~q10 有复习卡，仍可能被抽到）',
  buildSession(questions, someCards, [], { mode: 'random', size: 30, now: NOW, rng: () => 0.5 }).length, 30)

/* ── relearn：筛选后全部，按 seq 升序 ── */
t('E1 relearn size:0 → 全部 30 道按 seq',
  seqs(buildSession(questions, [], [], { mode: 'relearn', size: 0, now: NOW })), range(1, 30).map((_, i) => i + 1))
t('E2 relearn 题型筛选生效（单选题 = seq 1,4,7,…共 10 道）',
  ids(buildSession(questions, [], [], { mode: 'relearn', size: 0, now: NOW, types: ['单选题'] })),
  questions.filter((q) => q.type === '单选题').map((q) => q.id))
t('E3 relearn 知识域筛选：不在 K1 的返回空',
  buildSession(questions, [], [], { mode: 'relearn', size: 0, now: NOW, domains: ['K9'] }).length, 0)

/* ── 未知 mode ── */
t('F1 未知 mode 返回空数组（不炸）', buildSession(questions, [], [], { mode: 'nope', now: NOW }), [])

console.log(`\n通过 ${pass} / ${pass + fails.length}`)
if (fails.length > 0) { console.log(fails.join('\n')); process.exit(1) }
console.log('ALL PASS')

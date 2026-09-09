/* ability.js 行为回归测试（2026-09-09 v4.15，Route B 深化配套）。
   覆盖四项新机制 + 一项既有语义回归：
   G：empDifficulty 先验随作答条数衰减（冷启动与 v4.14 逐位一致）
   H：pickMatched 冷却期（近期作答惩罚，窗口 20 条，含窗口外对照）
   I：族级薄弱度优先（knowledgeDomain 归并，n≥3 闸，含 n<3 负对照）
   J：FSRS 到期轻加权（pickMatched 直测 + buildSession 集成）
   K：zoneAdvice 放宽阈值（新闸内/旧闸外的区分案例 + 样本闸 + 旧口径回归）
   直接 import 真实源码。跑法：node scripts/t-ability.mjs   退出码 0=全过 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = (p) => pathToFileURL(path.join(here, '..', 'app', 'src', p)).href
const { empDifficulty, pickMatched, zoneAdvice } = await import(url('lib/ability.js'))
const { buildSession } = await import(url('lib/stats.js'))
const { newCard } = await import(url('lib/fsrs.js'))

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
const ids = (a) => a.map((q) => q.id)
const DAY = 86400000
const NOW = 1800000000000
const rec = (qid, correct, ts) => ({ questionId: qid, correct, timestamp: ts })

/* ── G：empDifficulty ── */
const qBase = { id: 'x', difficulty: '基础' }
ok('G1 冷启动=纯先验（基础 0.70）→ 难度 0.3（与 v4.14 逐位一致）',
  Math.abs(empDifficulty(qBase, []) - 0.3) < 1e-9,
  `got ${empDifficulty(qBase, [])}`)
{
  const hot = Array.from({ length: 24 }, (_, i) => rec('x', true, NOW - (24 - i) * 1000))
  ok('G2 24 条全对后先验近乎让位实测（难度 <0.05；常数先验下应为 ~0.117）',
    empDifficulty(qBase, hot) < 0.05, `got ${empDifficulty(qBase, hot).toFixed(4)}`)
}
{
  /* P6 首答语义回归（v4.10 首答加权）：首错+4对 的难度必须高于 首对+3错 */
  const firstWrong = [false, true, true, true, true].map((c, i) => rec('x', c, NOW - (10 - i) * 1000))
  const firstRight = [true, false, false, false].map((c, i) => rec('x', c, NOW - (10 - i) * 1000))
  ok('G3 首答加权语义不回归：首错+4对 > 首对+3错',
    empDifficulty(qBase, firstWrong) > empDifficulty(qBase, firstRight),
    `got ${empDifficulty(qBase, firstWrong).toFixed(4)} vs ${empDifficulty(qBase, firstRight).toFixed(4)}`)
}

/* ── H：冷却期 ── */
{
  /* 三题对照：q3（综合档）经一条"最近答对"后经验难度 ≈0.164，把 ability 调到
     使 target 恰好 = 0.164 → 无冷却时 q3 完美匹配必胜；有冷却（+0.3）必败。
     q1/q2（基础档）做陪跑。 */
  const pool = [
    { id: 'q1', difficulty: '基础', knowledgeDomain: 'K1' },
    { id: 'q2', difficulty: '基础', knowledgeDomain: 'K1' },
    { id: 'q3', difficulty: '综合', knowledgeDomain: 'K1' }
  ]
  const ghosts = (ts0) => Array.from({ length: 24 }, (_, i) => rec('ghost' + i, true, ts0 + (i + 1) * 1000))
  // H1：q3 的作答是最近一条 → 落入冷却窗口（ghost 题不在池内，只占窗口不产生族统计）
  const recent = [...ghosts(NOW - 30 * 1000), rec('q3', true, NOW)]
  const abilityH = 0.2 + 0.6 * ((empDifficulty(pool[2], recent) - 0.15) / 0.2)
  t('H1 最近作答过的完美匹配题被冷却挤出（返回 q1）',
    ids(pickMatched(pool, abilityH, 1, recent)), ['q1'])
  // H2 对照：同样 25 条记录，但 q3 的作答最老（24 条 ghost 把它挤出 20 条窗口）→ 冷却消失，q3 必胜
  const stale = [rec('q3', true, NOW - 40 * 1000), ...ghosts(NOW - 40 * 1000)]
  const abilityH2 = 0.2 + 0.6 * ((empDifficulty(pool[2], stale) - 0.15) / 0.2)
  t('H2 同题作答滑出冷却窗口后恢复必胜（返回 q3）',
    ids(pickMatched(pool, abilityH2, 1, stale)), ['q3'])
}

/* ── I：族级薄弱度优先（knowledgeDomain） ── */
{
  const pool = [
    { id: 'q1', difficulty: '基础', knowledgeDomain: 'K1' },
    { id: 'q2', difficulty: '基础', knowledgeDomain: 'K1' },
    { id: 'q4', difficulty: '综合', knowledgeDomain: 'K2' }
  ]
  // K1 族 3 次全错（n≥3 → weak=1，族内题 -0.1）：q2（经验难度 0.3，匹配差 0.05）
  // 靠族加成（cost -0.05）击败完美匹配的 q4（cost 0）
  const weakFam = [rec('q1', false, NOW - 3000), rec('q1', false, NOW - 2000), rec('q1', false, NOW - 1000)]
  t('I1 弱势族（n≥3）的题击败更匹配的他族题（返回 q2）',
    ids(pickMatched(pool, 0.5, 1, weakFam)), ['q2'])
  // 负对照：n=2 样本不足 → 族加成不参与 → 完美匹配的 q4 回到第一
  const thinFam = [rec('q1', false, NOW - 2000), rec('q1', false, NOW - 1000)]
  t('I2 族样本 n<3 不参与（宁可不动，返回完美匹配 q4）',
    ids(pickMatched(pool, 0.5, 1, thinFam)), ['q4'])
}

/* ── J：FSRS 到期轻加权 ── */
{
  const pool = [
    { id: 'q1', difficulty: '基础', knowledgeDomain: 'K1' },
    { id: 'q2', difficulty: '基础', knowledgeDomain: 'K1' },
    { id: 'q3', difficulty: '基础', knowledgeDomain: 'K1' }
  ]
  const dueQ2 = new Set(['q2'])
  // 三题匹配代价全同（0.05）；stable sort 平局取池序首位。给 q2 到期加权 → q2 跳到第一
  t('J1 到期题在同匹配度内优先（返回 q2）', ids(pickMatched(pool, 0.5, 1, [], Math.random, dueQ2)), ['q2'])
  t('J2 无到期集合时平局按池序（返回 q1，证明 J1 的 q2 来自加权而非巧合）',
    ids(pickMatched(pool, 0.5, 1, [], Math.random, null)), ['q1'])
  // buildSession 集成：random 模式把到期卡换算成 dueIds 传入
  const qs = pool.map((q, i) => ({ ...q, seq: i + 1 }))
  t('J3 buildSession random 到期题置顶（返回 q2）',
    ids(buildSession(qs, [newCard('q2', NOW)], [], { mode: 'random', size: 1, now: NOW, rng: () => 0.9 })), ['q2'])
  t('J4 buildSession random 无到期卡时平局取池序（返回 q1）',
    ids(buildSession(qs, [], [], { mode: 'random', size: 1, now: NOW, rng: () => 0.9 })), ['q1'])
}

/* ── K：zoneAdvice 放宽（v4.15：0.80/0.75 与 0.50/0.55） ── */
const mk = (arr) => arr.map((c, i) => rec('z', c === 1, NOW - (30 - i) * 1000))
{
  /* P1 模式：acc=0.933、ability=0.834 → 新闸内（≥0.80 且 ≥0.75）、旧闸外（ability<0.85） */
  const p1 = mk(Array(30).fill(0).map((_, i) => (i >= 5 ? 1 : (i % 2 === 0 ? 1 : 0))))
  t('K1 放宽后触发的 too-easy（旧双 85 闸抓不住）',
    zoneAdvice(p1).level, 'too-easy')
  /* P2 模式：acc=0.5、ability=0.529 → 新 too-hard 闸内（≤0.50 且 ≤0.55）、旧闸外（acc>0.45） */
  const p2 = mk(Array(30).fill(0).map((_, i) => (i % 2 === 0 ? 1 : 0)))
  t('K2 放宽后触发的 too-hard（旧 0.45 闸抓不住）',
    zoneAdvice(p2).level, 'too-hard')
  /* 旧口径回归：几乎全错仍触发 too-hard */
  const p3 = mk(Array(30).fill(0).map((_, i) => (i < 2 ? 1 : 0)))
  t('K3 旧口径案例（acc=0.067）仍触发 too-hard', zoneAdvice(p3).level, 'too-hard')
  /* 样本闸：n=23 即使全对也不触发 */
  const p4 = mk(Array(23).fill(1))
  t('K4 n=23 样本不足 → ok', zoneAdvice(p4).level, 'ok')
  t('K5 空记录 → ok', zoneAdvice([]).level, 'ok')
}

console.log(`\n通过 ${pass} / ${pass + fails.length}`)
if (fails.length > 0) { console.log(fails.join('\n')); process.exit(1) }
console.log('ALL PASS')

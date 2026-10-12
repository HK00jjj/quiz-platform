/* 自由回忆周检（P2）+ 水平快照趋势（P3）回归测试。
   直接 import 真实源码（lib/recall.js / lib/snapshot.js），不复制逻辑。
   跑法：node scripts/t-closure.mjs    退出码 0=全过，1=有失败 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const url = (p) => pathToFileURL(path.join(here, '..', 'app', 'src', p)).href
const R = await import(url('lib/recall.js'))
const S = await import(url('lib/snapshot.js'))

let pass = 0
const fails = []
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) pass++
  else fails.push(`  FAIL ${name}\n    got  ${g}\n    want ${w}`)
}

const DAY = 86400000
const HOUR = 3600000
const NOW = 1800000000000

/* ── recallDue：到期判定 ── */
t('R1 从未检查 + 近7天作答足够 → 到期',
  R.recallDue(null, Array.from({ length: 12 }, (_, i) => ({ correct: true, timestamp: NOW - i * HOUR })), NOW), true)
t('R2 距上次检查 3 天 → 不到期',
  R.recallDue({ at: NOW - 3 * DAY, items: [] },
    Array.from({ length: 12 }, () => ({ correct: true, timestamp: NOW - HOUR })), NOW), false)
t('R3 距上次检查 8 天 + 作答足够 → 到期',
  R.recallDue({ at: NOW - 8 * DAY, items: [] },
    Array.from({ length: 12 }, () => ({ correct: true, timestamp: NOW - HOUR })), NOW), true)
t('R4 超 7 天但近 7 天作答不足 10 条 → 不到期（不活跃不打扰）',
  R.recallDue({ at: NOW - 8 * DAY, items: [] },
    Array.from({ length: 9 }, () => ({ correct: true, timestamp: NOW - HOUR })), NOW), false)
t('R5 非 boolean 的 correct（无效作答）不计素材',
  R.recallDue(null, [{ correct: null, timestamp: NOW - HOUR }, { timestamp: NOW - HOUR }], NOW), false)

/* ── buildRecallItems：清单构建 ── */
const qs = [
  { id: 'a1', knowledgeDomain: 'K1' }, { id: 'a2', knowledgeDomain: 'K1' }, { id: 'a3', knowledgeDomain: 'K1' },
  { id: 'b1', knowledgeDomain: 'K2' }, { id: 'b2', knowledgeDomain: 'K2' },
  { id: 'c1', knowledgeDomain: 'K3' }
]
const rs = [
  { questionId: 'a1', correct: true, timestamp: NOW - DAY },      // K1 ×3
  { questionId: 'a2', correct: false, timestamp: NOW - 2 * DAY },
  { questionId: 'a3', correct: true, timestamp: NOW - 3 * DAY },
  { questionId: 'b1', correct: true, timestamp: NOW - DAY },      // K2 ×2
  { questionId: 'b2', correct: true, timestamp: NOW - 2 * DAY },
  { questionId: 'c1', correct: true, timestamp: NOW - 9 * DAY },  // 9 天前 → 出窗
  { questionId: 'ghost', correct: true, timestamp: NOW - DAY }    // 不在当前书 → 剔除
]
t('R6 近7天作答过的域按量降序、出窗/无主记录剔除',
  R.buildRecallItems(qs, rs, NOW), [{ domain: 'K1', n: 3 }, { domain: 'K2', n: 2 }])
t('R7 最多取 8 个域',
  R.buildRecallItems(
    Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, knowledgeDomain: 'K' + (i + 1) })),
    Array.from({ length: 12 }, (_, i) => ({ questionId: 'x' + i, correct: true, timestamp: NOW - HOUR })), NOW).length, 8)

/* ── weakDomains：薄弱域提取 ── */
const log = { at: NOW - DAY, items: [{ domain: 'K1', n: 3, grade: '讲得清' }, { domain: 'K2', n: 2, grade: '有点模糊' }, { domain: 'K4', n: 1, grade: '想不起来' }] }
t('R8 未达「讲得清」的域按清单原序返回', R.weakDomains(log), ['K2', 'K4'])
t('R9 跳过项（items 空）→ 无薄弱域', R.weakDomains({ at: NOW, items: [] }), [])
t('R10 无检查记录 → 无薄弱域', R.weakDomains(null), [])

/* ── snapshot：快照节奏 ── */
t('S1 从未打过 → 该打', S.shouldSnapshot([], NOW), true)
t('S2 距上一份 5h → 不该打（一天最多一份）',
  S.shouldSnapshot([{ at: NOW - 5 * HOUR, p: 60 }], NOW), false)
t('S3 距上一份 21h → 该打', S.shouldSnapshot([{ at: NOW - 21 * HOUR, p: 60 }], NOW), true)

t('S4 buildSnapshot 字段口径（p 百分制 / cov 与 acc 夹取）',
  S.buildSnapshot(NOW, { ability: 0.734, rankName: '黄金', total: 100, doneN: 40, recentAcc: 2 }),
  { at: NOW, p: 73, rank: '黄金', cov: 0.4, acc: 1 })

let snaps = []
for (let i = 0; i < 65; i++) snaps = S.pushSnapshot(snaps, { at: i, p: i })
t('S5 pushSnapshot 封顶 60 份且保留最新', [snaps.length, snaps[0].at, snaps[59].at], [60, 5, 64])

/* ── trendOf：7 日趋势 ── */
const base = { at: NOW - 7 * DAY, p: 60 }
const mid = { at: NOW - 3 * DAY, p: 70 }   // 窗口外（<4d 前不算基线）
const snapNow = { at: NOW - HOUR, p: 66 }
t('S6 有 7 日基线 → delta = 最新 - 基线', S.trendOf([base, mid, snapNow], NOW), { delta: 6, baseAt: base.at, baseP: 60 })
t('S7 基线取窗口内距锚点最近者（5天前 vs 9天前，选9天前）',
  S.trendOf([{ at: NOW - 9 * DAY, p: 50 }, { at: NOW - 5 * DAY, p: 55 }, snapNow], NOW),
  { delta: 16, baseAt: NOW - 9 * DAY, baseP: 50 })
t('S8 不足 4 天数据 → 无基线返回 null', S.trendOf([{ at: NOW - 2 * DAY, p: 60 }], NOW), null)
t('S9 空 → null', S.trendOf([], NOW), null)
t('S10 指数回落如实为负', S.trendOf([{ at: NOW - 7 * DAY, p: 70 }, snapNow], NOW).delta, -4)

console.log(`\n通过 ${pass} / ${pass + fails.length}`)
if (fails.length > 0) { console.log(fails.join('\n')); process.exit(1) }
console.log('ALL PASS')

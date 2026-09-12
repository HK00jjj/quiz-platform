// 掌握度三闸回归锁（2026-09-12 全流程颗粒度对齐）：masteryGate 从 Learn.jsx 提取后锁语义。
// 核心锁点 = 闸③聚合键从细粒度 kp 改为 knowledgeDomain（K 域族级）后的行为变化与不变式。
// 运行：node tests/mastery-gate.regression.mjs （在 app 目录下）
import { masteryGate, MASTERY } from '../src/lib/ability.js'

let pass = 0, fail = 0
const t = (name, cond) => {
  if (cond) { pass++; console.log('  PASS ' + name) }
  else { fail++; console.log('  FAIL ' + name) }
}
const rec = (qid, correct, ts) => ({ questionId: qid, correct, timestamp: ts })

// 题目夹具：a/b 同属 K1（制造"旧口径豁免、新口径参判"的分歧场景）；c 属 K2；n 无域有 kp；m 全无
const QS = [
  { id: 'a', knowledgeDomain: 'K1', knowledgePoint: '细点a' },
  { id: 'b', knowledgeDomain: 'K1', knowledgePoint: '细点b' },
  { id: 'c', knowledgeDomain: 'K2', knowledgePoint: '细点c' },
  { id: 'n', knowledgePoint: '细点n' },
  { id: 'm' }
]

/* ── ① 对齐核心锁：同域两题各 2 次作答 ──
   旧口径（kp 字符串聚合）：每 kp n=2 < KP_MIN=3 → 全豁免 → kpPass=true（空转证据）；
   新口径（K 域聚合）：K1 域 n=4 ≥3 → 参判，c/n=2/4=50% <95% → kpPass=false。
   该用例同时证明闸③从"名存实亡"变为真实闸。 */
{
  const g = masteryGate(QS, [rec('a', true, 1), rec('a', false, 2), rec('b', true, 3), rec('b', false, 4)], 0)
  t('① 域聚合：K1 n=4 参判（旧 kp 口径下 n=2 双双豁免）', g.kpTotal === 1)
  t('① 域正确率 50% <95% → kpOK=0', g.kpOK === 0)
  t('① kpPass=false（旧口径此场景恒 true——空转实锤锁）', g.kpPass === false)
  t('① masteryReady=false', g.masteryReady === false)
}

/* ── ② 达标路径：K2 域 3 次全对 → 参判且通过 ── */
{
  const g = masteryGate([QS[2]], [rec('c', true, 1), rec('c', true, 2), rec('c', true, 3)], 0)
  t('② K2 n=3 c=3 → kpTotal=1 kpOK=1 kpPass=true', g.kpTotal === 1 && g.kpOK === 1 && g.kpPass === true)
  t('② 单题全对 → itemRate=1 → masteryReady=true', g.itemRate === 1 && g.masteryReady === true)
}

/* ── ③ 样本不足豁免语义保持：域 n=2 <3 → 不参判 ── */
{
  const g = masteryGate([QS[0]], [rec('a', false, 1), rec('a', false, 2)], 0)
  t('③ K1 n=2 → kpTotal=0 → kpPass=true（豁免不变）', g.kpTotal === 0 && g.kpPass === true)
  t('③ 但闸②仍拦：itemRate=0 → masteryReady=false', g.masteryReady === false)
}

/* ── ④ 无域兜底 = 旧行为等价（防畸形数据制造假闸）──
   无域题回落 knowledgePoint：同 kp 3 次全错 → 参判不过（与旧 kp 聚合行为一致）。 */
{
  const g = masteryGate([QS[3]], [rec('n', false, 1), rec('n', false, 2), rec('n', false, 3)], 0)
  t('④ 无域兜底 kp 桶 n=3 参判 → kpPass=false', g.kpTotal === 1 && g.kpPass === false)
}

/* ── ⑤ since 时间窗语义一字未变：窗外记录不计 ── */
{
  const g = masteryGate([QS[0]], [rec('a', false, 50), rec('a', true, 200), rec('a', true, 300)], 100)
  t('⑤ 窗外错记录不计 → latest=对 → itemRate=1', g.doneN === 1 && g.masteredN === 1 && g.itemRate === 1)
  t('⑤ 窗内域 n=2 <3 → 豁免 → masteryReady=true', g.kpPass === true && g.masteryReady === true)
}

/* ── ⑥ 覆盖/掌握中间量数值行为不变 ── */
{
  const g = masteryGate([QS[0], QS[1], QS[2]], [rec('a', true, 1), rec('b', false, 2)], 0)
  t('⑥ doneN=2 covered=false（3 题只碰 2）', g.doneN === 2 && g.covered === false)
  t('⑥ masteredN=1 itemRate=1/3', g.masteredN === 1 && Math.abs(g.itemRate - 1 / 3) < 1e-12)
}

/* ── ⑦ 空题库防除零（EmptyState 上游安全）── */
{
  const g = masteryGate([], [], 0)
  t('⑦ 空库 covered=false itemRate=0 kpPass=true masteryReady=false',
    g.covered === false && g.itemRate === 0 && g.kpPass === true && g.masteryReady === false)
}

/* ── ⑧ 阈值常量未被顺手改动 ── */
t('⑧ MASTERY 阈值不动：ITEM_RATE .95 / KP_ACC .95 / KP_MIN 3',
  MASTERY.ITEM_RATE === 0.95 && MASTERY.KP_ACC === 0.95 && MASTERY.KP_MIN === 3)

console.log(`\nregression: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)

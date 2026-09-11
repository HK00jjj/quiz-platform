// 顶尖段适配回归锁（2026-09-12）：targetDifficulty 专家段斜率 + abilityOf 按题去重窗口
// 运行：node tests/ability-expert.regression.mjs （在 app 目录下）
import { abilityOf, targetDifficulty } from '../src/lib/ability.js'

let pass = 0, fail = 0
const t = (name, got, want, tol = 0) => {
  const ok = tol ? Math.abs(got - want) <= tol : got === want
  if (ok) { pass++; console.log('  PASS ' + name) }
  else { fail++; console.log(`  FAIL ${name} :: got ${got}, want ${want}`) }
}

/* ── ① targetDifficulty 专家段斜率 ── */
t('新手端不变：ability=0.2（t=0）→ 难度 0.15', targetDifficulty(0.2), 0.15)
t('中段不变：ability=0.5（t=0.5）→ 难度 0.25', targetDifficulty(0.5), 0.25)
t('专家段入口连续：ability=0.68（t=0.8）→ 难度 0.31', targetDifficulty(0.68), 0.31, 1e-9)
t('专家段封顶：ability=1.0（t=1）→ 难度 0.50（通过率 50%，旧公式 0.35）', targetDifficulty(1.0), 0.50, 1e-9)
t('超出上界钳制：ability=1.2（t 钳 1）→ 仍 0.50', targetDifficulty(1.2), 0.50, 1e-9)
t('连续性：t=0.799 与 t=0.801 差 < 0.002', Math.abs(targetDifficulty(0.2 + 0.6 * 0.799) - targetDifficulty(0.2 + 0.6 * 0.801)), 0, 0.002)

/* ── ② abilityOf 按题去重取最近一条 ── */
const rec = (qid, correct, ts) => ({ questionId: qid, correct, timestamp: ts })

// 热点题免疫：20 道旧题全错 + 1 道热点题近期刷 40 遍全对。
// 旧口径（60 条记录窗口）热点题占 40/60 → 指数 ≈0.756（虚假高分）；
// 新口径每题一票 → 21 票（20 错 + 1 对）→ 指数 = 0.0347（真实弱）。
{
  const rs = []
  for (let i = 0; i < 20; i++) rs.push(rec(`old${i}`, false, 1000 + i))
  for (let k = 0; k < 40; k++) rs.push(rec('hot', true, 5000 + k))
  t('热点题不再灌满窗口（20错+热点40对 → ≈0.0347 而非 0.756）', abilityOf(rs), 0.034657359027997266, 1e-9)
}

// 同题"最新证据"语义：[对, 错] 同题 → 只取最近一条（错）→ 0
t('同题只看最近一次：[对,错] → 0（最新证据为准）', abilityOf([rec('a', true, 1), rec('a', false, 2)]), 0)

// 三遍判定典型流不受影响：10 题×3 遍（错错对）→ 每题一票（对）→ 1
{
  const rs = []
  let ts = 0
  for (let i = 0; i < 10; i++) for (const c of [false, false, true]) rs.push(rec(`q${i}`, c, ++ts))
  t('三遍判定流（错错对×10 题）→ 10 票全对 → 1', abilityOf(rs), 1)
}

// 窗口 = 60 道不同题：61 题里最旧一道错被挤出 → 60 票全对 → 1
{
  const rs = [rec('old', false, 1)]
  for (let i = 0; i < 60; i++) rs.push(rec(`n${i}`, true, 100 + i))
  t('窗口按"题"数（61 题挤掉最旧 1 题 → 1）', abilityOf(rs), 1)
}

console.log(`\nability-expert regression: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

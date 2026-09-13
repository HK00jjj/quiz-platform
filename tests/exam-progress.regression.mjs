// 续考进度恢复源选择回归锁（2026-09-13 ③续考进度云化）
// 锁 pickExamProgress 的选择语义：ts 新者胜 / 缺端兜底 / 无效结构过滤 / 旧格式 ts=0。
import assert from 'node:assert/strict'
import { pickExamProgress } from '../src/lib/exam-progress.js'

const mk = (ts, extra = {}) => ({ attemptId: 'att_1', ids: ['q1', 'q2'], round: 1, wins: 1, wrongs: [], answers: {}, ts, ...extra })

const cases = []
const t = (name, fn) => cases.push([name, fn])

t('两端都无 → null（走 examStart 新开）', () => {
  assert.equal(pickExamProgress(null, null), null)
})
t('仅本地有 → 本地', () => {
  const l = mk(100)
  assert.equal(pickExamProgress(l, null), l)
})
t('仅云端有 → 云端', () => {
  const c = mk(100)
  assert.equal(pickExamProgress(null, c), c)
})
t('云端 ts 更新 → 云端（跨设备防旧覆盖新）', () => {
  const c = mk(200)
  assert.equal(pickExamProgress(mk(100), c), c)
})
t('本地 ts 更新 → 本地', () => {
  const l = mk(300)
  assert.equal(pickExamProgress(l, mk(200)), l)
})
t('ts 相同 → 取云端（确定性偏好真源）', () => {
  const c = mk(100), l = mk(100)
  assert.equal(pickExamProgress(l, c), c)
})
t('无 ts 的旧格式视为 0：云端新格式胜本地旧格式', () => {
  const c = mk(50), l = { attemptId: 'att_0', ids: ['q1'], round: 0 }
  assert.equal(pickExamProgress(l, c), c)
})
t('本地新格式胜云端旧格式（无 ts 视为 0）', () => {
  const l = mk(50), c = { attemptId: 'att_0', ids: ['q1'], round: 0 }
  assert.equal(pickExamProgress(l, c), l)
})
t('结构无效的云端（缺 attemptId/ids）→ 回落本地', () => {
  const l = mk(10)
  assert.equal(pickExamProgress(l, { ts: 999 }), l)
  assert.equal(pickExamProgress(l, { attemptId: 'x', ts: 999 }), l)
})
t('结构无效的本地 → 回落云端', () => {
  const c = mk(10)
  assert.equal(pickExamProgress('garbage', c), c)
  assert.equal(pickExamProgress({ attemptId: 'x', ts: 999 }, c), c)
})
t('非对象输入（损坏 JSON 解析结果）一律过滤', () => {
  assert.equal(pickExamProgress('garbage', 42), null)
})

let pass = 0
for (const [name, fn] of cases) {
  try { fn(); pass++; console.log('  ✓', name) }
  catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1 }
}
console.log(`exam-progress.regression: ${pass}/${cases.length} ${pass === cases.length ? 'ALL OK' : 'FAILED'}`)
if (process.exitCode) process.exit(1)

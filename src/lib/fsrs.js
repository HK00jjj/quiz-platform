// 间隔重复调度（与线上算法完全一致，保证复习数据兼容）
const w = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755]
const DECAY = -0.5
const FACTOR = 19 / 81
const REQ = 0.9
export const DAY = 24 * 60 * 60 * 1000

const clampD = (d) => Math.min(10, Math.max(1, d))
const retrievability = (elapsed, stability) => (1 + FACTOR * (Math.max(0, elapsed) / stability)) ** DECAY
const intervalFromStability = (s, r = REQ) => s / FACTOR * (r ** (1 / DECAY) - 1)
const initStability = (rating) => w[rating - 1]
const initDifficulty = (rating) => clampD(w[4] - (rating - 3) * w[5])
const nextDifficulty = (d, rating) => {
  const nd = d - w[6] * (rating - 3)
  return clampD(w[7] * initDifficulty(3) + (1 - w[7]) * nd)
}
const nextRecallStability = (d, s, r, rating) => {
  const hard = rating === 2 ? w[15] : 1
  const easy = rating === 4 ? w[16] : 1
  const gain = Math.exp(w[8]) * (11 - d) * s ** -0.1367 * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy
  return s * (gain + 1)
}
const nextForgetStability = (d, s, r) => w[11] * d ** -0.0793 * ((s + 1) ** w[13] - 1) * Math.exp(w[14] * (1 - r))
const daysOf = (s) => Math.max(1, Math.round(intervalFromStability(s)))
const ratingOf = (str) => (str === '忘记' ? 1 : str === '模糊' ? 2 : 3)

export function newCard(questionId, now) {
  return { questionId, easeFactor: 2.5, intervalDays: 0, reps: 0, lapses: 0, dueAt: now, learnedAt: now }
}

export function reviewCard(card, ratingStr, now) {
  const rating = ratingOf(ratingStr)
  const next = { ...card, lastReviewedAt: now, easeFactor: 2.5 }
  if (next.stability === undefined && card.lastReviewedAt === undefined) {
    const s0 = initStability(rating)
    const d0 = initDifficulty(rating)
    if (rating === 1) return { ...next, stability: s0, difficulty: d0, reps: 0, intervalDays: 0, lapses: next.lapses + 1, dueAt: now }
    const iv = daysOf(s0)
    return { ...next, stability: s0, difficulty: d0, reps: 1, intervalDays: iv, dueAt: now + iv * DAY }
  }
  const cur = card.stability !== undefined && card.difficulty !== undefined
    ? card
    : { ...card, stability: Math.max(1, card.intervalDays), difficulty: 5 }
  const base = card.lastReviewedAt ?? card.learnedAt
  const elapsed = Math.max(0, (now - base) / DAY)
  const r = retrievability(elapsed, cur.stability)
  const d = nextDifficulty(cur.difficulty, rating)
  if (rating === 1) {
    const s = nextForgetStability(d, cur.stability, r)
    return { ...next, stability: s, difficulty: d, reps: 0, intervalDays: 0, lapses: cur.lapses + 1, dueAt: now }
  }
  const s = nextRecallStability(d, cur.stability, r, rating)
  const iv = daysOf(s)
  return { ...next, stability: s, difficulty: d, reps: cur.reps + 1, intervalDays: iv, dueAt: now + iv * DAY }
}

export const isDue = (card, now) => card.dueAt <= now

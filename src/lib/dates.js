// 本地日期工具（与线上口径一致：以本地时区计日）
export function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function todayStr() { return fmtDate(new Date()) }
export function daysAgoStr(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return fmtDate(d)
}
// 连续天数：今天没练则从今天-1天往前数
export function streakLength(dates, today) {
  const set = new Set(dates)
  let cur = set.has(today) ? today : daysAgoStr(today, 1)
  if (!set.has(cur)) return 0
  let n = 0
  while (set.has(cur)) { n++; cur = daysAgoStr(cur, 1) }
  return n
}

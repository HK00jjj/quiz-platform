// 水平快照与趋势（P3，2026-09-09）：
// EWMA 能力指数只反映"当前状态"，没有历史基线就无法回答"我是否在进步"。
// 快照 = 每天最多一份（间隔 ≥SNAP_GAP_MS）把 { 指数, 段位, 覆盖率, 近30题正确率 }
// 存进 settings.snapshots（云同步，容量封顶），Learn 页据此展示 7 日趋势与迷你走势。
// 纯函数 + 不碰作答内核：快照只读现状，不影响组卷/晋级任何闸门。

export const SNAP_GAP_MS = 20 * 3600000 // 至少间隔 20h：跨天一份，且不受同日多次刷新影响
export const SNAP_MAX = 60              // 封顶 60 份（约两个月），settings 体积可控

/* 是否该打快照：从未打过，或距上一份 ≥20h */
export function shouldSnapshot(snapshots, now) {
  const last = (snapshots ?? [])[(snapshots ?? []).length - 1]
  return !last || now - (last.at ?? 0) >= SNAP_GAP_MS
}

/* 构造一份快照。p=指数百分制，rank=段位名，cov=覆盖率(0~1)，acc=近30题正确率(0~1) */
export function buildSnapshot(now, { ability, rankName, total, doneN, recentAcc }) {
  return {
    at: now,
    p: Math.round(Math.min(1, Math.max(0, ability)) * 100),
    rank: rankName ?? '',
    cov: total > 0 ? Math.min(1, Math.max(0, doneN / total)) : 0,
    acc: Math.min(1, Math.max(0, recentAcc ?? 0))
  }
}

/* 追加并封顶（保留最新 SNAP_MAX 份） */
export function pushSnapshot(snapshots, snap) {
  const next = [...(snapshots ?? []), snap]
  return next.length > SNAP_MAX ? next.slice(next.length - SNAP_MAX) : next
}

/* 7 日趋势：取落在 [now-10d, now-4d] 窗口内、距 7 日锚点最近的快照做基线。
   窗口放宽到 ±3 天——快照一天最多一份，严格"恰好在 7 天前"大概率找不到。
   无基线返回 null（学习不足一周/断档时如实显示"暂无基线"，不造假数据）。 */
export function trendOf(snapshots, now) {
  const list = snapshots ?? []
  const latest = list[list.length - 1]
  if (!latest) return null
  const anchor = now - 7 * 86400000
  let base = null
  for (const s of list) {
    const at = s.at ?? 0
    if (at < now - 10 * 86400000 || at > now - 4 * 86400000) continue
    if (!base || Math.abs(at - anchor) < Math.abs(base.at - anchor)) base = s
  }
  if (!base) return null
  return { delta: latest.p - base.p, baseAt: base.at, baseP: base.p }
}

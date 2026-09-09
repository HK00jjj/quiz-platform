// 存储水位监测（2026-09-09 经验对照报告 #2：localStorage 约 5MB 上限、同步阻塞主线程、
// 仅字符串存储；diagrams.js 的 imageMap 与题库 fallback 是最先触顶的点）。
// 原则：只读监测，不做任何自动清理/迁移——超限的处置（导出备份/清旧书）由用户在设置页决定。
// 估算口径：localStorage 每个键值按 UTF-16 存取，占用量 ≈ (key.length + value.length) × 2 字节。
// 这是业界通行的近似式（略高于实际 UTF-8 存储，属保守高估，宁可早提醒不误报安全）。

/* 阈值：浏览器配额一般 5MB/源（Chrome 实际按字符数 5M ≈ 10MB UTF-16 字节，
   Firefox/Safari 更保守）。取保守低线：3.0MB 提醒、4.2MB 强提醒，给用户留出
   导出备份的反应窗口，而不是等 QuotaExceededError 砸脸。 */
export const SOFT_LIMIT = 3.0 * 1024 * 1024
export const HARD_LIMIT = 4.2 * 1024 * 1024

export function estimateStorage() {
  let bytes = 0
  let biggestKey = null
  let biggestBytes = 0
  const entries = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      const v = localStorage.getItem(k) ?? ''
      const n = (k.length + v.length) * 2
      bytes += n
      entries.push({ key: k, bytes: n })
      if (n > biggestBytes) { biggestBytes = n; biggestKey = k }
    }
  } catch {
    /* localStorage 被禁用（隐私模式等）：返回不可用态，设置页不显示仪表 */
    return null
  }
  entries.sort((a, b) => b.bytes - a.bytes)
  const level = bytes >= HARD_LIMIT ? 'danger' : bytes >= SOFT_LIMIT ? 'warn' : 'ok'
  return { bytes, level, biggestKey, biggestBytes, top: entries.slice(0, 3) }
}

export function fmtBytes(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB'
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB'
  return n + ' B'
}

/* 供 t-storage 回归与 CI 使用的纯函数核心：不碰 window/localStorage。
   entries: [{key, bytes}] —— 估算与分级逻辑与 estimateStorage 完全一致。 */
export function assessEntries(entries) {
  let bytes = 0, biggestKey = null, biggestBytes = 0
  for (const { key, bytes: n } of entries) {
    bytes += n
    if (n > biggestBytes) { biggestBytes = n; biggestKey = key }
  }
  const level = bytes >= HARD_LIMIT ? 'danger' : bytes >= SOFT_LIMIT ? 'warn' : 'ok'
  return { bytes, level, biggestKey, biggestBytes }
}

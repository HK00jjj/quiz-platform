// 续考进度恢复源选择（2026-09-13 · ③续考进度云化）
// 背景：进度原先只存 localStorage（qp-exam-progress），清缓存即丢整场考试。
// 云化后真源双写：本地 localStorage + 云端 settings.examProgress（与 examWrongs 同链路）。
// 恢复时二选一：ts（保存时刻毫秒）大者优先——防止跨设备时旧进度覆盖新进度
//（answers 会随 deck 一起恢复并整体提交 examSubmit，取旧会污染服务端判分）。

const valid = (p) =>
  p && typeof p === 'object' && p.attemptId && Array.isArray(p.ids)

export function pickExamProgress(local, cloud) {
  const l = valid(local) ? local : null
  const c = valid(cloud) ? cloud : null
  if (!l) return c
  if (!c) return l
  /* 无 ts 的旧格式进度视为 0：云端新格式胜本地旧格式，本地新格式胜云端旧格式。 */
  return ((c.ts ?? 0) > (l.ts ?? 0) ? c : l)
}

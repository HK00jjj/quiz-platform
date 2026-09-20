// 题目插图映射的持久化层（Y批 2026-09-19 从 diagrams.js 剥离）。
// 为什么独立成模块：store.js / validate.js 在主包只需要这 4 个 localStorage helper
// 与 15 个模板 ID；diagrams.js 的 38KB SVG 模板库只有 Practice/Settings/Path（懒加载块）
// 需要。拆开后主包不再拖图谱库。
// ⚠ 维护约定：在 diagrams.js 的 DIAGRAMS 里新增模板时，必须同步把模板 ID 加进
//    下面 DIAGRAM_IDS（两处需一致，DIAGRAM_TITLES 也要加标题）。
export const DIAGRAM_IDS = [
  'tpl_din_wiring', 'tpl_plc_sinking', 'tpl_relay_diode', 'tpl_sensor_3wire_plc',
  'tpl_sensor_2wire_plc', 'tpl_npn_pnp_relay', 'tpl_wire_color_legend', 'tpl_plc_io_common',
  'tpl_stepper_driver', 'tpl_servo_driver', 'tpl_vfd_wiring', 'tpl_motor_fwd_rev',
  'tpl_motor_stardelta', 'tpl_socket_wiring', 'tpl_crystal_head',
]

const IMG_MAP_KEY = 'qp.imgmap.v1'

/* 导入时记录 {questionId: templateId|spec}（与 importedAt 同为本机元数据，零 DDL） */
export function saveImageMap(questions) {
  try {
    const map = JSON.parse(localStorage.getItem(IMG_MAP_KEY) || '{}')
    for (const q of questions) { if (q && q.id && q.image && DIAGRAM_IDS.includes(String(q.image).split('|')[0])) map[q.id] = q.image }
    localStorage.setItem(IMG_MAP_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

export function imageFor(qid) {
  try { const map = JSON.parse(localStorage.getItem(IMG_MAP_KEY) || '{}'); return map[qid] || null } catch { return null }
}

export function readImageMap() {
  try { return JSON.parse(localStorage.getItem(IMG_MAP_KEY) || '{}') } catch { return {} }
}

export function mergeImageMap(extra) {
  if (!extra || typeof extra !== 'object') return
  try {
    const map = readImageMap()
    for (const [k, v] of Object.entries(extra)) { if (DIAGRAM_IDS.includes(String(v).split('|')[0])) map[k] = v }
    localStorage.setItem(IMG_MAP_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

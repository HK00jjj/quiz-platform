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

/* 配图 spec 两种形态（2026-09-21 逐题配图改造）：
   ① 模板型 'tpl_xxx' 或 'tpl_xxx|参数1|参数2' —— 渲染时查 DIAGRAMS 转 dataURI；
   ② 文件型 'file:ill/<题id>.svg|<配图说明>' 或 'file:ill/<题id>.webp|<配图说明>' ——
      指向线上 img/ill/ 静态文件（逐题专属配图，SVG 示意图 / AI 生成压缩图），
      '|' 后面是配图说明（图题），渲染在 figcaption。两种形态都以 '|' 切首段判定。
   【多图支持 2026-09-22（用户口径：一题配「设备实物图 + 电路图」两张）】：
     一条映射可用**换行符**承载多条 spec —— 'file:ill/a.jpg|图题A\nfile:ill/b.jpg|图题B'。
     选换行为分隔符的理由：零 DDL（仍是同一 TEXT 字段）、旧单图条目无需迁移、
     图题不可能含换行故不会歧义。解析统一走 imgSpecList()。 */
export function imgSpecList(v) {
  if (typeof v !== 'string' || !v) return []
  return v.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && isImgSpec(s))
}
export function isImgSpec(v) {
  if (typeof v !== 'string' || !v) return false
  const lines = v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  if (!lines.length) return false
  return lines.every((line) => {
    const head = line.split('|')[0]
    return DIAGRAM_IDS.includes(head) || head.startsWith('file:ill/')
  })
}
function safeFile(spec) {
  const head = spec.split('|')[0]
  if (!head.startsWith('file:ill/')) return null
  const name = head.slice('file:ill/'.length)
  return /^[\w-]+\.(?:svg|webp|png)$/.test(name) ? name : null   // 文件名白名单：防注入/防穿越
}
export function imgSpecAlt(v) {
  if (typeof v !== 'string') return ''
  return v.split('|').slice(1).join('|').trim()
}
export function imgSpecFile(v) {
  if (typeof v !== 'string') return null
  return safeFile(v)
}

const IMG_MAP_KEY = 'qp.imgmap.v1'

/* 导入时记录 {questionId: templateId|spec}（与 importedAt 同为本机元数据，零 DDL） */
export function saveImageMap(questions) {
  try {
    const map = JSON.parse(localStorage.getItem(IMG_MAP_KEY) || '{}')
    for (const q of questions) { if (q && q.id && isImgSpec(q.image)) map[q.id] = q.image }
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
    for (const [k, v] of Object.entries(extra)) { if (isImgSpec(v)) map[k] = v }
    localStorage.setItem(IMG_MAP_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

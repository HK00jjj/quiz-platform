// 题目配图模板库（已人工目检的 SVG 电气图，唯一正确性源头）
// 出题时 JSON 的 image 字段只填模板 ID，渲染时由本模块解析为 dataURI，零 base64 入库、零链接失效。
export const DIAGRAMS = {
  tpl_din_wiring: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 380" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="380" fill="#ffffff"/>
  <text x="20" y="32" font-size="19" font-weight="bold" fill="#222">DIN 43650-A 插头接线（DC24V 电磁阀）</text>
  <rect x="60" y="90" width="200" height="150" rx="12" fill="#f4f4f4" stroke="#333" stroke-width="2.5"/>
  <text x="160" y="80" font-size="14" text-anchor="middle" fill="#555">电磁阀线圈侧（插头）</text>
  <circle cx="105" cy="130" r="11" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="105" y="135" font-size="13" text-anchor="middle" font-weight="bold">1</text>
  <circle cx="160" cy="130" r="11" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="160" y="135" font-size="13" text-anchor="middle" font-weight="bold">2</text>
  <circle cx="215" cy="130" r="11" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="215" y="135" font-size="13" text-anchor="middle" font-weight="bold">3</text>
  <rect x="90" y="170" width="140" height="50" rx="6" fill="#eef7ee" stroke="#4a4" stroke-width="1.5"/>
  <text x="160" y="190" font-size="12" text-anchor="middle" fill="#274">内置 LED + 续流二极管</text>
  <text x="160" y="208" font-size="11" text-anchor="middle" fill="#274">（直流线圈必须分极性）</text>
  <line x1="105" y1="141" x2="105" y2="290" stroke="#8b4513" stroke-width="3"/>
  <line x1="160" y1="141" x2="160" y2="290" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="215" y1="141" x2="215" y2="300" stroke="#2e8b2e" stroke-width="3" stroke-dasharray="8 4"/>
  <rect x="380" y="100" width="200" height="110" rx="10" fill="#fff8ec" stroke="#b8860b" stroke-width="2"/>
  <text x="480" y="128" font-size="15" text-anchor="middle" font-weight="bold" fill="#7a5c00">DC24V 开关电源</text>
  <circle cx="420" cy="160" r="8" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="438" y="165" font-size="13" fill="#333">L+（+24V）</text>
  <circle cx="420" cy="190" r="8" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="438" y="195" font-size="13" fill="#333">M（0V）</text>
  <line x1="105" y1="290" x2="330" y2="290" stroke="#8b4513" stroke-width="3"/>
  <line x1="330" y1="290" x2="330" y2="160" stroke="#8b4513" stroke-width="3"/>
  <line x1="330" y1="160" x2="412" y2="160" stroke="#8b4513" stroke-width="3"/>
  <line x1="160" y1="290" x2="360" y2="290" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="360" y1="290" x2="360" y2="190" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="360" y1="190" x2="412" y2="190" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="195" y1="300" x2="235" y2="300" stroke="#2e8b2e" stroke-width="3"/>
  <line x1="203" y1="308" x2="227" y2="308" stroke="#2e8b2e" stroke-width="3"/>
  <line x1="210" y1="316" x2="220" y2="316" stroke="#2e8b2e" stroke-width="3"/>
  <text x="245" y="306" font-size="13" fill="#2e8b2e">PE 保护接地</text>
  <text x="80" y="265" font-size="12" fill="#8b4513">棕 1=L+</text>
  <text x="137" y="265" font-size="12" fill="#1e6fd0">蓝 2=M</text>
  <text x="222" y="265" font-size="12" fill="#2e8b2e">绿黄 3=PE</text>
  <text x="20" y="362" font-size="12" fill="#888">要点：直流线圈 1 接正、2 接负，极性不可反（内置LED与续流二极管有方向性）；3 接 PE。</text>
</svg>`,
  tpl_plc_sinking: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 380" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="380" fill="#ffffff"/>
  <text x="20" y="32" font-size="19" font-weight="bold" fill="#222">PLC 漏型（Sinking）输出驱动 DC24V 电磁阀</text>
  <rect x="40" y="70" width="160" height="100" rx="10" fill="#fff8ec" stroke="#b8860b" stroke-width="2"/>
  <text x="120" y="95" font-size="14" text-anchor="middle" font-weight="bold" fill="#7a5c00">DC24V 电源</text>
  <circle cx="70" cy="125" r="7" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="85" y="112" font-size="12" fill="#333">L+（+24V）</text>
  <circle cx="70" cy="150" r="7" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="85" y="172" font-size="12" fill="#333">M（0V）</text>
  <rect x="300" y="70" width="140" height="70" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="370" y="98" font-size="14" text-anchor="middle" font-weight="bold" fill="#234">电磁阀线圈</text>
  <text x="370" y="118" font-size="12" text-anchor="middle" fill="#234">DC24V / 4.8W</text>
  <rect x="300" y="220" width="220" height="110" rx="10" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2.5"/>
  <text x="410" y="245" font-size="15" text-anchor="middle" font-weight="bold" fill="#1c5c1c">PLC 晶体管输出（漏型）</text>
  <circle cx="340" cy="275" r="8" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="356" y="280" font-size="13" fill="#333">Q0.0 输出点</text>
  <circle cx="340" cy="305" r="8" fill="#fff" stroke="#333" stroke-width="2"/>
  <text x="356" y="310" font-size="13" fill="#333">1M 公共端</text>
  <line x1="77" y1="125" x2="250" y2="125" stroke="#8b4513" stroke-width="3"/>
  <line x1="250" y1="125" x2="250" y2="105" stroke="#8b4513" stroke-width="3"/>
  <line x1="250" y1="105" x2="300" y2="105" stroke="#8b4513" stroke-width="3"/>
  <line x1="440" y1="105" x2="470" y2="105" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="470" y1="105" x2="470" y2="275" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="470" y1="275" x2="348" y2="275" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="77" y1="150" x2="230" y2="150" stroke="#555" stroke-width="3"/>
  <line x1="230" y1="150" x2="230" y2="305" stroke="#555" stroke-width="3"/>
  <line x1="230" y1="305" x2="332" y2="305" stroke="#555" stroke-width="3"/>
  <path d="M 400 105 l -12 -6 v 12 z" fill="#1e6fd0"/>
  <text x="480" y="180" font-size="12" fill="#1e6fd0">电流方向：L+ → 线圈 → Q0.0</text>
  <text x="480" y="200" font-size="12" fill="#1e6fd0">→ 内部晶体管 → 1M → M</text>
  <text x="20" y="362" font-size="12" fill="#888">要点：漏型输出导通时将负载"吸入"0V，故线圈另一端接 L+；公共端 1M 接 M。</text>
</svg>`,
  tpl_relay_diode: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 380" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="380" fill="#ffffff"/>
  <text x="20" y="32" font-size="19" font-weight="bold" fill="#222">中间继电器隔离 + 线圈续流二极管保护</text>
  <rect x="40" y="80" width="150" height="90" rx="10" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="115" y="105" font-size="14" text-anchor="middle" font-weight="bold" fill="#1c5c1c">PLC 输出 Q0.1</text>
  <text x="115" y="128" font-size="12" text-anchor="middle" fill="#1c5c1c">DC24V 弱电侧</text>
  <text x="115" y="150" font-size="12" text-anchor="middle" fill="#1c5c1c">0V</text>
  <rect x="270" y="70" width="120" height="60" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="330" y="95" font-size="14" text-anchor="middle" font-weight="bold" fill="#234">继电器线圈 KA</text>
  <text x="330" y="115" font-size="11" text-anchor="middle" fill="#234">DC24V</text>
  <line x1="190" y1="105" x2="270" y2="100" stroke="#36c" stroke-width="3"/>
  <line x1="190" y1="150" x2="240" y2="150" stroke="#555" stroke-width="3"/>
  <line x1="240" y1="150" x2="240" y2="115" stroke="#555" stroke-width="3"/>
  <line x1="240" y1="115" x2="270" y2="115" stroke="#555" stroke-width="3"/>
  <g stroke="#c33" stroke-width="2.5" fill="none">
    <line x1="430" y1="80" x2="430" y2="100"/>
    <line x1="430" y1="100" x2="450" y2="100"/>
    <line x1="450" y1="100" x2="450" y2="120"/>
    <circle cx="430" cy="80" r="3" fill="#c33"/>
    <circle cx="450" cy="120" r="3" fill="#c33"/>
  </g>
  <text x="462" y="95" font-size="12" fill="#c33">KA 常开触点</text>
  <text x="462" y="115" font-size="12" fill="#c33">（强电侧）</text>
  <rect x="520" y="150" width="110" height="60" rx="8" fill="#fdf0f0" stroke="#c33" stroke-width="2"/>
  <text x="575" y="175" font-size="13" text-anchor="middle" font-weight="bold" fill="#922">电磁阀线圈</text>
  <text x="575" y="195" font-size="11" text-anchor="middle" fill="#922">AC220V 或 DC</text>
  <line x1="450" y1="120" x2="450" y2="165" stroke="#c33" stroke-width="3"/>
  <line x1="450" y1="165" x2="520" y2="165" stroke="#c33" stroke-width="3"/>
  <line x1="630" y1="180" x2="645" y2="180" stroke="#555" stroke-width="3"/>
  <line x1="645" y1="180" x2="645" y2="250" stroke="#555" stroke-width="3"/>
  <line x1="575" y1="210" x2="575" y2="250" stroke="#555" stroke-width="3"/>
  <line x1="575" y1="250" x2="645" y2="250" stroke="#555" stroke-width="3"/>
  <text x="540" y="272" font-size="12" fill="#555">回电源另一端</text>
  <g stroke="#2a7a2a" stroke-width="2.5" fill="none">
    <line x1="500" y1="150" x2="500" y2="165"/>
    <line x1="500" y1="165" x2="520" y2="165"/>
    <line x1="500" y1="210" x2="500" y2="195"/>
    <line x1="500" y1="195" x2="520" y2="195"/>
    <path d="M 500 178 l 0 0" />
    <path d="M 494 182 h 12 M 500 176 v 12" />
    <path d="M 494 176 l 12 12 M 506 176 l -12 12" opacity="0"/>
  </g>
  <path d="M 500 172 v 16 M 492 180 h 16" stroke="#2a7a2a" stroke-width="0" fill="none"/>
  <g stroke="#2a7a2a" stroke-width="2.5">
    <line x1="500" y1="165" x2="500" y2="195"/>
    <line x1="492" y1="172" x2="508" y2="172"/>
    <path d="M 492 188 L 500 180 L 508 188" fill="none"/>
  </g>
  <text x="430" y="230" font-size="12" fill="#2a7a2a">续流二极管并联在线圈两端</text>
  <text x="430" y="248" font-size="12" fill="#2a7a2a">（阴极接+端，吸收断电反电动势）</text>
  <text x="20" y="330" font-size="12" fill="#888">要点：PLC弱电只驱动继电器线圈；继电器触点切换强电负载，实现电气隔离；</text>
  <text x="20" y="350" font-size="12" fill="#888">直流负载线圈两端并联续流二极管保护触点/晶体管。</text>
</svg>`,
}

export const DIAGRAM_IDS = Object.keys(DIAGRAMS)

const IMG_MAP_KEY = 'qp.imgmap.v1'

/* 导入时记录 {questionId: templateId}（与 importedAt 同为本机元数据，零 DDL） */
export function saveImageMap(questions) {
  try {
    const map = JSON.parse(localStorage.getItem(IMG_MAP_KEY) || '{}')
    for (const q of questions) { if (q && q.id && q.image && DIAGRAMS[q.image]) map[q.id] = q.image }
    localStorage.setItem(IMG_MAP_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

export function imageFor(qid) {
  try { const map = JSON.parse(localStorage.getItem(IMG_MAP_KEY) || '{}'); return map[qid] || null } catch { return null }
}

export function diagramDataUri(id) {
  const svg = DIAGRAMS[id]
  if (!svg) return null
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

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
  tpl_sensor_3wire_plc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 380" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="380" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">3线传感器接PLC：NPN(左) vs PNP(右)</text>
  <text x="60" y="60" font-size="14" font-weight="bold" fill="#1e6fd0">NPN 漏型输出</text>
  <rect x="40" y="75" width="120" height="60" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="100" y="100" font-size="13" text-anchor="middle">传感器</text>
  <text x="100" y="118" font-size="11" text-anchor="middle">棕+ 蓝- 黑OUT</text>
  <line x1="60" y1="135" x2="60" y2="170" stroke="#8b4513" stroke-width="3"/>
  <line x1="100" y1="135" x2="100" y2="170" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="140" y1="135" x2="140" y2="200" stroke="#222" stroke-width="3"/>
  <text x="46" y="160" font-size="11" fill="#8b4513">棕→L+</text>
  <text x="86" y="160" font-size="11" fill="#1e6fd0">蓝→M</text>
  <rect x="40" y="200" width="180" height="70" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="130" y="222" font-size="13" text-anchor="middle" font-weight="bold">PLC 输入</text>
  <circle cx="70" cy="245" r="6" fill="#fff" stroke="#333"/><text x="82" y="250" font-size="11">X0</text>
  <circle cx="150" cy="245" r="6" fill="#fff" stroke="#333"/><text x="162" y="250" font-size="11">S/S</text>
  <line x1="140" y1="200" x2="140" y2="239" stroke="#222" stroke-width="3"/>
  <line x1="140" y1="239" x2="76" y2="245" stroke="#222" stroke-width="2"/>
  <line x1="150" y1="251" x2="150" y2="290" stroke="#8b4513" stroke-width="3"/>
  <text x="158" y="285" font-size="11" fill="#8b4513">S/S→L+（公共端接正）</text>
  <text x="40" y="320" font-size="11" fill="#555">NPN输出=开关到0V，故PLC公共端接L+</text>
  <line x1="330" y1="50" x2="330" y2="340" stroke="#ccc" stroke-dasharray="6 4"/>
  <text x="380" y="60" font-size="14" font-weight="bold" fill="#c33">PNP 源型输出</text>
  <rect x="360" y="75" width="120" height="60" rx="8" fill="#fdf0f0" stroke="#c33" stroke-width="2"/>
  <text x="420" y="100" font-size="13" text-anchor="middle">传感器</text>
  <text x="420" y="118" font-size="11" text-anchor="middle">棕+ 蓝- 黑OUT</text>
  <line x1="380" y1="135" x2="380" y2="170" stroke="#8b4513" stroke-width="3"/>
  <line x1="420" y1="135" x2="420" y2="170" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="460" y1="135" x2="460" y2="200" stroke="#222" stroke-width="3"/>
  <text x="366" y="160" font-size="11" fill="#8b4513">棕→L+</text>
  <text x="406" y="160" font-size="11" fill="#1e6fd0">蓝→M</text>
  <rect x="360" y="200" width="180" height="70" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="450" y="222" font-size="13" text-anchor="middle" font-weight="bold">PLC 输入</text>
  <circle cx="390" cy="245" r="6" fill="#fff" stroke="#333"/><text x="402" y="250" font-size="11">X0</text>
  <circle cx="470" cy="245" r="6" fill="#fff" stroke="#333"/><text x="482" y="250" font-size="11">S/S</text>
  <line x1="460" y1="200" x2="460" y2="239" stroke="#222" stroke-width="3"/>
  <line x1="460" y1="239" x2="396" y2="245" stroke="#222" stroke-width="2"/>
  <line x1="470" y1="251" x2="470" y2="290" stroke="#1e6fd0" stroke-width="3"/>
  <text x="478" y="285" font-size="11" fill="#1e6fd0">S/S→M（公共端接负）</text>
  <text x="360" y="320" font-size="11" fill="#555">PNP输出=开关到+24V，故PLC公共端接M</text>
  <text x="20" y="362" font-size="12" fill="#888">要点：黑线=信号进PLC输入点；NPN配S/S接L+，PNP配S/S接M，二者不可混。</text>
</svg>`,
  tpl_sensor_2wire_plc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 300" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="300" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">2线制磁性开关接PLC（串入输入回路）</text>
  <rect x="60" y="70" width="140" height="60" rx="8" fill="#fff8ec" stroke="#b8860b" stroke-width="2"/>
  <text x="130" y="95" font-size="13" text-anchor="middle" font-weight="bold">DC24V 电源</text>
  <circle cx="90" cy="115" r="6" fill="#fff" stroke="#333"/><text x="102" y="120" font-size="11">L+</text>
  <circle cx="160" cy="115" r="6" fill="#fff" stroke="#333"/><text x="172" y="120" font-size="11">M</text>
  <rect x="280" y="60" width="120" height="50" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="340" y="82" font-size="13" text-anchor="middle">磁性开关(2线)</text>
  <text x="340" y="98" font-size="11" text-anchor="middle">棕 / 蓝</text>
  <line x1="90" y1="121" x2="90" y2="85" stroke="#8b4513" stroke-width="3"/>
  <line x1="90" y1="85" x2="280" y2="85" stroke="#8b4513" stroke-width="3"/>
  <line x1="400" y1="85" x2="470" y2="85" stroke="#222" stroke-width="3"/>
  <line x1="470" y1="85" x2="470" y2="170" stroke="#222" stroke-width="3"/>
  <rect x="400" y="170" width="180" height="70" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="490" y="192" font-size="13" text-anchor="middle" font-weight="bold">PLC 输入</text>
  <circle cx="430" cy="215" r="6" fill="#fff" stroke="#333"/><text x="442" y="220" font-size="11">X0</text>
  <circle cx="520" cy="215" r="6" fill="#fff" stroke="#333"/><text x="532" y="220" font-size="11">S/S</text>
  <line x1="470" y1="170" x2="470" y2="209" stroke="#222" stroke-width="3"/>
  <line x1="470" y1="209" x2="436" y2="215" stroke="#222" stroke-width="2"/>
  <line x1="520" y1="221" x2="520" y2="260" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="520" y1="260" x2="160" y2="260" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="160" y1="260" x2="160" y2="121" stroke="#1e6fd0" stroke-width="3"/>
  <text x="200" y="75" font-size="11" fill="#8b4513">棕→L+</text>
  <text x="410" y="75" font-size="11" fill="#222">蓝→X0</text>
  <text x="300" y="255" font-size="11" fill="#1e6fd0">S/S→M</text>
  <text x="20" y="285" font-size="12" fill="#888">要点：2线制无独立信号线，开关串在L+与输入点之间；注意传感器漏电流须小于PLC输入 OFF 电流。</text>
</svg>`,
  tpl_npn_pnp_relay: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 320" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="320" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">用中间继电器转换 NPN ↔ PNP</text>
  <rect x="40" y="70" width="120" height="55" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="100" y="92" font-size="13" text-anchor="middle">NPN 传感器</text>
  <text x="100" y="108" font-size="11" text-anchor="middle">黑OUT(开关到0V)</text>
  <line x1="160" y1="97" x2="230" y2="97" stroke="#222" stroke-width="3"/>
  <rect x="230" y="70" width="120" height="55" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="290" y="92" font-size="13" text-anchor="middle">继电器线圈 KA</text>
  <text x="290" y="108" font-size="11" text-anchor="middle">另一端接 L+</text>
  <line x1="230" y1="97" x2="230" y2="97" stroke="#222" stroke-width="3"/>
  <text x="170" y="88" font-size="11" fill="#222">OUT→线圈-</text>
  <g stroke="#c33" stroke-width="2.5" fill="none">
    <line x1="420" y1="70" x2="420" y2="90"/><line x1="420" y1="90" x2="440" y2="90"/><line x1="440" y1="90" x2="440" y2="110"/>
    <circle cx="420" cy="70" r="3" fill="#c33"/><circle cx="440" cy="110" r="3" fill="#c33"/>
  </g>
  <text x="452" y="85" font-size="12" fill="#c33">KA 常开触点</text>
  <line x1="440" y1="110" x2="440" y2="160" stroke="#c33" stroke-width="3"/>
  <line x1="440" y1="160" x2="520" y2="160" stroke="#c33" stroke-width="3"/>
  <rect x="520" y="140" width="110" height="55" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="575" y="162" font-size="13" text-anchor="middle">PLC 输入 X0</text>
  <text x="575" y="178" font-size="11" text-anchor="middle">S/S→M</text>
  <line x1="420" y1="70" x2="420" y2="50" stroke="#8b4513" stroke-width="3"/>
  <text x="428" y="48" font-size="11" fill="#8b4513">触点公共端→L+</text>
  <text x="40" y="160" font-size="12" fill="#555">NPN(漏型)输出只能拉低→驱动继电器线圈；</text>
  <text x="40" y="180" font-size="12" fill="#555">继电器触点改为"接正"输出=等效 PNP(源型)。</text>
  <text x="40" y="210" font-size="12" fill="#555">反向转换(PNP→NPN)：线圈接法对调，触点改接 M。</text>
  <text x="20" y="300" font-size="12" fill="#888">要点：继电器提供电气隔离+极性反转；触点额定电流须≥PLC输入电流。</text>
</svg>`,
  tpl_wire_color_legend: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="340" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">导线颜色标识图例</text>
  <g font-size="13">
    <rect x="40" y="55" width="40" height="18" fill="#8b4513"/><text x="90" y="69">棕 = DC +24V（L+）／传感器正极</text>
    <rect x="40" y="83" width="40" height="18" fill="#1e6fd0"/><text x="90" y="97">蓝 = DC 0V（M）／中性线 N</text>
    <rect x="40" y="111" width="40" height="18" fill="#222"/><text x="90" y="125">黑 = 信号线（传感器 OUT／开关量）</text>
    <rect x="40" y="139" width="40" height="18" fill="#2e8b2e"/><text x="90" y="153">绿黄双色 = 保护接地 PE</text>
    <rect x="40" y="167" width="40" height="18" fill="#d40000"/><text x="90" y="181">红 = AC 相线 L（单相火线）</text>
    <rect x="40" y="195" width="40" height="18" fill="#ffd400"/><text x="90" y="209">黄 = 三相母线 A 相（L1）</text>
    <rect x="40" y="223" width="40" height="18" fill="#00a000"/><text x="90" y="237">绿 = 三相母线 B 相（L2）</text>
    <rect x="40" y="251" width="40" height="18" fill="#d40000"/><text x="90" y="265">红 = 三相母线 C 相（L3）</text>
    <rect x="40" y="279" width="40" height="18" fill="#7ec8e3"/><text x="90" y="293">淡蓝 = 中性线 N（交流）</text>
  </g>
  <text x="360" y="70" font-size="13" font-weight="bold">传感器3线：</text>
  <rect x="360" y="80" width="24" height="14" fill="#8b4513"/><text x="390" y="92" font-size="12">棕=+</text>
  <rect x="360" y="100" width="24" height="14" fill="#1e6fd0"/><text x="390" y="112" font-size="12">蓝=-</text>
  <rect x="360" y="120" width="24" height="14" fill="#222"/><text x="390" y="132" font-size="12">黑=信号</text>
  <text x="360" y="165" font-size="13" font-weight="bold">气缸磁性开关2线：</text>
  <rect x="360" y="175" width="24" height="14" fill="#8b4513"/><text x="390" y="187" font-size="12">棕=+</text>
  <rect x="360" y="195" width="24" height="14" fill="#1e6fd0"/><text x="390" y="207" font-size="12">蓝=-</text>
  <text x="360" y="240" font-size="12" fill="#555">PE 永远绿黄，不得作载流导体；</text>
  <text x="360" y="258" font-size="12" fill="#555">N 用淡蓝，不得与 PE 混用。</text>
  <text x="20" y="325" font-size="12" fill="#888">要点：直流控制棕+/蓝-；交流相线红、中性淡蓝、PE绿黄；母线A黄B绿C红。</text>
</svg>`,
  tpl_plc_io_common: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="340" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">PLC 输入/输出公共端（源型 vs 漏型）</text>
  <text x="50" y="58" font-size="14" font-weight="bold" fill="#1e6fd0">输入：公共端 S/S 接 M（配 PNP/源型传感器）</text>
  <rect x="40" y="70" width="250" height="80" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="165" y="92" font-size="13" text-anchor="middle" font-weight="bold">PLC 数字量输入</text>
  <circle cx="80" cy="120" r="6" fill="#fff" stroke="#333"/><text x="92" y="125" font-size="11">X0..Xn</text>
  <circle cx="200" cy="120" r="6" fill="#fff" stroke="#333"/><text x="212" y="125" font-size="11">S/S</text>
  <line x1="200" y1="126" x2="200" y2="165" stroke="#1e6fd0" stroke-width="3"/>
  <text x="208" y="162" font-size="11" fill="#1e6fd0">S/S→M(0V)</text>
  <text x="40" y="175" font-size="11" fill="#555">传感器输出+24V→X，电流流入PLC=源型输入回路</text>
  <text x="370" y="58" font-size="14" font-weight="bold" fill="#c33">输入：公共端 S/S 接 L+（配 NPN/漏型传感器）</text>
  <rect x="360" y="70" width="250" height="80" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="485" y="92" font-size="13" text-anchor="middle" font-weight="bold">PLC 数字量输入</text>
  <circle cx="400" cy="120" r="6" fill="#fff" stroke="#333"/><text x="412" y="125" font-size="11">X0..Xn</text>
  <circle cx="520" cy="120" r="6" fill="#fff" stroke="#333"/><text x="532" y="125" font-size="11">S/S</text>
  <line x1="520" y1="126" x2="520" y2="165" stroke="#8b4513" stroke-width="3"/>
  <text x="528" y="162" font-size="11" fill="#8b4513">S/S→L+(24V)</text>
  <text x="360" y="175" font-size="11" fill="#555">传感器输出0V→X，电流流出PLC=漏型输入回路</text>
  <text x="50" y="205" font-size="14" font-weight="bold" fill="#1e6fd0">输出：漏型(晶体管吸电流)</text>
  <rect x="40" y="215" width="250" height="80" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="165" y="237" font-size="13" text-anchor="middle" font-weight="bold">PLC 输出(漏型)</text>
  <circle cx="80" cy="265" r="6" fill="#fff" stroke="#333"/><text x="92" y="270" font-size="11">Y0..</text>
  <circle cx="200" cy="265" r="6" fill="#fff" stroke="#333"/><text x="212" y="270" font-size="11">1M/3L</text>
  <text x="40" y="310" font-size="11" fill="#555">负载一端接L+，另一端接Y；导通时Y拉低到0V</text>
  <text x="370" y="205" font-size="14" font-weight="bold" fill="#c33">输出：源型(晶体管送电流)</text>
  <rect x="360" y="215" width="250" height="80" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="485" y="237" font-size="13" text-anchor="middle" font-weight="bold">PLC 输出(源型)</text>
  <circle cx="400" cy="265" r="6" fill="#fff" stroke="#333"/><text x="412" y="270" font-size="11">Y0..</text>
  <circle cx="520" cy="265" r="6" fill="#fff" stroke="#333"/><text x="532" y="270" font-size="11">1M/3L</text>
  <text x="360" y="310" font-size="11" fill="#555">负载一端接M，另一端接Y；导通时Y输出+24V</text>
  <text x="20" y="332" font-size="12" fill="#888">要点：输入看传感器类型定S/S；输出看负载接法定源/漏；同一模块公共端接法须统一。</text>
</svg>`,
  tpl_stepper_driver: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="340" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">步进驱动器接线（脉冲+方向）</text>
  <rect x="40" y="70" width="150" height="90" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="115" y="95" font-size="13" text-anchor="middle" font-weight="bold">PLC 高速输出</text>
  <text x="115" y="115" font-size="11" text-anchor="middle">Y0=脉冲  Y1=方向</text>
  <text x="115" y="135" font-size="11" text-anchor="middle">COM</text>
  <rect x="270" y="60" width="160" height="150" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="350" y="85" font-size="13" text-anchor="middle" font-weight="bold">步进驱动器</text>
  <text x="285" y="110" font-size="11">PUL+  PUL-</text>
  <text x="285" y="130" font-size="11">DIR+  DIR-</text>
  <text x="285" y="150" font-size="11">ENA+  ENA-</text>
  <text x="285" y="180" font-size="11">A+  A-   B+  B-</text>
  <rect x="500" y="90" width="120" height="80" rx="8" fill="#fdf0f0" stroke="#c33" stroke-width="2"/>
  <text x="560" y="120" font-size="13" text-anchor="middle" font-weight="bold">步进电机</text>
  <text x="560" y="140" font-size="11" text-anchor="middle">A相 / B相</text>
  <line x1="190" y1="105" x2="270" y2="105" stroke="#222" stroke-width="2"/>
  <line x1="190" y1="125" x2="270" y2="125" stroke="#222" stroke-width="2"/>
  <line x1="430" y1="175" x2="500" y2="120" stroke="#c33" stroke-width="2"/>
  <line x1="430" y1="185" x2="500" y2="140" stroke="#c33" stroke-width="2"/>
  <text x="200" y="100" font-size="10" fill="#222">脉冲→PUL+</text>
  <text x="200" y="120" font-size="10" fill="#222">方向→DIR+</text>
  <text x="440" y="115" font-size="10" fill="#c33">A+/A-</text>
  <text x="440" y="150" font-size="10" fill="#c33">B+/B-</text>
  <g font-size="11" fill="#555">
    <text x="40" y="200">PUL+ / PUL- ：脉冲信号正/负（决定步进角脉冲）</text>
    <text x="40" y="218">DIR+ / DIR- ：方向信号正/负（高/低电平决定转向）</text>
    <text x="40" y="236">ENA+ / ENA- ：使能信号（断开=电机自由/脱机）</text>
    <text x="40" y="254">A+ A- / B+ B- ：电机两相绕组（同绕组相通断导通）</text>
  </g>
  <text x="20" y="290" font-size="12" fill="#888">辨相：万用表通断/电阻档，相通的两线为同一绕组(A或B)；</text>
  <text x="20" y="308" font-size="12" fill="#888">A/B两组互换→转向反向；同组内两线互换→转向也反向。</text>
  <text x="20" y="330" font-size="12" fill="#888">要点：共阳接法将PUL-/DIR-/ENA-接COM；信号须串限流电阻(按驱动器要求)。</text>
</svg>`,
  tpl_servo_driver: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="340" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">伺服驱动器接线（功率+编码器+控制）</text>
  <rect x="40" y="60" width="130" height="70" rx="8" fill="#fff8ec" stroke="#b8860b" stroke-width="2"/>
  <text x="105" y="85" font-size="13" text-anchor="middle" font-weight="bold">单相/三相电源</text>
  <text x="105" y="105" font-size="11" text-anchor="middle">L1 L2 (L3)</text>
  <rect x="250" y="50" width="170" height="180" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="335" y="75" font-size="13" text-anchor="middle" font-weight="bold">伺服驱动器</text>
  <text x="262" y="100" font-size="11">L1/L2/L3 电源入</text>
  <text x="262" y="120" font-size="11">U V W → 电机</text>
  <text x="262" y="140" font-size="11">编码器接口 CN2</text>
  <text x="262" y="160" font-size="11">控制 CN1: 脉冲/方向</text>
  <text x="262" y="180" font-size="11">或 总线(PROFINET/EtherCAT)</text>
  <text x="262" y="200" font-size="11">STO 安全转矩关断</text>
  <rect x="500" y="80" width="120" height="80" rx="8" fill="#fdf0f0" stroke="#c33" stroke-width="2"/>
  <text x="560" y="110" font-size="13" text-anchor="middle" font-weight="bold">伺服电机</text>
  <text x="560" y="130" font-size="11" text-anchor="middle">U V W + 编码器</text>
  <line x1="170" y1="90" x2="250" y2="95" stroke="#8b4513" stroke-width="3"/>
  <line x1="420" y1="115" x2="500" y2="110" stroke="#c33" stroke-width="3"/>
  <line x1="420" y1="135" x2="500" y2="135" stroke="#2a7a2a" stroke-width="2"/>
  <text x="430" y="108" font-size="10" fill="#c33">U/V/W</text>
  <text x="430" y="150" font-size="10" fill="#2a7a2a">编码器反馈</text>
  <g font-size="11" fill="#555">
    <text x="40" y="250">功率回路：L1/L2(/L3)进，U/V/W出接电机，相序错→反转/报警；</text>
    <text x="40" y="268">编码器：绝对值(多圈电池) / 增量(每转脉冲)，接CN2不可热插拔；</text>
    <text x="40" y="286">控制：位置模式=脉冲+方向；速度/转矩=模拟量或总线给定；</text>
    <text x="40" y="304">STO：安全回路断开时切断转矩输出（功能安全）。</text>
  </g>
  <text x="20" y="330" font-size="12" fill="#888">要点：伺服=功率+反馈+控制三回路；编码器与U/V/W均须对应，接错即报警或飞车。</text>
</svg>`,
  tpl_vfd_wiring: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="340" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">变频器接线（主回路+控制回路）</text>
  <rect x="40" y="60" width="120" height="60" rx="8" fill="#fff8ec" stroke="#b8860b" stroke-width="2"/>
  <text x="100" y="85" font-size="13" text-anchor="middle" font-weight="bold">三相电源</text>
  <text x="100" y="103" font-size="11" text-anchor="middle">R S T (L1 L2 L3)</text>
  <rect x="240" y="50" width="180" height="170" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="330" y="75" font-size="13" text-anchor="middle" font-weight="bold">变频器 VFD</text>
  <text x="252" y="100" font-size="11">输入 R/S/T</text>
  <text x="252" y="120" font-size="11">输出 U/V/W → 电机</text>
  <text x="252" y="140" font-size="11">直流母线 + / -</text>
  <text x="252" y="160" font-size="11">制动电阻 + / PB</text>
  <text x="252" y="180" font-size="11">控制: DI(AI) 启停/频率</text>
  <text x="252" y="200" font-size="11">PE 接地</text>
  <rect x="500" y="90" width="120" height="70" rx="8" fill="#fdf0f0" stroke="#c33" stroke-width="2"/>
  <text x="560" y="118" font-size="13" text-anchor="middle" font-weight="bold">三相电机</text>
  <text x="560" y="138" font-size="11" text-anchor="middle">U V W</text>
  <line x1="160" y1="85" x2="240" y2="95" stroke="#8b4513" stroke-width="3"/>
  <line x1="420" y1="115" x2="500" y2="115" stroke="#c33" stroke-width="3"/>
  <rect x="500" y="180" width="120" height="40" rx="6" fill="#f4f4f4" stroke="#333" stroke-width="1.5"/>
  <text x="560" y="205" font-size="11" text-anchor="middle">制动电阻</text>
  <line x1="420" y1="155" x2="460" y2="155" stroke="#333" stroke-width="2"/>
  <line x1="460" y1="155" x2="460" y2="200" stroke="#333" stroke-width="2"/>
  <line x1="460" y1="200" x2="500" y2="200" stroke="#333" stroke-width="2"/>
  <g font-size="11" fill="#555">
    <text x="40" y="250">输入接 R/S/T；输出 U/V/W 接电机（禁接电源/电容/单相电机）；</text>
    <text x="40" y="268">制动电阻接 +/PB（能耗制动）；长下坡/大惯量必配；</text>
    <text x="40" y="286">控制：两线/三线启停 DI，频率=面板/模拟量(0-10V,4-20mA)/总线；</text>
    <text x="40" y="304">PE 可靠接地；输入/输出电抗器抑制谐波与 dv/dt。</text>
  </g>
  <text x="20" y="330" font-size="12" fill="#888">要点：进出不可反接；输出端严禁接电容与单相电机；制动电阻勿短接。</text>
</svg>`,
  tpl_motor_fwd_rev: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="340" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">电机正反转控制（电气+机械互锁）</text>
  <text x="50" y="60" font-size="12" font-weight="bold">三相电源 L1 L2 L3</text>
  <line x1="60" y1="70" x2="600" y2="70" stroke="#8b4513" stroke-width="2"/>
  <line x1="60" y1="78" x2="600" y2="78" stroke="#00a000" stroke-width="2"/>
  <line x1="60" y1="86" x2="600" y2="86" stroke="#d40000" stroke-width="2"/>
  <rect x="120" y="100" width="120" height="60" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="180" y="125" font-size="13" text-anchor="middle" font-weight="bold">KM1 正转</text>
  <text x="180" y="143" font-size="11" text-anchor="middle">L1-L2-L3 顺序</text>
  <rect x="360" y="100" width="120" height="60" rx="8" fill="#fdf0f0" stroke="#c33" stroke-width="2"/>
  <text x="420" y="125" font-size="13" text-anchor="middle" font-weight="bold">KM2 反转</text>
  <text x="420" y="143" font-size="11" text-anchor="middle">L3-L2-L1 换两相</text>
  <line x1="180" y1="86" x2="180" y2="100" stroke="#333" stroke-width="2"/>
  <line x1="420" y1="86" x2="420" y2="100" stroke="#333" stroke-width="2"/>
  <line x1="180" y1="160" x2="180" y2="220" stroke="#333" stroke-width="2"/>
  <line x1="420" y1="160" x2="420" y2="220" stroke="#333" stroke-width="2"/>
  <rect x="240" y="220" width="120" height="60" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="300" y="245" font-size="13" text-anchor="middle" font-weight="bold">电机 M</text>
  <text x="300" y="263" font-size="11" text-anchor="middle">U V W</text>
  <line x1="180" y1="220" x2="240" y2="240" stroke="#333" stroke-width="2"/>
  <line x1="420" y1="220" x2="360" y2="240" stroke="#333" stroke-width="2"/>
  <g stroke="#c33" stroke-width="2" fill="none">
    <line x1="150" y1="180" x2="150" y2="200"/><line x1="150" y1="200" x2="390" y2="200"/>
    <line x1="450" y1="180" x2="450" y2="190"/><line x1="450" y1="190" x2="210" y2="190"/>
  </g>
  <text x="60" y="196" font-size="11" fill="#c33">KM2常闭串入KM1线圈回路</text>
  <text x="60" y="212" font-size="11" fill="#c33">KM1常闭串入KM2线圈回路=电气互锁</text>
  <text x="40" y="305" font-size="12" fill="#555">换向=对调任意两相(图中L1与L3)；互锁防KM1/KM2同时吸合造成相间短路；</text>
  <text x="40" y="323" font-size="12" fill="#555">再加按钮机械互锁(复合按钮常闭)双重保护；正反转切换须先停或加延时。</text>
</svg>`,
  tpl_motor_stardelta: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="340" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">星三角(Y-Δ)降压起动</text>
  <text x="50" y="58" font-size="12" font-weight="bold">三相电源 L1 L2 L3</text>
  <rect x="60" y="70" width="110" height="50" rx="8" fill="#eef2fb" stroke="#36c" stroke-width="2"/>
  <text x="115" y="92" font-size="12" text-anchor="middle" font-weight="bold">KM 主接触器</text>
  <rect x="60" y="140" width="110" height="50" rx="8" fill="#eef7ee" stroke="#4a4" stroke-width="2"/>
  <text x="115" y="162" font-size="12" text-anchor="middle" font-weight="bold">KM-Y 星接</text>
  <rect x="60" y="210" width="110" height="50" rx="8" fill="#fdf0f0" stroke="#c33" stroke-width="2"/>
  <text x="115" y="232" font-size="12" text-anchor="middle" font-weight="bold">KM-Δ 角接</text>
  <rect x="330" y="110" width="180" height="140" rx="8" fill="#f0f7f0" stroke="#2a7a2a" stroke-width="2"/>
  <text x="420" y="135" font-size="13" text-anchor="middle" font-weight="bold">电机绕组</text>
  <text x="420" y="158" font-size="11" text-anchor="middle">U1 V1 W1（首端）</text>
  <text x="420" y="178" font-size="11" text-anchor="middle">U2 V2 W2（末端）</text>
  <text x="420" y="205" font-size="11" text-anchor="middle">Y: 末端短接成中性点</text>
  <text x="420" y="225" font-size="11" text-anchor="middle">Δ: 首尾相接成环</text>
  <line x1="170" y1="95" x2="330" y2="150" stroke="#36c" stroke-width="2"/>
  <line x1="170" y1="165" x2="330" y2="175" stroke="#4a4" stroke-width="2"/>
  <line x1="170" y1="235" x2="330" y2="205" stroke="#c33" stroke-width="2"/>
  <g font-size="11" fill="#555">
    <text x="40" y="285">起动: KM+KM-Y 吸合=星接，绕组电压=线电压/√3，起动电流↓为Δ的1/3；</text>
    <text x="40" y="303">运行: 延时后断KM-Y、合KM-Δ=角接，全压运行；</text>
    <text x="40" y="321">KM-Y与KM-Δ必须电气+机械互锁，切换有短暂断电(开口三角)。</text>
  </g>
  <text x="20" y="338" font-size="12" fill="#888">要点：星起角运降流不降转矩要求；只适用正常运行=Δ接法的电机。</text>
</svg>`,
  tpl_socket_wiring: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 300" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="300" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">单相插座接线（左零右火上接地）</text>
  <rect x="240" y="60" width="180" height="140" rx="14" fill="#f4f4f4" stroke="#333" stroke-width="2.5"/>
  <circle cx="330" cy="100" r="10" fill="#fff" stroke="#2e8b2e" stroke-width="3"/>
  <text x="352" y="105" font-size="12" fill="#2e8b2e">上 = PE 地线(绿黄)</text>
  <rect x="285" y="150" width="8" height="26" fill="#1e6fd0"/>
  <text x="240" y="168" font-size="12" fill="#1e6fd0" text-anchor="end">左 = N 零线(淡蓝)</text>
  <rect x="367" y="150" width="8" height="26" fill="#d40000"/>
  <text x="385" y="168" font-size="12" fill="#d40000">右 = L 火线(红)</text>
  <line x1="330" y1="110" x2="330" y2="230" stroke="#2e8b2e" stroke-width="3" stroke-dasharray="7 4"/>
  <line x1="289" y1="176" x2="289" y2="230" stroke="#1e6fd0" stroke-width="3"/>
  <line x1="371" y1="176" x2="371" y2="230" stroke="#d40000" stroke-width="3"/>
  <text x="270" y="248" font-size="11" fill="#1e6fd0">N</text>
  <text x="365" y="248" font-size="11" fill="#d40000">L</text>
  <text x="322" y="248" font-size="11" fill="#2e8b2e">PE</text>
  <g font-size="12" fill="#555">
    <text x="470" y="90">面对插座：</text>
    <text x="470" y="112">左孔 = 中性线 N</text>
    <text x="470" y="134">右孔 = 相线 L</text>
    <text x="470" y="156">上孔 = 保护地 PE</text>
    <text x="470" y="190">L-N 电压 = 220V</text>
    <text x="470" y="212">L-PE ≈ 220V，N-PE ≈ 0V</text>
  </g>
  <text x="20" y="285" font-size="12" fill="#888">要点：左零右火上接地；PE 不得与 N 混接；开关必须断 L 不断 N。</text>
</svg>`,
  tpl_crystal_head: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 300" font-family="'Microsoft YaHei',sans-serif">
  <rect width="660" height="300" fill="#fff"/>
  <text x="20" y="30" font-size="18" font-weight="bold">RJ45 水晶头线序（T568B）</text>
  <rect x="180" y="60" width="300" height="90" rx="10" fill="#f4f4f4" stroke="#333" stroke-width="2.5"/>
  <g font-size="11" text-anchor="middle">
    <rect x="200" y="80" width="26" height="50" fill="#ffe6cc"/><text x="213" y="145">1</text><text x="213" y="72">白橙</text>
    <rect x="234" y="80" width="26" height="50" fill="#ff8c00"/><text x="247" y="145">2</text><text x="247" y="72">橙</text>
    <rect x="268" y="80" width="26" height="50" fill="#e6ffe6"/><text x="281" y="145">3</text><text x="281" y="72">白绿</text>
    <rect x="302" y="80" width="26" height="50" fill="#0066cc"/><text x="315" y="145">4</text><text x="315" y="72">蓝</text>
    <rect x="336" y="80" width="26" height="50" fill="#e6f0ff"/><text x="349" y="145">5</text><text x="349" y="72">白蓝</text>
    <rect x="370" y="80" width="26" height="50" fill="#00a000"/><text x="383" y="145">6</text><text x="383" y="72">绿</text>
    <rect x="404" y="80" width="26" height="50" fill="#ffe6e6"/><text x="417" y="145">7</text><text x="417" y="72">白棕</text>
    <rect x="438" y="80" width="26" height="50" fill="#8b4513"/><text x="451" y="145">8</text><text x="451" y="72">棕</text>
  </g>
  <g font-size="12" fill="#555">
    <text x="60" y="190">T568B 顺序：白橙-橙-白绿-蓝-白蓝-绿-白棕-棕</text>
    <text x="60" y="212">实际通信用 1/2(橙对) 与 3/6(绿对) 两对；4/5、7/8 备用或POE供电</text>
    <text x="60" y="234">T568A = 绿橙两对互换；直连线两端同序，交叉线一端A一端B</text>
  </g>
  <text x="20" y="280" font-size="12" fill="#888">要点：压水晶头按 T568B 从左到右 1~8；线序错→链路不通或速率降级。</text>
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

export const DIAGRAM_TITLES = {"tpl_din_wiring":"DIN插头接线","tpl_plc_sinking":"PLC漏型输出","tpl_relay_diode":"继电器隔离+续流","tpl_sensor_3wire_plc":"3线传感器接PLC","tpl_sensor_2wire_plc":"2线磁感接PLC","tpl_npn_pnp_relay":"NPN/PNP继电器转换","tpl_wire_color_legend":"导线颜色图例","tpl_plc_io_common":"PLC公共端源漏型","tpl_stepper_driver":"步进驱动接线","tpl_servo_driver":"伺服驱动接线","tpl_vfd_wiring":"变频器接线","tpl_motor_fwd_rev":"正反转互锁","tpl_motor_stardelta":"星三角启动","tpl_socket_wiring":"插座接线","tpl_crystal_head":"RJ45线序"}

export function parseImageSpec(spec) {
  if (typeof spec !== 'string' || !spec) return null
  const parts = spec.split('|')
  if (!DIAGRAMS[parts[0]]) return null
  return { id: parts[0], params: parts.slice(1) }
}

export function diagramSvg(spec) {
  const p = parseImageSpec(spec)
  if (!p) return null
  let svg = DIAGRAMS[p.id]
  p.params.forEach((v, i) => { svg = svg.split('{{' + (i + 1) + '}}').join(v) })
  return svg
}

export function diagramDataUri(spec) {
  const svg = diagramSvg(spec)
  if (!svg) return null
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

export function diagramTitle(spec) {
  const p = parseImageSpec(spec)
  return p ? (DIAGRAM_TITLES[p.id] || p.id) : ''
}

export function readImageMap() {
  try { return JSON.parse(localStorage.getItem(IMG_MAP_KEY) || '{}') } catch { return {} }
}

export function mergeImageMap(extra) {
  if (!extra || typeof extra !== 'object') return
  try {
    const map = readImageMap()
    for (const [k, v] of Object.entries(extra)) { if (DIAGRAMS[String(v).split('|')[0]]) map[k] = v }
    localStorage.setItem(IMG_MAP_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

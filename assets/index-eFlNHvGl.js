import{e as $e,u as v,o as He,r,q as Ke,w as Ye,x as Ue,y as We,z as dt,C as St,B as Xe,t as fe,F as qe,c as Ct,s as Y,H as G,I as ht,J as Qe,j as t,G as T,K as Je,L as Ze,M as F,N as de,O as Ge,P as ti,Q as ei,d as ii,a as si,R as he,S as ye,U as ni,V as pe,W as ge,X as li,Y as ri,Z as oi,_ as xi,$ as we,a0 as ci,a1 as ai,a2 as Lt,b as Et,a3 as fi,a4 as di,a5 as Pt,a6 as Mt,a7 as ue,a8 as hi,a9 as ke,aa as yi,ab as pi,ac as gi,ad as wi,ae as ui,af as ki,ag as mi}from"./index-dQmMDKqw.js";const be={tpl_din_wiring:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 380" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_plc_sinking:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 380" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_relay_diode:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 380" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_sensor_3wire_plc:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 380" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_sensor_2wire_plc:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 300" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_npn_pnp_relay:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 320" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_wire_color_legend:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_plc_io_common:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_stepper_driver:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_servo_driver:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_vfd_wiring:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_motor_fwd_rev:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_motor_stardelta:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 340" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_socket_wiring:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 300" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`,tpl_crystal_head:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 300" font-family="'Microsoft YaHei',sans-serif">
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
</svg>`},bi={tpl_din_wiring:"DIN插头接线",tpl_plc_sinking:"PLC漏型输出",tpl_relay_diode:"继电器隔离+续流",tpl_sensor_3wire_plc:"3线传感器接PLC",tpl_sensor_2wire_plc:"2线磁感接PLC",tpl_npn_pnp_relay:"NPN/PNP继电器转换",tpl_wire_color_legend:"导线颜色图例",tpl_plc_io_common:"PLC公共端源漏型",tpl_stepper_driver:"步进驱动接线",tpl_servo_driver:"伺服驱动接线",tpl_vfd_wiring:"变频器接线",tpl_motor_fwd_rev:"正反转互锁",tpl_motor_stardelta:"星三角启动",tpl_socket_wiring:"插座接线",tpl_crystal_head:"RJ45线序"};function ve(f){if(typeof f!="string"||!f)return null;const d=f.split("|");return be[d[0]]?{id:d[0],params:d.slice(1)}:null}function vi(f){const d=ve(f);if(!d)return null;let h=be[d.id];return d.params.forEach((o,c)=>{h=h.split("{{"+(c+1)+"}}").join(o)}),h}function zi(f){const d=vi(f);return d?"data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(d))):null}function ji(f){const d=ve(f);return d?bi[d.id]||d.id:""}function Ni({q:f}){if(f.type!=="填空题"||!f.stem.includes("{"))return t.jsx("p",{className:"q-stem",children:f.stem});const d=f.stem.split(/(\{[^{}]*\})/g);return t.jsx("p",{className:"q-stem",children:d.map((h,o)=>h.startsWith("{")&&h.endsWith("}")?t.jsx("span",{style:{display:"inline-block",minWidth:70,borderBottom:"1.5px solid #5a4a2a",margin:"0 3px"},children:" "},o):t.jsx(mi.Fragment,{children:h},o))})}function me({text:f}){const d=String(f??""),h=d.split(/【(概念|推导|正解|误诊|记忆点)】/);if(h.length<3)return t.jsx("p",{children:d});const o=[];for(let c=1;c<h.length;c+=2){const w=(h[c+1]??"").trim();w&&o.push([h[c],w])}return o.length?t.jsx(t.Fragment,{children:o.map(([c,w],y)=>t.jsxs("div",{className:"exp-sec",children:[t.jsx("h6",{children:c}),t.jsx("p",{children:w})]},y))}):t.jsx("p",{children:d})}function V(f,d,h){const o=f.type==="单选题"||f.type==="多选题",c={};o&&(h||[]).forEach((j,S)=>{var _;const W=(f.options??[])[j]??"",M=((_=String(W).match(/^([A-E])[.、]/))==null?void 0:_[1])??"ABCDE"[j];c[M]="ABCDE"[S]});const w=j=>String(j??"").split("").map(S=>c[S]??S).join(""),y=j=>{const S=String(j??"");return!o||!Object.keys(c).length?S:S.replace(/(选|选项|答案)\s*([A-E])/g,(W,M,_)=>M+(c[_]??_)).replace(new RegExp("(?<![A-Za-z0-9.])([A-E])(?=项)","g"),(W,M)=>c[M]??M)},U=[`正确答案：${o?w(d?d.expected:f.answer):f.type==="填空题"&&(d!=null&&d.expectedParts)?d.expectedParts.map((j,S)=>d.expectedParts.length>1?`第${S+1}空：${j}`:j).join("　"):f.answer}`];return f.explanation&&U.push(`解析：${y(f.explanation)}`),U.join("。")}function Ci(){const f=$e(),d=v(e=>e.sessionMode),h=v(e=>e.sessionQuestions),o=v(e=>e.sessionIndex),c=v(e=>e.phase),w=v(e=>e.sessionResults),y=v(e=>e.lastGrade),P=v(e=>e.lastRating),U=v(e=>e.summary),j=v(e=>e.submitObjective),S=v(e=>e.confirmObjective),W=v(e=>e.submitSubjective),M=v(e=>e.next),_=v(e=>e.abortSession),ze=v(e=>e.startSession),s=h[o],g=s&&He(s.type),[_t,At]=r.useState(null),[yt,Rt]=r.useState([]),[X,Dt]=r.useState(null),[Tt,Vt]=r.useState([]),[tt,It]=r.useState(""),[m,Bt]=r.useState(!1),[Ot,Ft]=r.useState(!1),[je,$t]=r.useState(""),[Ne,pt]=r.useState(!1),[N,gt]=r.useState("intact"),wt=r.useRef(null),et=r.useRef(!1),Ht=r.useRef(Date.now()),[it,Se]=r.useState(()=>new Set),[Kt,ut]=r.useState(!1),[Yt,st]=r.useState(!1),Ut=it.has(o),L=r.useRef({key:null,order:[]}),[Wt,Xt]=r.useState(0);r.useEffect(()=>{At(null),Rt([]),Dt(null),Vt(Ke((s==null?void 0:s.stem)??"").map(()=>"")),It(""),Bt(!1),$t(""),clearTimeout(wt.current),gt("intact"),Ft(!1),pt(!1);const e=setTimeout(()=>pt(!0),120);return()=>clearTimeout(e)},[o,s==null?void 0:s.id]);function kt(){gt("cracking"),clearTimeout(wt.current),wt.current=setTimeout(()=>gt("broken"),520)}const qt=r.useRef(null);r.useEffect(()=>{const e=qt.current;if(!e)return;const i=e.querySelector(".q-face-scroll"),n=()=>{const l=e.clientWidth||320,x=((document.querySelector(".practice-top")||{}).offsetHeight||0)+26,p=((document.querySelector(".q-face-foot")||{}).offsetHeight||0)+14,b=Math.max(360,window.innerHeight-x);e.style.height="auto";const z=i?i.scrollHeight:b;e.style.height="auto";let K=z&&z>160?z+58+p:b;const ft=Math.max(320,Math.min(b,l/.5*.7)),C=Math.round(Math.min(b,Math.max(ft,K)));e.style.height=C+"px",e.parentElement&&(e.parentElement.style.minHeight=window.innerHeight+"px")};return n(),window.addEventListener("resize",n),window.addEventListener("orientationchange",n),()=>{window.removeEventListener("resize",n),window.removeEventListener("orientationchange",n)}},[o,s==null?void 0:s.id,N,m,c]),r.useEffect(()=>{if(c!=="feedback"&&!m||N!=="broken")return;let e=0,i=0;return e=requestAnimationFrame(()=>{i=requestAnimationFrame(()=>{const n=document.querySelector(".q-face-scroll"),l=document.querySelector(".grade-panel");if(!n||!l)return;const x=l.getBoundingClientRect().top-n.getBoundingClientRect().top+n.scrollTop-6,p=Math.max(0,Math.min(x,n.scrollHeight-n.clientHeight));Math.abs(p-n.scrollTop)<2||n.scrollTo({top:p})})}),()=>{cancelAnimationFrame(e),cancelAnimationFrame(i)}},[c,m,N]),r.useEffect(()=>{if(c==="done")return;const e=setInterval(()=>Xt(Math.floor((Date.now()-Ht.current)/1e3)),1e3);return()=>clearInterval(e)},[c]);const $=r.useMemo(()=>{let e=0;for(let i=w.length-1;i>=0&&w[i];i--)e++;return e},[w]);r.useEffect(()=>{if(c!=="answering"&&c!=="feedback")return;const e=i=>{var ft;if(i.altKey||i.metaKey)return;if(i.key==="?"){st(!0);return}const n=i.target&&i.target.tagName,l=n==="INPUT"||n==="TEXTAREA",x=()=>[...document.querySelectorAll(".q-face-foot button")];if((i.key==="ArrowDown"||i.key==="ArrowUp")&&c==="answering"&&g&&!l){const C=document.querySelectorAll(".opt-row, .judge-card");if(!C.length)return;i.preventDefault();const D=i.key==="ArrowDown";let B=-1;C.forEach((O,Fe)=>{O.className.indexOf("selected")>=0&&(B=Fe)}),B<0&&(B=D?-1:0);const Z=Math.min(C.length-1,Math.max(0,B+(D?1:-1)));(ft=C[Z])==null||ft.scrollIntoView({block:"nearest"}),C[Z].click();return}if(i.key==="Enter"){if(c==="feedback"){const D=x().find(O=>O.textContent.includes("下一题"));if(D){i.preventDefault(),D.click();return}const B=x().find(O=>O.textContent.includes("我答对了")),Z=x().find(O=>O.textContent.includes("我答错了"));if(B&&!i.shiftKey){i.preventDefault(),B.click();return}Z&&i.shiftKey&&(i.preventDefault(),Z.click());return}if(n==="TEXTAREA"&&!i.ctrlKey)return;const C=x().find(D=>D.textContent.includes("查看解析")||D.textContent.includes("展开参考答案"));C&&!C.disabled&&(i.preventDefault(),C.click());return}if(l||c!=="answering"||!g)return;const p=/^Digit([1-5])$/.exec(i.code)||/^Numpad([1-5])$/.exec(i.code),b=p?Number(p[1])-1:/^Key([A-E])$/.test(i.code)?"ABCDE".indexOf(i.code.slice(3)):-1;if(b<0)return;const z=document.querySelectorAll(".opt-row")[b],K=document.querySelectorAll(".judge-card")[b];z?(i.preventDefault(),z.click()):K&&(i.preventDefault(),K.click())};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[c,g,s==null?void 0:s.id]);const[u,Qt]=r.useState(Ye),mt=r.useRef(!1),[bt,Ce]=r.useState(Ue),[vt,Le]=r.useState(!1),[q,Ee]=r.useState(We),[nt,lt]=r.useState(!1),[rt,zt]=r.useState(()=>typeof window<"u"&&window.speechSynthesis?dt(window.speechSynthesis.getVoices()||[]):[]),Jt=r.useMemo(()=>[{value:"",label:"自动"},...Xe.map(e=>({value:e.id,label:e.label})),{value:St,label:"百度女声（备用线路）"},...rt.map(e=>({value:e.name,label:e.label}))],[rt]),Pe=(Jt.find(e=>e.value===(q||""))||{}).label||q||"自动";r.useEffect(()=>{if(!nt)return;const e=i=>{i.key==="Escape"&&lt(!1)};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[nt]);const Q=r.useRef(null),ot=r.useRef(null),E=r.useRef(fe()||qe()).current,A=r.useRef(null);r.useEffect(()=>{if(!fe())return;const e=window.speechSynthesis,i=()=>zt(dt(Mt()));i();try{e.addEventListener("voiceschanged",i)}catch{}const l=[400,900,1500,2400,3600,5200,7e3,9e3].map(x=>setTimeout(i,x));return()=>{try{e.removeEventListener("voiceschanged",i)}catch{}l.forEach(clearTimeout)}},[E]),r.useEffect(()=>{try{window.__ttsfxArm&&(window.__ttsfxLog=window.__ttsfxLog||[]).push({t:Date.now(),seal:N,phase:c,showAnswer:m,index:o,qid:s&&s.id,ttsOn:u})}catch{}if(!E)return;if(!(N==="broken"&&(c==="feedback"||m))||!s){mt.current&&(Ct(),H(),mt.current=!1),A.current=null;return}if(mt.current=!0,!u)return;const i=o+"|"+s.id;A.current!==i&&(A.current=i,H(),Y(V(s,y,L.current.order),{tag:"reveal|"+o+"|"+s.id}))},[E,N,c,m,o,s==null?void 0:s.id,u]);const Zt=r.useRef(null),I=r.useRef(null),xt=r.useRef(u),Gt=r.useRef(!1),te=r.useRef("");r.useLayoutEffect(()=>{xt.current=u,Gt.current=c!=="answering"||m,te.current=o+"|"+((s==null?void 0:s.id)??"")});function H(){I.current=null}function jt(e,i,n){H();const l={key:i+"|"+n,onDone:null};I.current=l,(()=>{let p=null;I.current!==l?p="handover":xt.current?Gt.current?p="revealed":te.current!==l.key&&(p="switched"):p="muted";try{window.__ttsfxArm&&(window.__stemLoopLog=window.__stemLoopLog||[]).push({t:Date.now(),key:l.key,blocked:p})}catch{}if(p)return;const b=()=>{I.current===l&&(I.current=null)};l.onDone=b,Y(e,{tag:"stem|"+i+"|"+n,onDone:b})})()}if(r.useEffect(()=>{if(!E||c!=="answering"||m||!s||!u)return;const e=o+"|"+s.id;if(Zt.current===e)return;Zt.current=e,jt(G(s),o,s.id);const i=L.current.order;if(ht(V(s,null,i)),s.type==="填空题"){const n=Qe(s);n.length>1&&ht(V(s,{expectedParts:n},i))}},[E,o,s==null?void 0:s.id,c,m,u]),r.useEffect(()=>()=>{Ct(),H(),clearInterval(ot.current)},[]),c==="idle"||h.length===0)return t.jsxs("div",{className:"practice-stage",style:{textAlign:"center",paddingTop:"24vh"},children:[t.jsx("p",{style:{color:"var(--muted)",letterSpacing:3,marginBottom:20},children:"还没有可练的题"}),t.jsx(T,{onClick:()=>f("/"),children:"返回学习页"})]});const k=c==="feedback",Nt=P!==null,Me=g&&s?h.slice(0,o).filter(e=>e.id===s.id).length+1:0,J=s.type==="单选题"||s.type==="多选题",ee=s.id+"#"+o;L.current.key!==ee&&(L.current={key:ee,order:Je((s.options??[]).length)});const ie=J?L.current.order.map((e,i)=>{var l;const n=s.options[e]??"";return{oi:e,raw:n,orig:((l=n.match(/^([A-E])[.、]/))==null?void 0:l[1])??"ABCDE"[e],disp:"ABCDE"[i],text:n.replace(/^[A-E]\s*[.、]\s*/,"")}}):[],R={};ie.forEach(e=>{R[e.orig]=e.disp});const _e=e=>String(e??"").split("").map(i=>R[i]??i).join(""),se=e=>{const i=String(e??"");return!J||!Object.keys(R).length?i:i.replace(/(选|选项|答案)\s*([A-E])/g,(n,l,x)=>l+(R[x]??x)).replace(new RegExp("(?<![A-Za-z0-9.])([A-E])(?=项)","g"),(n,l)=>R[l]??l)},Ae=g?J?_e(y?y.expected:s.answer):s.type==="填空题"&&(y!=null&&y.expectedParts)?y.expectedParts.map((e,i)=>y.expectedParts.length>1?`第${i+1}空：${e}`:e).join("　"):(y==null?void 0:y.expected)??s.answer:s.answer,ct=s.type==="单选题"?_t??"":s.type==="多选题"?yt.join(""):s.type==="判断题"?X??"":s.type==="填空题"?Tt.join(`
`):tt,ne=g?ct.trim().length>0:!0;function le(){const e=!u;if(Qt(e),ue(e),xt.current=e,!e){hi();return}F();const i=N==="broken"&&(c==="feedback"||m),n=(i?"reveal|":"stem|")+o+"|"+(s?s.id:"");if(ke()===n&&yi(I.current?I.current.onDone:void 0))return;ke()&&Ct();const l=o+"|"+(s==null?void 0:s.id);i&&s&&A.current!==l?(A.current=l,H(),Y(V(s,y,L.current.order),{tag:"reveal|"+o+"|"+s.id})):!i&&s&&c==="answering"&&!m&&jt(G(s),o,s.id)}function re(){if(!s)return;const e=N==="broken"&&(c==="feedback"||m);u||(Qt(!0),ue(!0),xt.current=!0),F(),clearTimeout(Q.current),e?(A.current=o+"|"+s.id,H(),Y(V(s,y,L.current.order),{tag:"reveal|"+o+"|"+s.id})):jt(G(s),o,s.id)}function at(){zt(dt(Mt()))}function Re(){const e=!vt;if(Le(e),clearInterval(ot.current),!e)return;pi(),at();const i=Date.now();ot.current=setInterval(()=>{zt(dt(Mt())),Date.now()-i>12e3&&clearInterval(ot.current)},1200)}function De(e){gi(e||null),Ee(e||null),e===St&&F(),u&&s&&A.current===o+"|"+s.id&&(clearTimeout(Q.current),Q.current=setTimeout(()=>Y(V(s,y,L.current.order),{tag:"reveal|"+o+"|"+s.id}),300)),setTimeout(at,1800)}function Te(e){const i=wi(e);Ce(i),u&&s&&A.current===o+"|"+s.id&&(clearTimeout(Q.current),Q.current=setTimeout(()=>Y(V(s,y,L.current.order),{rate:i,tag:"reveal|"+o+"|"+s.id}),450))}function Ve(){var i,n;if(!ne)return;if(Et(),F(),d==="review"){j(ct),Ft(!0);return}kt(),j(ct);const e=Ie(ct);if($t(e?"ok-flash":"bad-flash"),e||window.dispatchEvent(new Event("abyss-pulse")),e&&$+1>=3){const l=((i=document.querySelector(".reveal-btn"))==null?void 0:i.getBoundingClientRect())||((n=document.querySelector(".q-card-wrap"))==null?void 0:n.getBoundingClientRect());l&&ui(l.left+l.width/2,l.top,"teal",16)}}function Ie(e){try{return ki(s,e).correct}catch{return!0}}function oe(){if(et.current)return;et.current=!0;const e=h[o+1];e&&ht(G(e)),pt(!1),setTimeout(()=>{et.current=!1,M()},360)}function xe(e){W(e?"记得":"忘记"),e||window.dispatchEvent(new Event("abyss-pulse")),oe()}function Be(){et.current||(y&&y.correct,S(),oe())}if(c==="done"){const e=U.total,i=U.correct,n=e>0?Math.round(i/e*100):0,l=e-i,x=Math.floor(Wt/60),p=Wt%60;return t.jsx("div",{className:"practice-stage",children:t.jsx("div",{className:"settle-wrap",children:t.jsxs("div",{className:"settle-card",children:[t.jsx("div",{className:"confetti-drop","aria-hidden":"true",children:Array.from({length:14}).map((b,z)=>t.jsx("i",{},z))}),t.jsx("div",{className:"settle-medal","aria-hidden":"true",children:n===100?"🏆":n>=60?"🍬":"🍓"}),t.jsx("h2",{className:"settle-title",children:"本 轮 成 绩"}),t.jsxs("div",{className:"settle-pct "+(n>=60?"teal-glow-text":"red-glow-text"),children:[n,"%"]}),t.jsx("p",{className:"settle-sub",children:"正 确 率"}),n===100&&t.jsx("p",{className:"settle-praise",children:"全对！满分收工"}),n>=80&&n<100&&t.jsx("p",{className:"settle-praise",children:"正确率不错，继续保持"}),t.jsxs("div",{className:"settle-grid",children:[t.jsxs("span",{children:[t.jsx("b",{className:"teal-glow-text",children:i}),"答对"]}),t.jsxs("span",{children:[t.jsx("b",{className:"red-glow-text",children:l}),"答错"]}),t.jsxs("span",{children:[t.jsx("b",{children:x>0?`${x}分${p}秒`:`${p}秒`}),"用时"]}),t.jsxs("span",{children:[t.jsx("b",{children:$}),"最高连对"]})]}),t.jsxs("div",{className:"settle-actions",children:[l>0&&t.jsxs(T,{tone:"danger",onClick:async()=>{if(F(),await ze("wrong",{size:0})>0){Ht.current=Date.now(),Xt(0);const z=v.getState().sessionQuestions;z&&z[0]&&ht(G(z[0]))}else f("/")},children:[t.jsx(Ze,{})," 再练错题（",l,"）"]}),t.jsx(T,{onClick:()=>{_(),f("/")},children:"返回学习页"})]})]})})})}const a=y,ce=s?zi(de(s.id)):null,ae=h.length?w.length/h.length*100:0,Oe=h.length?(o+1)/h.length*100:0;return t.jsxs("div",{className:"practice-stage practice-play",role:"main","aria-label":"答题",children:[t.jsxs("div",{className:"practice-top",children:[t.jsxs("div",{className:"syrup-bar",role:"progressbar","aria-label":"答题进度","aria-valuenow":Math.round(ae),"aria-valuemin":0,"aria-valuemax":100,children:[t.jsx("div",{className:"syrup-fill",style:{transform:`scaleX(${Math.max(0,Math.min(1,Oe/100))})`,transformOrigin:"left"}}),t.jsx("div",{className:"syrup-knob",style:{left:`clamp(15px, ${ae}%, calc(100% - 15px))`}})]}),t.jsxs("span",{className:"practice-count",children:["第 ",o+1," 题 / 共 ",h.length," 题 · ",t.jsxs("b",{className:"teal-glow-text",children:["✓",w.filter(Boolean).length]})," ",t.jsxs("b",{className:"red-glow-text",children:["✗",w.filter(e=>!e).length]}),w.length>0&&t.jsxs(t.Fragment,{children:[" · 正确率 ",Math.round(w.filter(Boolean).length/w.length*100),"%"]})]}),t.jsx("button",{className:`chip tool${Ut?" on":""}`,"aria-pressed":Ut,title:"旗标：标记待回看（F）",onClick:()=>Se(e=>{const i=new Set(e);return i.has(o)?i.delete(o):i.add(o),i}),children:t.jsx(Ge,{})}),t.jsx("button",{className:"chip tool","aria-expanded":Kt,title:"答题总览（N）",onClick:()=>ut(!0),children:t.jsx(ti,{})}),t.jsx("button",{className:"chip tool","aria-expanded":Yt,title:"快捷键与帮助（?）",onClick:()=>st(!0),children:t.jsx(ei,{})}),t.jsx("button",{className:"chip",style:{fontSize:11},onClick:()=>{_(),f("/")},children:"✕ 退出"})]}),t.jsx("div",{className:"q-card-wrap",ref:qt,children:t.jsxs("div",{className:"q-flipper"+(Ne?" is-front":""),children:[t.jsxs("div",{className:"q-card "+je,children:[$>=3&&!k&&t.jsxs("span",{className:"combo-pop",style:{zIndex:8},children:[$," 连击"]}),t.jsxs("div",{className:"q-face",children:[t.jsxs("div",{className:"q-face-scroll",children:[t.jsxs("section",{className:"zone zone-q",children:[t.jsxs("div",{className:"q-tags",children:[t.jsx("span",{className:"type-candy",children:(s.type||"").replace(/题$/,"")}),s.knowledgeDomain&&t.jsx("span",{className:"q-domain-tag",children:ii(s.knowledgeDomain)}),s.difficulty&&t.jsx("span",{className:"diff-pill d-"+(si[s.difficulty]??"base"),children:s.difficulty})]}),t.jsx("div",{className:"parch-layer",children:t.jsx(Ni,{q:s})}),E&&!k&&!m&&t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,marginTop:6},children:[t.jsx("button",{className:"chip",style:{fontSize:11},"aria-pressed":u,title:"题干到手自动读一遍，不自动重复。关闭＝暂停在原处；再点＝接着读（不会从头重读）",onClick:le,children:u?t.jsxs(t.Fragment,{children:[t.jsx(he,{})," 题干播报"]}):t.jsxs(t.Fragment,{children:[t.jsx(ye,{})," 已暂停"]})}),t.jsxs("button",{className:"chip",style:{fontSize:11},title:"从开头重读题干（读一遍即止，不自动重复）",onClick:re,children:[t.jsx(ni,{})," 重读题干"]})]})]}),t.jsx("div",{className:"zone-rule","aria-hidden":"true"}),t.jsxs("section",{className:"zone zone-a",children:[t.jsx("h5",{className:"zone-label",children:g?"作答":"誊 写 作 答"}),t.jsxs("div",{className:"q-answer-zone",...J?{role:s.type==="多选题"?"group":"radiogroup","aria-label":s.type==="多选题"?"多选作答":"单选作答"}:{},children:[J&&ie.map(e=>{const i=s.type==="单选题"?_t===e.orig:yt.includes(e.orig);let n="";if(k&&a){const x=(a.expected??"").includes(e.orig);i&&x?n="right":i&&!x?n="wronged":x&&(n="missed")}else i&&(n="selected");return t.jsx("button",{disabled:k,role:s.type==="多选题"?"checkbox":"radio","aria-checked":i,className:`opt-row ${s.type==="多选题"?"square":""} ${n}`,onClick:()=>s.type==="单选题"?At(e.orig):Rt(l=>l.includes(e.orig)?l.filter(x=>x!==e.orig):[...l,e.orig].sort()),children:t.jsxs("span",{children:[t.jsxs("i",{className:"opt-k",children:[e.disp,"."]}),e.text]})},e.oi)}),s.type==="判断题"&&t.jsx("div",{className:"judge-pair",children:[["正确","✓","j-true"],["错误","✗","j-false"]].map(([e,i,n],l)=>{let x="";return k&&a?X===e?x=a.expected===e?"right":"wronged":e===a.expected&&(x="missed"):x=X===e?"selected":X?"dimmed":"",t.jsx("button",{disabled:k,className:`judge-card ${n} ${x}`,"aria-pressed":X===e,onClick:()=>Dt(e),children:t.jsx("span",{className:"judge-label",children:e})},e)})}),s.type==="填空题"&&t.jsx("div",{className:"fill-grid",children:Tt.map((e,i)=>{const n=k&&a?a.expectedParts??(a.expected??"").split(","):[],l=k&&a&&n[i]!==void 0&&e.trim()===n[i],x=k&&a&&!l;return t.jsxs("div",{className:"fill-item"+(l?" right":x?" wronged":""),children:[t.jsxs("span",{className:"no font-cinzel",children:["第",i+1,"空"]}),t.jsxs("div",{style:{flex:1},children:[t.jsx("input",{className:"rune-input",value:e,disabled:k,onChange:p=>Vt(b=>b.map((z,K)=>K===i?p.target.value:z)),placeholder:"导入答案…"}),x&&t.jsxs("p",{className:"fill-expected",children:["正确答案：",n[i]]})]})]},i)})}),!g&&t.jsxs("div",{className:"subjective-area",children:[t.jsx("textarea",{className:"rune-textarea",value:tt,disabled:k,onChange:e=>It(e.target.value),placeholder:s.type==="计算分析题"?"导入关键数值与推演过程…":"在此导入你的解读…"}),t.jsxs("p",{className:"char-count",children:["已导入 ",tt.length," 字"]})]})]})]}),t.jsx("div",{className:"zone-rule","aria-hidden":"true"}),t.jsxs("section",{role:"region","aria-label":"解析与反馈",className:"zone zone-s"+(k||m?" revealed":"")+(k&&!(g?y!=null&&y.correct:P==="记得")?" bad":""),children:[t.jsxs("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",paddingRight:2},children:[t.jsx("h5",{className:"zone-label",children:"解析"}),E&&t.jsx("button",{className:"chip",style:{fontSize:11},"aria-expanded":vt,"aria-pressed":u,title:u?`解析语音播报进行中｜${ge()}`:`已暂停在原处，再点继续接着读｜${ge()}`,onClick:Re,children:u?t.jsxs(t.Fragment,{children:[t.jsx(he,{})," ",pe(bt),"×"]}):t.jsxs(t.Fragment,{children:[t.jsx(ye,{})," 已暂停"]})}),!E&&t.jsx("span",{style:{fontSize:10.5,color:"var(--muted)",letterSpacing:".3px"},title:"当前浏览器内核不支持 Web Speech 语音合成（常见于部分安卓 WebView / 旧机型 / 内置浏览器）。换 Chrome、Edge 或 Safari 打开即可使用解析语音播报。",children:"🔇 本浏览器不支持播报"})]}),E&&vt&&t.jsxs(t.Fragment,{children:[t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"6px 4px 4px"},children:[t.jsx("button",{className:"chip",style:{fontSize:11},"aria-pressed":u,title:"关闭＝暂停在原处；再点＝接着读（不会从头重读）",onClick:le,children:u?"🔊 播报开":"▶ 继续播报"}),t.jsx("button",{className:"chip",style:{fontSize:11},title:"从开头重读本题（答题中重读题干，揭晓后重读答案与解析；静音时点它会自动打开播报）",onClick:re,children:"🔁 重读"}),t.jsx("input",{type:"range",min:oi,max:ri,step:li,value:bt,"aria-label":"播报语速",style:{flex:1,accentColor:"var(--teal, #3fbfa8)"},onChange:e=>Te(parseFloat(e.target.value))}),t.jsxs("span",{style:{fontSize:11,minWidth:40,textAlign:"right",letterSpacing:".3px"},children:[pe(bt),"×"]})]}),t.jsxs("div",{style:{display:"flex",alignItems:"flex-start",gap:8,padding:"0 4px 8px"},children:[t.jsx("span",{style:{fontSize:11,opacity:.7,paddingTop:3},children:"音色"}),t.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:2,minWidth:0},children:[t.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6},children:[t.jsxs("button",{className:"chip",style:{fontSize:11,maxWidth:232,textAlign:"left"},"aria-haspopup":"listbox","aria-expanded":nt,onClick:()=>{lt(e=>!e),at()},children:[Pe," ",t.jsx("span",{style:{opacity:.55},children:"▾"})]}),t.jsx("button",{className:"chip",style:{fontSize:11,padding:"2px 7px"},title:"重新读取本机音色列表（若是安卓且列表为空，可按下方提示装中文语音数据）",onClick:at,children:"↻"})]}),t.jsx("span",{style:{fontSize:10.5,opacity:.68,lineHeight:1.32,maxWidth:262},children:xi(q)?`已选云端音色（${q===St?"百度备用线路":"微软神经音"}）：不依赖本机语音库。本机可见语音 ${we().total} 条。`:rt.length>0?`已读取 ${rt.length} 个中文音色，可任选（含粤语/台湾/方言）· ${ci()}`:(()=>{const e=we();return e.total>0?`本机共 ${e.total} 条语音，其中中文 0 条。样例：${e.sample.join("；")}（可截图反馈）`:ai()})()})]})]})]}),N==="broken"&&ce&&t.jsx("img",{src:ce,alt:ji(de(s.id)),style:{display:"block",maxWidth:"100%",margin:"0 auto 10px",background:"#fff",border:"1px solid #e5d9c3",borderRadius:8}}),Ot&&N!=="broken"&&t.jsxs("div",{className:"selfcheck-note",style:{margin:"2px 0 10px",padding:"10px 12px",borderRadius:10,background:"rgba(63,191,168,.10)",border:"1px dashed rgba(63,191,168,.45)"},children:[t.jsxs("div",{style:{fontSize:12.5,lineHeight:1.6,letterSpacing:".3px"},children:[t.jsx(Lt,{})," ",t.jsx("b",{children:"复习自查"}),"：答案已提交。先在脑中完整回想「为什么是这个答案」，再启封对照—— 回想比直接看解析记得更牢（生成效应）。"]}),t.jsx("button",{className:"chip",style:{fontSize:12.5,padding:"5px 14px",marginTop:8},onClick:()=>{Et(),F(),kt()},children:"我已回想，对答案"})]}),N!=="broken"&&!Ot&&t.jsxs("div",{className:"seal-lock "+N,children:[t.jsx("span",{className:"seal-wax","aria-hidden":"true"}),t.jsx("span",{children:g?"答案已封印 · 查看解析后启封":"参考答案已隐藏 · 展开后显示"})]}),k&&t.jsxs("div",{className:"grade-panel",children:[(g||Nt)&&t.jsxs("div",{role:"status","aria-live":"polite",className:"verdict-banner "+((g?a!=null&&a.correct:P==="记得")?"ok":"bad"),children:[$>=3&&(g?a==null?void 0:a.correct:P==="记得")&&t.jsxs("span",{className:"combo-pop",children:[$," 连击"]}),(g?a!=null&&a.correct:P==="记得")?"答对了":"答错了"]}),g&&a&&!a.correct&&(()=>{const e=String(a.normalized??"").trim(),n=(e.match(/^[A-E]$/)?[...String(s.explanation??"").matchAll(/选(?:项)?\s*([A-E])[^（(]{0,40}[（(]混淆点[:：]\s*([^）]+)）|选(?:项)?\s*([A-E])[^：:]{0,40}混淆点[:：]\s*([^，。；）]+)/g)]:[]).find(p=>(p[1]??p[3])===e);if(!n)return null;const l=(n[2]??n[4]??"").trim().slice(0,60);if(!l)return null;const x=R[e]??e;return t.jsxs("p",{style:{margin:"2px 0 8px",padding:"7px 10px",borderRadius:8,background:"rgba(201,138,31,.10)",fontSize:12.5,lineHeight:1.7,letterSpacing:".3px"},children:["💡 你选的 ",t.jsx("b",{children:x})," 正是一个常见误区：",l]})})(),g&&a&&!a.correct&&s.type==="多选题"&&(()=>{const e=new Set(String(a.expected??"").split("")),i=new Set(yt),n=[...e].filter(x=>!i.has(x)).map(x=>R[x]??x).sort(),l=[...i].filter(x=>!e.has(x)).map(x=>R[x]??x).sort();return n.length===0&&l.length===0?null:t.jsxs("p",{style:{margin:"2px 0 8px",fontSize:12.5,lineHeight:1.8,color:"var(--ink-2)",letterSpacing:".3px"},children:["本题为多选：",n.length>0&&`漏选 ${n.length} 项（${n.join("、")}）`,n.length>0&&l.length>0&&" · ",l.length>0&&`错选 ${l.length} 项（${l.join("、")}）`]})})(),t.jsxs("div",{className:"answer-scroll-box "+((g?a!=null&&a.correct:P==="记得")?"ok":"bad"),children:[t.jsx("h5",{children:(g?a!=null&&a.correct:P==="记得")?"参考答案":"正确答案"}),t.jsx("p",{children:Ae}),s.explanation&&t.jsxs(t.Fragment,{children:[t.jsx("p",{className:"lab",children:"题库解析"}),t.jsx(me,{text:se(s.explanation)})]})]})]}),!g&&!k&&m&&t.jsx("div",{className:"grade-panel",children:t.jsxs("div",{className:"answer-scroll-box",children:[t.jsx("h5",{children:"◆ 参考答案"}),t.jsx("p",{children:s.answer}),s.explanation&&t.jsxs(t.Fragment,{children:[t.jsx("p",{className:"lab",children:"题库解析"}),t.jsx(me,{text:se(s.explanation)})]})]})})]})]}),t.jsxs("div",{className:"q-face-foot",children:[t.jsx("div",{className:"q-face-rule","aria-hidden":"true"}),!k&&(g?t.jsxs(t.Fragment,{children:[t.jsxs(T,{size:"lg",block:!0,className:"reveal-btn",disabled:!ne,onClick:Ve,children:[t.jsx(Lt,{})," 查看解析"]}),t.jsx("p",{className:"kbd-hint",children:"键盘 1-5 直选 · ↑↓ 切换选项 · Enter 确认"})]}):m?t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:"self-judge-row",children:[t.jsx(T,{tone:"teal",onClick:()=>xe(!0),children:"✓ 我答对了"}),t.jsx(T,{tone:"danger",onClick:()=>xe(!1),children:"✗ 我答错了"})]}),t.jsx("p",{className:"kbd-hint",children:"Enter = 答对 · Shift+Enter = 答错"})]}):t.jsxs(t.Fragment,{children:[t.jsxs(T,{size:"lg",block:!0,className:"reveal-btn",disabled:tt.trim()==="",onClick:()=>{Et(),F(),di(V(s,y,L.current.order)),kt(),Bt(!0)},children:[t.jsx(fi,{})," 展开参考答案"]}),t.jsx("p",{className:"kbd-hint",children:"Ctrl+Enter 展开答案"})]})),k&&g&&!Nt&&t.jsxs(t.Fragment,{children:[t.jsxs("h4",{children:["第 ",Me," / 3 次作答"]}),t.jsxs(T,{size:"lg",block:!0,className:"reveal-btn",onClick:Be,children:[t.jsx(Lt,{})," 确认，下一题"]}),t.jsx("p",{className:"kbd-hint",children:"Enter = 下一题"})]}),Nt&&t.jsx("p",{className:"flip-hint",children:"已记录，正在进入下一题"})]})]}),"        "]}),t.jsx("div",{className:"card-flip-cover","aria-hidden":"true"})]})},s.id+"-"+o),Kt&&Pt.createPortal(t.jsx("div",{className:"nav-mask",onClick:()=>ut(!1),children:t.jsxs("div",{className:"nav-sheet",role:"dialog","aria-label":"答题总览",onClick:e=>e.stopPropagation(),children:[t.jsxs("div",{className:"nav-hd",children:[t.jsx("b",{children:"答题总览"}),t.jsxs("span",{children:["已答 ",w.length," / ",h.length," · 旗标 ",it.size]}),t.jsx("button",{className:"chip tool",onClick:()=>ut(!1),"aria-label":"关闭",children:"✕"})]}),t.jsx("div",{className:"nav-grid",children:h.map((e,i)=>{const n=typeof w[i]=="boolean",l="nav-cell"+(n?w[i]?" ok":" bad":"")+(it.has(i)?" flag":"")+(i===o?" cur":"");return t.jsx("span",{className:l,"aria-current":i===o?"true":void 0,title:`第 ${i+1} 题${n?"（已作答）":""}${it.has(i)?" 已旗标":""}`,children:i+1},i)})}),t.jsx("p",{className:"nav-hint",children:"灰=未答 · 绿=答对 · 红=答错 · 角标=旗标 · 蓝框=当前题（仅供纵览，不支持跳题）"})]})}),document.body),Yt&&Pt.createPortal(t.jsx("div",{className:"nav-mask",onClick:()=>st(!1),children:t.jsxs("div",{className:"nav-sheet",role:"dialog","aria-label":"快捷键与帮助",onClick:e=>e.stopPropagation(),children:[t.jsxs("div",{className:"nav-hd",children:[t.jsx("b",{children:"快捷键与帮助"}),t.jsx("button",{className:"chip tool",onClick:()=>st(!1),"aria-label":"关闭",children:"✕"})]}),t.jsxs("div",{className:"help-grid",children:[t.jsx("span",{className:"kbd-key",children:"1-5 / A-E"}),t.jsx("span",{children:"直选选项或判断"}),t.jsx("span",{className:"kbd-key",children:"↑ ↓"}),t.jsx("span",{children:"在选项间移动"}),t.jsx("span",{className:"kbd-key",children:"Enter"}),t.jsx("span",{children:"提交作答 / 确认下一题"}),t.jsx("span",{className:"kbd-key",children:"Ctrl+Enter"}),t.jsx("span",{children:"展开主观题参考答案"}),t.jsx("span",{className:"kbd-key",children:"Shift+Enter"}),t.jsx("span",{children:"主观题自判答错"}),t.jsx("span",{className:"kbd-key",children:"F"}),t.jsx("span",{children:"旗标当前题"}),t.jsx("span",{className:"kbd-key",children:"N"}),t.jsx("span",{children:"答题总览"}),t.jsx("span",{className:"kbd-key",children:"?"}),t.jsx("span",{children:"本面板"})]}),t.jsx("p",{className:"nav-hint",children:"🔊 题干播报在答题中自动朗读一遍；解析区可调语速与音色。Esc 关闭面板。"})]})}),document.body),nt&&Pt.createPortal(t.jsxs(t.Fragment,{children:[t.jsx("div",{onClick:()=>lt(!1),style:{position:"fixed",inset:0,zIndex:79,background:"rgba(45,32,38,.30)"}}),t.jsx("div",{role:"listbox","aria-label":"播报音色",style:{position:"fixed",left:12,right:12,bottom:"calc(var(--nav-h, 58px) + 12px)",zIndex:80,maxHeight:"46vh",overflowY:"auto",overscrollBehavior:"contain",background:"var(--cream, #FFFDF8)",border:"2px solid var(--candy-pink-lt, #F3CBD3)",borderRadius:14,padding:6,boxShadow:"0 12px 32px rgba(90,60,70,.24)"},children:Jt.map(e=>{const i=(q||"")===e.value;return t.jsxs("button",{role:"option","aria-selected":i,onClick:()=>{De(e.value),lt(!1)},style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,width:"100%",padding:"9px 10px",margin:"1px 0",fontSize:12.5,lineHeight:1.35,textAlign:"left",border:"none",borderRadius:10,background:i?"linear-gradient(180deg,#EAF2ED,#DFECE5)":"transparent",color:"#2E6E58",cursor:"pointer"},children:[t.jsx("span",{style:{minWidth:0},children:e.label}),i&&t.jsx("span",{style:{color:"var(--candy-pink-dk, #E08CA0)",fontWeight:700},children:"✓"})]},e.value||"auto")})})]}),document.body)]})}export{Ci as default};

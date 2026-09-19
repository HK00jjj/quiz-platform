/* 依赖图静态数据（2026-09-18 自动生成自 tools/dependency_graph.json，md5=46096e93cb7fa8615d50bf2d4eab8def）
 * 勿手工编辑——更新请改源 JSON 后重跑 tools/graph_export.mjs。
 * 61 主题 / 74 先修边 / DAG 无环；覆盖 K8/K17/K23 三域。 */
export default {
 "meta": {
  "version": "1.0",
  "created": "2026-09-18",
  "domains": [
   "K8",
   "K17",
   "K23"
  ],
  "nodeCount": 61,
  "edgeCount": 74,
  "isDAG": true,
  "note": "专家假设图，需数据检验：若学习者出现违反依赖的掌握状态，应记录并复核（可能是另一学习路径，或该边不成立）"
 },
 "nodes": [
  {
   "id": "T-LV-BASIC",
   "name": "低压电器基础与元器件辨识",
   "domain": "K8",
   "attrCount": 5,
   "level": 1
  },
  {
   "id": "T-CTRL-CIRCUIT",
   "name": "继电器控制基本环节（点动/自锁/互锁/多地）",
   "domain": "K8",
   "attrCount": 4,
   "level": 3
  },
  {
   "id": "T-TIMER",
   "name": "时间继电器与延时控制",
   "domain": "K8",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T-THERMAL",
   "name": "热继电器与过载保护",
   "domain": "K8",
   "attrCount": 4,
   "level": 2
  },
  {
   "id": "T-RCD",
   "name": "漏电保护与剩余电流",
   "domain": "K8",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T-GROUND-SYS",
   "name": "接地系统型式与保护导体（TN/TT/IT/PE）",
   "domain": "K8",
   "attrCount": 4,
   "level": 3
  },
  {
   "id": "T-GROUND-RESIST",
   "name": "接地电阻与接地装置",
   "domain": "K8",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T-NEUTRAL",
   "name": "中性线与零线（N线）",
   "domain": "K8",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T-INSULATION-COORD",
   "name": "绝缘配合（电气间隙/爬电距离/CTI）",
   "domain": "K8",
   "attrCount": 4,
   "level": 2
  },
  {
   "id": "T-CONDUCTOR",
   "name": "导线/母排/载流量/压降",
   "domain": "K8",
   "attrCount": 4,
   "level": 2
  },
  {
   "id": "T-MOTOR-START",
   "name": "电机控制与启动方式/保护",
   "domain": "K8",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T-PROTECT-COORD",
   "name": "保护配合与选择性（级差/跳闸分析）",
   "domain": "K8",
   "attrCount": 4,
   "level": 3
  },
  {
   "id": "T-PROTECT-DEVICE",
   "name": "保护电器原理与特性（断路器/熔断器/隔离开关）",
   "domain": "K8",
   "attrCount": 4,
   "level": 2
  },
  {
   "id": "T-ELECTROMAG",
   "name": "电磁机构与电器本体原理（触点/铁芯/短路环）",
   "domain": "K8",
   "attrCount": 5,
   "level": 2
  },
  {
   "id": "T-SECONDARY",
   "name": "二次回路/端子与接线工艺",
   "domain": "K8",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T-CABINET",
   "name": "柜体结构与防护散热",
   "domain": "K8",
   "attrCount": 4,
   "level": 3
  },
  {
   "id": "T-REACTIVE",
   "name": "无功补偿与降损",
   "domain": "K8",
   "attrCount": 4,
   "level": 3
  },
  {
   "id": "T-HEAT-EFFECT",
   "name": "电流热效应与温升治理",
   "domain": "K8",
   "attrCount": 4,
   "level": 3
  },
  {
   "id": "T-SAFETY-OP",
   "name": "安规操作（倒闸/停电送电/接地线/两票/安全距离）",
   "domain": "K8",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T-VOLTAGE-SYS",
   "name": "电压等级与相线电压制式",
   "domain": "K8",
   "attrCount": 4,
   "level": 1
  },
  {
   "id": "T-POWER-SUPPLY",
   "name": "电源装置（开关电源/变压器/直流）",
   "domain": "K8",
   "attrCount": 4,
   "level": 2
  },
  {
   "id": "T-UNBALANCE",
   "name": "相序与三相不平衡",
   "domain": "K8",
   "attrCount": 4,
   "level": 5
  },
  {
   "id": "T-FIRE",
   "name": "电气火灾与防控",
   "domain": "K8",
   "attrCount": 2,
   "level": 4
  },
  {
   "id": "T-CABLE-INSTALL",
   "name": "电缆敷设与线路安装",
   "domain": "K8",
   "attrCount": 2,
   "level": 3
  },
  {
   "id": "T-MEASURE",
   "name": "测量与试验（万用表/绝缘/校验/互感器）",
   "domain": "K8",
   "attrCount": 4,
   "level": 2
  },
  {
   "id": "T-COLOR",
   "name": "颜色与标识规范（相色/母线/端子标识）",
   "domain": "K8",
   "attrCount": 4,
   "level": 1
  },
  {
   "id": "T-LOAD-DESIGN",
   "name": "负荷计算与配电设计（分级/需要系数/短路电流）",
   "domain": "K8",
   "attrCount": 4,
   "level": 3
  },
  {
   "id": "T-ATS-EMERGENCY",
   "name": "双电源与应急电源（ATSE/消防负荷）",
   "domain": "K8",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T-ELECTRIC-SAFETY",
   "name": "触电防护与安全电压",
   "domain": "K8",
   "attrCount": 4,
   "level": 5
  },
  {
   "id": "T-STANDARD",
   "name": "标准与规范引用（GB/IEC）",
   "domain": "K8",
   "attrCount": 2,
   "level": 1
  },
  {
   "id": "T-DC-SYSTEM",
   "name": "直流系统与直流接地（查找/绝缘监测/串电）",
   "domain": "K8",
   "attrCount": 4,
   "level": 5
  },
  {
   "id": "T-CTRL-SYSTEM",
   "name": "控制器与系统类（数控/主控/防跳回路）",
   "domain": "K8",
   "attrCount": 4,
   "level": 5
  },
  {
   "id": "T17-PANEL-LAYOUT",
   "name": "配盘布局与元器件安装",
   "domain": "K17",
   "attrCount": 3,
   "level": 1
  },
  {
   "id": "T17-WIRING",
   "name": "走线工艺（线槽/线管/弯曲半径/绑扎）",
   "domain": "K17",
   "attrCount": 3,
   "level": 2
  },
  {
   "id": "T17-TERMINAL",
   "name": "端子压接与紧固工艺",
   "domain": "K17",
   "attrCount": 4,
   "level": 2
  },
  {
   "id": "T17-CABLE",
   "name": "线缆选用（拖链/柔性/型号）",
   "domain": "K17",
   "attrCount": 3,
   "level": 3
  },
  {
   "id": "T17-SOLDER",
   "name": "焊接工艺（焊点/电烙铁）",
   "domain": "K17",
   "attrCount": 2,
   "level": 3
  },
  {
   "id": "T17-ASSEMBLY",
   "name": "装配工序与作业流程",
   "domain": "K17",
   "attrCount": 3,
   "level": 4
  },
  {
   "id": "T17-FIRSTPOWER",
   "name": "首次上电与出厂检查",
   "domain": "K17",
   "attrCount": 3,
   "level": 5
  },
  {
   "id": "T17-COMMISSION",
   "name": "调试流程（对点/空载带载/试机）",
   "domain": "K17",
   "attrCount": 4,
   "level": 6
  },
  {
   "id": "T17-INSPECT",
   "name": "点检维护与应急处置",
   "domain": "K17",
   "attrCount": 3,
   "level": 7
  },
  {
   "id": "T17-LABEL",
   "name": "标识与线号管理",
   "domain": "K17",
   "attrCount": 3,
   "level": 3
  },
  {
   "id": "T17-IO",
   "name": "I/O 设计与源漏型接法",
   "domain": "K17",
   "attrCount": 2,
   "level": 5
  },
  {
   "id": "T17-VALVE",
   "name": "电磁阀与执行器接线",
   "domain": "K17",
   "attrCount": 2,
   "level": 5
  },
  {
   "id": "T17-GROUND-ASSY",
   "name": "装配环节接地作业（PE/N 交接）",
   "domain": "K17",
   "attrCount": 1,
   "level": 5
  },
  {
   "id": "T17-CRAFT-MGMT",
   "name": "工艺管理（标准/一致性/图纸/反馈）",
   "domain": "K17",
   "attrCount": 3,
   "level": 5
  },
  {
   "id": "T17-DOC",
   "name": "资料与清单管理（BOM/图纸/记录）",
   "domain": "K17",
   "attrCount": 3,
   "level": 1
  },
  {
   "id": "T17-ACCEPT",
   "name": "验收测试与试运行",
   "domain": "K17",
   "attrCount": 3,
   "level": 7
  },
  {
   "id": "T17-PARAM",
   "name": "参数与程序管理",
   "domain": "K17",
   "attrCount": 2,
   "level": 7
  },
  {
   "id": "T17-ROOM",
   "name": "配电室与土建要求",
   "domain": "K17",
   "attrCount": 3,
   "level": 2
  },
  {
   "id": "T17-CABLE-INSTALL",
   "name": "电缆敷设与桥架安装",
   "domain": "K17",
   "attrCount": 4,
   "level": 3
  },
  {
   "id": "T17-TEAM",
   "name": "班组管理与协作",
   "domain": "K17",
   "attrCount": 3,
   "level": 6
  },
  {
   "id": "T23-EMC",
   "name": "电磁兼容与干扰抑制（屏蔽/滤波/磁环/地环路）",
   "domain": "K23",
   "attrCount": 5,
   "level": 4
  },
  {
   "id": "T23-REACTIVE",
   "name": "无功补偿与功率因数",
   "domain": "K23",
   "attrCount": 4,
   "level": 4
  },
  {
   "id": "T23-EQUIPOTENTIAL",
   "name": "等电位联结（MEB/LEB）",
   "domain": "K23",
   "attrCount": 4,
   "level": 5
  },
  {
   "id": "T23-SIGNAL-GND",
   "name": "信号地与工作地（GND）",
   "domain": "K23",
   "attrCount": 3,
   "level": 1
  },
  {
   "id": "T23-HARMONIC",
   "name": "谐波与三相不平衡治理",
   "domain": "K23",
   "attrCount": 3,
   "level": 5
  },
  {
   "id": "T23-GROUND-PRACTICE",
   "name": "接地作业规范与选型（车间/整改）",
   "domain": "K23",
   "attrCount": 3,
   "level": 4
  },
  {
   "id": "T23-GROUND-FAULT",
   "name": "接地故障诊断（间歇性/配合）",
   "domain": "K23",
   "attrCount": 2,
   "level": 5
  },
  {
   "id": "T23-SPD",
   "name": "浪涌保护（SPD/雷击）",
   "domain": "K23",
   "attrCount": 3,
   "level": 5
  },
  {
   "id": "T23-PQ",
   "name": "电能质量治理设备（SVG/APF/DVR）",
   "domain": "K23",
   "attrCount": 3,
   "level": 6
  }
 ],
 "edges": [
  {
   "from": "T-LV-BASIC",
   "to": "T-ELECTROMAG",
   "rationale": "器件本体原理需先认识器件",
   "confidence": "high"
  },
  {
   "from": "T-LV-BASIC",
   "to": "T-PROTECT-DEVICE",
   "rationale": "保护电器属低压电器范畴",
   "confidence": "high"
  },
  {
   "from": "T-LV-BASIC",
   "to": "T-THERMAL",
   "rationale": "热继电器是低压电器之一",
   "confidence": "high"
  },
  {
   "from": "T-LV-BASIC",
   "to": "T-POWER-SUPPLY",
   "rationale": "电源装置为器件供电",
   "confidence": "high"
  },
  {
   "from": "T-LV-BASIC",
   "to": "T-MEASURE",
   "rationale": "测量需识别被测器件",
   "confidence": "high"
  },
  {
   "from": "T-VOLTAGE-SYS",
   "to": "T-CONDUCTOR",
   "rationale": "载流量与压降以电压制式为前提",
   "confidence": "high"
  },
  {
   "from": "T-VOLTAGE-SYS",
   "to": "T-INSULATION-COORD",
   "rationale": "绝缘配合以电压等级为前提",
   "confidence": "high"
  },
  {
   "from": "T-VOLTAGE-SYS",
   "to": "T-UNBALANCE",
   "rationale": "不平衡是三相制式下的现象",
   "confidence": "high"
  },
  {
   "from": "T-LV-BASIC",
   "to": "T-CTRL-CIRCUIT",
   "rationale": "控制环节由器件构成",
   "confidence": "high"
  },
  {
   "from": "T-ELECTROMAG",
   "to": "T-CTRL-CIRCUIT",
   "rationale": "自锁/互锁依赖触点与线圈原理",
   "confidence": "high"
  },
  {
   "from": "T-CTRL-CIRCUIT",
   "to": "T-TIMER",
   "rationale": "延时环节是控制环节的扩展",
   "confidence": "high"
  },
  {
   "from": "T-CTRL-CIRCUIT",
   "to": "T-MOTOR-START",
   "rationale": "启动控制由基本环节组合",
   "confidence": "high"
  },
  {
   "from": "T-CTRL-CIRCUIT",
   "to": "T-SECONDARY",
   "rationale": "二次回路核心是控制逻辑",
   "confidence": "high"
  },
  {
   "from": "T-CTRL-CIRCUIT",
   "to": "T-CTRL-SYSTEM",
   "rationale": "系统类控制以基本环节为基础",
   "confidence": "high"
  },
  {
   "from": "T-TIMER",
   "to": "T-CTRL-SYSTEM",
   "rationale": "系统控制常含时序逻辑",
   "confidence": "high"
  },
  {
   "from": "T-PROTECT-DEVICE",
   "to": "T-PROTECT-COORD",
   "rationale": "配合需先懂各保护电器特性",
   "confidence": "high"
  },
  {
   "from": "T-PROTECT-DEVICE",
   "to": "T-MOTOR-START",
   "rationale": "电机回路保护由保护电器承担",
   "confidence": "high"
  },
  {
   "from": "T-CONDUCTOR",
   "to": "T-PROTECT-COORD",
   "rationale": "选择性校验涉及导体载流",
   "confidence": "high"
  },
  {
   "from": "T-CONDUCTOR",
   "to": "T-HEAT-EFFECT",
   "rationale": "发热源于导体载流",
   "confidence": "high"
  },
  {
   "from": "T-CONDUCTOR",
   "to": "T-LOAD-DESIGN",
   "rationale": "负荷计算落在导体选型",
   "confidence": "high"
  },
  {
   "from": "T-CONDUCTOR",
   "to": "T-CABLE-INSTALL",
   "rationale": "敷设对象是导体",
   "confidence": "high"
  },
  {
   "from": "T-INSULATION-COORD",
   "to": "T-GROUND-SYS",
   "rationale": "接地属绝缘/保护体系",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-SYS",
   "to": "T-NEUTRAL",
   "rationale": "N 线角色在接地系统中确定",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-SYS",
   "to": "T-RCD",
   "rationale": "RCD 动作依赖系统接地型式",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-SYS",
   "to": "T-GROUND-RESIST",
   "rationale": "接地电阻是接地系统的参数",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-SYS",
   "to": "T-ELECTRIC-SAFETY",
   "rationale": "触电防护以接地为核心手段",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-SYS",
   "to": "T-SAFETY-OP",
   "rationale": "安规操作含接地措施",
   "confidence": "high"
  },
  {
   "from": "T-RCD",
   "to": "T-ELECTRIC-SAFETY",
   "rationale": "剩余电流保护是触电防护手段",
   "confidence": "high"
  },
  {
   "from": "T-NEUTRAL",
   "to": "T-UNBALANCE",
   "rationale": "不平衡表现为中性点位移",
   "confidence": "high"
  },
  {
   "from": "T-POWER-SUPPLY",
   "to": "T-REACTIVE",
   "rationale": "无功补偿围绕电源与负载",
   "confidence": "high"
  },
  {
   "from": "T-POWER-SUPPLY",
   "to": "T-DC-SYSTEM",
   "rationale": "直流系统基于直流电源",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-RESIST",
   "to": "T-DC-SYSTEM",
   "rationale": "直流接地查找需懂接地电阻",
   "confidence": "high"
  },
  {
   "from": "T-HEAT-EFFECT",
   "to": "T-FIRE",
   "rationale": "电气火灾多由发热引起",
   "confidence": "high"
  },
  {
   "from": "T-PROTECT-COORD",
   "to": "T-FIRE",
   "rationale": "保护失效是火灾成因之一",
   "confidence": "high"
  },
  {
   "from": "T-PROTECT-DEVICE",
   "to": "T-ATS-EMERGENCY",
   "rationale": "双电源切换由开关电器实现",
   "confidence": "high"
  },
  {
   "from": "T-LOAD-DESIGN",
   "to": "T-ATS-EMERGENCY",
   "rationale": "应急电源配置由负荷等级决定",
   "confidence": "high"
  },
  {
   "from": "T-ELECTROMAG",
   "to": "T-CABINET",
   "rationale": "柜内散热与电器温升相关",
   "confidence": "high"
  },
  {
   "from": "T-STANDARD",
   "to": "T-SAFETY-OP",
   "rationale": "安规操作依据标准",
   "confidence": "high"
  },
  {
   "from": "T17-PANEL-LAYOUT",
   "to": "T17-WIRING",
   "rationale": "先布局后走线",
   "confidence": "high"
  },
  {
   "from": "T17-PANEL-LAYOUT",
   "to": "T17-TERMINAL",
   "rationale": "先装元件后接线",
   "confidence": "high"
  },
  {
   "from": "T17-PANEL-LAYOUT",
   "to": "T17-ROOM",
   "rationale": "配电室尺寸以柜体布置为约束",
   "confidence": "high"
  },
  {
   "from": "T17-WIRING",
   "to": "T17-LABEL",
   "rationale": "走线完成后编号",
   "confidence": "high"
  },
  {
   "from": "T17-TERMINAL",
   "to": "T17-LABEL",
   "rationale": "接线完成后编号",
   "confidence": "high"
  },
  {
   "from": "T17-WIRING",
   "to": "T17-CABLE",
   "rationale": "敷线需选线缆",
   "confidence": "high"
  },
  {
   "from": "T17-WIRING",
   "to": "T17-CABLE-INSTALL",
   "rationale": "桥架/穿管属走线范畴",
   "confidence": "high"
  },
  {
   "from": "T17-TERMINAL",
   "to": "T17-SOLDER",
   "rationale": "焊接是接线工艺之一",
   "confidence": "high"
  },
  {
   "from": "T17-WIRING",
   "to": "T17-ASSEMBLY",
   "rationale": "装配整合走线工艺",
   "confidence": "high"
  },
  {
   "from": "T17-TERMINAL",
   "to": "T17-ASSEMBLY",
   "rationale": "装配整合端子工艺",
   "confidence": "high"
  },
  {
   "from": "T17-LABEL",
   "to": "T17-ASSEMBLY",
   "rationale": "标识在装配中落实",
   "confidence": "high"
  },
  {
   "from": "T17-ASSEMBLY",
   "to": "T17-GROUND-ASSY",
   "rationale": "接地属装配环节",
   "confidence": "high"
  },
  {
   "from": "T17-ASSEMBLY",
   "to": "T17-FIRSTPOWER",
   "rationale": "装配完成后上电",
   "confidence": "high"
  },
  {
   "from": "T17-ASSEMBLY",
   "to": "T17-IO",
   "rationale": "I/O 接线属装配内容",
   "confidence": "high"
  },
  {
   "from": "T17-ASSEMBLY",
   "to": "T17-VALVE",
   "rationale": "执行器接线属装配内容",
   "confidence": "high"
  },
  {
   "from": "T17-ASSEMBLY",
   "to": "T17-CRAFT-MGMT",
   "rationale": "工艺管理针对装配过程",
   "confidence": "high"
  },
  {
   "from": "T17-FIRSTPOWER",
   "to": "T17-COMMISSION",
   "rationale": "上电检查后进入调试",
   "confidence": "high"
  },
  {
   "from": "T17-IO",
   "to": "T17-COMMISSION",
   "rationale": "调试需先通 I/O",
   "confidence": "high"
  },
  {
   "from": "T17-COMMISSION",
   "to": "T17-ACCEPT",
   "rationale": "验收在调试合格后",
   "confidence": "high"
  },
  {
   "from": "T17-COMMISSION",
   "to": "T17-INSPECT",
   "rationale": "点检针对运行中的设备",
   "confidence": "high"
  },
  {
   "from": "T17-COMMISSION",
   "to": "T17-PARAM",
   "rationale": "调试产生参数与程序",
   "confidence": "high"
  },
  {
   "from": "T17-CRAFT-MGMT",
   "to": "T17-TEAM",
   "rationale": "工艺管理涉及班组协作",
   "confidence": "high"
  },
  {
   "from": "T23-SIGNAL-GND",
   "to": "T23-EMC",
   "rationale": "抗扰以信号地处理为前提",
   "confidence": "high"
  },
  {
   "from": "T23-GROUND-PRACTICE",
   "to": "T23-EQUIPOTENTIAL",
   "rationale": "等电位是接地体系的组成",
   "confidence": "high"
  },
  {
   "from": "T23-GROUND-PRACTICE",
   "to": "T23-GROUND-FAULT",
   "rationale": "故障诊断以系统型式为前提",
   "confidence": "high"
  },
  {
   "from": "T23-REACTIVE",
   "to": "T23-HARMONIC",
   "rationale": "谐波影响功率因数与补偿",
   "confidence": "high"
  },
  {
   "from": "T23-HARMONIC",
   "to": "T23-PQ",
   "rationale": "电能质量治理针对谐波与暂降",
   "confidence": "high"
  },
  {
   "from": "T23-EMC",
   "to": "T23-PQ",
   "rationale": "治理设备需满足 EMC 要求",
   "confidence": "high"
  },
  {
   "from": "T23-EMC",
   "to": "T23-SPD",
   "rationale": "浪涌保护属 EMC 防护手段",
   "confidence": "high"
  },
  {
   "from": "T-CTRL-CIRCUIT",
   "to": "T17-IO",
   "rationale": "（跨域）I/O 接法以控制回路为基础",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-SYS",
   "to": "T17-GROUND-ASSY",
   "rationale": "（跨域）装配接地以接地系统知识为前提",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-SYS",
   "to": "T23-GROUND-PRACTICE",
   "rationale": "（跨域）作业规范以接地系统型式为前提",
   "confidence": "high"
  },
  {
   "from": "T-GROUND-SYS",
   "to": "T23-EMC",
   "rationale": "（跨域）EMC 接地以接地体系为前提",
   "confidence": "high"
  },
  {
   "from": "T-REACTIVE",
   "to": "T23-REACTIVE",
   "rationale": "（跨域）补偿深化以基础无功知识为前提",
   "confidence": "high"
  },
  {
   "from": "T-PROTECT-DEVICE",
   "to": "T23-SPD",
   "rationale": "（跨域）SPD 配合以保护电器知识为前提",
   "confidence": "high"
  },
  {
   "from": "T-MOTOR-START",
   "to": "T17-COMMISSION",
   "rationale": "（跨域）调试常涉及电机回路",
   "confidence": "high"
  }
 ]
}

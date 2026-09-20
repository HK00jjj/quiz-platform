/* 自绘糖果图标系统（替代 emoji）。
   设计语言：24×24 viewBox、1.7px 圆头细线、currentColor 主色 + 一条低透明度辅色线做"糖霜高光"。
   不用 Lucide/FontAwesome/Material（high-end-visual-design 明确禁用粗描边图标库），
   也不用 emoji（craft-floor：emoji 不能充当图标系统）。
   全部是纯几何 path，无位图、无外链字体。 */
import React from 'react'

const S = {
  width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true, focusable: 'false'
}

/* 学习：翻开的书页（AV批 2026-09-23 用户要求换掉 candy 棒棒糖 motif ——
   白瓷主题符号：左右两页纸面 + 中缝，右缝一条 .55 行线呼应"纸面阅读"。） */
export const IconLearn = () => (
  <svg {...S}>
    <path d="M12 7c-1.8-1.6-4.2-2.2-6.5-2.2v12.4c2.3 0 4.7.6 6.5 2.2 1.8-1.6 4.2-2.2 6.5-2.2V4.8C16.2 4.8 13.8 5.4 12 7Z" />
    <path d="M12 7v12.2" opacity=".55" />
  </svg>
)

/* 导入：收纳托盘（原糖纸礼盒换掉 —— 下箭头落进浅托盘，
   呼应"收进书架"三步流的最后一步，比礼盒更贴导入语义。） */
export const IconImport = () => (
  <svg {...S}>
    <path d="M12 3.5v9" />
    <path d="M8.5 9l3.5 3.5L15.5 9" />
    <path d="M4.5 13.5v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" />
    <path d="M4.5 17.5h15" opacity=".55" />
  </svg>
)

/* 书库：书架三书（原糖果罐换掉 —— 两本竖书 + 一本斜靠，
   书架剪影辨识度最高；底线横贯 = 架板。） */
export const IconBank = () => (
  <svg {...S}>
    <path d="M5 20.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v15" />
    <path d="M11 20.5v-13a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v13" />
    <path d="M17.8 8.6l2.6 12.2" opacity=".55" />
    <path d="M3.5 20.5h17" />
  </svg>
)

/* 设置：三档滑杆（白瓷沿用，仅注释去糖果措辞） */
export const IconSettings = () => (
  <svg {...S}>
    <path d="M4 7h9M17 7h3" />
    <circle cx="15" cy="7" r="2" />
    <path d="M4 12h3M11 12h9" />
    <circle cx="9" cy="12" r="2" />
    <path d="M4 17h9M17 17h3" />
    <circle cx="15" cy="17" r="2" />
  </svg>
)

/* 诊断：仪表盘（表盘弧 + 指针 + 两侧刻度）。
   2026-09-19 P0-5：底部导航「诊断」原用 emoji 📊（注释自述为省事），
   平台渲染不一致且不随主题色走——补自绘图标，导航五项回归统一线性体系。 */
export const IconDiag = () => (
  <svg {...S}>
    <path d="M4.5 16.5a8 8 0 1 1 15 0" />
    <path d="M12 16.5 16.2 10.2" />
    <circle cx="12" cy="16.5" r="1.5" opacity=".55" />
    <path d="M5.2 11.4h1.6M17.2 11.4h1.6M7.2 7.2l1.1 1.1" opacity=".55" />
  </svg>
)

/* 错题重练：循环箭头（重练） */
export const IconRetry = () => (
  <svg {...S}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 3.5V7h-3.5" />
    <path d="M9.5 12.5 11.5 14.5 15 10.5" opacity=".55" />
  </svg>
)

/* 随机练习：洗牌双箭头 */
export const IconShuffle = () => (
  <svg {...S}>
    <path d="M3.5 7h3.2c1.2 0 2.3.6 3 1.6l4.6 6.8c.7 1 1.8 1.6 3 1.6h3.2" />
    <path d="M3.5 17h3.2c1.2 0 2.3-.6 3-1.6l.9-1.3" opacity=".55" />
    <path d="M14.4 8.6l.9-1.3c.7-1 1.8-1.6 3-1.6h3.2" opacity=".55" />
    <path d="M18 4.5 20.5 7 18 9.5M18 14.5 20.5 17 18 19.5" />
  </svg>
)

/* 新题上手：四角星 + 小星（新） */
export const IconNew = () => (
  <svg {...S}>
    <path d="M12 3.5c.7 4.4 2.4 6.1 6.8 6.8-4.4.7-6.1 2.4-6.8 6.8-.7-4.4-2.4-6.1-6.8-6.8 4.4-.7 6.1-2.4 6.8-6.8Z" />
    <path d="M18.5 15.5c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9Z" opacity=".55" />
  </svg>
)

/* 挑题练习：漏斗筛选 */
export const IconFilter = () => (
  <svg {...S}>
    <path d="M4 5h16l-6.2 7.4v6.1L10.2 21v-8.6Z" />
    <path d="M8 8.5h8" opacity=".55" />
  </svg>
)

/* 查看解析（答题页主操作）：放大镜 + 内部加号（揭示/检视） */
export const IconReveal = () => (
  <svg {...S}>
    <circle cx="10.5" cy="10.5" r="5.75" />
    <path d="M15 15l5.5 5.5" />
    <path d="M8 10.5h5M10.5 8v5" opacity=".55" />
  </svg>
)

/* 展开参考答案：卷起的答案卷轴（纸面 + 折角 + 两行墨迹） */
export const IconScroll = () => (
  <svg {...S}>
    <path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h7.5L19 6.5v12A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-12" />
    <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5H14" opacity=".55" />
    <path d="M15 3.2V7h3.8" opacity=".55" />
    <path d="M9 11.5h6M9 15h4" opacity=".55" />
  </svg>
)

/* ── Batch B 增补（2026-09-19）：播报控件与题号导航图标化，去掉 emoji ── */
export const IconSound = () => (
  <svg {...S}>
    <path d="M4.5 9.5h3l4-3v11l-4-3h-3z" />
    <path d="M15 9.2a4 4 0 0 1 0 5.6" opacity=".55" />
    <path d="M17.4 7a7 7 0 0 1 0 10" opacity=".55" />
  </svg>
)
export const IconPause = () => (
  <svg {...S}>
    <path d="M9.5 6v12M14.5 6v12" />
  </svg>
)
export const IconReplay = () => (
  <svg {...S}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 3.5V7h-3.5" />
  </svg>
)
export const IconFlag = () => (
  <svg {...S}>
    <path d="M6.5 3.5v17" />
    <path d="M6.5 4.5h10l-1.6 3.4 1.6 3.4h-10z" />
  </svg>
)
export const IconGrid = () => (
  <svg {...S}>
    <path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z" />
  </svg>
)

/* 帮助：问号圆环（快捷键面板入口，Batch L） */
export const IconHelp = () => (
  <svg {...S}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M9.6 9.6a2.4 2.4 0 1 1 3.3 2.2c-.75.3-.9.8-.9 1.7" />
    <circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none" />
  </svg>
)

/* 对勾（状态确认用：自评、导出完成、书架使用中） */
export const IconCheck = () => (
  <svg {...S}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)

/* 叉（状态否定用：自评、错误标记） */
export const IconClose = () => (
  <svg {...S}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)

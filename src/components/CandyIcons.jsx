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

/* 学习：棒棒糖（糖头螺旋 + 糖棍） */
export const IconLearn = () => (
  <svg {...S}>
    <circle cx="12" cy="9" r="6" />
    <path d="M12 9c0-2 1.6-3.4 3.4-3.2" opacity=".55" />
    <path d="M12 9c0 1.6-1.3 2.8-2.9 2.7" opacity=".55" />
    <path d="M12 15v6" />
  </svg>
)

/* 导入：糖纸礼盒（盒身 + 盒盖 + 十字丝带） */
export const IconImport = () => (
  <svg {...S}>
    <path d="M4.5 9.5h15V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19Z" />
    <path d="M3.5 6.5h17v3h-17z" />
    <path d="M12 6.5v14" opacity=".55" />
    <path d="M12 6.5c-1.8 0-3-1-3-2.2C9 3.4 9.9 3 10.6 3c1 0 1.4 1.2 1.4 3.5Zm0 0c1.8 0 3-1 3-2.2C15 3.4 14.1 3 13.4 3c-1 0-1.4 1.2-1.4 3.5Z" opacity=".55" />
  </svg>
)

/* 书库：糖果罐（罐口 + 罐身 + 三颗糖豆） */
export const IconBank = () => (
  <svg {...S}>
    <path d="M8.5 3.5h7" />
    <path d="M8 3.5v2M16 3.5v2" opacity=".55" />
    <path d="M7 5.5h10c1 2.4 1.5 4.6 1.5 7 0 4.6-2.6 8-6.5 8s-6.5-3.4-6.5-8c0-2.4.5-4.6 1.5-7Z" />
    <circle cx="10" cy="13" r="1.5" opacity=".55" />
    <circle cx="14" cy="15.5" r="1.5" opacity=".55" />
    <circle cx="12.5" cy="10" r="1.2" opacity=".55" />
  </svg>
)

/* 设置：三档糖度滑杆 */
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

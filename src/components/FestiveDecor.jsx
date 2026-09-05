import React from 'react'

/* §52 节日点缀层（圣诞×马戏「玩具糖偶」，用户两轮小样拍板 v2）：
   只加不改——整层 pointer-events:none + aria-hidden，点击穿透、不挡任何字和按钮；
   只待空地——元素压在页框四缘，绝不进题干/卡片阅读区；
   色板纪律——树莓粉/薄荷/香槟金/淡紫四族，线材一律香槟金；
   动效克制——灯串呼吸/雪花缓落/气球浮动/摩天轮慢转，全 transform+opacity，
   无 blur、reduced-motion 全静止（candy.css §52 块）。位置/尺寸调整改 CSS，别动这里。
   compact（答题页）：只撤小旗（用户口径——答题界面去掉小旗就行，其余全保留）。 */
export default function FestiveDecor({ compact = false }) {
  return (
    <div className={'festive-layer' + (compact ? ' is-compact' : '')} aria-hidden="true">
      <svg className="flights" width="760" height="44" viewBox="0 0 760 44">
        <path d="M0 6 Q190 34 380 14 T760 10" fill="none" stroke="#F6D99A" strokeWidth="2" opacity=".7" />
        <circle cx="95" cy="26" r="7" fill="#FF8FA3" /><rect x="92" y="17" width="6" height="5" rx="1.5" fill="#E8B27D" />
        <circle cx="222" cy="29" r="7" fill="#5FD4B0" /><rect x="219" y="20" width="6" height="5" rx="1.5" fill="#E8B27D" />
        <circle cx="348" cy="20" r="7" fill="#F6D99A" /><rect x="345" y="11" width="6" height="5" rx="1.5" fill="#E8B27D" />
        <circle cx="472" cy="16" r="7" fill="#FFF6E8" /><rect x="469" y="7" width="6" height="5" rx="1.5" fill="#E8B27D" />
        <circle cx="588" cy="18" r="7" fill="#FF8FA3" /><rect x="585" y="9" width="6" height="5" rx="1.5" fill="#E8B27D" />
        <circle cx="692" cy="15" r="7" fill="#5FD4B0" /><rect x="689" y="6" width="6" height="5" rx="1.5" fill="#E8B27D" />
      </svg>
      <svg className="fbunting" width="480" height="34" viewBox="0 0 480 34">
        <path d="M0 4 Q240 22 480 4" fill="none" stroke="#F6D99A" strokeWidth="1.8" opacity=".75" />
        <path d="M30 8 l14 2 -6 16 z" fill="#FF8FA3" opacity=".8" /><path d="M112 12 l14 1 -7 16 z" fill="#5FD4B0" opacity=".8" />
        <path d="M194 14 l14 0 -6 16 z" fill="#F6D99A" opacity=".8" /><path d="M276 13 l14 -1 -8 17 z" fill="#D4B8FF" opacity=".8" />
        <path d="M358 10 l14 1 -6 16 z" fill="#FF8FA3" opacity=".8" /><path d="M432 7 l14 1 -7 15 z" fill="#5FD4B0" opacity=".8" />
      </svg>
      <svg className="fhat" width="42" height="40" viewBox="0 0 42 40">
        <path d="M8 30 Q14 8 30 4 Q24 16 26 28 Z" fill="#FF8FA3" /><path d="M8 30 Q14 8 30 4 Q20 12 22 28 Z" fill="#FFAAB9" />
        <rect x="4" y="27" width="30" height="8" rx="4" fill="#FFF6E8" /><circle cx="31" cy="6" r="5" fill="#FFF6E8" />
      </svg>
      <svg className="fflake ff1" width="22" height="22" viewBox="0 0 22 22" opacity=".8">
        <g stroke="#BFE9FB" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M11 2 V20 M3 6.5 L19 15.5 M19 6.5 L3 15.5" />
          <path d="M11 2 l-2.5 3 M11 2 l2.5 3 M11 20 l-2.5 -3 M11 20 l2.5 -3" />
        </g>
      </svg>
      <svg className="fflake ff2" width="15" height="15" viewBox="0 0 22 22" opacity=".7">
        <g stroke="#BFE9FB" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M11 2 V20 M3 6.5 L19 15.5 M19 6.5 L3 15.5" /></g>
      </svg>
      <svg className="fflake ff3" width="19" height="19" viewBox="0 0 22 22" opacity=".75">
        <g stroke="#BFE9FB" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M11 2 V20 M3 6.5 L19 15.5 M19 6.5 L3 15.5" /></g>
      </svg>
      <svg className="fflake ff4" width="13" height="13" viewBox="0 0 22 22" opacity=".6">
        <g stroke="#BFE9FB" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M11 2 V20 M3 6.5 L19 15.5 M19 6.5 L3 15.5" /></g>
      </svg>
      <svg className="ftree" width="52" height="66" viewBox="0 0 52 66">
        <path d="M26 2 l5 8 -10 0 z" fill="#F6D99A" />
        <path d="M26 10 L40 30 L12 30 Z" fill="#7FE8C8" /><path d="M26 22 L44 46 L8 46 Z" fill="#5FD4B0" /><path d="M26 36 L48 60 L4 60 Z" fill="#2FA98A" />
        <rect x="21" y="59" width="10" height="6" rx="2" fill="#E8B27D" />
        <circle cx="26" cy="27" r="2.2" fill="#FFF6E8" /><circle cx="18" cy="42" r="2.2" fill="#FF8FA3" /><circle cx="34" cy="42" r="2.2" fill="#D4B8FF" /><circle cx="26" cy="52" r="2.2" fill="#F6D99A" />
      </svg>
      <svg className="ftent" width="62" height="58" viewBox="0 0 62 58">
        <path d="M31 4 L56 22 L6 22 Z" fill="#FFF6E8" />
        <path d="M31 4 Q40 12 43 22 L36 22 Q34 10 31 4" fill="#FFC9D4" />
        <path d="M31 4 Q22 12 19 22 L26 22 Q28 10 31 4" fill="#FFC9D4" />
        <rect x="24" y="22" width="14" height="24" rx="3" fill="#FFF6E8" />
        <path d="M31 22 L38 46 L31 46 Z" fill="#FFC9D4" />
        <path d="M31 1 l7 2 -7 3 z" fill="#FF8FA3" /><circle cx="31" cy="3" r="2" fill="#F6D99A" />
        <rect x="27" y="44" width="8" height="10" rx="2" fill="#F6D99A" />
      </svg>
      <svg className="fwheel" width="64" height="64" viewBox="0 0 64 64">
        <g stroke="#F6D99A" strokeWidth="1.8" fill="none">
          <circle cx="32" cy="28" r="20" /><path d="M32 8 V48 M12 28 H52 M18 14 L46 42 M46 14 L18 42" />
        </g>
        <circle cx="32" cy="28" r="3" fill="#E8B27D" />
        <rect x="29" y="48" width="6" height="12" rx="2" fill="#E8B27D" />
        <circle cx="32" cy="8" r="4.5" fill="#FF8FA3" /><circle cx="52" cy="28" r="4.5" fill="#5FD4B0" />
        <circle cx="46" cy="42" r="4.5" fill="#D4B8FF" /><circle cx="18" cy="42" r="4.5" fill="#F6D99A" /><circle cx="12" cy="28" r="4.5" fill="#7FE8C8" />
      </svg>
      <svg className="fcake" width="40" height="36" viewBox="0 0 40 36">
        <path d="M4 18 Q4 10 20 10 Q36 10 36 18 L36 30 Q36 33 33 33 L7 33 Q4 33 4 30 Z" fill="#FFC9D4" />
        <path d="M4 18 Q8 22 12 18 Q16 22 20 18 Q24 22 28 18 Q32 22 36 18 L36 21 Q32 25 28 21 Q24 25 20 21 Q16 25 12 21 Q8 25 4 21 Z" fill="#FFF6E8" />
        <circle cx="20" cy="9" r="3.4" fill="#F2728C" />
        <rect x="4" y="28" width="32" height="5" rx="2.5" fill="#FFB0C0" />
      </svg>
      <svg className="fbunny" width="30" height="40" viewBox="0 0 30 40">
        <ellipse cx="10" cy="8" rx="3.4" ry="8" fill="#FFC9D4" transform="rotate(-8 10 8)" />
        <ellipse cx="19" cy="8" rx="3.4" ry="8" fill="#FFC9D4" transform="rotate(8 19 8)" />
        <ellipse cx="10.5" cy="8" rx="1.6" ry="5" fill="#FFE4EC" transform="rotate(-8 10.5 8)" />
        <ellipse cx="18.5" cy="8" rx="1.6" ry="5" fill="#FFE4EC" transform="rotate(8 18.5 8)" />
        <circle cx="15" cy="18" r="8" fill="#FFF6E8" />
        <ellipse cx="15" cy="31" rx="8.5" ry="7.5" fill="#FFF6E8" />
        <circle cx="12" cy="17" r="1.3" fill="#7A5A48" /><circle cx="18" cy="17" r="1.3" fill="#7A5A48" />
        <path d="M13.6 20.5 Q15 22 16.4 20.5" fill="none" stroke="#7A5A48" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="15" cy="19.2" r="1" fill="#FF8FA3" />
        <ellipse cx="15" cy="33" rx="4.5" ry="3.4" fill="#FFE4EC" />
      </svg>
      <svg className="fbear" width="30" height="30" viewBox="0 0 30 30">
        <circle cx="8" cy="7" r="4" fill="#E8B27D" /><circle cx="22" cy="7" r="4" fill="#E8B27D" />
        <circle cx="8" cy="7" r="2" fill="#FFDDB8" /><circle cx="22" cy="7" r="2" fill="#FFDDB8" />
        <circle cx="15" cy="13" r="9" fill="#E8B27D" />
        <ellipse cx="15" cy="25" rx="9" ry="5.5" fill="#E8B27D" />
        <circle cx="12" cy="12" r="1.3" fill="#5A3A22" /><circle cx="18" cy="12" r="1.3" fill="#5A3A22" />
        <ellipse cx="15" cy="16" rx="2.6" ry="2" fill="#FFDDB8" /><circle cx="15" cy="15.4" r="1" fill="#5A3A22" />
      </svg>
      <svg className="fballoon fb1" width="30" height="66" viewBox="0 0 30 66">
        <path d="M15 40 Q10 52 16 64" fill="none" stroke="#C9A0A8" strokeWidth="1.4" />
        <ellipse cx="15" cy="20" rx="12" ry="15" fill="#FFAAB9" />
        <ellipse cx="10.5" cy="14" rx="4" ry="5.5" fill="#FFD6E0" opacity=".9" />
        <path d="M12 34 L18 34 L15 40 Z" fill="#F2728C" />
      </svg>
      <svg className="fballoon fb2" width="26" height="58" viewBox="0 0 26 58">
        <path d="M13 35 Q18 46 12 56" fill="none" stroke="#9FBFB4" strokeWidth="1.3" />
        <ellipse cx="13" cy="18" rx="10.5" ry="13.5" fill="#7FE8C8" />
        <ellipse cx="9" cy="13" rx="3.4" ry="4.8" fill="#D8FBEE" opacity=".9" />
        <path d="M10 31 L16 31 L13 36 Z" fill="#2FA98A" />
      </svg>
      <svg className="fginger" width="34" height="42" viewBox="0 0 36 44">
        <circle cx="18" cy="14" r="9" fill="#E8B27D" />
        <path d="M11 22 Q4 30 9 34 Q13 36 15 31 L15 38 Q18 42 21 38 L21 31 Q23 36 27 34 Q32 30 25 22 Z" fill="#E8B27D" />
        <circle cx="14.5" cy="13" r="1.6" fill="#7A4A21" /><circle cx="21.5" cy="13" r="1.6" fill="#7A4A21" />
        <path d="M14 18 Q18 21 22 18" fill="none" stroke="#7A4A21" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="18" cy="28" r="1.7" fill="#FF8FA3" /><circle cx="13" cy="26" r="1.4" fill="#FFF6E8" /><circle cx="23" cy="26" r="1.4" fill="#FFF6E8" />
        <path d="M9 10 Q12 -2 22 2 Q19 6 20 9 Z" fill="#FF8FA3" />
        <rect x="7.5" y="8" width="16" height="4.5" rx="2.2" fill="#FFF6E8" />
      </svg>
      <svg className="fholly" width="30" height="26" viewBox="0 0 30 26">
        <path d="M14 14 Q4 4 2 14 Q6 22 14 16 Z" fill="#5FD4B0" /><path d="M16 14 Q26 4 28 14 Q24 22 16 16 Z" fill="#2FA98A" />
        <circle cx="12" cy="17" r="3.4" fill="#FF8FA3" /><circle cx="18" cy="18" r="3.4" fill="#F2728C" /><circle cx="15" cy="21" r="3" fill="#FFAAB9" />
      </svg>
      <svg className="fcane" width="18" height="42" viewBox="0 0 20 46">
        <path d="M6 44 V12 Q6 3 13 3 Q20 3 18 11" fill="none" stroke="#FFF" strokeWidth="7" strokeLinecap="round" />
        <path d="M6 44 V12 Q6 3 13 3 Q20 3 18 11" fill="none" stroke="#FF8FA3" strokeWidth="7" strokeLinecap="round" strokeDasharray="4 5" />
      </svg>
      <svg className="fgift" width="32" height="30" viewBox="0 0 34 32">
        <rect x="3" y="10" width="28" height="19" rx="4" fill="#5FD4B0" /><rect x="1" y="6" width="32" height="7" rx="3.5" fill="#7FE8C8" />
        <rect x="14.5" y="6" width="5" height="23" fill="#FFF6E8" /><path d="M17 6 Q11 -2 15 4 Q18 1 17 6" fill="#FFF6E8" />
      </svg>
      <svg className="fcstar" width="18" height="18" viewBox="0 0 18 18" opacity=".85">
        <path d="M9 1 L11 6.5 L17 7 L12.5 11 L14 17 L9 13.5 L4 17 L5.5 11 L1 7 L7 6.5 Z" fill="#F6D99A" />
      </svg>
      <svg className="fcdot" width="10" height="10" opacity=".7"><circle cx="5" cy="5" r="4.5" fill="#D4B8FF" /></svg>
      <svg className="fcbar" width="16" height="6" opacity=".75"><rect width="16" height="6" rx="3" fill="#7FE8C8" /></svg>
    </div>
  )
}

// 通用小工具（2026-09-11 审查整改：收敛散落的重复实现）
//
// shuffle 此前在 stats.js / ability.js / Practice.jsx / Learn.jsx 各写了一遍，
// 四处实现语义一致但分散——任一处改动都不会同步到其它三处。
// 统一到这里后，四处的洗牌保证同一个算法（Fisher-Yates，无偏）。
// rng 可注入：测试用固定序列复现，生产默认 Math.random。

export function shuffle(list, rng = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* 0..n-1 的一个随机排列（Practice 选项随机化用：只需要位置序列，不需要元素） */
export function shuffledOrder(n, rng = Math.random) {
  return shuffle(Array.from({ length: n }, (_, i) => i), rng)
}

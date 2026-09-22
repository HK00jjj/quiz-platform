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

/* ── 解析/答案文本的选项字母重映射（v7.5，2026-09-22）──
   练习页选项洗牌后，解析文本里的选项指代（命题时原始字母）必须同步换算成当前显示字母。
   Practice 屏幕渲染（remapExplLetters）与 TTS 播报（spokenOf）共用本函数，屏幕与朗读永远同源。
   单遍扫描五类句式（一次 replace，杜绝先后规则对同一字母二次映射）：
   ① 关键词锚定：正确选项为/答案是/故选/错选/…（+连接词 为|是|应|了|：+字母链，
      链内允许 、，和与或 连接 →「正确选项为 AB」「正确项为A、B、C、D」「选 A 或 B」全覆盖）
   ② 「X项」：D项 / D 项
   ③ 裸字母+判动词：A正确 / B错 / E描述的 / A可行 / D是A的直接结果
   ④ 字母链+判动词：D、A、B均不成立 / A、B的因果链（后 3 字含「相」则放弃 → A、B、C三相/相序不动）
   ⑤ 精确单字母括号：（A）/（A）——括号内含其他字符（AC、O—C、A对）一律不碰
   技术符号守卫（500 条真实解析 + 21 条陷阱夹具实测零误伤）：
   Icu/Ics/IEC/GB/RCD/MCB/kA（拉丁邻接天然不匹配）、AC/DC/AC-3/AC220V、3A/5A（数字邻接）、
   O—C 试验序列、A相/B级/A点/A端（判动词白名单天然排除）、记为A、B、C（右边界否决）、
   数字量D/模拟量A（助记无判动词跟随）。
   弱关键词（选择|可选|多选|选项|选）+ 头段 AC/DC/AD/DA/BCD → 不映射（选AC电源/选AD转换/选BCD码）；
   强答案词（正确选项为/答案/故选/错选…）不受此限——「正确选项为 AC」是真答案组合，照常映射。
   m2d 为空（非选择题/未洗牌）时恒等返回；字母不在 m2d（如只有 4 个选项却提及 E）时原样保留。 */
const REMAP_KW = '(正确选项|正确答案|干扰项|正确项|故选|应选|则选|错选|漏选|误选|选择|可选|答案|选项|正解|多选|选)'
const REMAP_CONN = '(为|是|应|了|：|:)?'
const REMAP_BOUND = '(?![A-Za-z0-9/／\\-－·和与或])'
const REMAP_RUN1 = '[A-E]+(?:\\s*[、,，]\\s*[A-E]|\\s*[和与或]\\s*[A-E])*'
const REMAP_RUN2 = '[A-E]+(?:\\s*[、,，]\\s*[A-E]|\\s*[和与或]\\s*[A-E])+'
const REMAP_FOLLOW = '(?:正确|对|错|可行|成立|符合|描述|所述|把|是|均|都|即|也|只|不|则|说|的)'
const REMAP_RE = new RegExp(
  REMAP_KW + REMAP_CONN + '(\\s*)(' + REMAP_RUN1 + ')' + REMAP_BOUND +
  '|(?<![A-Za-z0-9])([A-E])(\\s*)(?=项)' +
  '|(?<![A-Za-z0-9])([A-E])(\\s*)(?=' + REMAP_FOLLOW + ')' +
  '|(?<![A-Za-z0-9])(' + REMAP_RUN2 + ')(\\s*)(?=' + REMAP_FOLLOW + ')' +
  '|(?<![量相级类型])[（(]([A-E])[)）]',
  'g')
const REMAP_WEAK_KW = new Set(['选择', '可选', '多选', '选项', '选'])
const REMAP_VETO_HEAD = /AC|DC|AD|DA|BCD/

export function remapOptionLetters(text, m2d) {
  const s = String(text ?? '')
  if (!m2d || !Object.keys(m2d).length) return s
  const mapRun = (run) => run.split('').map((c) => m2d[c] ?? c).join('')
  return s.replace(REMAP_RE, (m, ...g) => {
    const off = g[g.length - 2], str = g[g.length - 1]
    const [kw, conn, ws, krun, xL, xWs, bL, bWs, crun, cWs, pL] = g
    if (kw !== undefined) {
      const head = krun.split(/\s*[、,，]\s*|\s*[和与或]\s*/)[0]
      if (REMAP_WEAK_KW.has(kw) && REMAP_VETO_HEAD.test(head)) return m
      return kw + (conn ?? '') + (ws ?? '') + mapRun(krun)
    }
    if (xL !== undefined) return (m2d[xL] ?? xL) + (xWs ?? '')
    if (bL !== undefined) return (m2d[bL] ?? bL) + (bWs ?? '')
    if (crun !== undefined) {
      const after = str.slice(off + m.length, off + m.length + 3)
      if (after.includes('相')) return m
      return mapRun(crun) + (cWs ?? '')
    }
    if (pL !== undefined) return m[0] + (m2d[pL] ?? pL) + m[m.length - 1]
    return m
  })
}

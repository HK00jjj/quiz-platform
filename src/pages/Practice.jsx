import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { GiltBtn } from '../components'
// burstParticles 改从 CandyBoot 引：components.jsx 正被编辑器陈旧缓冲区回写成 Apple 版（只发振动、不发糖豆）
import { burstParticles } from '../components/CandyBoot'
import { IconReveal, IconScroll, IconRetry } from '../components/CandyIcons'
import { isObjective, domainLabel, DIFF_CLS } from '../lib/stats'
import { gradeObjective, blanksOf, splitExpected, stemSpokenOf } from '../lib/validate'
import { imageFor, diagramDataUri, diagramTitle } from '../lib/diagrams'
/* 选项随机化用的位置排列（#6）。实现收敛到 lib/util.js（2026-09-11 审查整改：
   此前与 stats/ability/Learn 各写一遍 Fisher-Yates）。 */
import { shuffledOrder } from '../lib/util.js'
/* 解析语音播报（2026-09-13 增量）：启封自动朗读解析，🔊 一键可关，语速 1.25。
   2026-09-15 增量（用户钦定）：题卡到手自动读【题干】，选项不读——同一个 🔊 开关
   管两段（答题中读题干、揭晓后读答案+解析），各自有「已读」闸互不挤占。 */
import { speak, stopSpeak, pauseSpeak, resumeSpeak, unlockSpeech, ttsSupported, ttsEnabled as ttsPrefEnabled, setTtsEnabled, voiceNote, voiceAdvice, voiceGuideText, currentVoices, listVoices, ttsVoicePref, setTtsVoice, ttsRate, setTtsRate, fmtRate, voiceDiag, warmUpVoices, EDGE_VOICES, CLOUD_VOICE_ID, isCloudVoice, unlockCloudAudio, prefetchCloudFirst, currentPauseTag, prefetchGACache, RATE_MIN, RATE_MAX, RATE_STEP } from '../lib/tts.js'

/* 题干渲染：填空题把 {空} 显示为下划线占位 */
function Stem({ q }) {
  // 首字下沉已去掉（#4）：drop-cap 把第一个字放到 2.1em 还浮动，读起来累，与正文同号更舒服
  // §38：题图不再出现在题干（用户指名：图片只能点击解析后随答案一起显示）。
  // 题图统一由解析区的 fbImgUri 渲染（挂 seal==='broken'，蜡封启封后才出现）。
  if (q.type !== '填空题' || !q.stem.includes('{')) return <p className="q-stem">{q.stem}</p>
  const parts = q.stem.split(/(\{[^{}]*\})/g)
  return (
    <p className="q-stem">
      {parts.map((p, i) => p.startsWith('{') && p.endsWith('}')
        ? <span key={i} style={{ display: 'inline-block', minWidth: 70, borderBottom: '1.5px solid #5a4a2a', margin: '0 3px' }}>&nbsp;</span>
        : <React.Fragment key={i}>{p}</React.Fragment>)}
    </p>
  )
}

/* ── 解析播报文本组装（纯函数，2026-09-13）──
   与屏幕同源：选择题答案/解析里的选项字母都按洗牌后的【显示字母】重映射
   （同 remapExplLetters 的两步正则），朗读出来的「选B」与屏幕上的 B 一致。
   order 必须传本帧渲染用的洗牌序（shuffleRef.current），不能重掷。 */
function spokenOf(q, lastGrade, order) {
  const isChoice = q.type === '单选题' || q.type === '多选题'
  const dispMap = {}
  if (isChoice) (order || []).forEach((oi, pos) => {
    const raw = (q.options ?? [])[oi] ?? ''
    const orig = String(raw).match(/^([A-E])[.、]/)?.[1] ?? 'ABCDE'[oi]
    dispMap[orig] = 'ABCDE'[pos]
  })
  const mapLetters = (s) => String(s ?? '').split('').map((c) => dispMap[c] ?? c).join('')
  const remap = (t) => {
    const s = String(t ?? '')
    if (!isChoice || !Object.keys(dispMap).length) return s
    return s
      .replace(/(选|选项|答案)\s*([A-E])/g, (m, p, L) => p + (dispMap[L] ?? L))
      .replace(/(?<![A-Za-z0-9.])([A-E])(?=项)/g, (m, L) => dispMap[L] ?? L)
  }
  const ans = isChoice ? mapLetters(lastGrade ? lastGrade.expected : q.answer)
    : q.type === '填空题' && lastGrade?.expectedParts
      ? lastGrade.expectedParts.map((p, i) => lastGrade.expectedParts.length > 1 ? `第${i + 1}空：${p}` : p).join('　')
      : q.answer
  const parts = [`正确答案：${ans}`]
  if (q.explanation) parts.push(`解析：${remap(q.explanation)}`)
  return parts.join('。')
}

/* 题干循环朗读的轮间歇（2026-09-16）：一轮读完 → 停 1.2s → 再读。
   全零间隙会变成催眠循环，用户来不及点暂停；1.2s 恰好够一次「点 🔊 / 点解析」的决断窗口。 */
const STEM_LOOP_GAP = 1200

export default function Practice() {
  const navigate = useNavigate()
  const sessionMode = useStore((s) => s.sessionMode)
  const questions = useStore((s) => s.sessionQuestions)
  const index = useStore((s) => s.sessionIndex)
  const phase = useStore((s) => s.phase)
  const results = useStore((s) => s.sessionResults)
  const lastGrade = useStore((s) => s.lastGrade)
  const lastRating = useStore((s) => s.lastRating)
  const summary = useStore((s) => s.summary)
  const submitObjective = useStore((s) => s.submitObjective)
  const confirmObjective = useStore((s) => s.confirmObjective)
  const submitSubjective = useStore((s) => s.submitSubjective)
  const next = useStore((s) => s.next)
  const abortSession = useStore((s) => s.abortSession)
  const startSession = useStore((s) => s.startSession)

  const q = questions[index]
  const objective = q && isObjective(q.type)
  const [choice, setChoice] = useState(null)          // 单选
  const [multi, setMulti] = useState([])              // 多选
  const [judge, setJudge] = useState(null)            // 判断
  const [fills, setFills] = useState([])              // 填空
  const [text, setText] = useState('')                // 主观
                // §64 键盘 ↑↓ 指针（-1=未激活）

  const [showAnswer, setShowAnswer] = useState(false) // 主观题答案展开
  const [flash, setFlash] = useState('')
  const [flipped, setFlipped] = useState(false)   // 卡牌 3D 翻面
  const [seal, setSeal] = useState('intact')      // 答案封印：intact → cracking → broken
  const sealTimer = useRef(null)
  const flying = useRef(false)
  const startAt = useRef(Date.now())
  /* 选项洗牌排列按「题目 id#序号」缓存：同题重渲染复用，切题才重排（#6） */
  const shuffleRef = useRef({ key: null, order: [] })
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setChoice(null); setMulti([]); setJudge(null); setFills(blanksOf(q?.stem ?? '').map(() => ''))
    setText(''); setShowAnswer(false); setFlash('')
    clearTimeout(sealTimer.current); setSeal('intact')
    // 新卡牌入场：先见牌背，再 3D 翻到正面（上一题已翻回牌背，这里只留极短停留避免同帧交错）
    setFlipped(false)
    const t = setTimeout(() => setFlipped(true), 120)
    return () => clearTimeout(t)
  }, [index, q?.id])

  /* 启封：蜡封裂开 520ms 后消散，答案卷轴随后展开 */
  function breakSeal() {
    setSeal('cracking')
    clearTimeout(sealTimer.current)
    sealTimer.current = setTimeout(() => setSeal('broken'), 520)
  }

  /* 答案揭晓后把答案区滚进可见范围。三个关键点：
     ① 时机：蜡封卸载（seal==='broken'，时长随批2 B3 门控 300/520ms）前，提前滚会让上方内容在滚动途中突然少 ~40px
        → 目标位置移动 = 浏览器重定向/中断平滑滚动 = 顿挫感。所以等蜡封真消失后，
        再用双 rAF 等这次 DOM 变更提交并完成布局，才去测量+滚动。
     ② 测量：全程只读一次几何（双 rAF 内），不在滚动回调里反复读，避免强制同步布局。
     ③ 缓动：交给 CSS scroll-behavior:smooth（见 pages.css），这里只下一次 scrollTo；
        不自写 rAF 补间——否则与 CSS 平滑叠加会双重缓动，反而更顿。
     注意：依赖里用 store 的 phase 而不是下面才声明的 answered（const 有 TDZ，会整页崩溃） */
  useEffect(() => {
    if (phase !== 'feedback' && !showAnswer) return
    if (seal !== 'broken') return           // 蜡封未卸载，布局还没定型
    let raf1 = 0, raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const sc = document.querySelector('.q-face-scroll')
        const gp = document.querySelector('.grade-panel')
        if (!sc || !gp) return
        const top = gp.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 6
        const to = Math.max(0, Math.min(top, sc.scrollHeight - sc.clientHeight))
        if (Math.abs(to - sc.scrollTop) < 2) return   // 已完整可见就不滚，省掉一次无谓动画
        sc.scrollTo({ top: to })
      })
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [phase, showAnswer, seal])

  /* 用时计时（#7）：结算后必须停表，否则结算页那个「用时」会一直往上跳
     （原来 deps 是 []，组件活着就永远 tick）。挂 phase：进结算就清 interval，
     点「再练错题」回到 answering 时重新起表，配合 startAt.current 的重置。 */
  useEffect(() => {
    if (phase === 'done') return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase])

  const combo = useMemo(() => {
    let n = 0
    for (let i = results.length - 1; i >= 0; i--) { if (results[i]) n++; else break }
    return n
  }, [results])

  /* §64 键盘流：1-5/A-E/小键盘直选、↑↓ 在选项间移动指针（未作答也可先移再确认）、
     Enter 提交与翻页、Ctrl+Enter 展开主观题答案、Shift+Enter=自判答错。
     全部走「点真实 DOM 按钮/选项行」复用现有判分链路，不碰 React state 内部
     （esbuild 不查未定义变量，直接改 state 极易埋雷）。焦点在输入框时数字是题目内容，
     只有 Enter 参与；window 级监听不依赖焦点位置（用户反馈：要点一下界面 ↑↓ 才活）。
     ⚠ 必须挂在早退 return 之前（Rules of Hooks）：idle/done 分支也要保持钩子数量一致。 */
  useEffect(() => {
    if (phase !== 'answering' && phase !== 'feedback') return
    const onKey = (e) => {
      if (e.altKey || e.metaKey) return
      const tag = e.target && e.target.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      const footBtns = () => [...document.querySelectorAll('.q-face-foot button')]
      /* §70 重构：↑↓ 直接把选中切到上一项/下一项（无指针中间态，任何时刻只有一个选中视觉；
         window 级不依赖焦点）。单选/判断=改选；多选=勾选/取消该行。 */
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && phase === 'answering' && objective && !typing) {
        const els = document.querySelectorAll('.opt-row, .judge-card')
        if (!els.length) return
        e.preventDefault()
        const down = e.key === 'ArrowDown'
        let cur = -1
        els.forEach((el, i) => { if (el.className.indexOf('selected') >= 0) cur = i })
        if (cur < 0) cur = down ? -1 : 0
        const nx = Math.min(els.length - 1, Math.max(0, cur + (down ? 1 : -1)))
        els[nx]?.scrollIntoView({ block: 'nearest' })
        els[nx].click()
        return
      }
      if (e.key === 'Enter') {
        if (phase === 'feedback') {
          const nx = footBtns().find((b) => b.textContent.includes('下一题'))
          if (nx) { e.preventDefault(); nx.click(); return }
          const okB = footBtns().find((b) => b.textContent.includes('我答对了'))
          const badB = footBtns().find((b) => b.textContent.includes('我答错了'))
          if (okB && !e.shiftKey) { e.preventDefault(); okB.click(); return }
          if (badB && e.shiftKey) { e.preventDefault(); badB.click() }
          return
        }
        /* 多行 textarea 的回车留给换行（Ctrl+Enter 才展开）；单行 rune-input（填空）回车=提交 */
        if (tag === 'TEXTAREA' && !e.ctrlKey) return
        const rv = footBtns().find((b) =>
          b.textContent.includes('查看解析') || b.textContent.includes('展开参考答案'))
        if (rv && !rv.disabled) { e.preventDefault(); rv.click() }
        return
      }
      if (typing || phase !== 'answering' || !objective) return
      /* 主键盘 Digit 与小键盘 Numpad 都认；直选同步移动指针 */
      const dm = /^Digit([1-5])$/.exec(e.code) || /^Numpad([1-5])$/.exec(e.code)
      const digit = dm ? Number(dm[1]) - 1
        : /^Key([A-E])$/.test(e.code) ? 'ABCDE'.indexOf(e.code.slice(3)) : -1
      if (digit < 0) return
      const row = document.querySelectorAll('.opt-row')[digit]
      const judge = document.querySelectorAll('.judge-card')[digit]
      if (row) { e.preventDefault(); row.click() }
      else if (judge) { e.preventDefault(); judge.click() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, objective, q?.id])

  /* ── 解析语音播报（2026-09-13，用户钦定：点开解析自动播 + 🔊 可关 + 语速 1.25）──
     时机与滚动 effect 对齐：挂 seal==='broken'（蜡封卸载、布局定型之后）才开读。
     **一题只播一次**：用「题号|题目 id」做键，只有本题还没读过才开口。
     之前把 lastGrade/phase 放进依赖 → store 每次更新（作答、确认、翻牌）都重跑
     effect → stopSpeak+speak 重播。Edge 的 Online 神经音是云端流式合成，cancel()
     落地有几拍延迟，新链已经在说、旧音频还没停 → 听感就是"读一半换了个声音"
     "两个声音叠着一起播"（2026-09-13 晚用户两轮实测，同一个根因）。
     所以本 effect **不返回 cleanup**（cleanup 每次依赖变化都会停声，等于把重启请回来），
     改由"离开揭晓态 / 静音 / 切题"三条路径显式 stopSpeak，卸载另挂一个空依赖 effect。
     必须挂在 early return 之前（Rules of Hooks）；播报文本的洗牌序直接读
     shuffleRef.current（与本帧渲染同源，重掷会念错字母）。 */
  const [ttsOn, setTtsOn] = useState(ttsPrefEnabled)
  /* 揭晓态轨迹（2026-09-15）：切题要过两拍 commit（setSeal('intact') 在切题 effect 里），
     「未揭晓→清场」必须只在真正离开揭晓态的那一拍打 stopSpeak——否则第二拍会把
     题干 effect 刚开口的朗读拦腰打断（E2E 实证 audio play AbortError，第二题起不读）。 */
  const wasRevealedRef = useRef(false)
  const [rateNow, setRateNow] = useState(ttsRate)      // 语速：自定义（0.5~2.0 无级），存 localStorage
  const [ttsOpen, setTtsOpen] = useState(false)        // 「声音」控件展开态
  const [voiceSel, setVoiceSel] = useState(ttsVoicePref)   // 显式选择的音色（null=自动）
  const [voiceOpen, setVoiceOpen] = useState(false)        // 自绘音色弹层（2026-09-15：替代原生 select）
  const [voiceList, setVoiceList] = useState(() => (typeof window !== 'undefined' && window.speechSynthesis
    ? listVoices(window.speechSynthesis.getVoices() || []) : []))
  /* 自绘音色弹层的选项（2026-09-15）：**扁平列表、不带分组标题行**（用户截图红框要求去除
     "云端音色（任意设备可用）""本机系统音色"这类标题行）。顺序：自动 → 微软神经音
     （与电脑端 Edge 同一批）→ 百度备用线路 → 本机系统音色。 */
  const voiceOptions = useMemo(() => [
    { value: '', label: '自动' },
    ...EDGE_VOICES.map((v) => ({ value: v.id, label: v.label })),
    { value: CLOUD_VOICE_ID, label: '百度女声（备用线路）' },
    ...voiceList.map((v) => ({ value: v.name, label: v.label })),
  ], [voiceList])
  const voiceCurLabel = (voiceOptions.find((o) => o.value === (voiceSel || '')) || {}).label || (voiceSel || '自动')
  /* 弹层打开时按 Esc 关闭（桌面习惯；移动端点遮罩关闭） */
  useEffect(() => {
    if (!voiceOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setVoiceOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [voiceOpen])
  const rateRetry = useRef(null)                       // 拖动滑块/换音色时的重播防抖
  const panelPoll = useRef(null)                       // 面板展开期间的语音表轮询（2026-09-15）
  /* 面板可用性：系统语音或云端音频任一可用即渲染（2026-09-15——手机可能没有
     系统语音但云端通路可用，此时也必须让用户能打开「声音」控件选云端音色） */
  const ttsOK = useRef(ttsSupported() || cloudSupported()).current
  const spokenKeyRef = useRef(null)
  /* 语音清单是异步加载的（Chrome/Edge 首帧常为空），且**安卓内核可能根本不触发
     voiceschanged**（实测：只监听该事件会让移动端下拉永远只有"自动"，用户看到的就是
     "手机端不能选择语音"）。所以改为多点触发刷新：
       挂载后短轮询（8×600ms）→ 面板每次打开 → 首次播报后 → 手动 ↻ 按钮。 */
  useEffect(() => {
    if (!ttsSupported()) return               // 无系统语音时不再碰 speechSynthesis（可能是空壳属性）
    const s = window.speechSynthesis
    const refresh = () => setVoiceList(listVoices(currentVoices()))
    refresh()
    try { s.addEventListener('voiceschanged', refresh) } catch { /* 老实现无该方法 */ }
    const ticks = [400, 900, 1500, 2400, 3600, 5200, 7000, 9000]
    const timers = ticks.map((ms) => setTimeout(refresh, ms))
    return () => {
      try { s.removeEventListener('voiceschanged', refresh) } catch { /* ignore */ }
      timers.forEach(clearTimeout)
    }
  }, [ttsOK])
  useEffect(() => {
    /* 取证插桩（2026-09-15，修"播一段就停"）：仅当 E2E/排障者设 window.__ttsfxArm 时记录依赖快照，线上零开销零泄漏 */
    try { if (window.__ttsfxArm) (window.__ttsfxLog = window.__ttsfxLog || []).push({ t: Date.now(), seal, phase, showAnswer, index, qid: q && q.id, ttsOn }) } catch { /* ignore */ }
    if (!ttsOK) return
    const revealed = seal === 'broken' && (phase === 'feedback' || showAnswer)
    if (!revealed || !q) {
      /* 2026-09-15 修正：无条件 stopSpeak 会跨两拍清场——第二拍（seal broken→intact）
         正好轰掉题干 effect 刚开的口。改为「只在真正离开揭晓态的那一拍清场」；
         未曾揭晓就切题（主观题直接翻）时，残声由新 speak() 的 token++ 自己打断。 */
      if (wasRevealedRef.current) { stopSpeak(); wasRevealedRef.current = false }
      stopStemLoop()                        // 2026-09-16：离开揭晓态同时终结题干循环（点解析后不再循环读题干）
      spokenKeyRef.current = null; return
    }
    wasRevealedRef.current = true
    if (!ttsOn) return                            // 静音中：不自动开口（揭晓后再开由开关 handler 接）
    const key = index + '|' + q.id
    if (spokenKeyRef.current === key) return      // 本题已读过：不重播（这是防叠音的闸）
    spokenKeyRef.current = key
    stopStemLoop()                                // 2026-09-16：揭晓开口前清循环句柄——解析接管，题干循环到此为止
    speak(spokenOf(q, lastGrade, shuffleRef.current.order), { tag: 'reveal|' + index + '|' + q.id })
  }, [ttsOK, seal, phase, showAnswer, index, q?.id, ttsOn])
  /* ── 自动读题干（2026-09-15，用户钦定：题卡到手自动读题干，选项不读）
     → 2026-09-16 升级为【循环朗读】（用户钦定："题干在我点击解析之前，不停重复读"）──
     新题落地（index/q.id 变化、phase=answering）即开口，只念 stemSpokenOf(q)，
     一轮读完间歇 STEM_LOOP_GAP 再读，往复直至停止（见 startStemLoop 的三闸）。
     与解析播报共用 ttsOn 总开关，但「已读」闸各用一把：stemSpokenRef 管题干、
     spokenKeyRef 管解析，互不挤占——解析照旧在揭晓时读。
     作答提交 → phase 变 feedback → 本 effect 直接退出；题干若还在念，解析开口的
     speak() 内部 token++ 会把它短路，由解析播报接管，不会叠音（既有架构行为）。
     声明顺序即执行顺序：切题时上面的解析 effect 先 stopSpeak 清场（顺带停掉
     上一题没读完的解析），本 effect 随后开口——顺序固定，不会反过来。 */
  const stemSpokenRef = useRef(null)
  /* 循环朗读的实时状态镜像：go() 的 setTimeout 是宏任务，重开口前必须对表"当下"
     的界面状态，而不是启动循环那一帧的闭包。useLayoutEffect 无依赖同步——commit
     即新值，先于一切宏任务回调（doCheck→setState 那一拍的 flush 里就绪），无竞态。 */
  const stemLoopRef = useRef(null)               // 循环句柄 { key, timer, onDone }（🔊 暂停时保留）
  const ttsOnRef = useRef(ttsOn)
  const answerPhaseRef = useRef(false)           // true=已提交判分或已展开解析（答题期已结束）
  const stemKeyRef = useRef('')
  useLayoutEffect(() => {
    ttsOnRef.current = ttsOn
    answerPhaseRef.current = phase !== 'answering' || showAnswer
    stemKeyRef.current = index + '|' + (q?.id ?? '')
  })
  function stopStemLoop() {
    const L = stemLoopRef.current
    stemLoopRef.current = null
    if (L) clearTimeout(L.timer)
  }
  /* 循环本体：一轮 speak(onDone) → 间歇 → go() 对表三闸（静音/已揭晓/已切题，任一
     命中即静默终止）→ 重开口。四条保险绳：
     ① go() 三闸（实时 ref）；
     ② 句柄比对（新 startStemLoop/显式 stopStemLoop 即接管，旧 onDone 空转）；
     ③ 揭晓开口解析前解析 effect 显式 stopStemLoop()；
     ④ 正在读的链被解析 speak() token++ 打断时不触发 onDone（tts.js 既有语义），
        循环自然死——绝不与解析播报叠音。 */
  function startStemLoop(text, idx, qid) {
    stopStemLoop()                              // 幂等头：任何入口（新题/重读/开声重启）先终结旧循环
    const loop = { key: idx + '|' + qid, timer: null, onDone: null }
    stemLoopRef.current = loop
    const go = () => {
      if (stemLoopRef.current !== loop) return
      if (!ttsOnRef.current) return             // 静音：不重开口（🔊 关=暂停在原处，句柄保留）
      if (answerPhaseRef.current) return        // 点解析/提交判分：解析接管，循环到此为止
      if (stemKeyRef.current !== loop.key) return   // 已切题：让位新题的循环
      const onDone = () => {
        if (stemLoopRef.current !== loop) return
        loop.timer = setTimeout(go, STEM_LOOP_GAP)  // 一轮读完：间歇后重读
      }
      loop.onDone = onDone                      // 🔊 续播时透传给 resumeSpeak（native 重建链分支用）
      speak(text, { tag: 'stem|' + idx + '|' + qid, onDone })
    }
    go()
  }
  useEffect(() => {
    if (!ttsOK) return
    if (phase !== 'answering') return           // 揭晓(feedback)/结算(done)：解析播报的时段
    if (showAnswer) return                      // 主观题已展开解析：也归解析播报
    if (!q || !ttsOn) return                    // 静音中不自动开口；开关回开靠 ttsOn 依赖在这里接住
    const key = index + '|' + q.id
    if (stemSpokenRef.current === key) return   // 本题题干已读过：不重播（防叠音闸）
    stemSpokenRef.current = key
    startStemLoop(stemSpokenOf(q), index, q.id) // 2026-09-16：自动开口升级为循环朗读
    /* 解析首块预载（2026-09-15 晚"点解析就出声"）：题卡到手即后台预合成揭晓文本首块进
       GA 缓存，揭晓开口时 gaCache 命中零网络零解码秒排。命中口径：
       选择/判断 grade.expected===q.answer（gradeObjective 同参大写化，题库规范答案已
       大写无空格）→ 单版预载即命中；简答 lastGrade 恒 null（自评）单版即命中；填空题
       多空揭晓读「第N空：…」（expectedParts），补预载 splitExpected 真函数版（单空两版
       URL 相同，gaWarm 同 URL 幂等共享 promise，不产生双请求）。任何落空由手势
       prefetchCloudFirst 兜底，最坏回到原行为（热 ~2.2s）。 */
    const ord = shuffleRef.current.order
    prefetchGACache(spokenOf(q, null, ord))
    if (q.type === '填空题') {
      const parts = splitExpected(q)
      if (parts.length > 1) prefetchGACache(spokenOf(q, { correct: true, expectedParts: parts }, ord))
    }
  }, [ttsOK, index, q?.id, phase, showAnswer, ttsOn])
  /* 卸载兜底：离开练习页/进结算页时，不留一条还在说的声音；循环句柄与面板轮询一并清掉 */
  useEffect(() => () => { stopSpeak(); stopStemLoop(); clearInterval(panelPoll.current) }, [])

  if (phase === 'idle' || questions.length === 0) {
    return (
      <div className="practice-stage" style={{ textAlign: 'center', paddingTop: '24vh' }}>
        <p style={{ color: 'var(--muted)', letterSpacing: 3, marginBottom: 20 }}>还没有可练的题</p>
        <GiltBtn onClick={() => navigate('/')}>返回学习页</GiltBtn>
      </div>
    )
  }

  const answered = phase === 'feedback'
  const committed = lastRating !== null
  /* 本题在本批中的第几次作答（三遍判定制）：数当前 index 之前同 id 出现的次数 */
  const attemptNo = objective && q ? questions.slice(0, index).filter((x) => x.id === q.id).length + 1 : 0
  /* 选项随机化（#6）：内部一律用「原始字母」跑判分与对错高亮，只有显示出来的字母跟着洗牌走。
     于是 gradeObjective 与 opt-row 的 right/wronged/missed 判定链路一行都不用改，
     而给用户看的答案字母会同步换算，不会出现「答案是 D、洗牌后那项显示在 A 位置」的错位。 */
  const isChoice = q.type === '单选题' || q.type === '多选题'
  const orderKey = q.id + '#' + index
  if (shuffleRef.current.key !== orderKey) {
    shuffleRef.current = { key: orderKey, order: shuffledOrder((q.options ?? []).length) }
  }
  const optItems = isChoice ? shuffleRef.current.order.map((oi, pos) => {
    const raw = q.options[oi] ?? ''
    return {
      oi, raw,
      orig: raw.match(/^([A-E])[.、]/)?.[1] ?? 'ABCDE'[oi],
      disp: 'ABCDE'[pos],
      text: raw.replace(/^[A-E]\s*[.、]\s*/, '')
    }
  }) : []
  const origToDisp = {}
  optItems.forEach((o) => { origToDisp[o.orig] = o.disp })
  /* 展示给用户的答案：选择题把原始字母换算成洗牌后的字母；填空题多空时逐空列出，
     比原来一串逗号好读。注意这里用 lastGrade 而不是下面才声明的 grade（const 有 TDZ，会整页崩溃）。 */
  const mapLetters = (s) => String(s ?? '').split('').map((c) => origToDisp[c] ?? c).join('')
  /* v6.8 解析字母重映射（用户报障"题目与选项存在对不上"的根因修复）：
     练习页选项经 shuffledOrder 洗牌展示，而【题库解析】里的"选B者误以为…""故选项C…"
     用的是**命题时的原始字母**，过去原样渲染 → 用户按屏幕上的字母去对，对上的却是另一项。
     这里把解析文本中的选项指代同步换算为洗牌后的字母。
     限定范围：只重映射紧跟在 选 / 选项 / 答案 之后、或紧邻"项"字的 A~E 单字母，
     绝不逐字符替换——否则 I0.0、AC-3、K1、DC24V、380V 这类技术符号会被误伤。
     非选择题（optItems 为空 → origToDisp 为 {}）时本函数等价于恒等变换。 */
  const remapExplLetters = (text) => {
    const s = String(text ?? '')
    if (!isChoice || !Object.keys(origToDisp).length) return s
    return s
      .replace(/(选|选项|答案)\s*([A-E])/g, (m, p, L) => p + (origToDisp[L] ?? L))
      .replace(/(?<![A-Za-z0-9.])([A-E])(?=项)/g, (m, L) => origToDisp[L] ?? L)
  }
  const shownAnswer = !objective ? q.answer
    : isChoice ? mapLetters(lastGrade ? lastGrade.expected : q.answer)
      : q.type === '填空题' && lastGrade?.expectedParts
        ? lastGrade.expectedParts.map((p, i) => lastGrade.expectedParts.length > 1 ? `第${i + 1}空：${p}` : p).join('　')
        : (lastGrade?.expected ?? q.answer)
  const inputText = q.type === '单选题' ? (choice ?? '')
    : q.type === '多选题' ? multi.join('')
    : q.type === '判断题' ? (judge ?? '')
    : q.type === '填空题' ? fills.join('\n')
    : text
  const canSubmit = objective ? inputText.trim().length > 0 : true

  /* 播报开关 = 暂停/继续（2026-09-13 晚第五轮"开和关都暂停在原处"，2026-09-15 下午加严）：
     关 → pauseSpeak（GA 线=suspend 冻结时间线，位置采样级精确；native=pause 原地停；
          不支持原生暂停时记住块位置），**不清进度、不清键**；
     开 → 先对表：暂停会话的 tag 必须等于当前界面期望的上下文（揭晓期=reveal 键、
          答题期=stem 键）才 resumeSpeak 续播——**从暂停位置继续，一个字不重**；
          不匹配（例如答题时暂停了题干、揭晓后才开声）→ 丢弃过期暂停，按当前上下文
          从头开新口。都没有 → 老规矩：揭晓态且本题没读过才开口。 */
  function toggleTts() {
    const next = !ttsOn
    setTtsOn(next)
    setTtsEnabled(next)
    ttsOnRef.current = next                    // 手动同步实时 ref：关声瞬间 go() 就要看到，不等 layout effect
    if (!next) { pauseSpeak(); return }        // 暂停在原处；循环句柄保留，续播读完接续循环
    unlockCloudAudio()                    // 恢复播报也在手势内：顺手解锁云端 <audio>/AudioContext
    const revealed = seal === 'broken' && (phase === 'feedback' || showAnswer)
    const expected = (revealed ? 'reveal|' : 'stem|') + index + '|' + (q ? q.id : '')
    if (currentPauseTag() === expected && resumeSpeak(stemLoopRef.current ? stemLoopRef.current.onDone : undefined)) return
    // ↑ 续播透传循环 onDone（2026-09-16）：native"记块位置重建链"分支需要它接续循环；
    //   GA suspend/原生 pause 两路链未断，onDone 原闭包仍在，透传值被忽略。揭晓态时
    //   句柄已被解析 effect 清掉 → 传 undefined，行为与旧版完全一致。
    if (currentPauseTag()) stopSpeak()               // 过期的暂停会话：丢弃，落入下方按当前上下文开口
    const key = index + '|' + q?.id
    if (revealed && q && spokenKeyRef.current !== key) {
      spokenKeyRef.current = key
      stopStemLoop()                                 // 揭晓态开声：解析接管，终结题干循环句柄
      speak(spokenOf(q, lastGrade, shuffleRef.current.order), { tag: 'reveal|' + index + '|' + q.id })
    } else if (!revealed && q && phase === 'answering' && !showAnswer) {
      /* 答题期开声且无可续的暂停会话（如间隙期静音）：重启题干循环——"不停重复读" */
      startStemLoop(stemSpokenOf(q), index, q.id)
    }
  }

  /* 重读（2026-09-14 用户要求"在播放开关旁边加一个重读"；2026-09-15 傍晚扩展）：
     分语境重读——答题中（未揭晓）重读【题干】stemSpokenOf(q) 并进入循环朗读
     （2026-09-16：重读一遍就停太孤零，重读=重新进入"点解析前不停重复读"的状态）；
     揭晓后重读【答案+解析】spokenOf(...)。若当前是静音态，先自动打开播报再读
     ——"重读"这个动作本身就表达了"我要听"。 */
  function replayTts() {
    if (!q) return
    const revealed = seal === 'broken' && (phase === 'feedback' || showAnswer)
    if (!ttsOn) { setTtsOn(true); setTtsEnabled(true); ttsOnRef.current = true }
    unlockCloudAudio()                    // 重读按钮也是手势：解锁云端 <audio>，避免首次被浏览器拦
    clearTimeout(rateRetry.current)
    if (revealed) {
      spokenKeyRef.current = index + '|' + q.id
      stopStemLoop()
      speak(spokenOf(q, lastGrade, shuffleRef.current.order), { tag: 'reveal|' + index + '|' + q.id })
    } else {
      startStemLoop(stemSpokenOf(q), index, q.id)
    }
  }

  /* 手动重读语音清单（移动端的救命按钮：部分安卓内核不触发 voiceschanged，
     且首次 speak 之前 getVoices() 恒为空；用户点 ↻ 即可强制再读一次） */
  function refreshVoiceList() {
    setVoiceList(listVoices(currentVoices()))
  }

  /* 展开/收起「声音」面板（2026-09-15 修手机端「选不了其他语音」）：
     展开动作落在用户手势栈里，是叫醒系统 TTS 引擎的最佳时机——
     ① warmUpVoices() 播一个 0 音量空句（部分安卓内核"首次 speak 之后"才填充语音表）；
     ② 立即刷新一次；
     ③ 随后 12 秒内每 1.2s 刷新（不触发 voiceschanged 的内核也能在此期间自动出现音色，
        用户不必手动点 ↻）。getVoices() 是同步内存读取，轮询无性能负担。 */
  function toggleTtsPanel() {
    const next = !ttsOpen
    setTtsOpen(next)
    clearInterval(panelPoll.current)
    if (!next) return
    warmUpVoices()
    refreshVoiceList()
    const t0 = Date.now()
    panelPoll.current = setInterval(() => {
      setVoiceList(listVoices(currentVoices()))
      if (Date.now() - t0 > 12000) clearInterval(panelPoll.current)
    }, 1200)
  }

  /* 换音色：落盘 → 若本题正在播报，防抖 300ms 后立刻用新音色重读（便于直接对比听感） */
  function applyVoice(name) {
    setTtsVoice(name || null)
    setVoiceSel(name || null)
    /* 换成云端音色时，趁这次 change 手势把 <audio> 解锁（移动端首次播放必须落在手势里） */
    if (name === CLOUD_VOICE_ID) unlockCloudAudio()
    if (ttsOn && q && spokenKeyRef.current === index + '|' + q.id) {
      clearTimeout(rateRetry.current)
      rateRetry.current = setTimeout(
        () => speak(spokenOf(q, lastGrade, shuffleRef.current.order), { tag: 'reveal|' + index + '|' + q.id }), 300)
    }
    /* 首播之后再拉一次：部分内核要"说过一次"才补齐语音表 */
    setTimeout(refreshVoiceList, 1800)
  }

  /* 语速自定义（无级滑块）：夹取 → 落盘 → 停当前播报；若本题正在播报，
     防抖 450ms 后用新语速重播（拖动过程中不反复重启，松手才生效）。 */
  function applyRate(v) {
    const val = setTtsRate(v)
    setRateNow(val)
    if (ttsOn && q && spokenKeyRef.current === index + '|' + q.id) {
      clearTimeout(rateRetry.current)
      rateRetry.current = setTimeout(
        () => speak(spokenOf(q, lastGrade, shuffleRef.current.order), { rate: val, tag: 'reveal|' + index + '|' + q.id }), 450)
    }
  }

  function doCheck() {
    if (!canSubmit) return
    unlockSpeech()                    // 手势内解锁音频（移动端首次 speak 必须落在手势栈里）
    unlockCloudAudio()                // 云端通路同样是"首次播放须在手势内"（<audio> 解锁）
    breakSeal()
    submitObjective(inputText)
    const ok = lastGradeAfter(inputText)
    setFlash(ok ? 'ok-flash' : 'bad-flash')
    if (!ok) window.dispatchEvent(new Event('abyss-pulse')) // 做错：错题凝视加深，短暂愉悦地骚动
    /* §56 糖豆雨降频：只有把连击推到 ≥3 的作答才撒糖豆，平答靠色彩反馈（防高频刺激竞争注意力） */
    if (ok && combo + 1 >= 3) {
      const r = document.querySelector('.reveal-btn')?.getBoundingClientRect()
        || document.querySelector('.q-card-wrap')?.getBoundingClientRect()
      if (r) burstParticles(r.left + r.width / 2, r.top, 'teal', 16)
    }
  }
  function lastGradeAfter(input) {
    // 预判（与 store 同口径）以便立刻播放特效
    try {
      return gradeObjective(q, input).correct
    } catch { return true }
  }

  /* §56 翻牌只负责翻：burst/凝视脉冲已前移到作答与自判处，这里不再重复刺激 */
  function flipToNext() {
    if (flying.current) return
    flying.current = true
    /* 下一题题干首块预载（2026-09-15 晚"翻题就出声"）：手势内对 questions[index+1]
       发起 GA 预合成，360ms 翻牌动画正好是合成窗口，新题落地开口 gaCache 命中秒排。
       gaCache 是 JS Map，不受 stopSpeak 清场影响——解除"翻题不挂预载"旧禁令（该禁令
       针对 <audio> src 预载会被清场吃掉；GA 缓存线免疫）。队列已定（三遍判制重入队
       发生在判分时），index+1 即下一题；末题越界由 if 守卫。 */
    const nxt = questions[index + 1]
    if (nxt) prefetchGACache(stemSpokenOf(nxt))
    setFlipped(false)
    // 300ms = .q-flipper 退出时长，留 60ms 余量再切题
    setTimeout(() => { flying.current = false; next() }, 360)
  }

  function commitSelf(ok) {
    submitSubjective(ok ? '记得' : '忘记')
    if (!ok) window.dispatchEvent(new Event('abyss-pulse'))
    flipToNext()
  }

  /* 客观题三遍判定制：确认本笔作答（store 里第 3 次完成时自动折算记得/模糊/忘记推卡），
     随后立即翻牌切题。三档手动自评已下线——评级由三次真实作答结果决定。
     flying 复用翻牌锁做双击防护：连点会造成重复 record + 卡二次推进 */
  function confirmAndFlip() {
    if (flying.current) return
    const ok = lastGrade ? lastGrade.correct : true
    confirmObjective()
    flipToNext()
  }

  /* ── 结算 ── */
  if (phase === 'done') {
    const total = summary.total
    const correct = summary.correct
    const pct = total > 0 ? Math.round(correct / total * 100) : 0
    const wrongN = total - correct
    const mm = Math.floor(elapsed / 60), ss = elapsed % 60
    return (
      <div className="practice-stage">
        <div className="settle-wrap">
          <div className="settle-card">
            {/* §39 彩带雨：结算即庆典。一次性 1.6s 撒糖纸屑（transform/opacity only），
                reduced-motion 直接不渲染动画（display:none）。 */}
            <div className="confetti-drop" aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => <i key={i} />)}
            </div>
            {/* 哥特玫瑰窗位图下线（#7）：换成纯 CSS 糖果奖章，零位图零请求；
                图标随正确率变，给一点成绩反馈 */}
            <div className="settle-medal" aria-hidden="true">{pct === 100 ? '🏆' : pct >= 60 ? '🍬' : '🍓'}</div>
            <h2 className="settle-title">本 轮 成 绩</h2>
            <div className={'settle-pct ' + (pct >= 60 ? 'teal-glow-text' : 'red-glow-text')}>{pct}%</div>
            <p className="settle-sub">正 确 率</p>
            {pct === 100 && <p className="settle-praise">全对！满分收工</p>}
            {pct >= 80 && pct < 100 && <p className="settle-praise">正确率不错，继续保持</p>}
            <div className="settle-grid">
              <span><b className="teal-glow-text">{correct}</b>答对</span>
              <span><b className="red-glow-text">{wrongN}</b>答错</span>
              <span><b>{mm > 0 ? `${mm}分${ss}秒` : `${ss}秒`}</b>用时</span>
              <span><b>{combo}</b>最高连对</span>
            </div>
            <div className="settle-actions">
              {wrongN > 0 && (
                <GiltBtn tone="danger" onClick={async () => {
                  unlockCloudAudio()          // 重开一轮的手势内解锁云端 <audio>：首题题干播报不被浏览器拦
                  const n = await startSession('wrong', { size: 0 })
                  if (n > 0) {
                    startAt.current = Date.now(); setElapsed(0)
                    /* 首题题干首块预载（2026-09-15 晚）：结算→练习页的路由/装载时间变成合成窗口 */
                    const qs = useStore.getState().sessionQuestions
                    if (qs && qs[0]) prefetchGACache(stemSpokenOf(qs[0]))
                  }
                  else navigate('/')
                }}><IconRetry /> 再练错题（{wrongN}）</GiltBtn>
              )}
              <GiltBtn onClick={() => { abortSession(); navigate('/') }}>返回学习页</GiltBtn>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── 答题 ── */
  const grade = lastGrade
  const fbImgUri = q ? diagramDataUri(imageFor(q.id)) : null
  /* §50 糖浆进度条（方案 B 拍板）：糖浆一点点灌满，糖珠=当前位置。
     旧 .gem-row 点阵撤下——三遍判定制后会话动辄 200+ 题，点阵密度爆表 */
  const pct = questions.length ? (results.length / questions.length) * 100 : 0
  return (
    <div className="practice-stage">
      <div className="practice-top">
        <div className="syrup-bar" role="progressbar" aria-label="答题进度"
          aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="syrup-fill" style={{ width: `calc(${pct}% - 6px)` }} />
          <div className="syrup-knob" style={{ left: `clamp(15px, ${pct}%, calc(100% - 15px))` }} />
        </div>
        <span className="practice-count">第 {index + 1} 题 / 共 {questions.length} 题 · <b className="teal-glow-text">✓{results.filter(Boolean).length}</b> <b className="red-glow-text">✗{results.filter((v) => !v).length}</b></span>
        <button className="chip" style={{ fontSize: 11 }} onClick={() => { abortSession(); navigate('/') }}>✕ 退出</button>
      </div>

      <div className="q-card-wrap" key={q.id + '-' + index}>
        {/* 真 3D 双面翻牌容器：正面(p2) 与 牌背(p6) 是同一个 preserve-3d 体的两面 */}
        <div className={'q-flipper' + (flipped ? ' is-front' : '')}>
        <div className={'q-card ' + flash}>
          {combo >= 3 && !answered && <span className="combo-pop" style={{ zIndex: 8 }}>✦ {combo} 连击！</span>}
          {/* 答错反馈：card-flash-bad 一次性阴影脉冲（pages.css）。旧哥特裂纹位图层已下线——
              candy §36 早已 background:none 全 neutralize，这里连 DOM 一起清掉（沉浸批1 A4） */}
          {/* 牌面：内缩进尖拱/藤蔓/龙首纹样之内，正文可滚、主操作钉在牌底 */}
          <div className="q-face">
          <div className="q-face-scroll">
            {/* ── 分区一 · 题目区：视觉层级最高，底色最干净 ── */}
            <section className="zone zone-q">
            <div className="q-tags">
              <span className="type-candy">{(q.type || '').replace(/题$/, '')}</span>
              {q.knowledgeDomain && <span className="q-domain-tag">{domainLabel(q.knowledgeDomain)}</span>}
              {/* 难度小标（#3）：去掉哥特宝石位图 A.gems，改成纯 CSS 糖果胶囊（配色见 candy.css .diff-pill） */}
              {q.difficulty && (
                <span className={'diff-pill d-' + (DIFF_CLS[q.difficulty] ?? 'base')}>{q.difficulty}</span>
              )}
            </div>
            {/* 题面：直接写在卷轴上 */}
            <div className="parch-layer"><Stem q={q} /></div>
            {/* 题干声音条（2026-09-15 傍晚）：声音控件原本只在解析区——答题中（未揭晓）
                没有任何重读入口，用户真机反馈"重读对题干没有效果"。给一条精简控件：
                🔊 开关（toggleTts：关=暂停在原处，开=接着读）+ 🔁 重读题干（replayTts 分语境）。
                揭晓后（answered/showAnswer）本条消失，解析区完整控件接管。 */}
            {ttsOK && !answered && !showAnswer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <button className="chip" style={{ fontSize: 11 }} aria-pressed={ttsOn}
                  title="题干会反复朗读直到你点解析。关闭＝暂停在原处；再点＝接着读（不会从头重读）"
                  onClick={toggleTts}>
                  {ttsOn ? '🔊 题干播报' : '⏸ 已暂停'}
                </button>
                <button className="chip" style={{ fontSize: 11 }}
                  title="从开头重读题干（读完继续循环，点解析即停）"
                  onClick={replayTts}>
                  🔁 重读题干
                </button>
              </div>
            )}
            </section>

            <div className="zone-rule" aria-hidden="true" />

            {/* ── 分区二 · 作答区 ── */}
            <section className="zone zone-a">
            <h5 className="zone-label">{objective ? '◇ 作答' : '◇ 誊 写 作 答'}</h5>
            <div className="q-answer-zone">
              {isChoice && optItems.map((o) => {
                /* selected / cls / 点击全用原始字母 o.orig，只有渲染出来的前缀用 o.disp */
                const selected = q.type === '单选题' ? choice === o.orig : multi.includes(o.orig)
                let cls = ''
                if (answered && grade) {
                  const exp = grade.expected ?? ''
                  const inAns = exp.includes(o.orig)
                  if (selected && inAns) cls = 'right'
                  else if (selected && !inAns) cls = 'wronged'
                  /* §37：多选漏选项不再挂 missed 绿提示（用户口径：答错时正确答案不变绿，
                     维持未答色）。正确答案在解析框里看，选项行不再复述。 */
                } else if (selected) cls = 'selected'
                return (
                  <button key={o.oi} disabled={answered}
                    className={`opt-row ${q.type === '多选题' ? 'square' : ''} ${cls}`}
                    onClick={() => q.type === '单选题'
                      ? setChoice(o.orig)
                      : setMulti((m) => m.includes(o.orig) ? m.filter((x) => x !== o.orig) : [...m, o.orig].sort())}>
                    {/* 选框是 .opt-row::before 纯 CSS 糖果圆角方（哥特符文位图已下线，沉浸批1 A4） */}
                    <span>{o.disp}. {o.text}</span>
                  </button>
                )
              })}

              {q.type === '判断题' && (
                <div className="judge-pair">
                  {[['正确', '✓', 'j-true'], ['错误', '✗', 'j-false']].map(([label, rune, cls], jIdx) => {
                    let extra = ''
                    if (answered && grade) {
                      /* 裁决通道（§35/§37，与 opt-row 同语义）：颜色跟「我答得对不对」走，
                         不跟选项身份走——旧逻辑给正确答案卡挂 selected，选对「错误」也红脸，
                         读起来像答错。§37 收窄：只有「我选的那张卡」有裁决色——
                         对=right / 错=wronged；没选的卡（含正确答案卡）一律维持未答色，
                         不再给 missed 绿提示（用户截图指名）。正确答案去解析框看。 */
                      if (judge === label) extra = grade.expected === label ? 'right' : 'wronged'
                    } else {
                      extra = judge === label ? 'selected' : (judge ? 'dimmed' : '')
                    }
                    return (
                      <button key={label} disabled={answered} className={`judge-card ${cls} ${extra}`}
                        aria-pressed={judge === label} onClick={() => setJudge(label)}>
                        <span className="judge-label">{label}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {q.type === '填空题' && (
                <div className="fill-grid">
                  {fills.map((v, i) => {
                    const expParts = answered && grade ? (grade.expectedParts ?? (grade.expected ?? '').split(',')) : []
                    const ok = answered && grade && expParts[i] !== undefined && v.trim() === expParts[i]
                    const bad = answered && grade && !ok
                    return (
                      <div key={i} className={'fill-item' + (ok ? ' right' : bad ? ' wronged' : '')}>
                        <span className="no font-cinzel">第{i + 1}空</span>
                        <div style={{ flex: 1 }}>
                          <input className="rune-input" value={v} disabled={answered}
                            onChange={(e) => setFills((f) => f.map((x, j) => j === i ? e.target.value : x))}
                            placeholder="导入答案…" />
                          {bad && <p className="fill-expected">正确答案：{expParts[i]}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {!objective && (
                <div className="subjective-area">
                  <textarea className="rune-textarea" value={text} disabled={answered}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={q.type === '计算分析题' ? '导入关键数值与推演过程…' : '在此导入你的解读…'} />
                  <p className="char-count">已导入 {text.length} 字</p>
                </div>
              )}
            </div>
            </section>

            <div className="zone-rule" aria-hidden="true" />

            {/* ── 分区三 · 答案区：未答=蜡封遮挡，答后=墨迹显影 ── */}
            {/* 答错时给解析区补挂 bad：用户口径是「解析背景变红」，指的是这个 ◇解析 大区块，
                而不是里面那个白色答案框（答案框要维持白底，只有左侧那条边框变红）。
                只挂 bad、不挂 ok：答对态必须一行不碰，继续吃 candy.css L399 的薄荷绿。
                用 lastGrade 而不是下面才声明的 grade（const 有 TDZ，会整页崩溃）。 */}
            <section className={'zone zone-s' + (answered || showAnswer ? ' revealed' : '') + (answered && !(objective ? lastGrade?.correct : lastRating === '记得') ? ' bad' : '')}>
            {/* 这里原来是 `answered || showAnswer ? '◇ 解析' : '◇ 解析'`——两个分支完全相同的遗留三元，已收成一行。
                🔊 播报开关（2026-09-13）：启封即自动朗读，一键静音，偏好记忆在 localStorage（lib/tts）。
                2026-09-15：同一开关也管「题卡到手自动读题干（不读选项）」——答题中读题干，揭晓后读答案+解析。
                浏览器不支持 speechSynthesis 时不渲染，解析区外观零变化。 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 2 }}>
              <h5 className="zone-label">◇ 解析</h5>
              {/* 「声音」合并控件（2026-09-13 晚第四轮：开关与调速合一个，语速自定义无档位）：
                  收起时只显示当前状态（🔊 1.35× / 🔇 静音），点开是"开关 + 无级滑块"。 */}
              {ttsOK && (
                <button className="chip" style={{ fontSize: 11 }} aria-expanded={ttsOpen}
                  aria-pressed={ttsOn}
                  title={ttsOn ? `解析语音播报进行中｜${voiceNote()}` : `已暂停在原处，再点继续接着读｜${voiceNote()}`}
                  onClick={toggleTtsPanel}>
                  {ttsOn ? `🔊 ${fmtRate(rateNow)}×` : '⏸ 已暂停'}
                </button>
              )}
              {/* 浏览器不支持时**不再静默消失**（用户问"手机版为什么没有"的根因之一）：
                  给一句可见解释，并指路可用浏览器。 */}
              {!ttsOK && (
                <span style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.3px' }}
                  title="当前浏览器内核不支持 Web Speech 语音合成（常见于部分安卓 WebView / 旧机型 / 内置浏览器）。换 Chrome、Edge 或 Safari 打开即可使用解析语音播报。">
                  🔇 本浏览器不支持播报
                </span>
              )}
            </div>
            {ttsOK && ttsOpen && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px 4px' }}>
                  <button className="chip" style={{ fontSize: 11 }} aria-pressed={ttsOn}
                    title="关闭＝暂停在原处；再点＝接着读（不会从头重读）"
                    onClick={toggleTts}>
                    {ttsOn ? '🔊 播报开' : '▶ 继续播报'}
                  </button>
                  <button className="chip" style={{ fontSize: 11 }}
                    title="从开头重读本题（答题中重读题干，揭晓后重读答案与解析；静音时点它会自动打开播报）"
                    onClick={replayTts}>
                    🔁 重读
                  </button>
                  <input type="range" min={RATE_MIN} max={RATE_MAX} step={RATE_STEP} value={rateNow}
                    aria-label="播报语速" style={{ flex: 1, accentColor: 'var(--teal, #3fbfa8)' }}
                    onChange={(e) => applyRate(parseFloat(e.target.value))} />
                  <span style={{ fontSize: 11, minWidth: 40, textAlign: 'right', letterSpacing: '.3px' }}>{fmtRate(rateNow)}×</span>
                </div>
                {/* 音色选择（2026-09-14，用户反馈"机械音太重"）：
                    ⚠ 现实约束——Chrome 只暴露 3 个老 SAPI 中文音（Huihui/Kangkang/Yaoyao），
                    晓晓/云希这类 Online 神经音只有 Edge 提供（Windows 本地语音包不含它们，
                    且系统「讲述人自然语音」默认不给第三方应用调用）。所以这里能做的是：
                    把"用的是哪个音色、属于哪一档"摆到台面上，并允许用户自行挑选/换用。 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0 4px 8px' }}>
                  <span style={{ fontSize: 11, opacity: .7, paddingTop: 3 }}>音色</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* 自绘音色选择器（2026-09-15，用户反馈"一点选择语音就占满整个手机画面"）：
                          ⚠ 原用原生 <select>：安卓上会弹出**系统全屏选择器**（无法改样式、必然占满屏），
                          且 optgroup 标题在原生弹层里会变成多余的分组行（用户截图红框那几行）。
                          现改为「按钮 + 页面内弹层」：高度 ≤46vh、可滚动、样式随主题，
                          并且**不再渲染分组标题行**（"云端音色（任意设备可用）""本机系统音色"等一律去掉）。 */}
                      <button className="chip" style={{ fontSize: 11, maxWidth: 232, textAlign: 'left' }}
                        aria-haspopup="listbox" aria-expanded={voiceOpen}
                        onClick={() => { setVoiceOpen((o) => !o); refreshVoiceList() }}>
                        {voiceCurLabel} <span style={{ opacity: .55 }}>▾</span>
                      </button>
                      {/* ↻ 重新读取音色（移动端必需：部分安卓内核不触发 voiceschanged，
                          且首次 speak 之前 getVoices() 恒为空） */}
                      <button className="chip" style={{ fontSize: 11, padding: '2px 7px' }}
                        title="重新读取本机音色列表（若是安卓且列表为空，可按下方提示装中文语音数据）"
                        onClick={refreshVoiceList}>↻</button>
                    </div>
                    {/* 空列表 + 已选云端时，把"引擎看到了什么"和"现在用的是谁"都摊开
                        （2026-09-15）：手机无 devtools，用户截图即可反馈，避免靠猜。 */}
                    <span style={{ fontSize: 10.5, opacity: .68, lineHeight: 1.32, maxWidth: 262 }}>
                      {isCloudVoice(voiceSel)
                        ? `已选云端音色（${voiceSel === CLOUD_VOICE_ID ? '百度备用线路' : '微软神经音'}）：不依赖本机语音库。本机可见语音 ${voiceDiag().total} 条。`
                        : voiceList.length > 0
                          ? `已读取 ${voiceList.length} 个中文音色，可任选（含粤语/台湾/方言）· ${voiceAdvice()}`
                          : (() => {
                              const d = voiceDiag()
                              return d.total > 0
                                ? `本机共 ${d.total} 条语音，其中中文 0 条。样例：${d.sample.join('；')}（可截图反馈）`
                                : voiceGuideText(0)
                            })()}
                    </span>
                  </div>
                </div>
              </>
            )}
            {/* §38：题图只在点击解析（蜡封启封）后随答案一起显示，答题前不渲染 */}
            {seal === 'broken' && fbImgUri && <img src={fbImgUri} alt={diagramTitle(imageFor(q.id))} style={{ display: 'block', maxWidth: '100%', margin: '0 auto 10px', background: '#fff', border: '1px solid #e5d9c3', borderRadius: 8 }} />}
            {seal !== 'broken' && (
              <div className={'seal-lock ' + seal}>
                {/* 封缄是 .seal-wax 纯 CSS 糖豆（candy.css §65）：哥特蜡封三帧位图已下线（沉浸批1 A4） */}
                <span className="seal-wax" aria-hidden="true" />
                <span>{objective ? '答案已封印 · 查看解析后启封' : '参考答案已隐藏 · 展开后显示'}</span>
              </div>
            )}

            {/* 判分反馈：启封后墨迹自左向右显影 */}
            {answered && (
              <div className="grade-panel">
                {(objective || committed) && (
                  <div className={'verdict-banner ' + ((objective ? grade?.correct : lastRating === '记得') ? 'ok' : 'bad')}>
                    {combo >= 3 && (objective ? grade?.correct : lastRating === '记得') && <span className="combo-pop">✦ {combo} 连击！</span>}
                    {(objective ? grade?.correct : lastRating === '记得') ? '答对了' : '答错了'}
                  </div>
                )}
                {/* 多选"错在哪"文字提示（2026-09-11 审查整改 · 纯文字通道）：
                    §37 用户裁决「答错时正确答案不变绿、选项行不复述答案」——选项配色与
                    勾选状态一行未动，这里只在解析区补一行字，把漏选/错选显式化。
                    动因：旧版部分答对时只有"已选且正确"的项显绿、整体却判答错，
                    学习者容易误判自己的掌握度（掌握度是错题重练与段位的入口）。 */}
                {objective && grade && !grade.correct && q.type === '多选题' && (() => {
                  const exp = new Set(String(grade.expected ?? '').split(''))
                  const sel = new Set(multi)
                  /* v6.8：比较仍用原始字母（grade.expected 与 multi 同为原始字母），
                     但**展示一律换算成洗牌后的显示字母**——否则"漏选 B"会指向
                     用户屏幕上的另一个选项，与解析错位是同一类问题。 */
                  const missed = [...exp].filter((L) => !sel.has(L)).map((L) => origToDisp[L] ?? L).sort()
                  const extra = [...sel].filter((L) => !exp.has(L)).map((L) => origToDisp[L] ?? L).sort()
                  if (missed.length === 0 && extra.length === 0) return null
                  return (
                    <p style={{ margin: '2px 0 8px', fontSize: 12.5, lineHeight: 1.8, color: 'var(--ink-2)', letterSpacing: '.3px' }}>
                      本题为多选：{missed.length > 0 && `漏选 ${missed.length} 项（${missed.join('、')}）`}
                      {missed.length > 0 && extra.length > 0 && ' · '}
                      {extra.length > 0 && `错选 ${extra.length} 项（${extra.join('、')}）`}
                    </p>
                  )
                })()}
                <div className={'answer-scroll-box ' + ((objective ? grade?.correct : lastRating === '记得') ? 'ok' : 'bad')}>
                  <h5>{(objective ? grade?.correct : lastRating === '记得') ? '参考答案' : '正确答案'}</h5>
                  <p>{shownAnswer}</p>
                  {q.explanation && <>
                    <p className="lab">【题库解析】</p>
                    <p>{remapExplLetters(q.explanation)}</p>
                  </>}
                </div>
              </div>
            )}

            {/* 主观题：展开参考答案后与自己写的对照（尚未提交） */}
            {!objective && !answered && showAnswer && (
              <div className="grade-panel">
                <div className="answer-scroll-box">
                  <h5>◆ 参考答案</h5>
                  <p>{q.answer}</p>
                  {q.explanation && <>
                    <p className="lab">【题库解析】</p>
                    <p>{remapExplLetters(q.explanation)}</p>
                  </>}
                </div>
              </div>
            )}
            </section>
          </div>

          {/* 牌底：铜质藤蔓花纹分隔 + 当前唯一主操作（不随正文滚动，永远在手边） */}
          <div className="q-face-foot">
            <div className="q-face-rule" aria-hidden="true" />
            {!answered && (objective ? (
              <>
                <GiltBtn size="lg" block className="reveal-btn" disabled={!canSubmit} onClick={doCheck}>
                  <IconReveal /> 查看解析
                </GiltBtn>
                <p className="kbd-hint">键盘 1-5 直选 · ↑↓ 切换选项 · Enter 确认</p>
              </>
            ) : showAnswer ? (
              <>
                <div className="self-judge-row">
                  <GiltBtn tone="teal" onClick={() => commitSelf(true)}>✓ 我答对了</GiltBtn>
                  <GiltBtn tone="danger" onClick={() => commitSelf(false)}>✗ 我答错了</GiltBtn>
                </div>
                <p className="kbd-hint">Enter = 答对 · Shift+Enter = 答错</p>
              </>
            ) : (
              <>
                <GiltBtn size="lg" block className="reveal-btn" disabled={text.trim() === ''}
                  onClick={() => { unlockSpeech(); unlockCloudAudio(); prefetchCloudFirst(spokenOf(q, lastGrade, shuffleRef.current.order)); breakSeal(); setShowAnswer(true) }}>
                  <IconScroll /> 展开参考答案
                </GiltBtn>
                <p className="kbd-hint">Ctrl+Enter 展开答案</p>
              </>
            ))}

            {answered && objective && !committed && (
              <>
                {/* 三遍判定制（§48）：不再问「你的记忆状态」，评级由本批 3 次作答自动折算 */}
                <h4>第 {attemptNo} / 3 次作答</h4>
                <GiltBtn size="lg" block className="reveal-btn" onClick={confirmAndFlip}>
                  <IconReveal /> 确认，下一题
                </GiltBtn>
                <p className="kbd-hint">Enter = 下一题</p>
              </>
            )}

            {/* 评分即翻牌：已删除「下一卷」按钮，翻牌期间只给一行轻提示，避免牌底突然空掉 */}
            {committed && <p className="flip-hint">✦ 已记录，正在进入下一题 ✦</p>}
          </div>
          </div>
        </div>
        {/* 牌背（candy.css §37 马卡龙渐变+波点）：玫瑰窗位图与内联 p6 背景已下线（沉浸批1 A4） */}
        <div className="card-flip-cover" aria-hidden="true" />
        </div>
      </div>
      {/* 自绘音色弹层（2026-09-15）：portal 到 body —— 卡片是 3D 变换容器，fixed 元素
          放它内部会被变换坐标系"吞掉"（定位错乱/被裁剪），必须挂到 document.body。
          高度 ≤46vh、可滚动：不再像安卓原生 select 那样占满整屏。 */}
      {voiceOpen && createPortal(
        <>
          <div onClick={() => setVoiceOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 79, background: 'rgba(45,32,38,.30)' }} />
          <div role="listbox" aria-label="播报音色"
            style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(var(--nav-h, 58px) + 12px)', zIndex: 80,
              maxHeight: '46vh', overflowY: 'auto', overscrollBehavior: 'contain',
              background: 'var(--cream, #FFFDF8)', border: '2px solid var(--candy-pink-lt, #F3CBD3)',
              borderRadius: 14, padding: 6, boxShadow: '0 12px 32px rgba(90,60,70,.24)' }}>
            {voiceOptions.map((o) => {
              const sel = (voiceSel || '') === o.value
              return (
                <button key={o.value || 'auto'} role="option" aria-selected={sel}
                  onClick={() => { applyVoice(o.value); setVoiceOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    width: '100%', padding: '9px 10px', margin: '1px 0', fontSize: 12.5, lineHeight: 1.35,
                    textAlign: 'left', border: 'none', borderRadius: 10,
                    background: sel ? 'linear-gradient(180deg,#EAF2ED,#DFECE5)' : 'transparent',
                    color: '#2E6E58', cursor: 'pointer' }}>
                  <span style={{ minWidth: 0 }}>{o.label}</span>
                  {sel && <span style={{ color: 'var(--candy-pink-dk, #E08CA0)', fontWeight: 700 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

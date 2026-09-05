import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { A } from '../assets'
import { GiltBtn } from '../components'
// burstParticles 改从 CandyBoot 引：components.jsx 正被编辑器陈旧缓冲区回写成 Apple 版（只发振动、不发糖豆）
import { burstParticles } from '../components/CandyBoot'
import { IconReveal, IconScroll, IconRetry } from '../components/CandyIcons'
import { isObjective, domainLabel, DIFF_CLS } from '../lib/stats'
import { gradeObjective, blanksOf } from '../lib/validate'
import { imageFor, diagramDataUri, diagramTitle } from '../lib/diagrams'

/* Fisher-Yates 洗牌，返回 0..n-1 的一个排列（#6 选项随机化用） */
function shuffledOrder(n) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
     ① 时机：蜡封在 520ms 才卸载（seal==='broken'），提前滚会让上方内容在滚动途中突然少 ~40px
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

  /* §56 键盘流：1-5/A-E 选选项、1/2 判断、Enter 提交与翻页、Ctrl+Enter 展开主观题答案、
     Shift+Enter=自判答错。全部走「点真实 DOM 按钮/选项行」复用现有判分链路，
     不碰 React state 内部（esbuild 不查未定义变量，直接改 state 极易埋雷）。
     焦点在输入框时数字是题目内容，只有 Enter 参与；无障碍靠真实按钮本身，键盘是加速器。
     ⚠ 必须挂在早退 return 之前（Hooks 规则）：idle/done 分支也要保持钩子数量一致。 */
  useEffect(() => {
    if (phase !== 'answering' && phase !== 'feedback') return
    const onKey = (e) => {
      if (e.altKey || e.metaKey) return
      const tag = e.target && e.target.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      const footBtns = () => [...document.querySelectorAll('.q-face-foot button')]
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
        const rv = footBtns().find((b) => !b.disabled &&
          (b.textContent.includes('查看解析') || b.textContent.includes('展开参考答案')))
        if (rv && (!typing || e.ctrlKey || tag === 'INPUT')) { e.preventDefault(); rv.click() }
        return
      }
      if (typing || phase !== 'answering' || !objective) return
      /* 主键盘 Digit 与小键盘 Numpad 都认 */
      const dm = /^Digit([1-5])$/.exec(e.code) || /^Numpad([1-5])$/.exec(e.code)
      const digit = dm ? Number(dm[1]) - 1
        : /^Key([A-E])$/.test(e.code) ? 'ABCDE'.indexOf(e.code.slice(3)) : -1
      if (digit < 0) return
      const row = document.querySelectorAll('.opt-row')[digit]
      const judge = document.querySelectorAll('.judge-card')[digit]
      if (row) { e.preventDefault(); row.click() } else if (judge) { e.preventDefault(); judge.click() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, objective])

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

  function doCheck() {
    if (!canSubmit) return
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
                  const n = await startSession('wrong', { size: 0 })
                  if (n > 0) { startAt.current = Date.now(); setElapsed(0) }
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
        <span className="practice-count">第 {index + 1} 题 / 共 {questions.length} 题</span>
        <button className="chip" style={{ fontSize: 11 }} onClick={() => { abortSession(); navigate('/') }}>✕ 退出</button>
      </div>

      <div className={'pile-counter okp'}>
        <span className="pile">✓</span> 答对 <b className="teal-glow-text">{results.filter(Boolean).length}</b>
      </div>
      <div className={'pile-counter badp'}>
        <span className="pile">✗</span> 答错 <b className="red-glow-text">{results.filter((v) => !v).length}</b>
      </div>

      <div className="q-card-wrap" key={q.id + '-' + index}>
        {/* 真 3D 双面翻牌容器：正面(p2) 与 牌背(p6) 是同一个 preserve-3d 体的两面 */}
        <div className={'q-flipper' + (flipped ? ' is-front' : '')}>
        <div className={'q-card ' + flash}>
          {combo >= 3 && !answered && <span className="combo-pop" style={{ zIndex: 8 }}>✦ {combo} 连击！</span>}
          {/* 答错了：真实裂纹素材三帧自四角向中心蔓延（与牌面同 2:3 比例，零变形） */}
          {flash === 'bad-flash' && (
            <div className="crack-veil" aria-hidden="true">
              {A.cracks.map((s, k) => <img key={k} className={'c' + (k + 1)} src={s} alt="" decoding="async" />)}
            </div>
          )}
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
                    <img className="mark" decoding="async" alt="" aria-hidden="true"
                      src={(q.type === '单选题' ? A.markRadio : A.markCheck)[selected ? 'on' : 'off']} />
                    <span>{o.disp}. {o.text}</span>
                  </button>
                )
              })}

              {q.type === '判断题' && (
                <div className="judge-pair">
                  {[['正确', '✓', 'j-true'], ['错误', '✗', 'j-false']].map(([label, rune, cls]) => {
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
                        style={{ backgroundImage: `url(${label === '正确' ? A.judgeCard.ok : A.judgeCard.no})` }}
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
            {/* 这里原来是 `answered || showAnswer ? '◇ 解析' : '◇ 解析'`——两个分支完全相同的遗留三元，已收成一行 */}
            <h5 className="zone-label">◇ 解析</h5>
            {/* §38：题图只在点击解析（蜡封启封）后随答案一起显示，答题前不渲染 */}
            {seal === 'broken' && fbImgUri && <img src={fbImgUri} alt={diagramTitle(imageFor(q.id))} style={{ display: 'block', maxWidth: '100%', margin: '0 auto 10px', background: '#fff', border: '1px solid #e5d9c3', borderRadius: 8 }} />}
            {seal !== 'broken' && (
              <div className={'seal-lock ' + seal}>
                <span className="seal-wax" aria-hidden="true">
                  {A.waxSeal.map((s, k) => <img key={k} className={'f' + (k + 1)} src={s} alt="" decoding="async" />)}
                </span>
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
                <div className={'answer-scroll-box ' + ((objective ? grade?.correct : lastRating === '记得') ? 'ok' : 'bad')}>
                  <h5>{(objective ? grade?.correct : lastRating === '记得') ? '参考答案' : '正确答案'}</h5>
                  <p>{shownAnswer}</p>
                  {q.explanation && <>
                    <p className="lab">【题库解析】</p>
                    <p>{q.explanation}</p>
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
                    <p>{q.explanation}</p>
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
                <p className="kbd-hint">键盘 1-5 选择 · Enter 确认</p>
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
                  onClick={() => { breakSeal(); setShowAnswer(true) }}>
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
        {/* 牌背（p6）：自身再转 180°，使 flipper 在 180° 时它朝外 */}
        <div className="card-flip-cover" style={{ backgroundImage: `url(${A.cardBack})` }} aria-hidden="true">
          <img src={A.roseWindow} alt="" />
        </div>
        </div>
      </div>
    </div>
  )
}

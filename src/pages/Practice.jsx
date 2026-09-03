import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { A, TYPE_SEAL_INDEX } from '../assets'
import { GiltBtn } from '../components'
// burstParticles 改从 CandyBoot 引：components.jsx 正被编辑器陈旧缓冲区回写成 Apple 版（只发振动、不发糖豆）
import { burstParticles } from '../components/CandyBoot'
import { isObjective, domainLabel, DIFF_CLS } from '../lib/stats'
import { gradeObjective, blanksOf } from '../lib/validate'

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
  const rateObjective = useStore((s) => s.rateObjective)
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
  /* 判定结果：客观题看 grade.correct，主观题看自评是否「记得」。
     解析区整体配色要用它，否则答错时外层 .zone-s.revealed 还是无条件薄荷绿，红绿混装。
     同样用 lastGrade 而不是下面才声明的 grade（const 有 TDZ）。 */
  const verdictOk = objective ? !!lastGrade?.correct : lastRating === '记得'
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

  function doCheck(e) {
    if (!canSubmit) return
    breakSeal()
    submitObjective(inputText)
    const ok = lastGradeAfter(inputText)
    setFlash(ok ? 'ok-flash' : 'bad-flash')
    const r = e.currentTarget.getBoundingClientRect()
    burstParticles(r.left + r.width / 2, r.top, ok ? 'teal' : 'red', 16)
    if (!ok) window.dispatchEvent(new Event('abyss-pulse')) // 做错：错题凝视加深，短暂愉悦地骚动
  }
  function lastGradeAfter(input) {
    // 预判（与 store 同口径）以便立刻播放特效
    try {
      return gradeObjective(q, input).correct
    } catch { return true }
  }

  /* 评分即翻牌：翻回牌背（与入场同轴同曲线）→ 到位后自动切下一题，全程无需再点「下一卷」 */
  function flipToNext(ok) {
    if (flying.current) return
    flying.current = true
    const r = document.querySelector('.q-card-wrap')?.getBoundingClientRect()
    if (r) burstParticles(r.left + r.width / 2, r.top + r.height * 0.32, ok ? 'teal' : 'red', 14)
    if (!ok) window.dispatchEvent(new Event('abyss-pulse'))
    setFlipped(false)
    // 300ms = .q-flipper 退出时长，留 60ms 余量再切题
    setTimeout(() => { flying.current = false; next() }, 360)
  }

  function commitSelf(ok) {
    submitSubjective(ok ? '记得' : '忘记')
    flipToNext(ok)
  }

  /* 客观题三档自评：记录 + 评级后立即翻牌切题 */
  function rate(rating) {
    rateObjective(rating)
    flipToNext(rating === '记得')
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
                }}>🍓 再练错题（{wrongN}）</GiltBtn>
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
  return (
    <div className="practice-stage">
      <div className="practice-top">
        <div className="gem-row" aria-label="进度">
          {questions.map((_, i) => (
            <span key={i} className={'gem-dot' + (i === index ? ' cur' : i < results.length ? (results[i] ? ' ok' : ' bad') : '')} />
          ))}
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
                  else if (!selected && inAns && q.type === '多选题') cls = 'missed'
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
                      if (grade.expected === label) extra = 'selected'
                      else if (judge === label) extra = 'dimmed'
                      else extra = 'dimmed'
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
            {/* revealed 之外再按判定结果挂 ok / bad：原来 .zone-s.revealed 无条件是薄荷绿，
                答错时里面的横幅 / 答案框 / 选项全红了、外层解析区还是绿的。
                现在整个分区跟着判定走同一色系，答错就是答对那套处理的红色镜像。
                主观题仅展开参考答案、尚未自判时（showAnswer 但 !answered）不挂，保持中性。 */}
            <section className={'zone zone-s' + (answered || showAnswer ? ' revealed' : '') + (answered ? (verdictOk ? ' ok' : ' bad') : '')}>
            {/* 这里原来是 `answered || showAnswer ? '◇ 解析' : '◇ 解析'`——两个分支完全相同的遗留三元，已收成一行 */}
            <h5 className="zone-label">◇ 解析</h5>
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
              <GiltBtn size="lg" block className="reveal-btn" disabled={!canSubmit} onClick={doCheck}>
                🔍 查看解析
              </GiltBtn>
            ) : showAnswer ? (
              <div className="self-judge-row">
                <GiltBtn tone="teal" onClick={() => commitSelf(true)}>✓ 我答对了</GiltBtn>
                <GiltBtn tone="danger" onClick={() => commitSelf(false)}>✗ 我答错了</GiltBtn>
              </div>
            ) : (
              <GiltBtn size="lg" block className="reveal-btn" disabled={text.trim() === ''}
                onClick={() => { breakSeal(); setShowAnswer(true) }}>
                📜 展开参考答案
              </GiltBtn>
            ))}

            {answered && objective && !committed && (
              <>
                <h4>你的记忆状态？</h4>
                {/* 三档副标题改成大白话：这三个选项直接驱动 FSRS 间隔算法，
                    原文案「被答错了 / 正确率游离 / 正确率铭刻」语义含糊，选错会影响复习排期 */}
                <div className="rate-row">
                  <button className="rate-btn r-forget" onClick={() => rate('忘记')}>忘记<small>完全想不起来</small></button>
                  <button className="rate-btn r-hazy" onClick={() => rate('模糊')}>模糊<small>犹豫了一下才对</small></button>
                  <button className="rate-btn r-remember" onClick={() => rate('记得')}>记得<small>一眼就答出来了</small></button>
                </div>
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

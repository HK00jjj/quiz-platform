import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { A, TYPE_SEAL_INDEX } from '../assets'
import { GiltBtn, burstParticles } from '../components'
import { isObjective, domainLabel } from '../lib/stats'
import { gradeObjective, blanksOf } from '../lib/validate'

/* 题干渲染：填空题把 {空} 显示为下划线占位 */
function Stem({ q }) {
  if (q.type !== '填空题' || !q.stem.includes('{')) return <p className="q-stem drop-cap">{q.stem}</p>
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

  /* 牌面是固定比例的塔罗牌，正文区可能溢出：答案卷轴展开后自动滚到可见。
     注意：这里必须用 store 的 phase，不能用下面才声明的 answered（const 有 TDZ，
     依赖数组在渲染期求值会报 Cannot access 'answered' before initialization 而整页崩溃） */
  useEffect(() => {
    if (phase !== 'feedback' && !showAnswer) return
    const sc = document.querySelector('.q-face-scroll')
    const gp = document.querySelector('.grade-panel')
    if (!sc || !gp) return
    const t = setTimeout(() => {
      const delta = gp.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 4
      sc.scrollTo({ top: Math.max(0, delta), behavior: 'smooth' })
    }, 420)
    return () => clearTimeout(t)
  }, [phase, showAnswer])

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startAt.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const combo = useMemo(() => {
    let n = 0
    for (let i = results.length - 1; i >= 0; i--) { if (results[i]) n++; else break }
    return n
  }, [results])

  if (phase === 'idle' || questions.length === 0) {
    return (
      <div className="practice-stage" style={{ textAlign: 'center', paddingTop: '24vh' }}>
        <p style={{ color: 'var(--muted)', letterSpacing: 3, marginBottom: 20 }}>没有可翻阅的秘典</p>
        <GiltBtn onClick={() => navigate('/')}>返回阅览厅</GiltBtn>
      </div>
    )
  }

  const answered = phase === 'feedback'
  const committed = lastRating !== null
  const inputText = q.type === '单选题' ? (choice ?? '')
    : q.type === '多选题' ? multi.join('')
    : q.type === '判断题' ? (judge ?? '')
    : q.type === '填空题' ? fills.join('，')
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
    if (!ok) window.dispatchEvent(new Event('abyss-pulse')) // 做错：深渊凝视加深，短暂愉悦地骚动
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
            <img className="settle-rose" src={A.roseWindow} alt="" />
            <h2 className="gold-title font-gothic" style={{ fontSize: 22, letterSpacing: 8 }}>◆ 参 悟 总 结 ◆</h2>
            <div className={'settle-pct ' + (pct >= 60 ? 'teal-glow-text' : 'red-glow-text')}>{pct}%</div>
            <p style={{ fontSize: 12, letterSpacing: 4, color: 'var(--muted)' }}>灵 知 契 合 度</p>
            {pct === 100 && <p className="gold-glow-text" style={{ marginTop: 10, letterSpacing: 3 }}>✦✦✦ 完美一役 ✦✦✦</p>}
            {pct >= 80 && pct < 100 && <p className="gold-glow-text" style={{ marginTop: 10, letterSpacing: 3 }}>✦ 灵知精进 ✦</p>}
            <div className="settle-grid">
              <span><b className="teal-glow-text">{correct}</b>✦ 窥见</span>
              <span><b className="red-glow-text">{wrongN}</b>✗ 侵蚀</span>
              <span><b>{mm > 0 ? `${mm}分${ss}秒` : `${ss}秒`}</b>⏱ 用时</span>
              <span><b>{combo}</b>✦ 最高连击</span>
            </div>
            <div className="settle-actions">
              {wrongN > 0 && (
                <GiltBtn tone="danger" onClick={async () => {
                  const n = await startSession('wrong', { size: 0 })
                  if (n > 0) startAt.current = Date.now()
                  else navigate('/')
                }}>🕯 净化污染（{wrongN}）</GiltBtn>
              )}
              <GiltBtn onClick={() => { abortSession(); navigate('/') }}>返回阅览厅</GiltBtn>
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
        <span className="practice-count">第 {index + 1} 卷 / 共 {questions.length} 卷</span>
        <button className="chip" style={{ fontSize: 11 }} onClick={() => { abortSession(); navigate('/') }}>✕ 离场</button>
      </div>

      <div className={'pile-counter okp'}>
        <span className="pile">🗂</span> 已掌握 <b className="teal-glow-text">{results.filter(Boolean).length}</b>
      </div>
      <div className={'pile-counter badp'}>
        <span className="pile">🕯</span> 污染封印 <b className="red-glow-text">{results.filter((v) => !v).length}</b>
      </div>

      <div className="q-card-wrap" key={q.id + '-' + index}>
        {/* 真 3D 双面翻牌容器：正面(p2) 与 牌背(p6) 是同一个 preserve-3d 体的两面 */}
        <div className={'q-flipper' + (flipped ? ' is-front' : '')}>
        <div className={'q-card ' + flash}>
          {combo >= 3 && !answered && <span className="combo-pop" style={{ zIndex: 8 }}>✦ {combo} 连击！</span>}
          {/* 深渊侵蚀：真实裂纹素材三帧自四角向中心蔓延（与牌面同 2:3 比例，零变形） */}
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
              <img className="stamp" src={A.seals[TYPE_SEAL_INDEX[q.type] ?? 0]} alt={q.type} title={q.type} />
              {q.knowledgeDomain && <span className="q-domain-tag">{domainLabel(q.knowledgeDomain)}</span>}
              {q.difficulty && A.gems[q.difficulty] && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <img className="gem" src={A.gems[q.difficulty]} alt="" />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{q.difficulty}</span>
                </span>
              )}
            </div>
            {/* 符文谜面：直接写在卷轴上 */}
            <div className="parch-layer"><Stem q={q} /></div>
            </section>

            <div className="zone-rule" aria-hidden="true" />

            {/* ── 分区二 · 作答区 ── */}
            <section className="zone zone-a">
            <h5 className="zone-label">{objective ? '◇ 择 符 作 答' : '◇ 誊 写 作 答'}</h5>
            <div className="q-answer-zone">
              {(q.type === '单选题' || q.type === '多选题') && (q.options ?? []).map((opt, i) => {
                const letter = opt.match(/^([A-E])[.、]/)?.[1] ?? 'ABCDE'[i]
                const selected = q.type === '单选题' ? choice === letter : multi.includes(letter)
                let cls = ''
                if (answered && grade) {
                  const exp = grade.expected ?? ''
                  const inAns = exp.includes(letter)
                  if (selected && inAns) cls = 'right'
                  else if (selected && !inAns) cls = 'wronged'
                  else if (!selected && inAns && q.type === '多选题') cls = 'missed'
                } else if (selected) cls = 'selected'
                return (
                  <button key={i} disabled={answered}
                    className={`opt-row ${q.type === '多选题' ? 'square' : ''} ${cls}`}
                    onClick={() => q.type === '单选题'
                      ? setChoice(letter)
                      : setMulti((m) => m.includes(letter) ? m.filter((x) => x !== letter) : [...m, letter].sort())}>
                    <img className="mark" decoding="async" alt="" aria-hidden="true"
                      src={(q.type === '单选题' ? A.markRadio : A.markCheck)[selected ? 'on' : 'off']} />
                    <span>{opt}</span>
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
                    const expParts = answered && grade ? (grade.expected ?? '').split(',') : []
                    const ok = answered && grade && expParts[i] !== undefined && v.trim() === expParts[i]
                    const bad = answered && grade && !ok
                    return (
                      <div key={i} className={'fill-item' + (ok ? ' right' : bad ? ' wronged' : '')}>
                        <span className="no font-cinzel">第{i + 1}空</span>
                        <div style={{ flex: 1 }}>
                          <input className="rune-input" value={v} disabled={answered}
                            onChange={(e) => setFills((f) => f.map((x, j) => j === i ? e.target.value : x))}
                            placeholder="誊写答案…" />
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
                    placeholder={q.type === '计算分析题' ? '誊写关键数值与推演过程…' : '在此誊写你的解读…'} />
                  <p className="char-count">已誊写 {text.length} 字</p>
                </div>
              )}
            </div>
            </section>

            <div className="zone-rule" aria-hidden="true" />

            {/* ── 分区三 · 答案区：未答=蜡封遮挡，答后=墨迹显影 ── */}
            <section className={'zone zone-s' + (answered || showAnswer ? ' revealed' : '')}>
            <h5 className="zone-label">{answered || showAnswer ? '◇ 真 理 已 启 封' : '◇ 真 理 封 印 中'}</h5>
            {seal !== 'broken' && (
              <div className={'seal-lock ' + seal}>
                <span className="seal-wax" aria-hidden="true">
                  {A.waxSeal.map((s, k) => <img key={k} className={'f' + (k + 1)} src={s} alt="" decoding="async" />)}
                </span>
                <span>{objective ? '答案已封印 · 解读符文后启封' : '参考答案已封印 · 展开卷轴后启封'}</span>
              </div>
            )}

            {/* 判分反馈：启封后墨迹自左向右显影 */}
            {answered && (
              <div className="grade-panel">
                {(objective || committed) && (
                  <div className={'verdict-banner ' + ((objective ? grade?.correct : lastRating === '记得') ? 'ok' : 'bad')}>
                    {combo >= 3 && (objective ? grade?.correct : lastRating === '记得') && <span className="combo-pop">✦ {combo} 连击！</span>}
                    {(objective ? grade?.correct : lastRating === '记得') ? '✦ 窥见真理 ✦' : '✗ 深渊侵蚀 ✗'}
                  </div>
                )}
                <div className={'answer-scroll-box ' + ((objective ? grade?.correct : lastRating === '记得') ? 'ok' : 'bad')}>
                  <h5>{(objective ? grade?.correct : lastRating === '记得') ? '◆ 正解' : '◆ 被掩盖的正解'}</h5>
                  <p>{objective ? (grade?.expected ?? q.answer) : q.answer}</p>
                  {q.explanation && <>
                    <p className="lab">【秘典解析】</p>
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
                    <p className="lab">【秘典解析】</p>
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
                🔍 解读符文
              </GiltBtn>
            ) : showAnswer ? (
              <div className="self-judge-row">
                <GiltBtn tone="teal" onClick={() => commitSelf(true)}>✓ 我答对了</GiltBtn>
                <GiltBtn tone="danger" onClick={() => commitSelf(false)}>✗ 我答错了</GiltBtn>
              </div>
            ) : (
              <GiltBtn size="lg" block className="reveal-btn" disabled={text.trim() === ''}
                onClick={() => { breakSeal(); setShowAnswer(true) }}>
                📜 展开参考答案卷轴
              </GiltBtn>
            ))}

            {answered && objective && !committed && (
              <>
                <h4>你的记忆状态？</h4>
                <div className="rate-row">
                  <button className="rate-btn r-forget" onClick={() => rate('忘记')}>忘记<small>被深渊侵蚀</small></button>
                  <button className="rate-btn r-hazy" onClick={() => rate('模糊')}>模糊<small>灵知游离</small></button>
                  <button className="rate-btn r-remember" onClick={() => rate('记得')}>记得<small>灵知铭刻</small></button>
                </div>
              </>
            )}

            {/* 评分即翻牌：已删除「下一卷」按钮，翻牌期间只给一行轻提示，避免牌底突然空掉 */}
            {committed && <p className="flip-hint">✦ 此卷已归档 · 正在发下一张牌 ✦</p>}
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

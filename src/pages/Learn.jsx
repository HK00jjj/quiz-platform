import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, peekRelearnResume } from '../store'
import { A } from '../assets'
import { GiltBtn, EmptyState, burstParticles, FlameIcon } from '../components'
import { IconRetry, IconShuffle, IconNew, IconFilter, IconLearn, IconImport } from '../components/CandyIcons'
import { buildSession, lastResultMap, TYPES, DIFFICULTIES, domainLabel, filtersKey } from '../lib/stats'
import { abilityOf, zoneAdvice, RANKS, PROMOTION_EXAM, MASTERY } from '../lib/ability.js'
import { gradeObjective } from '../lib/validate'
import { isDue } from '../lib/fsrs'
import { todayStr, streakLength } from '../lib/dates'

const DOMAINS_ALL = Array.from({ length: 27 }, (_, i) => `K${i + 1}`)

function FilterModal({ title, filters, onToggle, onClose, onStart, count, startLabel, note }) {
  const [dim, setDim] = useState('types')
  const dims = [
    { key: 'types', label: '题型', options: TYPES },
    { key: 'domains', label: '知识域', options: DOMAINS_ALL, text: domainLabel },
    { key: 'difficulties', label: '难度', options: DIFFICULTIES }
  ]
  /* 知识域 chip 的值仍是 K1~K27（筛选逻辑与 settings 里存的过滤器都认它），
     但显示走 text 换成中文域名——光看 K17 谁也不知道是什么（#8）。 */
  const cur = dims.find((d) => d.key === dim)
  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="收起">✕</button>
        <h3 style={{ letterSpacing: 4, color: 'var(--pink-ink)', marginBottom: 14, fontSize: 18 }}>{title}</h3>
        <div className="ach-tabs">
          {dims.map((d) => (
            <button key={d.key} className={'chip' + (dim === d.key ? ' on' : '')} onClick={() => setDim(d.key)}>
              {d.label}{filters[d.key]?.length ? ` · ${filters[d.key].length}` : ''}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <div className="chip-row">
            {cur.options.map((o) => (
              <button key={o} className={'chip' + (filters[dim]?.includes(o) ? ' on' : '')} onClick={() => onToggle(dim, o)}>
                {cur.text ? cur.text(o) : o}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <GiltBtn size="lg" onClick={onStart} disabled={count === 0}>
            {startLabel}（{count} 题）
          </GiltBtn>
          <GiltBtn tone="ghost" onClick={onClose}>返回</GiltBtn>
          {note && <span style={{ fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.3px' }}>{note}</span>}
        </div>
      </div>
    </div>
  )
}

/* 晋级赛弹窗（2026-09-09 晨改版：百分制——随机抽 100 道客观题（含图题不进考池、
   考池不足按池缩容），答对 ≥90%（即 90 分）晋级）。逐题作答即时判分。
   纯考试：不写 records / 不动 SRS / 不进 EWMA——考完由 onDone 把结果交回 Learn 结算。
   进度持久化：百题考试耗时较长，每答一题写 localStorage（qp-exam-progress），
   意外刷新/关闭后重开自动续考；交卷或放弃时清除。 */
const EXAM_PROGRESS_KEY = 'qp-exam-progress'

function ExamModal({ pool, target, size, passScore, onDone }) {
  const [deck] = useState(() => {
    const saved = JSON.parse(localStorage.getItem(EXAM_PROGRESS_KEY) ?? 'null')
    if (saved && Array.isArray(saved.ids)) {
      const byId = new Map(pool.map((q) => [q.id, q]))
      const rebuilt = saved.ids.map((id) => byId.get(id)).filter(Boolean)
      /* 续考有效性：题都在、进度未越界且考题数与当前考制一致——题库变更/改制则重考 */
      if (rebuilt.length === saved.ids.length && saved.ids.length === size && saved.round <= saved.ids.length) {
        return { qs: rebuilt, resume: saved }
      }
    }
    const a = [...pool]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
    return { qs: a.slice(0, size), resume: null }
  })
  const [round, setRound] = useState(deck.resume?.round ?? 0)
  const [wins, setWins] = useState(deck.resume?.wins ?? 0)
  const [input, setInput] = useState('')
  const [multi, setMulti] = useState([])
  const [verdict, setVerdict] = useState(null)
  const q = deck.qs[round]
  if (!q) return null
  const isChoice = q.type === '单选题' || q.type === '多选题'
  const isMulti = q.type === '多选题'
  const canSubmit = isMulti ? multi.length > 0 : input.trim().length > 0

  function saveProgress(nextRound, nextWins) {
    try { localStorage.setItem(EXAM_PROGRESS_KEY, JSON.stringify({ ids: deck.qs.map((x) => x.id), round: nextRound, wins: nextWins })) } catch { /* 存储满等异常不阻断考试 */ }
  }
  function submit() {
    const text = isMulti ? multi.join('') : input
    let g
    try { g = gradeObjective(q, text) } catch { g = { correct: true, expected: q.answer } }
    setVerdict(g)
    if (g.correct) setWins((w) => w + 1)
  }
  function nextRound() {
    const nextWins = wins + (verdict?.correct ? 1 : 0)
    if (round + 1 >= deck.qs.length) {
      localStorage.removeItem(EXAM_PROGRESS_KEY)
      onDone({ pass: nextWins >= passScore, wins: nextWins })
      return
    }
    saveProgress(round + 1, nextWins)
    setRound((r) => r + 1); setInput(''); setMulti([]); setVerdict(null)
  }

  return (
    <div className="modal-veil">
      <div className="modal-box exam-box">
        <div className="exam-head">
          <span>⚔️ 晋级赛 · 百分制 {deck.qs.length} 题考 {passScore} 分</span>
          <span className="exam-score">第 {round + 1}/{deck.qs.length} 题 · 已得 {wins} 分 · 冲击「{target.emoji} {target.name}」</span>
        </div>
        <div className="rank-bar" style={{ marginBottom: 12 }}><span style={{ width: `${Math.round((round / deck.qs.length) * 100)}%`, background: target.color }} /></div>
        <div className="exam-stem">{q.stem}</div>
        {isChoice && (q.options ?? []).map((raw, i) => {
          const letter = raw.match(/^([A-E])[.、]/)?.[1] ?? 'ABCDE'[i]
          const on = isMulti ? multi.includes(letter) : input === letter
          return (
            <button key={i} className={'exam-opt' + (on ? ' on' : '') + (verdict ? ' locked' : '')}
              disabled={!!verdict}
              onClick={() => isMulti
                ? setMulti((m) => m.includes(letter) ? m.filter((x) => x !== letter) : [...m, letter])
                : setInput(letter)}>
              <b>{letter}</b> {raw.replace(/^[A-E]\s*[.、]\s*/, '')}
            </button>
          )
        })}
        {q.type === '判断题' && ['正确', '错误'].map((v) => (
          <button key={v} className={'exam-opt' + (input === v ? ' on' : '') + (verdict ? ' locked' : '')}
            disabled={!!verdict} onClick={() => setInput(v)}>{v}</button>
        ))}
        {q.type === '填空题' && (
          <input className="exam-fill" value={input} disabled={!!verdict}
            onChange={(e) => setInput(e.target.value)} placeholder="作答（多空用「、」分隔）" />
        )}
        {verdict && (
          <div className={'exam-verdict ' + (verdict.correct ? 'ok' : 'bad')}>
            {verdict.correct ? '✓ 答对' : '✗ 答错'} · 正确答案：{verdict.expected}
            {q.explanation && <p>{q.explanation}</p>}
          </div>
        )}
        <div className="exam-foot">
          {!verdict ? (
            <GiltBtn size="sm" onClick={submit} disabled={!canSubmit}>提交本题</GiltBtn>
          ) : (
            <GiltBtn size="sm" onClick={nextRound}>{round + 1 >= deck.qs.length ? `交卷（${wins} 分）` : '下一题'}</GiltBtn>
          )}
          <button className="exam-quit" onClick={() => { localStorage.removeItem(EXAM_PROGRESS_KEY); onDone({ pass: false, wins, quit: true }) }}>放弃本场（算失败）</button>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>每题自动存进度，刷新后可续考</span>
        </div>
      </div>
    </div>
  )
}

/* 学习页 · 穹顶阅览厅 */
export default function Learn() {
  const navigate = useNavigate()
  const questions = useStore((s) => s.questions)
  const cards = useStore((s) => s.cards)
  const records = useStore((s) => s.records)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const startSession = useStore((s) => s.startSession)
  const [openFilter, setOpenFilter] = useState(null) // 'relearn' | 'learn'

  const now = useMemo(() => Date.now(), [])  // §67 挂载期固定：now 每渲染变化会让下方 useMemo 全部失效
  const today = todayStr()
  const dates = useMemo(() => [...new Set(records.map((r) => r.date))], [records])
  const streak = streakLength(dates, today)
  const doneToday = useMemo(() => records.filter((r) => r.date === today).length, [records, today])
  /* 计数必须「书本作用域」：questions 已按当前书过滤，但 cards/records 是全局的
     （review_cards 以 questionId 为键，无 book_id 列）。旧写法 newCount = questions.length - cards.length
     会把其他书或历史遗留的卡片也算进分母——导入新题后 newCount 掉到 0 甚至负数，
     表现就是「新题上手」误报"全部题目都做过了"（2026-09-07 用户实测）。 */
  const bookCardIds = useMemo(() => new Set(questions.map((q) => q.id)), [questions])
  const dueCount = useMemo(() => cards.filter((c) => bookCardIds.has(c.questionId) && isDue(c, now)).length, [cards, bookCardIds, now])
  const newCount = useMemo(() => questions.reduce((n, q) => n + (cards.some((c) => c.questionId === q.id) ? 0 : 1), 0), [questions, cards])
  const lastMap = useMemo(() => lastResultMap(records), [records])
  const wrongCount = useMemo(() => questions.filter((q) => lastMap.get(q.id) === false).length, [questions, lastMap])

  const relearnFilters = settings.relearnFilters ?? {}
  const learnFilters = settings.learnFilters ?? {}
  /* §61 增量续练：弹窗计数按「当前重算」口径显示，并 peek 断点给出续练提示
     （断点剩余 R 题 + 新增 N 题将排在末尾——避免 379/260 两本账对不上的困惑） */
  const relearnList = useMemo(
    () => buildSession(questions, cards, records, { mode: 'relearn', size: 1e5, now, ...relearnFilters }),
    [questions, cards, records, now, relearnFilters])
  const relearnCount = relearnList.length
  const resumePeek = useMemo(() => peekRelearnResume(filtersKey(relearnFilters)), [relearnFilters, questions])
  const resumeNote = useMemo(() => {
    if (!resumePeek) return null
    const newN = relearnList.filter((q) => !resumePeek.savedIds.has(q.id)).length
    if (resumePeek.remaining <= 0 && newN === 0) return null
    return newN > 0
      ? `断点续练：剩余 ${resumePeek.remaining} 题，新增 ${newN} 题将排在末尾`
      : `断点续练：将从第 ${resumePeek.savedCount - resumePeek.remaining + 1} 题继续`
  }, [resumePeek, relearnList])
  const randomCount = Math.min(20, questions.length)
  /* 能力指数（自适应匹配）：EWMA 于每次作答即时更新。数据源是全部带对错字段的
     作答记录——客观题为机器判分，主观题自评也写 correct（记得=true/忘记=false），
     同样计入指数与掌握度；自评宽松会抬高指数，这是已知边界（store.submitSubjective）。 */
  const ability = useMemo(() => abilityOf(records), [records])
  const advice = useMemo(() => zoneAdvice(records), [records])
  /* 排位系统（LOL 式晋级赛，2026-09-09 晨改版考制）：
     - 段位从黑铁起步（settings.rank 持久化官方段位），晋级只能一级一级考上去，不能跳段；
     - 晋级赛触发：题库所有题自上次考试（settings.lastExamAt）后都刷过一遍（=彻底过一遍知识点）
       + 状态指数 ≥ 下一段位门槛；
     - 百分制考制：随机抽 100 道客观题（含图题不进——脱离配图没法判分；考池不足按池缩容），
       答对 ≥90%（即 90 分）晋级一段；进度存 localStorage 可续考；
     - 通过 → 官方段位 +1；失败 → lastExamAt 重置 = 必须"再刷一遍题"才能再次触发；
     - 考试作答不写 records：不污染 EWMA 能力指数与复习计划，纯考试。 */
  const [examOpen, setExamOpen] = useState(false)
  const [promo, setPromo] = useState(null)
  const promoTimer = useRef(null)
  const rank = useMemo(() => {
    const official = RANKS.find((r) => r.name === (settings.rank ?? '黑铁')) ?? RANKS[0]
    const next = RANKS[RANKS.indexOf(official) + 1] ?? null
    const since = settings.lastExamAt ?? 0
    /* 掌握度三闸（MASTERY 标准，2026-09-09 晨）：
       覆盖率 100% + 逐题掌握率（本轮每题最近一次作答答对）≥95% + 知识点正确率（≥3 次作答者）≥85% */
    const latest = new Map()
    const kpStats = new Map()
    for (const r of records) {
      if (r.timestamp <= since) continue
      const prev = latest.get(r.questionId)
      if (!prev || r.timestamp > prev.timestamp) latest.set(r.questionId, r)
    }
    const doneN = questions.filter((q) => latest.has(q.id)).length
    const covered = questions.length > 0 && doneN === questions.length
    const masteredN = questions.filter((q) => latest.get(q.id)?.correct === true).length
    const itemRate = questions.length ? masteredN / questions.length : 0
    const qKp = new Map(questions.map((q) => [q.id, q.knowledgePoint ?? '未标注']))
    for (const r of records) {
      if (r.timestamp <= since) continue
      const kp = qKp.get(r.questionId)
      if (!kp) continue
      const s = kpStats.get(kp) ?? { n: 0, c: 0 }
      s.n++; if (r.correct) s.c++
      kpStats.set(kp, s)
    }
    const kpArr = [...kpStats.values()].filter((s) => s.n >= MASTERY.KP_MIN)
    const kpTotal = kpArr.length
    const kpOK = kpArr.filter((s) => s.c / s.n >= MASTERY.KP_ACC).length
    const kpPass = kpTotal === 0 || kpOK === kpTotal
    const masteryReady = itemRate >= MASTERY.ITEM_RATE && kpPass
    const p = Math.round(ability * 100)
    const threshold = next ? next.lo : null
    const objPool = questions.filter((q) => ['单选题', '多选题', '判断题', '填空题'].includes(q.type) && !q.image)
    const examSize = Math.min(PROMOTION_EXAM.SIZE, objPool.length)
    const passScore = Math.ceil(examSize * PROMOTION_EXAM.PASS_RATE)
    let examSaved = null
    try {
      const s = JSON.parse(localStorage.getItem(EXAM_PROGRESS_KEY) ?? 'null')
      if (s && Array.isArray(s.ids) && s.ids.length === examSize && s.round <= examSize) examSaved = s
    } catch { /* 损坏进度视同无续考 */ }
    return { official, next, since, doneN, total: questions.length, covered, masteredN, itemRate, kpTotal, kpOK, kpPass, masteryReady, p, threshold, examSize, passScore, examSaved, objPool, examReady: covered && masteryReady && threshold !== null && p >= threshold && objPool.length >= 10 }
  }, [questions, records, settings.rank, settings.lastExamAt, ability])

  function finishExam({ pass, wins }) {
    setExamOpen(false)
    const { official, next, passScore, examSize } = rank
    if (pass && next) {
      updateSettings({ rank: next.name, lastExamAt: Date.now() })
      setPromo({ kind: 'promo', title: `晋级成功！${official.emoji} ${official.name} → ${next.emoji} ${next.name}`, sub: `百分制 ${examSize} 题考得 ${wins} 分（≥${passScore} 过线）。段位只能一级一级考上去——继续刷，向着最强王者进发。题库已全部刷穿：去导入页发下一批源题，难度随新源题上台阶` })
    } else {
      updateSettings({ lastExamAt: Date.now() })
      setPromo({ kind: 'demote', title: `晋级失败（${wins} 分 / ${passScore} 分线）：${official.emoji} ${official.name}`, sub: `差 ${Math.max(0, passScore - wins)} 分。晋级条件重新计数——把题库再刷一遍，就能再次挑战「${next?.name ?? '下一段位'}」` })
    }
    if (promoTimer.current) clearTimeout(promoTimer.current)
    promoTimer.current = setTimeout(() => setPromo(null), 8000)
  }

  async function run(mode, opts = {}) {
    const n = await startSession(mode, opts)
    if (n > 0) navigate('/practice')
  }
  // 「开始今日练习」优先链：到期复习 → 错题 → 新题 → 随机（按交接要求保留）
  const hero = dueCount > 0
    ? { sub: `${dueCount} 道题到期，该复习了`, run: () => run('review', { size: 20 }) }
    : wrongCount > 0
      ? { sub: `${wrongCount} 道错题等着重练`, run: () => run('wrong', { size: 20 }) }
      : newCount > 0
        ? { sub: `${newCount} 道新题还没做过`, run: () => run('learn') }
        : { sub: '今天也来练几道，保持手感', run: () => run('random', { size: 20 }) }

  function toggleFilter(scope, dim, value) {
    const key = scope === 'relearn' ? 'relearnFilters' : 'learnFilters'
    const cur = { ...(scope === 'relearn' ? relearnFilters : learnFilters) }
    const list = cur[dim] ?? []
    cur[dim] = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    updateSettings({ [key]: cur })
  }

  if (questions.length === 0) {
    return (
      <div className="page-wrap">
        <div className="panel">
          <EmptyState
            img={A.emptyShelf}
            title="题库还是空的"
            hint="把外部 AI 生成的题目 JSON 导入到导入页，就可以开始做题、间隔复习与错题重练。"
            action={<GiltBtn size="lg" onClick={() => navigate('/import')}><IconImport /> 去导入</GiltBtn>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <div className="learn-banner">
        <div className="brand"><IconLearn /> 糖果题库</div>
        {doneToday > 0 ? (
          <span className="tag teal" style={{ fontSize: 13, padding: '6px 14px' }}>
            ✦ 今日已做题，成长值累积中 <FlameIcon />
          </span>
        ) : (
          <GiltBtn size="sm" onClick={(e) => {
            burstParticles(e.clientX, e.clientY, 'gold', 14)
            hero.run()
          }}><IconRetry /> 继续累积</GiltBtn>
        )}
      </div>

      {/* 糖果橱窗横幅（取代哥特巫师位图 A.hallVision）：纯 CSS，零位图零请求。
          三颗糖豆 + 一支旋转棒棒糖做氛围，幅度极小，不抢标题注意力 */}
      <div className="learn-vision candy-hero rise">
        <span className="ch-candy c1" aria-hidden="true" />
        <span className="ch-candy c2" aria-hidden="true" />
        <span className="ch-candy c3" aria-hidden="true" />
        <span className="ch-candy c4" aria-hidden="true" />
        <span className="ch-lolli" aria-hidden="true" />
        {/* 原来这里只有一个居中浮动的 caption 胶囊，整条 ~200px 渐变带大片留白显得没做完。
            改成左文右糖：左边真标题 + 副标，右边糖豆聚成一簇（位置在 candy.css 里重排）。 */}
        <div className="hero-copy">
          <h2>今天想练点什么？</h2>
          <p>{questions.length} 道题在架上{streak > 0 ? ` · 已连续学习 ${streak} 天` : ''}</p>
        </div>
      </div>

      {/* 晋级赛横幅：考试结束时的晋级/失败播报，8 秒自动消失 */}
      {promo && (
        <div className={'promo-banner rise' + (promo.kind === 'demote' ? ' promo-demote' : '')}>
          <span className="promo-emoji" aria-hidden="true">{promo.kind === 'promo' ? '🏆' : '🔁'}</span>
          <div className="zone-copy">
            <h4>{promo.title}</h4>
            <p>{promo.sub}</p>
          </div>
        </div>
      )}

      {/* 排位卡（LOL 式晋级赛）：官方段位只通过五局三胜考试获得，一级一级往上考 */}
      <div className="rank-card rise">
        <span className="rank-badge" style={{ borderColor: rank.official.color }}>
          <span className="rank-emoji" aria-hidden="true">{rank.official.emoji}</span>
        </span>
        <div className="rank-info">
          <h4 style={{ color: rank.official.color }}>
            当前段位：{rank.official.name}{rank.next ? '' : ' · 已到顶'}
          </h4>
          {rank.next && (
            <div className="rank-bar">
              <span style={{ width: `${Math.min(100, Math.round((rank.p / rank.next.lo) * 100))}%`, background: rank.official.color }} />
            </div>
          )}
          <p>
            状态指数 {rank.p}{rank.next ? `（晋级门槛 ${rank.next.lo}）` : ''}
            {' · '}覆盖 {rank.doneN}/{rank.total}
            {' · '}逐题掌握 {Math.round(rank.itemRate * 100)}%（≥{Math.round(MASTERY.ITEM_RATE * 100)}）
            {' · '}知识点达标 {rank.kpTotal === 0 ? '—' : `${rank.kpOK}/${rank.kpTotal}`}（≥{Math.round(MASTERY.KP_ACC * 100)}%）
          </p>
          {!rank.examReady && (
            <p className="rank-hint">
              距晋级赛还差：{[
                rank.covered ? null : `刷完 ${rank.total - rank.doneN} 道未刷题`,
                rank.itemRate >= MASTERY.ITEM_RATE ? null : `错题重练（${rank.total - rank.masteredN} 题最近一次未答对）`,
                rank.kpPass ? null : `${rank.kpTotal - rank.kpOK} 个知识点正确率未达 ${Math.round(MASTERY.KP_ACC * 100)}%`,
                rank.threshold === null || rank.p >= rank.threshold ? null : `状态指数升到 ${rank.threshold}`
              ].filter(Boolean).join('；') || '—'}
            </p>
          )}
          {advice.level === 'too-easy' && (
            <p className="rank-hint">⚡ 近 30 题正确率 {Math.round(advice.recentAcc * 100)}%——题库对你已偏易，去导入更高水平源题继续上分</p>
          )}
          {advice.level === 'too-hard' && (
            <p className="rank-hint">🛟 近 30 题正确率 {Math.round(advice.recentAcc * 100)}%——题库偏难，可导入降阶源题先回血</p>
          )}
          {/* 晋级→再导入联动（2026-09-09）：题库刷穿且掌握达标、但还考不了晋级赛
             （指数未到门槛或刚晋完级）→ 提醒发新源题。措辞守 v4.10 红线：
             段位只做提醒信号，难度仍由 kpProfile verdict + 新源题自身难度档决定，
             不承诺"段位到了题自动变难"。导入后新题计入覆盖闸，晋级周期自动重开。 */}
          {rank.next && rank.covered && rank.masteryReady && !rank.examReady && (
            <p className="rank-hint">📚 题库已全部刷穿——去导入页发下一批源题，难度随新源题上台阶（导入后晋级周期自动重开）</p>
          )}
        </div>
        {rank.examReady && (
          <GiltBtn size="sm" onClick={() => setExamOpen(true)}>
            {rank.examSaved ? `⚔️ 续考晋级赛（第 ${rank.examSaved.round + 1}/${rank.examSize} 题，已得 ${rank.examSaved.wins} 分）` : '⚔️ 进入晋级赛'}
          </GiltBtn>
        )}
      </div>

      <div className="panel deep" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 10 }} aria-hidden="true">
          <span className="tag teal"><IconNew /></span>
          <span className="tag">今 日 复 习</span>
          <span className="tag teal"><IconNew /></span>
        </div>
        <GiltBtn size="lg" className="block" style={{ maxWidth: 420, margin: '0 auto' }} onClick={hero.run}>
          <IconLearn /> 开始今日练习
        </GiltBtn>
        <p style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)', letterSpacing: 1 }}>{hero.sub}</p>
        {streak > 0 && (
          <p style={{ marginTop: 6, fontSize: 12, color: 'var(--pink-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <FlameIcon /> 已连续学习 {streak} 天
          </p>
        )}
      </div>

      <div className="entry-grid">
        {/* 四段文案改成糖果主题的直白说法（#2）：原来的「污染重阅 / 被酸糖低语侵蚀的符文 /
            无放回抽取 20 卷 / 切牌筛选」是哥特卡牌词汇，看不出到底在干什么。
            .art 空 div 一并删掉——哥特插图早没了，留着只白占 150px 高度。 */}
        <div className={'entry-card rise' + (wrongCount > 0 ? ' hot' : '')} style={{ animationDelay: '.08s' }}
          onClick={() => wrongCount > 0 && run('wrong', { size: 0 })}>
          <span className="entry-ico ico-red" aria-hidden="true"><IconRetry /></span>
          <h3>错题重练</h3>
          <p>{wrongCount > 0 ? `答错过的 ${wrongCount} 道 · 再练一遍就记牢了` : '暂时没有错题，保持住'}</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.16s' }} onClick={() => run('random', { size: 20 })}>
          <span className="entry-ico ico-yellow" aria-hidden="true"><IconShuffle /></span>
          <h3>智能匹配练习</h3>
          <p>按你的水平挑 {randomCount} 道（目标答对率 65~85%，随段位下移）· 状态指数 {rank.p} · 段位 {rank.official.name}</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.24s' }} onClick={() => newCount > 0 && run('learn')}>
          <span className="entry-ico ico-mint" aria-hidden="true"><IconNew /></span>
          <h3>新题上手</h3>
          <p>{newCount > 0 ? `${newCount} 道还没做过 · 做完自动排进复习计划` : '全部题目都做过了'}</p>
        </div>
        <div className="entry-card rise" style={{ animationDelay: '.32s' }} onClick={() => setOpenFilter('relearn')}>
          <span className="entry-ico ico-lav" aria-hidden="true"><IconFilter /></span>
          <h3>挑题练习</h3>
          <p>按题型、知识域、难度筛出想练的题 · 共 {relearnCount} 道</p>
        </div>
      </div>

      {/* 星象悬浮入口已删：📊「星象观测」属于哥特世界观，与糖果主题不符。
          /stats 路由保留，仍可直接访问 #/stats；以后想要统计页就重新给一个糖果入口 */}

      {openFilter === 'relearn' && (
        <FilterModal
          title="🍬 挑题练习 · 按条件筛选"
          filters={relearnFilters}
          onToggle={(dim, v) => toggleFilter('relearn', dim, v)}
          onClose={() => setOpenFilter(null)}
          count={relearnCount}
          startLabel="开始练习"
          note={resumeNote}
          onStart={() => { setOpenFilter(null); run('relearn', { size: 0, ...relearnFilters }) }}
        />
      )}

      {/* 晋级赛考试弹窗：examReady 已保证 next 存在、考池 ≥10 题（不足 100 按池缩容） */}
      {examOpen && (
        <ExamModal pool={rank.objPool} target={rank.next} size={rank.examSize} passScore={rank.passScore} onDone={finishExam} />
      )}
    </div>
  )
}

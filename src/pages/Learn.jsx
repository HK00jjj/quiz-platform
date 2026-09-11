import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, peekRelearnResume } from '../store'
import { A } from '../assets'
import { GiltBtn, EmptyState, burstParticles, FlameIcon } from '../components'
import { IconRetry, IconShuffle, IconNew, IconFilter, IconLearn, IconImport } from '../components/CandyIcons'
import { buildSession, lastResultMap, TYPES, DIFFICULTIES, domainLabel, filtersKey } from '../lib/stats'
import { abilityOf, zoneAdvice, RANKS, PROMOTION_EXAM, MASTERY, EXAM_ATTEMPTS, EXAM_WRONGS_KEY } from '../lib/ability.js'
import { gradeObjective } from '../lib/validate'
import { isDue } from '../lib/fsrs'
import { recallDue, buildRecallItems, weakDomains, RECALL_GRADES } from '../lib/recall'
import { shouldSnapshot, buildSnapshot, pushSnapshot, trendOf } from '../lib/snapshot'
import { todayStr, streakLength } from '../lib/dates'
import { repo } from '../lib/db'

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

/* 晋级赛弹窗（2026-09-09 晨改版：百分制——随机抽 100 道客观题（考池不足按池缩容），
   答对 ≥90%（即 90 分）晋级。逐题作答即时判分（**仅作答题反馈展示**）。
   2026-09-11 §3.2 服务端化：开考调 exam_start RPC（服务端在候选池内随机抽题并登记
   attempt），交卷调 exam_submit RPC（服务端以 questions.answer 为唯一真值判分并结算
   段位状态机）——客户端自报的对错只影响答题过程展示，不再决定晋级。
   进度持久化：每答一题写 localStorage（qp-exam-progress，含 attemptId——续考必须复用
   同一 attempt，重复开考会留下孤儿 attempt）。交卷或放弃时清除。 */
const EXAM_PROGRESS_KEY = 'qp-exam-progress'
/* 考试错题单的**旧存储位**。2026-09-11 审查整改：真源迁到云端 settings.examWrongs——
   原先纯 localStorage 时，删掉这个键即可直接绕过闸④（上场考试错题消号），
   段位可信度被削弱。这里保留读取只为把旧值**一次性迁移上云**，迁移后不再写入。 */
function legacyExamWrongs() {
  try {
    const w = JSON.parse(localStorage.getItem(EXAM_WRONGS_KEY) ?? 'null')
    return (w && Array.isArray(w.ids) && typeof w.failedAt === 'number') ? w : null
  } catch { return null }
}

function ExamModal({ pool, target, size, passScore, onDone }) {
  /* 服务端化重构：deck 由 RPC 异步产出（原为 useState 同步初始化）。
     phase: loading → ready / error。attemptId 必须随进度持久化——续考复用同一 attempt。 */
  const [deck, setDeck] = useState(null)          // { qs, attemptId }
  const [examErr, setExamErr] = useState(null)
  const [sending, setSending] = useState(false)   // 交卷 RPC 在途
  const [round, setRound] = useState(0)
  const [wins, setWins] = useState(0)
  /* 错题跟踪（v6.1）：本场答错的题 id 列表——仅用于过程展示与续考恢复，
     最终错题单以服务端 exam_submit 返回的 wrong_ids 为准。 */
  const [wrongIds, setWrongIds] = useState([])
  const [answers, setAnswers] = useState({})      // {qid: 最终提交的答案文本}
  const [input, setInput] = useState('')
  const [multi, setMulti] = useState([])
  const [verdict, setVerdict] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const saved = JSON.parse(localStorage.getItem(EXAM_PROGRESS_KEY) ?? 'null')
      if (saved && saved.attemptId && Array.isArray(saved.ids)) {
        const byId = new Map(pool.map((x) => [x.id, x]))
        const rebuilt = saved.ids.map((id) => byId.get(id)).filter(Boolean)
        /* 续考有效性：attemptId 在、题都在、进度未越界且考题数与当前考制一致。
           （round < 上界 的防御性语义见 2026-09-11 修复注：round 是 0 基下标。） */
        if (rebuilt.length === saved.ids.length && saved.ids.length === size && saved.round < saved.ids.length) {
          if (!alive) return
          setDeck({ qs: rebuilt, attemptId: saved.attemptId })
          setRound(saved.round); setWins(saved.wins ?? 0)
          setWrongIds(saved.wrongs ?? []); setAnswers(saved.answers ?? {})
          return
        }
      }
      try {
        const v = await repo.examStart(size, pool.map((x) => x.id))
        const byId = new Map(pool.map((x) => [x.id, x]))
        const qs = (v.question_ids ?? []).map((id) => byId.get(id)).filter(Boolean)
        if (!alive) return
        if (qs.length < 10) { setExamErr('服务端考池不足（<10）'); return }
        setDeck({ qs, attemptId: v.attempt_id })
      } catch (e) {
        if (alive) setExamErr(String(e?.message ?? e))
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (examErr) return (
    <div className="modal-veil">
      <div className="modal-box exam-box">
        <div className="exam-head"><span>⚔️ 晋级赛</span></div>
        <p style={{ color: 'var(--bad, #c0392b)', fontSize: 14 }}>开考失败（fail-closed：服务端不可用时不降级到本地判分）：{examErr}</p>
        <GiltBtn size="sm" onClick={() => onDone({ aborted: true })}>关闭</GiltBtn>
      </div>
    </div>
  )
  if (!deck) return (
    <div className="modal-veil">
      <div className="modal-box exam-box">
        <div className="exam-head"><span>⚔️ 晋级赛 · 服务端抽题中…</span></div>
        <div className="rank-bar"><span style={{ width: '40%', background: target.color }} /></div>
      </div>
    </div>
  )

  const q = deck.qs[round]
  if (!q) return null
  const isChoice = q.type === '单选题' || q.type === '多选题'
  const isMulti = q.type === '多选题'
  const canSubmit = isMulti ? multi.length > 0 : input.trim().length > 0

  function saveProgress(nextRound, nextWins, nextWrongs, nextAnswers) {
    try { localStorage.setItem(EXAM_PROGRESS_KEY, JSON.stringify({ attemptId: deck.attemptId, ids: deck.qs.map((x) => x.id), round: nextRound, wins: nextWins, wrongs: nextWrongs, answers: nextAnswers })) } catch { /* 存储满等异常不阻断考试 */ }
  }
  function submit() {
    const text = isMulti ? multi.join('') : input
    let g
    try { g = gradeObjective(q, text) } catch { g = { correct: false, expected: q.answer ?? '—' } } // fail-closed：异常按答错计（仅展示层面）
    setVerdict(g)
    setAnswers((a) => ({ ...a, [q.id]: text }))
    if (g.correct) setWins((w) => w + 1)
    else setWrongIds((w) => (w.includes(q.id) ? w : [...w, q.id]))
  }
  function nextRound() {
    /* 得分口径修复（2026-09-09 v4.13）：submit() 已通过 setWins 把本题得分计入 wins，
       此处不再重复计分（nextWins 直接取 wins）。 */
    const nextWins = wins
    const nextWrongIds = wrongIds
    const nextAnswers = { ...answers, [q.id]: (isMulti ? multi.join('') : input) }
    if (round + 1 >= deck.qs.length) {
      sendVerdict(nextWins, nextWrongIds, nextAnswers, false)
      return
    }
    saveProgress(round + 1, nextWins, nextWrongIds, nextAnswers)
    setRound((r) => r + 1); setInput(''); setMulti([]); setVerdict(null)
  }
  /* 交卷/放弃统一走服务端结算。放弃=把已答部分上交（服务端按实际得分判失败），
     保证"放弃算失败"由服务端记账，客户端不再自扣补考次数。 */
  async function sendVerdict(nextWins, nextWrongIds, finalAnswers, quit) {
    if (sending) return
    setSending(true)
    try {
      const v = await repo.examSubmit(deck.attemptId, finalAnswers)
      localStorage.removeItem(EXAM_PROGRESS_KEY)
      onDone({ server: v, quit, wins: nextWins, wrongIds: nextWrongIds })
    } catch (e) {
      setSending(false)
      setExamErr('结算失败：' + String(e?.message ?? e) + '——进度已保留，重开考试可续考后再次交卷')
    }
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
            <GiltBtn size="sm" onClick={nextRound} disabled={sending}>{sending ? '服务端结算中…' : (round + 1 >= deck.qs.length ? `交卷（${wins} 分）` : '下一题')}</GiltBtn>
          )}
          <button className="exam-quit" disabled={sending} onClick={() => sendVerdict(wins, wrongIds, { ...answers, [q.id]: (isMulti ? multi.join('') : input) }, true)}>放弃本场（算失败）</button>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>每题自动存进度，刷新后可续考；判分与段位由服务端结算</span>
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
  /* 排位系统（LOL 式晋级赛，2026-09-09 午后二改四闸版）：
     - 段位从黑铁起步（settings.rank 持久化官方段位），晋级只能一级一级考上去，不能跳段；
     - 晋级赛触发（四闸合取）：① 本轮（自 settings.lastExamAt 起）全库刷过一遍（覆盖 100%）
       ② 逐题掌握率 ≥95%（本轮每题最近一次作答答对）③ 知识点正确率（≥3 次作答者）≥95%
       ④ 上场考试错题已在练习中答对消号；
       持久性闸（≥3 天）与状态指数门槛已按用户指令取消——指数只展示不作门槛；
     - 百分制考制：随机抽 100 道客观题（含图题不进——脱离配图没法判分；考池不足按池缩容），
       答对 ≥90%（即 90 分）晋级一段；进度存 localStorage 可续考；
     - 补考机会：每周期 3 次（EXAM_ATTEMPTS，settings.examFails 计失败次数）。通过 → 段位 +1
       且计数清零；失败 → 本场错题记入"错题重练"（练习中答对即消），资格保留可补考；
       3 次全败 → 周期作废：lastExamAt 重置（覆盖/掌握进度清零）、错题单作废、计数归零，
       重新刷穿全库再来（用户裁决："输了3次补考机会，用完重来"）；
     - 考试作答不写 records：不污染 EWMA 能力指数与复习计划，纯考试。 */
  const [examOpen, setExamOpen] = useState(false)
  const [promo, setPromo] = useState(null)
  const promoTimer = useRef(null)
  const rank = useMemo(() => {
    const official = RANKS.find((r) => r.name === (settings.rank ?? '黑铁')) ?? RANKS[0]
    const next = RANKS[RANKS.indexOf(official) + 1] ?? null
    const since = settings.lastExamAt ?? 0
    /* 掌握度三闸（MASTERY 标准，2026-09-09 午后二改）：
       覆盖率 100% + 逐题掌握率（本轮每题最近一次作答答对）≥95% + 知识点正确率（≥3 次作答者）≥95% */
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
    /* 晋级失败错题重练：考试错题练习中答对即消——failedAt 之后该题出现 correct=true 记录即清除。
       2026-09-11：错题单改读云端 settings.examWrongs。
       ⚠ 必须区分 undefined 与 null：undefined=从未设置（回落读旧 localStorage 值以便迁移），
       null=已显式清空（晋级成功/周期作废）——若用 `??` 两者都会回落到旧键，清空后旧错题单会"复活"。 */
    const examWrongs = settings.examWrongs === undefined ? legacyExamWrongs() : settings.examWrongs
    const cleared = new Set(records.filter((r) => r.correct === true && r.timestamp > (examWrongs?.failedAt ?? 0)).map((r) => r.questionId))
    const qIds = new Set(questions.map((q) => q.id))
    const pendingWrongN = examWrongs ? examWrongs.ids.filter((id) => qIds.has(id) && !cleared.has(id)).length : 0
    const p = Math.round(ability * 100)
    /* 补考机会（2026-09-09 午后二改）：每周期 EXAM_ATTEMPTS 次，settings.examFails 计已败次数。
       第 EXAM_ATTEMPTS 次失败时结算直接作废周期，此处 examFails 正常取值 0~2。 */
    const examFails = Number.isInteger(settings.examFails) && settings.examFails > 0 ? settings.examFails : 0
    const chancesLeft = Math.max(0, EXAM_ATTEMPTS - examFails)
    const objPool = questions.filter((q) => ['单选题', '多选题', '判断题', '填空题'].includes(q.type) && !q.image)
    const examSize = Math.min(PROMOTION_EXAM.SIZE, objPool.length)
    const passScore = Math.ceil(examSize * PROMOTION_EXAM.PASS_RATE)
    let examSaved = null
    try {
      const s = JSON.parse(localStorage.getItem(EXAM_PROGRESS_KEY) ?? 'null')
      if (s && Array.isArray(s.ids) && s.ids.length === examSize && s.round < examSize) examSaved = s
    } catch { /* 损坏进度视同无续考 */ }
    return { official, next, since, doneN, total: questions.length, covered, masteredN, itemRate, kpTotal, kpOK, kpPass, masteryReady, pendingWrongN, p, examFails, chancesLeft, examSize, passScore, examSaved, objPool, examReady: covered && masteryReady && pendingWrongN === 0 && next !== null && objPool.length >= 10 }
  }, [questions, records, settings.rank, settings.lastExamAt, settings.examFails, settings.examWrongs, ability])

  /* 考试错题单一次性迁移上云（2026-09-11）：旧 localStorage 值存在而云端没有时搬过去，
     搬完删掉本地键——此后闸④的状态不再由客户端单独持有。只跑一次，迁移后不再触发。 */
  useEffect(() => {
    if (settings.examWrongs) return
    const legacy = legacyExamWrongs()
    if (!legacy) return
    updateSettings({ examWrongs: legacy })
    try { localStorage.removeItem(EXAM_WRONGS_KEY) } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* P3 水平快照：挂载时若距上一份 ≥20h 就补一份（一天最多一份）进 settings.snapshots
     （云同步、封顶 60 份）。只读现状，不碰任何闸门——趋势仅展示。 */
  useEffect(() => {
    const snaps = settings.snapshots ?? []
    if (!shouldSnapshot(snaps, now)) return
    updateSettings({ snapshots: pushSnapshot(snaps, buildSnapshot(now, {
      ability, rankName: rank.official.name, total: questions.length, doneN: rank.doneN, recentAcc: advice.recentAcc
    })) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const trend = useMemo(() => trendOf(settings.snapshots, now), [settings.snapshots, now])
  /* 迷你走势：最近 12 份快照的指数折线（不足 2 份不画） */
  const spark = useMemo(() => {
    const list = (settings.snapshots ?? []).slice(-12)
    if (list.length < 2) return null
    const W = 120, H = 30, PAD = 2
    const ps = list.map((s) => Math.max(0, Math.min(100, s.p ?? 0)))
    const min = Math.min(...ps), span = Math.max(5, Math.max(...ps) - min)
    const line = ps.map((p, i) => `${(PAD + (i / (ps.length - 1)) * (W - 2 * PAD)).toFixed(1)},${(H - PAD - ((p - min) / span) * (H - 2 * PAD)).toFixed(1)}`).join(' ')
    return { W, H, line }
  }, [settings.snapshots])

  /* P2 自由回忆周检：每周一次的主动提取自检（engram 机制迁移）。
     结果进 settings.recallLog（云同步）；未达「讲得清」的域给出直达练习入口。 */
  const [recallPick, setRecallPick] = useState({})
  const recallLog = settings.recallLog ?? []
  const lastRecall = recallLog.length ? recallLog[recallLog.length - 1] : null
  const recallItems = useMemo(() => buildRecallItems(questions, records, now), [questions, records, now])
  const needRecall = useMemo(() => recallDue(lastRecall, records, now) && recallItems.length > 0, [lastRecall, records, now, recallItems])
  const weakKp = useMemo(() => weakDomains(lastRecall), [lastRecall])
  function submitRecall(skipped) {
    const items = skipped ? [] : recallItems.map((it) => ({ domain: it.domain, n: it.n, grade: recallPick[it.domain] }))
    updateSettings({ recallLog: [...recallLog, { at: Date.now(), items }] })
    setRecallOpen(false)
    setRecallPick({})
  }

  /* 考试结算（2026-09-11 §3.2 服务端化）：晋级/补考/周期作废全部由服务端
     exam_submit RPC 判定并写入 exam_state（客户端对该表无任何写策略，实测直写 403）。
     本函数只做两件事：把服务端结论**镜像**进 settings（rank/examFails/lastExamAt/examWrongs
     ——闸④消号与四闸统计仍读 settings，镜像让既有 UI 零改动），并渲染结算文案。 */
  function finishExam({ server, quit, wins, wrongIds = [] }) {
    setExamOpen(false)
    if (!server) return // 开考失败被关闭（fail-closed，无服务端记录，不产生任何状态变化）
    const { official, next, passScore, examSize } = rank
    if (server.passed && next) {
      updateSettings({ rank: server.new_rank, lastExamAt: Date.now(), examFails: 0, examWrongs: null })
      setPromo({ kind: 'promo', title: `晋级成功！${official.emoji} ${official.name} → ${(RANKS.find((r) => r.name === server.new_rank) ?? next).emoji} ${server.new_rank}`, sub: `服务端判分：${server.score}/${server.total}（≥${passScore} 过线）。段位只能一级一级考上去——继续刷，向着最强王者进发` })
    } else if (server.passed) {
      /* 已在最强王者：通过不再升段，服务端仅重置周期 */
      updateSettings({ lastExamAt: Date.now(), examFails: 0, examWrongs: null })
      setPromo({ kind: 'promo', title: `守擂成功！${official.emoji} ${official.name}`, sub: `服务端判分：${server.score}/${server.total}。已是最高段位——继续保持` })
    } else if (server.chances_left >= EXAM_ATTEMPTS) {
      /* 第 3 次失败：服务端已作废周期（examFails 归零/lastExamAt 重置/错题清空），客户端镜像 */
      updateSettings({ examFails: 0, lastExamAt: Date.now(), examWrongs: null })
      setPromo({ kind: 'demote', title: `补考机会用完（${EXAM_ATTEMPTS} 战 ${EXAM_ATTEMPTS} 败）：晋级周期重新开始`, sub: `${quit ? '放弃本场' : '本场'} 服务端判分 ${server.score} / ${server.total} 题（${passScore} 分线）。本周期作废——覆盖与掌握进度已清零，错题单已作废，请重新刷穿全库再挑战「${next?.name ?? '下一段位'}」` })
    } else {
      const fails = EXAM_ATTEMPTS - server.chances_left
      updateSettings({ examFails: fails, examWrongs: { failedAt: Date.now(), ids: server.wrong_ids ?? [] } })
      setPromo({ kind: 'demote', title: `${quit ? '放弃本场' : '晋级失败'}（服务端判分 ${server.score} / ${server.total} 题，${passScore} 分线）：${official.emoji} ${official.name}`, sub: (server.wrong_ids ?? []).length ? `本场上答错的 ${(server.wrong_ids ?? []).length} 道题已记入错题重练——去练习里把它们答对（答对即消），全部消完就能再次挑战「${next?.name ?? '下一段位'}」。本周期还剩 ${server.chances_left} 次补考机会` : `晋级资格保留，可再次挑战「${next?.name ?? '下一段位'}」。本周期还剩 ${server.chances_left} 次补考机会，用完将重新刷库` })
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

      {/* 排位卡（LOL 式晋级赛）：官方段位只通过晋级赛考试获得，一级一级往上考 */}
      <div className="rank-card rise">
        <span className="rank-badge" style={{ borderColor: rank.official.color }}>
          <span className="rank-emoji" aria-hidden="true">{rank.official.emoji}</span>
        </span>
        <div className="rank-info">
          <h4 style={{ color: rank.official.color }}>
            当前段位：{rank.official.name}{rank.next ? '' : ' · 已到顶'}
          </h4>
          <p>
            状态指数 {rank.p}{trend ? `（7日趋势 ${trend.delta >= 0 ? '+' : ''}${trend.delta}）` : ''}（仅展示，不作晋级门槛 · 口径含主观自评，出题画像只认客观题）
            {' · '}覆盖 {rank.doneN}/{rank.total}
            {' · '}逐题掌握 {Math.round(rank.itemRate * 100)}%（≥{Math.round(MASTERY.ITEM_RATE * 100)}）
            {' · '}知识点达标 {rank.kpTotal === 0 ? '—' : `${rank.kpOK}/${rank.kpTotal}`}（≥{Math.round(MASTERY.KP_ACC * 100)}%）
            {rank.next ? ` · 补考机会 ${rank.chancesLeft}/${EXAM_ATTEMPTS}` : ''}
          </p>
          {spark && (
            <svg className="rank-spark" width={spark.W} height={spark.H} aria-hidden="true">
              <polyline points={spark.line} fill="none" stroke="var(--pink-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {!rank.examReady && (
            <p className="rank-hint">
              距晋级赛还差：{[
                rank.covered ? null : `刷完 ${rank.total - rank.doneN} 道未刷题`,
                rank.itemRate >= MASTERY.ITEM_RATE ? null : `错题重练（${rank.total - rank.masteredN} 题最近一次未答对）`,
                rank.kpPass ? null : `${rank.kpTotal - rank.kpOK} 个知识点正确率未达 ${Math.round(MASTERY.KP_ACC * 100)}%`,
                rank.pendingWrongN ? `晋级赛错题重练（${rank.pendingWrongN} 道上场答错的题，练习中答对即消）` : null
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

      {/* P2 自由回忆周检：到期时出清单自评；未到期但有薄弱域 → 直达「练薄弱域」 */}
      {needRecall && (
        <div className="panel recall-card rise">
          <h4>🧠 本周自由回忆</h4>
          <p className="recall-sub">下面是本周练过的知识域。先在脑里把每个域的要点「讲一遍」，再如实自评——想不起来的正是下周该优先补的。这是比选择题更有效的提取练习。</p>
          {recallItems.map((it) => (
            <div className="recall-row" key={it.domain}>
              <span className="recall-domain">{domainLabel(it.domain)}<i>本周练过 {it.n} 题</i></span>
              <span className="chip-row">
                {RECALL_GRADES.map((g) => (
                  <button key={g} className={'chip' + (recallPick[it.domain] === g ? ' on' : '')}
                    onClick={() => setRecallPick((m) => ({ ...m, [it.domain]: g }))}>{g}</button>
                ))}
              </span>
            </div>
          ))}
          <div className="recall-foot">
            <GiltBtn size="sm" disabled={recallItems.some((it) => !recallPick[it.domain])} onClick={() => submitRecall(false)}>提交自评</GiltBtn>
            <GiltBtn size="sm" tone="ghost" onClick={() => submitRecall(true)}>跳过本周</GiltBtn>
            <span>提交后 7 天内不再提醒；未达「讲得清」的域会给出直达练习入口</span>
          </div>
        </div>
      )}
      {!needRecall && weakKp.length > 0 && (
        <div className="panel recall-weak rise">
          <span aria-hidden="true">🧠</span>
          <div className="recall-weak-copy">
            <h4>自由回忆遗留薄弱域（{new Date(lastRecall.at).toLocaleDateString('zh-CN')} 自评）</h4>
            <p>{weakKp.map((d) => domainLabel(d)).join('、')} —— 这些域你自评「讲得清」以外，优先补一轮</p>
          </div>
          <GiltBtn size="sm" onClick={() => run('relearn', { size: 20, domains: weakKp })}>练薄弱域（20 题）</GiltBtn>
        </div>
      )}

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

import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { classifyImport, parseItems, validateItems, crossBatchCheck } from '../lib/validate'
import { reworkTalk } from '../lib/validate'
import { abilityOf, tierOf } from '../lib/ability'
import { GiltBtn, burstParticles } from '../components'

/* 导入页 · 题库导入（2026-09-09：题集通道唯一化——旧「🧩 题集模式」开关拆除，
   题目数组一律走逐题校验（N 任意含 21）；备份 JSON 仍由 classifyImport 自动识别
   走恢复通道。生成模式（默认整批通道）随其规则退役，不再作为导入选项。 */
export default function Import() {
  const navigate = useNavigate()
  const importBank = useStore((s) => s.importBank)
  const total = useStore((s) => s.questions.length)
  /* v4.8 能力档：复用线上 abilityOf（f3ce99a 已部署），与本机作答记录联动 */
  const records = useStore((s) => s.records)
  const ability = useMemo(() => abilityOf(records), [records])
  const tier = tierOf(ability)
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // {tone, title, issues, rework, warnings, added}
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dragOn, setDragOn] = useState(false)
  const [sealing, setSealing] = useState(false)
  const fileRef = useRef(null)
  const taRef = useRef(null)

  function showResult(issues, importRes, prefix = '') {
    const errs = issues.filter((i) => i.level === '错误')
    const warns = issues.filter((i) => i.level === '告警')
    if (importRes && importRes.errors.length > 0) {
      const title = `检测通过但入库被拒：${importRes.errors.length} 条条目无效`
      setResult({ tone: 'red', title, issues: importRes.errors.map((m) => ({ where: '入库', level: '错误', message: m })), rework: true })
    } else if (errs.length > 0) {
      setResult({ tone: 'red', title: `${prefix}检测失败：${errs.length} 项错误、${warns.length} 项告警，未入库`, issues, rework: true })
    } else if (importRes) {
      const total = importRes.questions?.length ?? importRes.added
      const skipped = importRes.skipped ?? Math.max(0, total - importRes.added)
      /* 重复导入同一批：id 按内容哈希生成、全部撞库去重 → added=0。
         旧文案「已入库 新增 0 题」误导（2026-09-08 用户反馈），改为明确去重提示 */
      if (importRes.added === 0 && total > 0) {
        setResult({ tone: 'warn', title: `${prefix}检测通过：本批 ${total} 题均已存在，未新增（重复导入自动去重，题库无重复题）`, warnings: warns })
      } else {
        setResult({ tone: 'green', title: `${prefix}检测通过，已入库 新增 ${importRes.added} 题` + (skipped > 0 ? `，另有 ${skipped} 题已存在跳过` : ''), warnings: warns, added: importRes.added })
      }
    } else {
      setResult({ tone: 'warn', title: `${prefix}检测完成：${warns.length} 项告警（可入库）`, warnings: warns, issues })
    }
  }

  /* 云端写入超时守卫（2026-09-08 用户反馈：导入转圈无提示）。importBank 先写本地
     再等云端，Supabase 请求一旦卡住，await 永不返回、页面永远停在转圈——用户误以为
     失败而重导。此处只对「等结果」加时限：超时给出明确话术并解锁按钮，底层写入
     继续在后台跑（幂等 upsert + 内容哈希去重，稍后刷新或重导都安全）。 */
  const CLOUD_TIMEOUT_MS = 20000
  function guardCloud(p) {
    return Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('__cloud_timeout__')), CLOUD_TIMEOUT_MS))
    ])
  }
  function cloudTimeoutResult() {
    setResult({
      tone: 'warn',
      title: '云端写入响应超时（本地已保存）',
      warnings: [{ where: '云端', message: '题目数据已写入本机，云端可能仍在后台完成。请稍后刷新页面核对题数；若未入库，重新导入本批即可——题目按内容自动去重，不会产生重复题。' }]
    })
  }

  /* 题目通道（2026-09-09 起唯一通道）：逐题校验直通任意 N（含恰 21 元素）。
     旧"默认整批生成批通道"随生成模式规则退役而移除出导入选项——题目数组
     不再分模式，全部按题集逐题规则校验。备份恢复不走本分支（classifyImport 先识别 kind）。 */
  async function detectSetMode() {
    const { items, errors } = parseItems(text)
    if (errors.length > 0) {
      setResult({ tone: 'red', title: '题集导入 · 导入内容无法解析', issues: errors.map((m) => ({ where: '顶层', level: '错误', message: m })), rework: true })
      return
    }
    /* v4.13 自适应退役：不再传 records/全库题做 verdict 复算——命题端已无换挡声明，
       校验器只做逐题通用校验（ctx 参数已废弃） */
    const issues = validateItems(items, false)
    const errs = issues.filter((i) => i.level === '错误')
    if (errs.length > 0) {
      showResult(issues, null, '题集导入 · ')
      return
    }
    /* 跨批撞库（2026-09-08）：与库内已有题比知识点撞名/题干近似，仅告警不拦截；
       已在库内的题（内容哈希命中）自动跳过，重复导入同批不产生噪音。 */
    const crossWarns = crossBatchCheck(items, useStore.getState().allQuestions)
    /* 难度分布提示（v4.13 更新，非拦截）：题库难度完全由源题决定（命题端自适应已退役），
       新手档导入大比例应用/综合层时仅作展示提醒——确认这是你想要的输入难度即可。 */
    const tierWarns = []
    const ab = abilityOf(useStore.getState().records)
    if (tierOf(ab) === '新手' && items.length > 0) {
      const hi = items.filter((it) => ['应用', '分析', '评价', '创造'].includes(it.认知层级)).length
      if (hi / items.length >= 0.3) {
        tierWarns.push({
          where: '难度分布', level: '告警',
          message: `本批 ${items.length} 题中 ${hi} 题（${Math.round((hi / items.length) * 100)}%）为应用/综合层，当前状态指数 ${Math.round(ab * 100)}（建议档位：新手）。题目难度由源题决定、AI 不做升降档适配——若为刻意挑战可忽略本提示。`
        })
      }
    }
    const allIssues = [...issues, ...crossWarns, ...tierWarns]
    setSealing(true)
    try {
      const res = await guardCloud(importBank(text))
      showResult(allIssues, res, '题集导入 · ')
    } catch (e) {
      if (e instanceof Error && e.message === '__cloud_timeout__') { cloudTimeoutResult(); return }
      setResult({ tone: 'red', title: '云端写入失败', issues: [{ where: '云端', level: '错误', message: e instanceof Error ? e.message : String(e) }], rework: false })
    }
  }

  async function detect() {
    if (!text.trim() || busy) return
    setBusy(true); setResult(null); setSealing(false); setCopied(false)
    try {
      const cls = classifyImport(text)
      if (cls.kind === 'backup') {
        setSealing(true)
        try {
          const res = await guardCloud(importBank(text))
          const skipped = res.skipped ?? Math.max(0, (res.questions?.length ?? res.added) - res.added)
          setResult({ tone: 'green', title: `✦ 备份恢复完成，新增 ${res.added} 题` + (skipped > 0 ? `，${skipped} 题已存在跳过` : '') + ' ✦', added: res.added, backup: true })
        } catch (e) {
          if (e instanceof Error && e.message === '__cloud_timeout__') { cloudTimeoutResult(); return }
          setResult({ tone: 'red', title: '云端写入失败', issues: [{ where: '云端', level: '错误', message: '云端写入受阻，请重试' }], rework: false })
        }
      } else if (cls.kind === 'parse-error') {
        /* §46：JSON 语法解析失败同样给返工话术（用户口径：图二没出复制窗口）。
           报错信息本身含 line/column 定位，AI 拿话术即可定向修语法。 */
        setResult({ tone: 'red', title: '导入内容无法解析', issues: cls.errors.map((m) => ({ where: '顶层', level: '错误', message: m })), rework: true })
      } else {
        /* 唯一题目通道（2026-09-09）：一切题目数组（任意 N）走题集逐题校验，
           旧"默认整批通道"及其 21 元素报错已随生成模式退役而移除出导入流程。 */
        await detectSetMode()
      }
    } finally {
      setBusy(false)
      setTimeout(() => setSealing(false), 1600)
    }
  }

  async function copyRework() {
    const talk = reworkTalk(result.issues ?? [])
    try { await navigator.clipboard.writeText(talk) } catch {
      const ta = document.createElement('textarea')
      ta.value = talk; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function onFile(f) {
    if (f) setText(await f.text())
  }

  const stepState = result?.tone === 'green' ? 3 : busy || sealing ? 2 : text.trim() ? 2 : 1
  const chars = text.length
  const volumes = (text.match(/"序号"\s*:/g) ?? []).length

  return (
    <div className="page-wrap wide">
      <div className="page-head">
        <h1><span className="rune">🍬</span> 检 测 &amp; 入 库</h1>
        <p>题库导入 · 当前 {total} 题</p>
      </div>

      {/* 题集导入说明（2026-09-09：唯一导入通道，开关已拆除） */}
      <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--candy-pink-dk, #5FAE8F)' }}>
        <div className="panel-title">🧩 题集导入（唯一导入通道 · 逐题检测）</div>
        <p style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--muted)' }}>
          只做逐题校验（题型、元数据映射、选项结构、解析标记、填空与配图白名单、批内避重等通用检查），<b>任意题数（含 21）均可通过</b>；通过校验后还会与<b>库内已有题</b>做跨批撞库提示（知识点同名 / 题干高度相似，仅告警不拦截，已在库内的题自动跳过）。对应《出题规则》现行版（AI 触发词：<b>题目：</b>）；备份 JSON 粘贴后自动识别并走「备份恢复」，无需任何开关。
        </p>
        {/* v4.13 自适应退役：状态指数仅作展示，"复制水平声明"按钮与 fetch_level 联动文案已移除 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4, padding: '10px 12px', borderRadius: 12, background: 'rgba(168,216,196,.18)' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            📊 当前状态指数 <b style={{ color: '#2E6B52' }}>{Math.round(ability * 100)}</b> · 建议能力档 <b style={{ color: '#2E6B52' }}>{tier}</b>
            <span style={{ fontSize: 12 }}>（&lt;55 新手 / 55~78 进阶 / &gt;78 熟练 · 含主观自评，仅展示参考）</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>题目难度完全由你提供的源题决定，AI 不做升降档适配</span>
        </div>
      </div>

      <div className="panel deep">
        <div className="step-bar">
          <div className={'step-node st1' + (stepState >= 1 ? (stepState === 1 ? ' active' : ' done') : '')}>
            {/* 节点图标由 CSS .step-node::before 提供（📜/🔒/✓），不再用位图：
                                光靠 display:none 隐藏仍会发请求，必须从 JSX 里拿掉 */}
            <span>粘贴题库{stepState > 1 ? ' ✓' : ''}</span>
          </div>
          <div className={'step-line' + (stepState > 1 ? ' on' : '')} />
          <div className={'step-node st2' + (stepState === 2 ? ' active' : stepState > 2 ? ' done' : '')}>
            
            <span>导入检测{busy ? '中…' : stepState > 2 ? ' ✓' : ''}</span>
          </div>
          <div className={'step-line' + (stepState > 2 ? ' on' : '')} />
          <div className={'step-node st3' + (stepState === 3 ? ' active' : '')}>
            
            <span>收进书架{stepState === 3 ? ' ✓' : ''}</span>
          </div>
        </div>

        {/* 那行 rgba(30,24,16,.6) 深棕哥特底是死代码：candy.css 给 .panel 定了
            background: rgba(255,255,255,.84) !important，内联非 important 早就输了。
            说明文字里被早期「卷」正则改坏的句子一并修正（§7.4）。 */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-title">📖 导入说明</div>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--muted)' }}>
            把外部 AI 生成的题目 JSON 粘贴到下方输入框，或直接拖入 JSON 文件，会自动校验结构与规范。
            题目一律走<b>题集逐题校验</b>（任意题数，含 21；题型 / 元数据映射 / 选项结构 / 解析标记 / 批内避重等通用检查）。出题请统一使用《出题规则》（AI 触发词：<b>题目：</b>）。备份 JSON 粘贴后自动识别并走「备份恢复」。
          </p>
        </div>

        <div className={'scroll-zone' + (dragOn ? ' drag-on' : '') + (result?.tone === 'red' ? ' err' : '')}
          onDragOver={(e) => { e.preventDefault(); setDragOn(true) }}
          onDragLeave={() => setDragOn(false)}
          onDrop={(e) => { e.preventDefault(); setDragOn(false); onFile(e.dataTransfer.files?.[0]) }}>
          <textarea ref={taRef} className="rune-textarea" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'将 AI 生成的题目 JSON 数组导入到这里，如 [{"序号":1,"题型":"单选题",…}]，也可直接拖入 JSON 文件'}
            rows={12} />
        </div>

        <div className="scroll-meta">
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            检测到 {volumes || '—'} 题 · 约 {chars} 字
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <GiltBtn onClick={detect} disabled={!text.trim() || busy}>
              {busy ? '导入校验中…' : '🔍 检测并入库'}
            </GiltBtn>
            <GiltBtn tone="ghost" onClick={() => fileRef.current?.click()}>📎 选择 JSON 文件</GiltBtn>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden
              onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>

        {sealing && (
          <div className="sealing-anim">
            {/* 哥特玫瑰窗去掉：它既是位图，又挂着 spin-slow 10s linear infinite 的永久旋转
                （违反 §5「infinite 动画只跑在小面积元素上」）。只留五颗掉落糖豆。 */}
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="fall-card" style={{ left: `${38 + i * 6}%`, animationDelay: `${i * 0.22}s` }} />
            ))}
          </div>
        )}

        {result?.tone === 'green' && (
          <div className="success-box">
            <p className="gold-glow-text" style={{ fontSize: 17, letterSpacing: 3 }}>{result.title}</p>
            {result.backup && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>做题记录一并恢复</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              <GiltBtn onClick={(e) => { burstParticles(e.clientX, e.clientY, 'gold', 14); navigate('/bank') }}>前往糖果书架</GiltBtn>
              <GiltBtn tone="ghost" onClick={() => { setText(''); setResult(null) }}>继续导入</GiltBtn>
            </div>
          </div>
        )}

        {/* 告警框原来是哥特暗金：#d9c26a 浅金字压在浅色果冻底上只有约 1.8:1，告警内容等于看不见。
            改成糖果柠檬通道，文字用深金 #8A6D00（约 4.9:1，与答题页「模糊」档同源） */}
        {result?.tone === 'warn' && (
          <div className="success-box" style={{ borderColor: 'var(--lemon-dk)', background: 'rgba(255, 224, 102, .2)' }}>
            <p style={{ color: '#8A6D00', letterSpacing: 2, fontWeight: 800 }}>{result.title}</p>
            <ul style={{ listStyle: 'none', marginTop: 8, fontSize: 13, color: '#8A6D00' }}>
              {result.warnings?.map((w, i) => <li key={i}>告警 [{w.where}] {w.message}</li>)}
            </ul>
          </div>
        )}

        {result?.tone === 'red' && (
          <div className="rework-box">
            <h4>{result.title}</h4>
            <ul style={{ maxHeight: 220, overflowY: 'auto' }}>
              {(result.issues ?? []).map((it, i) => (
                <li key={i} className={it.level === '错误' ? 'err-i' : 'warn-i'}>
                  {it.level} [{it.where}] {it.message}
                </li>
              ))}
            </ul>
            {result.rework && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <GiltBtn tone="danger" onClick={copyRework}>{copied ? '✓ 已复制，发回给 AI 修正' : '📋 一键复制返工话术'}</GiltBtn>
                {/* §59：复制只是「离开修内容」的第一步，回来要有一键清场重导的出口（用户反馈） */}
                <GiltBtn tone="ghost" onClick={() => { setText(''); setResult(null); setCopied(false); taRef.current?.focus() }}>
                  🧹 清空，重新导入
                </GiltBtn>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>话术含全部报错行与修正要求，AI 改完重新导入再检测。</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { classifyImport, PROTOCOL_VERSION, parseItems, validateItems } from '../lib/validate'
import { reworkTalk } from '../lib/validate'
import { GiltBtn, burstParticles } from '../components'

/* 导入页 · 题库导入 */
export default function Import() {
  const navigate = useNavigate()
  const importBank = useStore((s) => s.importBank)
  const total = useStore((s) => s.questions.length)
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // {tone, title, issues, rework, warnings, added}
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dragOn, setDragOn] = useState(false)
  const [sealing, setSealing] = useState(false)
  /* 题集模式开关（2026-09-08 用户反馈）：改存 settings 持久化——原 useState 局部状态
     每次刷新/切页都重置回关闭，长批导入每次都要重开。走 updateSettings 与
     relearnFilters 同一条云端同步链路（DEMO 模式守卫内只落本机）。 */
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const setMode = settings.questionSetMode ?? false
  const toggleSetMode = () => { updateSettings({ questionSetMode: !setMode }); setResult(null) }
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
      setResult({ tone: 'green', title: `${prefix}检测通过，已入库 新增 ${importRes.added} 题`, warnings: warns, added: importRes.added })
    } else {
      setResult({ tone: 'warn', title: `${prefix}检测完成：${warns.length} 项告警（可入库）`, warnings: warns, issues })
    }
  }

  /* 题集模式（v4.6 通用性整改）：逐题校验直通任意 N（含恰 21 元素）。
     旧版"恰 21 元素且满足生成批规则即互斥拒绝"已删除——那是围绕默认通道
     实现缺陷（batchMode = N<=21）打的补丁；v4.6 起逐题检查对全部序号同口径
     （生成批专属豁免已收敛到 batchMode 门内），两模式产物可由各自的
     结构特征（21 元素配比 vs 任意 N）自然区分，无需互斥拦截。
     备份恢复不走本分支（classifyImport 先识别 kind）。 */
  async function detectSetMode() {
    const { items, errors } = parseItems(text)
    if (errors.length > 0) {
      setResult({ tone: 'red', title: '题集模式 · 导入内容无法解析', issues: errors.map((m) => ({ where: '顶层', level: '错误', message: m })), rework: true })
      return
    }
    const issues = validateItems(items, false)
    const errs = issues.filter((i) => i.level === '错误')
    if (errs.length > 0) {
      showResult(issues, null, '题集模式 · ')
      return
    }
    setSealing(true)
    try {
      const res = await importBank(text)
      showResult(issues, res, '题集模式 · ')
    } catch (e) {
      setResult({ tone: 'red', title: '云端写入失败', issues: [{ where: '云端', level: '错误', message: e instanceof Error ? e.message : String(e) }], rework: false })
    }
  }

  async function detect() {
    if (!text.trim() || busy) return
    setBusy(true); setResult(null); setSealing(false); setCopied(false)
    try {
      if (setMode) { await detectSetMode(); return }
      const cls = classifyImport(text)
      if (cls.kind === 'backup') {
        setSealing(true)
        try {
          const res = await importBank(text)
          setResult({ tone: 'green', title: `✦ 备份恢复完成，已恢复 ${res.added} 题 ✦`, added: res.added, backup: true })
        } catch {
          setResult({ tone: 'red', title: '云端写入失败', issues: [{ where: '云端', level: '错误', message: '云端写入受阻，请重试' }], rework: false })
        }
      } else if (cls.kind === 'parse-error') {
        /* §46：JSON 语法解析失败同样给返工话术（用户口径：图二没出复制窗口）。
           报错信息本身含 line/column 定位，AI 拿话术即可定向修语法。 */
        setResult({ tone: 'red', title: '导入内容无法解析', issues: cls.errors.map((m) => ({ where: '顶层', level: '错误', message: m })), rework: true })
      } else if (cls.issues.filter((i) => i.level === '错误').length === 0) {
        setSealing(true)
        try {
          const res = await importBank(text)
          showResult(cls.issues, res)
        } catch (e) {
          setResult({ tone: 'red', title: '云端写入失败', issues: [{ where: '云端', level: '错误', message: e instanceof Error ? e.message : String(e) }], rework: false })
        }
      } else {
        showResult(cls.issues, null)
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

      {/* 右上角 · 题集模式开关：开=逐题检测（题集解答规则，N 任意），关=默认整批生成批规则 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, margin: '-6px 0 10px' }}>
        <button
          type="button"
          aria-pressed={setMode}
          onClick={toggleSetMode}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            border: '1.5px solid ' + (setMode ? 'var(--candy-pink-dk, #5FAE8F)' : 'rgba(0,0,0,.15)'),
            background: setMode ? 'rgba(168,216,196,.35)' : 'rgba(255,255,255,.7)',
            color: setMode ? '#2E6B52' : 'var(--muted, #666)'
          }}>
          <span style={{
            width: 30, height: 16, borderRadius: 999, position: 'relative',
            background: setMode ? 'var(--candy-pink-dk, #5FAE8F)' : 'rgba(0,0,0,.18)', transition: 'background .2s'
          }}>
            <span style={{
              position: 'absolute', top: 2, left: setMode ? 16 : 2, width: 12, height: 12,
              borderRadius: '50%', background: '#fff', transition: 'left .2s'
            }} />
          </span>
          🧩 题集模式{setMode ? ' · 已开启' : ''}
        </button>
      </div>
      {setMode && (
        <div className="panel" style={{ marginBottom: 16, borderColor: 'var(--candy-pink-dk, #5FAE8F)' }}>
          <div className="panel-title">🧩 题集模式（逐题检测）</div>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--muted)' }}>
            开启后<b>只做逐题校验</b>（题型、元数据映射、选项结构、解析标记、填空与配图白名单、批内避重等通用检查），<b>不校验</b> 21 道生成批的数量/配比/难度层段。<b>任意元素数（含 21）均可通过本通道</b>；关闭开关则是生成模式产物与备份恢复的通道（生成批整批规则仅在恰为 21 元素时生效）。对应《题集模式规则》现行版（AI 触发词：<b>源题：</b>）；备份 JSON 请关闭本开关走「备份恢复」。
          </p>
        </div>
      )}

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
            关闭开关（默认通道）：恰 21 题按整批生成批规则校验（区间配比 / 难度层段 / 层内题型构成 / 元数据映射 / 解析标记等 11 类），非 21 元素无法通过；题集批量题目（AI 触发词「源题：」）请开启右上角「🧩 题集模式」走逐题检测（N 任意，含 21）。生成模式协议版本 {PROTOCOL_VERSION}。
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

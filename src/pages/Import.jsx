import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { classifyImport } from '../lib/validate'
import { reworkTalk } from '../lib/validate'
import { A } from '../assets'
import { GiltBtn, burstParticles } from '../components'

/* 导入页 · 题库导入仪式 */
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
  const fileRef = useRef(null)

  function showResult(issues, importRes) {
    const errs = issues.filter((i) => i.level === '错误')
    const warns = issues.filter((i) => i.level === '告警')
    if (importRes && importRes.errors.length > 0) {
      const title = `检测通过但入库被拒：${importRes.errors.length} 条条目无效`
      setResult({ tone: 'red', title, issues: importRes.errors.map((m) => ({ where: '入库', level: '错误', message: m })), rework: true })
    } else if (errs.length > 0) {
      setResult({ tone: 'red', title: `检测失败：${errs.length} 项错误、${warns.length} 项告警，未入库`, issues, rework: true })
    } else if (importRes) {
      setResult({ tone: 'green', title: `检测通过，已封印入库 新增 ${importRes.added} 题`, warnings: warns, added: importRes.added })
    } else {
      setResult({ tone: 'warn', title: `检测完成：${warns.length} 项告警（可入库）`, warnings: warns, issues })
    }
  }

  async function detect() {
    if (!text.trim() || busy) return
    setBusy(true); setResult(null); setSealing(false)
    try {
      const cls = classifyImport(text)
      if (cls.kind === 'backup') {
        setSealing(true)
        try {
          const res = await importBank(text)
          setResult({ tone: 'green', title: `✦ 记忆回溯完成，已恢复 ${res.added} 题题库 ✦`, added: res.added, backup: true })
        } catch {
          setResult({ tone: 'red', title: '云端写入失败', issues: [{ where: '云端', level: '错误', message: '甜蜜值回流受阻，请重试' }], rework: false })
        }
      } else if (cls.kind === 'parse-error') {
        setResult({ tone: 'red', title: '导入内容无法解析', issues: cls.errors.map((m) => ({ where: '顶层', level: '错误', message: m })), rework: false })
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
      <div className="page-head" style={{ backgroundImage: `url(${A.titleDecor})` }}>
        <h1 className="font-gothic"><span className="rune">🔮</span> 检测 &amp; 封印</h1>
        <p>题库导入仪式 · 当前题库 {total} 题</p>
      </div>

      <div className="panel deep">
        <div className="step-bar">
          <div className={'step-node' + (stepState >= 1 ? (stepState === 1 ? ' active' : ' done') : '')}>
            {/* 节点图标由 CSS .step-node::before 提供（📜/🔒/✓），不再用位图：
                                光靠 display:none 隐藏仍会发请求，必须从 JSX 里拿掉 */}
            <span>甜蜜值凝聚{stepState > 1 ? ' ✓' : ''}</span>
          </div>
          <div className={'step-line' + (stepState > 1 ? ' on' : '')} />
          <div className={'step-node' + (stepState === 2 ? ' active' : stepState > 2 ? ' done' : '')}>
            
            <span>导入检测{busy ? '中…' : stepState > 2 ? ' ✓' : ''}</span>
          </div>
          <div className={'step-line' + (stepState > 2 ? ' on' : '')} />
          <div className={'step-node' + (stepState === 3 ? ' active' : '')}>
            
            <span>封印入库{stepState === 3 ? ' ✓' : ''}</span>
          </div>
        </div>

        <div className="panel" style={{ background: 'rgba(30,24,16,.6)', marginBottom: 16 }}>
          <div className="panel-title">📖 导入说明</div>
          <p style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--muted)' }}>
            将外部 AI 生成的题目 JSON 导入到下方卷轴，或拖入 JSON 文件，自动校验结构与规范。
            21 卷批执行完整规则（配比 / 难度层段 / 元数据映射等 9 类）；超过 21 卷按大秘库逐题检测；备份 JSON 走备份恢复。
          </p>
        </div>

        <div className={'scroll-zone' + (dragOn ? ' drag-on' : '') + (result?.tone === 'red' ? ' err' : '')}
          onDragOver={(e) => { e.preventDefault(); setDragOn(true) }}
          onDragLeave={() => setDragOn(false)}
          onDrop={(e) => { e.preventDefault(); setDragOn(false); onFile(e.dataTransfer.files?.[0]) }}>
          <textarea className="rune-textarea" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'将 AI 生成的题目 JSON 数组导入到这里，如 [{"序号":1,"题型":"单选题",…}]，也可直接拖入 JSON 文件'}
            rows={12} />
        </div>

        <div className="scroll-meta">
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            已导入 {volumes || '—'} 题 · 约 {chars} 字
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <GiltBtn onClick={detect} disabled={!text.trim() || busy}>
              {busy ? '导入校验中…' : '🔍 检测并封印'}
            </GiltBtn>
            <GiltBtn tone="ghost" onClick={() => fileRef.current?.click()}>📎 选择 JSON 文件</GiltBtn>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden
              onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>

        {sealing && (
          <div className="sealing-anim">
            <img src={A.roseWindow} alt="" style={{ width: 110, opacity: .8, animation: 'spin-slow 10s linear infinite' }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="fall-card" style={{ left: `${38 + i * 6}%`, animationDelay: `${i * 0.22}s` }} />
            ))}
          </div>
        )}

        {result?.tone === 'green' && (
          <div className="success-box">
            <img className="rose" src={A.roseWindow} alt="" />
            <p className="gold-glow-text" style={{ fontSize: 17, letterSpacing: 3 }}>{result.title}</p>
            {result.backup && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>做题记录一并回溯</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
              <GiltBtn onClick={(e) => { burstParticles(e.clientX, e.clientY, 'gold', 14); navigate('/bank') }}>前往糖果书架</GiltBtn>
              <GiltBtn tone="ghost" onClick={() => { setText(''); setResult(null) }}>继续导入</GiltBtn>
            </div>
          </div>
        )}

        {result?.tone === 'warn' && (
          <div className="success-box" style={{ borderColor: 'var(--mid)', background: 'rgba(168,138,26,.12)' }}>
            <p style={{ color: '#d9c26a', letterSpacing: 2 }}>{result.title}</p>
            <ul style={{ listStyle: 'none', marginTop: 8, fontSize: 13, color: '#d9c26a' }}>
              {result.warnings?.map((w, i) => <li key={i}>告警 [{w.where}] {w.message}</li>)}
            </ul>
          </div>
        )}

        {result?.tone === 'red' && (
          <div className="rework-box">
            <h4><img src={A.warnRune} alt="" /> {result.title}</h4>
            <ul style={{ maxHeight: 220, overflowY: 'auto' }}>
              {(result.issues ?? []).map((it, i) => (
                <li key={i} className={it.level === '错误' ? 'err-i' : 'warn-i'}>
                  {it.level} [{it.where}] {it.message}
                </li>
              ))}
            </ul>
            {result.rework && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <GiltBtn tone="danger" onClick={copyRework}>{copied ? '✓ 已复制，发回给 AI 净化' : '📋 一键复制返工话术'}</GiltBtn>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>话术含全部报错行与修正要求，AI 净化后重新导入再检测。</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

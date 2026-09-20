import React, { useState } from 'react'
import { useStore } from '../store'
import { GiltBtn } from '../components'

/* ── 题库书架 · 白瓷「纸上书斋」（2026-09-20 重设计）──
   每本书 = 立在架上的一册实体书：顶部书脊布带（--spine 实色）+ 右缘纸页叠层
   （宽度 --thick 随题数增长：1258 题的厚典一眼可辨于 4 题的小册——厚度即数据）
   + 封面学科章纹（SVG 发丝线稿，与全站图标语言一致，告别 emoji）。
   使用中 = 从架上微微抽出的那本：上浮 + 靛蓝书签丝带垂下。
   切书 = 改 activeBookId，store 里 questions 是派生值，全站自动换上下文。 */

const COLORS = [
  { key: 'pink', css: '#C4372E' }, { key: 'mint', css: '#2F7D5C' },
  { key: 'lemon', css: '#C98A1F' }, { key: 'lav', css: '#2F5FD0' },
  { key: 'sky', css: '#4A6FD4' }, { key: 'orange', css: '#A05A2C' },
  { key: 'lime', css: '#256A4C' }, { key: 'rose', css: '#A02D26' }
]

/* 学科章纹库：24×24 发丝线稿（stroke=currentColor 由外层 svg 统一控制）。
   语义优先：图标先回答「这本书是哪个学科的」，再谈好看。 */
const GLYPHS = {
  book: { label: '通用书目', el: (
    <><path d="M12 6.6C10.2 5 7.4 4.4 4.5 4.6v13c2.9-.2 5.7.4 7.5 2 1.8-1.6 4.6-2.2 7.5-2v-13C16.6 4.4 13.8 5 12 6.6z" /><path d="M12 6.6v13" /></>
  ) },
  chat: { label: '面试问答', el: (
    <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" /><path d="M8.6 11.5h.01M12.5 11.5h.01M16.4 11.5h.01" /></>
  ) },
  network: { label: '知识体系', el: (
    <><circle cx="12" cy="5.5" r="2.3" /><circle cx="5" cy="18" r="2.3" /><circle cx="19" cy="18" r="2.3" /><path d="M10.9 7.6L6.1 15.9M13.1 7.6l4.8 8.3M7.3 18h9.4" /></>
  ) },
  wave: { label: '调试维修', el: (
    <><rect x="3" y="4.5" width="18" height="13" rx="2" /><path d="M6 11c1.2-2.6 2.4-2.6 3.6 0s2.4 2.6 3.6 0 2.4-2.6 3.6 0" /><path d="M8.5 20.5h7" /></>
  ) },
  helmet: { label: '工程师现场', el: (
    <><path d="M4.5 15.5a7.5 7.5 0 0 1 15 0" /><path d="M3 15.5h18v2.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M12 8V5.6" /></>
  ) },
  bolt: { label: '电工基础', el: (
    <path d="M13.2 2.8L5.8 13.4h5.3L9.9 21.2l7.5-11h-5.4z" />
  ) },
  ask: { label: '问题集', el: (
    <><circle cx="12" cy="12" r="8.8" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.9c-.8.5-1.2 1-1.2 1.9" /><path d="M12 17.3h.01" /></>
  ) },
  gear: { label: '自动化', el: (
    <><circle cx="12" cy="12" r="3.4" /><circle cx="12" cy="12" r="7.6" /><path d="M12 4.4v2.4M12 17.2v2.4M4.4 12h2.4M17.2 12h2.4M6.5 6.5l1.7 1.7M15.8 15.8l1.7 1.7M17.5 6.5l-1.7 1.7M8.2 15.8l-1.7 1.7" /></>
  ) },
  chart: { label: '统计拓展', el: (
    <><rect x="6" y="12" width="3" height="8" rx=".6" /><rect x="10.5" y="8" width="3" height="12" rx=".6" /><rect x="15" y="14" width="3" height="6" rx=".6" /><path d="M4 20.5h16" /></>
  ) }
}

/* 书名 → 学科章纹匹配表（按特征优先级；显式 icon key 永远优先于本表）。
   存量书的 icon 字段是旧 emoji 字符串（不在 GLYPHS key 里），自动落到本表——
   无需迁移数据即让每本书获得贴合学科的章纹，且与「无 emoji」红线一致。 */
const GLYPH_RULES = [
  [/\d+\s*问|[百千]问/, 'ask'],
  [/面试|问答/, 'chat'],
  [/体系|知识|图谱|框架/, 'network'],
  [/调试|维修|检修|故障/, 'wave'],
  [/工程师/, 'helmet'],
  [/自动化|电机|PLC|变频|电气/, 'gear'],
  [/电工/, 'bolt'],
  [/拓展|统计|题集/, 'chart']
]
const glyphOf = (b) => {
  if (b && GLYPHS[b.icon]) return b.icon
  const name = (b && b.name) || ''
  for (const [re, key] of GLYPH_RULES) if (re.test(name)) return key
  return 'book'
}

const colorOf = (k) => (COLORS.find((c) => c.key === k) ?? COLORS[0]).css
/* 纸页厚度 = 题数的线性映射（0 题 → 5px 薄纸 … 1258 题+ → 19px 厚典） */
const thickOf = (n) => `${5 + Math.min(14, Math.round((n / 1258) * 14))}px`

function Glyph({ name, size = 22 }) {
  const g = GLYPHS[name] ?? GLYPHS.book
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{g.el}</svg>
  )
}

/* 卡上三枚操作钮的 13px 线稿（替代旧 ✎↺🗑 字符，风格与章纹统一） */
const OP_ICONS = {
  rename: <path d="M4.5 19.5l.9-3.6L16 5.3a2 2 0 0 1 2.8 2.8L8.2 18.6l-3.7.9z" />,
  reset: <><path d="M3.5 4.5v5h5" /><path d="M4.6 14a8 8 0 1 0 .7-6.6L3.5 9.5" /></>,
  trash: <><path d="M4 7h16M9.5 7V4.6a1.1 1.1 0 0 1 1.1-1.1h2.8a1.1 1.1 0 0 1 1.1 1.1V7M6.2 7l.9 12.1a1.9 1.9 0 0 0 1.9 1.8h6a1.9 1.9 0 0 0 1.9-1.8L17.8 7" /><path d="M10 11v5.5M14 11v5.5" /></>
}
function OpIcon({ name }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{OP_ICONS[name]}</svg>
  )
}

export default function Bookshelf() {
  const books = useStore((s) => s.books)
  const order = useStore((s) => s.bookOrder)
  const activeBookId = useStore((s) => s.activeBookId)
  const allQuestions = useStore((s) => s.allQuestions)
  const assign = useStore((s) => s.assign)
  const createBook = useStore((s) => s.createBook)
  const switchBook = useStore((s) => s.switchBook)
  const renameBook = useStore((s) => s.renameBook)
  const deleteBook = useStore((s) => s.deleteBook)
  const clearBookProgress = useStore((s) => s.clearBookProgress)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('pink')
  const [icon, setIcon] = useState('book')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const countOf = (id) => allQuestions.filter((q) => assign[q.id] === id).length
  const active = books[activeBookId]
  const totalQ = order.reduce((acc, id) => acc + countOf(id), 0)

  function flash(msg) { setNote(msg); setTimeout(() => setNote(''), 2200) }

  async function onCreate() {
    if (!name.trim() || busy) return
    setBusy(true)
    await createBook({ name: name.trim(), color, icon })
    setBusy(false); setCreating(false); setName(''); setColor('pink'); setIcon('book')
    flash('已创建并切换到新题库，现在是空的，去导入题目吧')
  }
  async function onSwitch(id) {
    if (id === activeBookId || busy) return
    setBusy(true)
    await switchBook(id)
    setBusy(false)
    flash(`已切换到《${books[id]?.name ?? ''}》`)
  }
  async function onRename(id) {
    if (!editName.trim()) { setEditingId(null); return }
    await renameBook(id, editName.trim())
    setEditingId(null)
  }
  async function onDelete() {
    const b = books[confirmId]
    if (!b || confirmName !== b.name || busy) return
    setBusy(true)
    await deleteBook(confirmId)
    setBusy(false); setConfirmId(null); setConfirmName('')
    flash(`《${b.name}》已删除`)
  }

  return (
    <div className="panel bookshelf">
      <div className="bookshelf-head">
        <div className="bookshelf-title-wrap">
          <div className="panel-title">题库书架</div>
          <div className="book-shelf-stat">
            {order.length} 本藏书 · 共 {totalQ.toLocaleString()} 题
          </div>
        </div>
        {active && <span className="book-current">当前 · {active.name}</span>}
      </div>

      {note && <p className="book-note" role="status">{note}</p>}

      <div className="book-grid">
        {order.map((id) => {
          const b = books[id]
          if (!b) return null
          const on = id === activeBookId
          const n = countOf(id)
          return (
            <div key={id} className={'book-card' + (on ? ' on' : '') + (n === 0 ? ' empty' : '')}
              style={{ '--spine': colorOf(b.color), '--thick': thickOf(n) }}
              onClick={() => onSwitch(id)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitch(id) } }}
              aria-pressed={on}>
              <span className="book-band" aria-hidden="true" />
              <span className="book-pages" aria-hidden="true" />
              {on && <span className="book-ribbon" role="img" aria-label="使用中" />}
              <span className="book-face">
                <span className="book-glyph"><Glyph name={glyphOf(b)} /></span>
              </span>
              {editingId === id ? (
                <input className="rune-input book-rename" value={editName} autoFocus maxLength={20}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => onRename(id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onRename(id); if (e.key === 'Escape') setEditingId(null) }} />
              ) : (
                <span className="book-name">{b.name}</span>
              )}
              <span className="book-meta">
                {n === 0 ? <>暂无藏书 · 待导入</> : <><b className="book-num">{n}</b> 题</>}
              </span>
              <span className="book-ops" onClick={(e) => e.stopPropagation()}>
                <button className="book-op" title="重命名" aria-label={`重命名 ${b.name}`}
                  onClick={() => { setEditingId(id); setEditName(b.name) }}><OpIcon name="rename" /></button>
                <button className="book-op" title="清除本书学习记录（保留题目）" aria-label={`清除 ${b.name} 的学习记录`}
                  onClick={async () => { await clearBookProgress(id); flash(`《${b.name}》的学习记录已清除，题目保留`) }}><OpIcon name="reset" /></button>
                <button className="book-op danger" title="删除整本题库" aria-label={`删除 ${b.name}`}
                  disabled={order.length <= 1}
                  onClick={() => { setConfirmId(id); setConfirmName('') }}><OpIcon name="trash" /></button>
              </span>
            </div>
          )
        })}

        <div className={'book-card book-new' + (creating ? ' open' : '')}
          onClick={() => setCreating((v) => !v)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCreating((v) => !v) } }}>
          <span className="book-new-plus" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" /></svg>
          </span>
          <span className="book-name">新建题库</span>
          <span className="book-meta">独立数据空间</span>
        </div>
      </div>

      {creating && (
        <div className="book-form">
          <label className="book-form-label" htmlFor="book-name-input">题库名称</label>
          <input id="book-name-input" className="rune-input" value={name} maxLength={20} autoFocus
            onChange={(e) => setName(e.target.value)} placeholder="例如：高等数学"
            onKeyDown={(e) => { if (e.key === 'Enter') onCreate() }} />
          <span className="book-count">{name.length}/20</span>

          <div className="book-form-label">封面颜色</div>
          <div className="book-colors" role="radiogroup" aria-label="封面颜色">
            {COLORS.map((c) => (
              <button key={c.key} role="radio" aria-checked={color === c.key} aria-label={c.key}
                className={'color-dot' + (color === c.key ? ' on' : '')}
                style={{ background: c.css }} onClick={() => setColor(c.key)}>
                {color === c.key && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>}
              </button>
            ))}
          </div>

          <div className="book-form-label">学科章纹</div>
          <div className="book-icons" role="radiogroup" aria-label="学科章纹">
            {Object.entries(GLYPHS).map(([key, g]) => (
              <button key={key} role="radio" aria-checked={icon === key} aria-label={g.label}
                title={g.label} className={'icon-pick' + (icon === key ? ' on' : '')}
                onClick={() => setIcon(key)}><Glyph name={key} size={19} /></button>
            ))}
          </div>

          <div className="book-form-ops">
            <GiltBtn tone="ghost" onClick={() => setCreating(false)}>取消</GiltBtn>
            <GiltBtn onClick={onCreate} disabled={!name.trim() || busy}>{busy ? '创建中…' : '创建并切换'}</GiltBtn>
          </div>
        </div>
      )}

      {confirmId && books[confirmId] && (
        <div className="book-confirm">
          <p className="book-confirm-title">删除《{books[confirmId].name}》？</p>
          <p className="book-confirm-desc">
            该题库的 {countOf(confirmId)} 道题目与全部学习记录将被永久删除，其他题库不受影响。此操作不可撤销。
          </p>
          <input className="rune-input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)}
            placeholder={`输入「${books[confirmId].name}」以确认`}
            onKeyDown={(e) => { if (e.key === 'Enter') onDelete() }} />
          <div className="book-form-ops">
            <GiltBtn tone="ghost" onClick={() => { setConfirmId(null); setConfirmName('') }}>取消</GiltBtn>
            <GiltBtn tone="danger" disabled={confirmName !== books[confirmId].name || busy} onClick={onDelete}>
              {busy ? '删除中…' : '确认删除'}
            </GiltBtn>
          </div>
        </div>
      )}

      <p className="book-foot">每个题库的题目、错题与学习记录相互独立保存。</p>
    </div>
  )
}

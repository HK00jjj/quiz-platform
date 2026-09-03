import React, { useState } from 'react'
import { useStore } from '../store'
import { GiltBtn } from '../components'

/* ── 题库书架（方案 5.3 / 8.1）：设置页最顶部、视觉权重最高的模块 ──
   每本题库是一个完全独立的数据空间：题目、间隔重复卡、做题记录互不干扰。
   切书 = 改 activeBookId，store 里 questions 是派生值，所以全站自动换上下文。 */

const COLORS = [
  { key: 'pink', css: '#FFB6C1' }, { key: 'mint', css: '#7FE8C8' },
  { key: 'lemon', css: '#FFE066' }, { key: 'lav', css: '#D4B8FF' },
  { key: 'sky', css: '#A8D8FF' }, { key: 'orange', css: '#FFC98A' },
  { key: 'lime', css: '#A8E063' }, { key: 'rose', css: '#FF8FA3' }
]
const ICONS = ['📖', '📐', '🧪', '📊', '🎨', '🎵', '🌍', '💻', '⚗️', '📝']
const colorOf = (k) => (COLORS.find((c) => c.key === k) ?? COLORS[0]).css

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
  const [icon, setIcon] = useState('📖')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const countOf = (id) => allQuestions.filter((q) => assign[q.id] === id).length
  const active = books[activeBookId]

  function flash(msg) { setNote(msg); setTimeout(() => setNote(''), 2200) }

  async function onCreate() {
    if (!name.trim() || busy) return
    setBusy(true)
    await createBook({ name: name.trim(), color, icon })
    setBusy(false); setCreating(false); setName(''); setColor('pink'); setIcon('📖')
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
        <div className="panel-title">📚 题库书架</div>
        {active && <span className="book-current">当前：{active.name}</span>}
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
              style={{ '--spine': colorOf(b.color) }}
              onClick={() => onSwitch(id)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitch(id) } }}
              aria-pressed={on}>
              <span className="book-spine" aria-hidden="true" />
              <span className="book-icon" aria-hidden="true">{b.icon || '📖'}</span>
              {editingId === id ? (
                <input className="rune-input book-rename" value={editName} autoFocus maxLength={20}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => onRename(id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onRename(id); if (e.key === 'Escape') setEditingId(null) }} />
              ) : (
                <span className="book-name">{b.name}</span>
              )}
              <span className="book-meta">{n === 0 ? '0 题 · 待导入' : `${n} 题`}</span>
              {on && <span className="book-check" aria-label="使用中">✓ 使用中</span>}
              <span className="book-ops" onClick={(e) => e.stopPropagation()}>
                <button className="book-op" title="重命名" aria-label={`重命名 ${b.name}`}
                  onClick={() => { setEditingId(id); setEditName(b.name) }}>✎</button>
                <button className="book-op" title="清除本书学习记录（保留题目）" aria-label={`清除 ${b.name} 的学习记录`}
                  onClick={async () => { await clearBookProgress(id); flash(`《${b.name}》的学习记录已清除，题目保留`) }}>↺</button>
                <button className="book-op danger" title="删除整本题库" aria-label={`删除 ${b.name}`}
                  disabled={order.length <= 1}
                  onClick={() => { setConfirmId(id); setConfirmName('') }}>🗑</button>
              </span>
            </div>
          )
        })}

        <div className={'book-card book-new' + (creating ? ' open' : '')}
          onClick={() => setCreating((v) => !v)} role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCreating((v) => !v) } }}>
          <span className="book-plus" aria-hidden="true">➕</span>
          <span className="book-name">新建题库</span>
          <span className="book-meta">数据全 0，独立保存</span>
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
                {color === c.key && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>

          <div className="book-form-label">图标</div>
          <div className="book-icons" role="radiogroup" aria-label="图标">
            {ICONS.map((ic) => (
              <button key={ic} role="radio" aria-checked={icon === ic} aria-label={ic}
                className={'icon-pick' + (icon === ic ? ' on' : '')} onClick={() => setIcon(ic)}>{ic}</button>
            ))}
          </div>

          <div className="book-form-ops">
            <GiltBtn tone="ghost" onClick={() => setCreating(false)}>取消</GiltBtn>
            <GiltBtn onClick={onCreate} disabled={!name.trim() || busy}>{busy ? '创建中…' : '✨ 创建并切换'}</GiltBtn>
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

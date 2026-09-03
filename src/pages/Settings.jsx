import React, { useState } from 'react'
import { useStore } from '../store'
import { A } from '../assets'
import { GiltBtn } from '../components'
import Bookshelf from '../components/Bookshelf'

/* 设置页 · 尝味师的糖果抽屉 */
export default function Settings() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const userEmail = useStore((s) => s.userEmail)
  const signOut = useStore((s) => s.signOut)
  const resetAll = useStore((s) => s.resetAll)
  const questions = useStore((s) => s.questions)
  const cards = useStore((s) => s.cards)
  const records = useStore((s) => s.records)
  const [exported, setExported] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [melting, setMelting] = useState(false)
  const [melted, setMelted] = useState(false)

  const goal = settings.dailyGoal ?? 20

  function exportBackup() {
    const payload = { exportedAt: new Date().toISOString(), questions, cards, records }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `典籍馆甜蜜值备份_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 2500)
  }

  async function melt() {
    setMelting(true)
    await resetAll()
    setMelting(false)
    setMelted(true)
    setConfirmText('')
    setTimeout(() => setMelted(false), 3000)
  }

  return (
    <div className="page-wrap">
      <div className="page-head" style={{ backgroundImage: `url(${A.titleDecor})` }}>
        <h1 className="font-gothic"><span className="rune">⚗️</span> 糖 果 抽 屉</h1>
        <p>题库设置 · 整理你的糖果抽屉</p>
      </div>

      {/* 题库书架：方案 5.3 定为设置页最重要、视觉权重最高的模块，所以置顶 */}
      <Bookshelf />

      <div className="panel">
        <div className="setting-row">
          <div className="tool"><img src={A.balance} alt="炼金天平" /></div>
          <div style={{ flex: 1 }}>
            <div className="panel-title">⚖️ 每日目标</div>
            <div className="stepper">
              <button onClick={() => updateSettings({ dailyGoal: Math.max(5, goal - 5) })} disabled={goal <= 5} aria-label="减少">−</button>
              <span className="val">{goal}</span>
              <button onClick={() => updateSettings({ dailyGoal: Math.min(100, goal + 5) })} disabled={goal >= 100} aria-label="增加">+</button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>首页的进度环以做题次数计算（含复习）</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="setting-row">
          <div className="tool"><img src={A.memoryFlask} alt="记忆水晶瓶" /></div>
          <div style={{ flex: 1 }}>
            <div className="panel-title">🔮 甜蜜值备份</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--muted)' }}>
              数据存于云端，多设备登录同一账号实时同步。导出备份为可选保险，
              备份 JSON 可在任意设备的导入页（备份恢复）导入恢复。
            </p>
            <div style={{ marginTop: 12 }}>
              <GiltBtn onClick={exportBackup}>{exported ? '✓ 已导出' : '封装记忆 · 导出全量备份 JSON'}</GiltBtn>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="setting-row">
          <div className="tool"><img src={A.sigilBadge} alt="尝味师徽章" /></div>
          <div style={{ flex: 1 }}>
            <div className="panel-title">🏅 尝味师凭证</div>
            <p style={{ fontSize: 14, color: '#d6c79b', letterSpacing: 1 }}>{userEmail ?? '未登录'}</p>
            <div style={{ marginTop: 12 }}>
              <GiltBtn tone="ghost" onClick={signOut}>解除契约 · 退出登录</GiltBtn>
            </div>
          </div>
        </div>
      </div>

      <div className="panel furnace-zone">
        <div className="setting-row">
          <div className="tool"><img src={A.furnace} alt="糖果熔炉" /></div>
          <div style={{ flex: 1 }}>
            <div className="panel-title">🔥 危险区 · 糖果熔炉</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: '#d98ba0' }}>
              清空当前题库的题目、复习卡片与全部做题记录。此操作不可撤销，请先封装记忆（导出备份）。
            </p>
            {melted ? (
              <p className="red-glow-text" style={{ marginTop: 12, letterSpacing: 2 }}>✗ 全部数据已熔毁</p>
            ) : (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="rune-input" style={{ maxWidth: 260 }} value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)} placeholder='输入「确认熔毁」以启炉' />
                <GiltBtn tone="danger" disabled={confirmText !== '确认熔毁' || melting} onClick={melt}>
                  {melting ? '熔炉咆哮中…' : '投入熔炉 · 清空全部数据'}
                </GiltBtn>
              </div>
            )}
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, letterSpacing: 2, color: 'rgba(156,132,82,.55)', marginTop: 26 }}>
        ✦ 糖果题库 v1.0 · 尝味师专用 · 纯网页端 · 云端甜蜜值同步 ✦
      </p>
    </div>
  )
}

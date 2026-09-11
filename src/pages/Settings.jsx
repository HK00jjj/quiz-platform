import React, { useMemo, useState } from 'react'
import { useStore } from '../store'
import { GiltBtn } from '../components'
import Bookshelf from '../components/Bookshelf'
import { readImageMap } from '../lib/diagrams'
import { estimateStorage, fmtBytes, HARD_LIMIT, SOFT_LIMIT } from '../lib/storageQuota'

/* 设置页 · 尝味师的糖果抽屉 */
export default function Settings() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const userEmail = useStore((s) => s.userEmail)
  const signOut = useStore((s) => s.signOut)
  const resetAll = useStore((s) => s.resetAll)
  const allQuestions = useStore((s) => s.allQuestions)
  const bookOrder = useStore((s) => s.bookOrder)
  const books = useStore((s) => s.books)
  const activeBookId = useStore((s) => s.activeBookId)
  const assign = useStore((s) => s.assign)
  const cards = useStore((s) => s.cards)
  const records = useStore((s) => s.records)
  const [exported, setExported] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [melting, setMelting] = useState(false)
  const [melted, setMelted] = useState(false)

  /* 存储水位（2026-09-09 经验对照 #2）：localStorage 约 5MB 上限，imageMap/题库 fallback
     最先触顶。只读监测不自动清理；本页每次进入时重新估算。 */
  const storage = useMemo(() => estimateStorage(), [])
  const meterPct = storage ? Math.min(100, Math.round((storage.bytes / HARD_LIMIT) * 100)) : 0
  const meterColor = !storage ? 'var(--mint)'
    : storage.level === 'danger' ? 'var(--bad-ink)'
    : storage.level === 'warn' ? '#B8860B'
    : 'var(--teal-dk)'

  const goal = settings.dailyGoal ?? 20

  function exportBackup() {
    /* 备份自足化（2026-09-11 审查整改）：
       旧写法 questions 取的是 **当前书**（store 里是派生值），而 cards/records 是全局——
       第二本书上线后，导出的备份缺其它书的题；且整个 payload 不含书本结构，
       换机恢复会把所有题塌进一本书、归书关系（assign）归零。
       现改为：questions = allQuestions（全库），并把书本映射一并随包携带。 */
    const payload = {
      exportedAt: new Date().toISOString(),
      questions: allQuestions,
      cards,
      records,
      imageMap: readImageMap(),
      books: { books, order: bookOrder, activeBookId, assign }
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `糖果题库备份_${new Date().toISOString().slice(0, 10)}.json`
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
      {/* p45 哥特标题装饰条早被 candy.css 的 background-image:none !important 掐掉了（不发请求），
          那行内联样式与 font-gothic 类都是死代码，一并清掉 */}
      <div className="page-head">
        <h1><span className="rune">🧁</span> 糖 果 抽 屉</h1>
        <p>题库设置 · 整理你的糖果抽屉</p>
      </div>

      {/* 题库书架：方案 5.3 定为设置页最重要、视觉权重最高的模块，所以置顶 */}
      <Bookshelf />

      <div className="panel">
        <div className="setting-row">
          {/* 糖果天平（方案 5.4）：纯 CSS 实体——中央薄荷水晶柱 + 横梁 + 左右两个糖盘 */}
          <div className="tool candy-balance" role="img" aria-label="糖果天平">
            <span className="cb-pan l" /><span className="cb-pan r" />
          </div>
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
          {/* 糖果罐（方案 5.5）：半透玻璃罐 + 五颗彩色糖豆 + 粉桃盖子 */}
          <div className="tool candy-jar" role="img" aria-label="糖果罐">
            <span className="cj-lid" />
            <span className="cj-body"><i /><i /><i /><i /><i /></span>
          </div>
          <div style={{ flex: 1 }}>
            <div className="panel-title">💾 数据备份</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--muted)' }}>
              数据存于云端，多设备登录同一账号实时同步。导出备份为可选保险，
              备份 JSON 可在任意设备的导入页（备份恢复）导入恢复。
            </p>
            {storage && storage.level !== 'ok' && (
              <div style={{
                marginTop: 10, padding: '10px 12px', borderRadius: 12,
                background: storage.level === 'danger' ? 'rgba(196,55,46,.08)' : 'rgba(255,224,102,.15)',
                fontSize: 12.5, lineHeight: 1.8, color: storage.level === 'danger' ? 'var(--bad-ink)' : 'var(--ink-2)'
              }}>
                {storage.level === 'danger'
                  ? `⚠ 本地存储已用 ${fmtBytes(storage.bytes)}，逼近浏览器上限，随时可能写入失败。请立即导出备份，并考虑清掉不用的旧书（书库页可删书，云端数据不受影响）。`
                  : `本地存储已用 ${fmtBytes(storage.bytes)}，超过提醒线 ${fmtBytes(SOFT_LIMIT)}。建议先导出一份备份；题库继续增长前可清理不用的旧书。`}
                {storage.top[0] && (
                  <span style={{ display: 'block', marginTop: 4, color: 'var(--muted)' }}>
                    占用最大：{storage.top[0].key}（{fmtBytes(storage.top[0].bytes)}）
                  </span>
                )}
              </div>
            )}
            {storage && (
              <div style={{ marginTop: 10 }} aria-label={`本地存储已用 ${fmtBytes(storage.bytes)}`}>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--copper)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${meterPct}%`, height: '100%', borderRadius: 4,
                    background: meterColor, transition: 'width .6s var(--smooth-ease)'
                  }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  本地缓存水位 {fmtBytes(storage.bytes)} / 上限约 {fmtBytes(HARD_LIMIT)}（云端数据不计入，仅本地缓存与离线兜底）
                </p>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <GiltBtn onClick={exportBackup}>{exported ? '✓ 已导出' : '封装记忆 · 导出全量备份 JSON'}</GiltBtn>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="setting-row">
          {/* 尝味人徽章（方案 5.6）：圆形糖果徽章 */}
          <div className="tool candy-badge" role="img" aria-label="尝味人徽章" />
          <div style={{ flex: 1 }}>
            <div className="panel-title">🏅 尝味师凭证</div>
            {/* 原来是硬编码的哥特暗金 #d6c79b，在白色果冻面板上只有约 1.9:1，邮箱几乎读不出来 */}
            <p style={{ fontSize: 14, color: 'var(--ink)', letterSpacing: 1 }}>{userEmail ?? '未登录'}</p>
            <div style={{ marginTop: 12 }}>
              <GiltBtn tone="ghost" onClick={signOut}>退出登录</GiltBtn>
            </div>
          </div>
        </div>
      </div>

      <div className="panel furnace-zone">
        <div className="setting-row">
          {/* 糖果熔炉（方案 5.7）：橙红炉体 + 炉口 + 跳动的火焰（只动 transform/opacity） */}
          <div className="tool candy-furnace" role="img" aria-label="糖果熔炉">
            <span className="cf-flame" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="panel-title">🔥 危险区 · 糖果熔炉</div>
            {/* 危险区说明改用草莓红（--bad-ink，5.3:1）：既是警告语义、又与全站「错」通道同一色系。
                原来的 #d98ba0 在浅底上只有约 2.6:1 */}
            <p style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--bad-ink)' }}>
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

      {/* 页脚原来是 rgba(156,132,82,.55) 哥特青铜色再叠 55% 透明，约 1.6:1，基本看不见 */}
      <p style={{ textAlign: 'center', fontSize: 11, letterSpacing: 2, color: 'var(--ink-3)', marginTop: 26 }}>
        ✦ 糖果题库 v1.0 · 尝味师专用 · 纯网页端 · 云端成长档案同步 ✦
      </p>
    </div>
  )
}

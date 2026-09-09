// Learn 页闭环件真机验证（demo 模式）：P2 自由回忆周检卡 + P3 快照/走势线
// 用法：NODE_PATH=C:/Users/青丘白浅/.workbuddy/binaries/node/workspace/node_modules node verify-closure.cjs
const WebSocket = require('ws')
const fs = require('fs')
const os = require('os')
const path = require('path')

const OUT = path.join(os.tmpdir(), 'qp-learn-closure.png')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const list = await (await fetch('http://127.0.0.1:9223/json')).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 })
  let id = 0
  const pending = new Map()
  ws.on('message', (raw) => {
    const m = JSON.parse(raw)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    return r.result?.result?.value
  }
  await new Promise((r) => ws.on('open', r))
  await send('Page.enable')
  await send('Page.navigate', { url: 'http://127.0.0.1:5176/quiz-platform/' })
  await sleep(3500)

  const report = {}

  // ① demo 数据下 recallDue 判定：demo 记录集中在近 12 天且数量≥10 → 应出现周检卡
  report.recallCard = await evalJs(`(() => {
    const c = document.querySelector('.recall-card')
    if (!c) return { present: false }
    const rows = [...c.querySelectorAll('.recall-row')]
    return {
      present: true,
      title: c.querySelector('h4')?.textContent ?? '',
      rows: rows.length,
      sampleDomain: rows[0]?.querySelector('.recall-domain')?.textContent ?? '',
      chipOnAny: rows.some((r) => r.querySelectorAll('.chip').length === 3)
    }
  })()`)

  // ② 首域点「想不起来」(第3个chip)、其余点「讲得清」(第1个chip) → 提交按钮应从禁用变可用
  report.gradeFlow = await evalJs(`(async () => {
    const c = document.querySelector('.recall-card')
    if (!c) return { skipped: 'no card' }
    const submit = [...c.querySelectorAll('button')].find((b) => b.textContent.includes('提交自评'))
    const disabledBefore = submit?.disabled ?? null
    c.querySelectorAll('.recall-row').forEach((row, i) => row.querySelectorAll('.chip')[i === 0 ? 2 : 0].click())
    await new Promise((r) => setTimeout(r, 300))
    const disabledAfter = submit?.disabled ?? null
    return { disabledBefore, disabledAfter }
  })()`)
  await evalJs(`(() => { const c = document.querySelector('.recall-card'); if (!c) return; [...c.querySelectorAll('button')].find((b) => b.textContent.includes('提交自评'))?.click() })()`)
  await sleep(1200)
  // ③ 提交后：周检卡消失；薄弱域卡出现（首域自评非「讲得清」）且带「练薄弱域」按钮
  report.afterSubmit = await evalJs(`(() => {
    const w = document.querySelector('.recall-weak')
    return {
      cardGone: !document.querySelector('.recall-card'),
      weakPresent: !!w,
      weakTitle: w?.querySelector('h4')?.textContent ?? '',
      weakDomains: w?.querySelector('p')?.textContent?.slice(0, 40) ?? '',
      weakBtn: [...(w?.querySelectorAll('button') ?? [])].map((b) => b.textContent)
    }
  })()`)

  // ④ 快照：demo 下挂载已打 1 份（逻辑由 t-closure 锁定）；走势线不足 2 份不画、趋势文案不造假
  report.snapshotUi = await evalJs(`(() => ({
    sparkSvg: !!document.querySelector('.rank-spark'),
    trendShown: /7日趋势/.test(document.querySelector('.rank-info p')?.textContent ?? ''),
    rankCardOk: !!document.querySelector('.rank-card .rank-info p')
  }))()`)

  await send('Page.captureScreenshot', { format: 'png' }).then((r) => {
    if (r.result?.data) fs.writeFileSync(OUT, Buffer.from(r.result.data, 'base64'))
  })
  console.log(JSON.stringify(report, null, 2))
  console.log('screenshot:', OUT, fs.existsSync(OUT) ? fs.statSync(OUT).size + 'B' : 'MISSING')
  ws.close()
}
main().catch((e) => { console.error('VERIFY FAIL', e); process.exit(1) })

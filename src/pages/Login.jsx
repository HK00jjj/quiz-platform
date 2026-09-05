import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import { burstParticles } from '../components'

/* 登录页 · 糖果之门 */
export default function Login() {
  const signIn = useStore((s) => s.signIn)
  const syncError = useStore((s) => s.syncError)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [bgOn, setBgOn] = useState(false)
  const [burst, setBurst] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBgOn(true), 80)
    return () => clearTimeout(t)
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const err = await signIn(email.trim(), password)
    if (err) {
      setError('✗ 密码不对，再试一次？')
      setBusy(false)
      const box = document.querySelector('.login-gate-inner')
      if (box) {
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake')
      }
    } else {
      // 成功仪式：光芒爆发后淡出，交由 store 切到主界面
      setBurst(true)
      const r = document.querySelector('.login-gate')?.getBoundingClientRect()
      if (r) burstParticles(r.left + r.width / 2, r.top + r.height / 2, 'mixed', 30)
    }
  }

  return (
    <div className="login-stage">
      {/* 五个哥特位图从 JSX 删净（p11 星空 / p12 漩涡 / p7 青铜门 / p13 魔法球 / p44 分隔条）。
          candy.css 早就把它们 display:none 或 background-image:none 掉了，但 §6 那条规矩还在：
          display:none 的 <img> 照样发请求——登录页每次都在白下 p12.png 与 p13.webp。
          .login-bg 这个 div 要留：它的糖果渐变底就是 candy.css 挂在这个选择器上的。 */}
      <div className={'login-bg' + (bgOn ? ' on' : '')} />
      <div className="login-gate-wrap">
        <div className={'login-gate' + (burst ? ' gate-success' : '')}>
          <div className="login-gate-inner">
            {/* 糖果 hero：直接复用系统自有的 .ch-lolli（棒棒糖）与 .ch-candy（糖豆）——
                Learn 页的糖果橱窗用的就是这两个类。这里原本挂着哥特魔法球位图 A.magicOrb，
                §13 删掉后没补任何东西，页面就空了。不新增位图、不发明新 motif。 */}
            <div className="login-hero" aria-hidden="true">
              <span className="ch-lolli" />
              <span className="ch-candy c1" />
              <span className="ch-candy c2" />
              <span className="ch-candy c3" />
            </div>
            <h1 className="login-title">糖果之门</h1>
            <p className="login-sub">尝 味 师 登 录</p>
            {/* 糖果分隔条：复用 .divider / .zone-rule 的渐变配方，纯CSS零位图。
                原本这里是哥特铜质花纹条 A.divider(p44.png)。 */}
            <div className="login-divider" aria-hidden="true" />
            <form onSubmit={submit}>
              {/* §60 方案 A「糖霜胶囊」：emoji 图标（✉️🔒👁）换 1.7px 线性 SVG（与 CandyIcons 同源），
                  单层果冻胶囊由 candy.css §60 承担；聚焦态转薄荷走 CSS :focus-within，零 JS 状态 */}
              <div className="login-input">
                <span className="icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
                </span>
                <input type="email" required autoComplete="username" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" />
              </div>
              <div className="login-input">
                <span className="icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                </span>
                <input type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" />
                <button type="button" className="eye" onClick={() => setShowPwd(!showPwd)}
                  aria-label={showPwd ? '隐藏密码' : '显示密码'}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.6" /></svg>
                </button>
              </div>
              {error && <p className="login-error">{error}</p>}
              {!error && syncError && <p className="login-error">{syncError}</p>}
              <button className="btn lg block" style={{ marginTop: 20 }} disabled={busy}>
                {busy ? '正在登录…' : '进入糖果题库'}
              </button>
            </form>
            <p className="login-foot">✦ 糖果题库 v1.0 · 尝味师专用 · 纯网页端 · 云端甜蜜值同步 ✦</p>
          </div>
        </div>
      </div>
    </div>
  )
}

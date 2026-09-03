import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import { A } from '../assets'
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
      setError('✗ 密文错了，这颗糖有点酸～再试试？')
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
      <div className={'login-bg' + (bgOn ? ' on' : '')} style={{ backgroundImage: `url(${A.starryBg})` }} />
      <img className="login-vortex" src={A.vortex} alt="" />
      <div className="login-gate-wrap">
        <div className={'login-gate' + (burst ? ' gate-success' : '')}>
          <div className="login-gate-frame" style={{ backgroundImage: `url(${A.loginGate})` }} />
          <div className="login-gate-inner">
            <img className="login-orb" src={A.magicOrb} alt="" />
            <h1 className="login-title gold-title font-gothic">糖果之门</h1>
            <p className="login-sub">尝 味 师 登 入</p>
            <div className="login-divider" style={{ backgroundImage: `url(${A.divider})` }} />
            <form onSubmit={submit}>
              <div className="login-input">
                <span className="icon" aria-hidden="true">✉️</span>
                <input type="email" required autoComplete="username" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="邮箱 / 窥秘名" />
              </div>
              <div className="login-input">
                <span className="icon" aria-hidden="true">🔒</span>
                <input type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="甜蜜值密文" />
                <button type="button" className="eye" onClick={() => setShowPwd(!showPwd)}
                  aria-label={showPwd ? '隐藏密文' : '显示密文'}>👁</button>
              </div>
              {error && <p className="login-error">{error}</p>}
              {!error && syncError && <p className="login-error">{syncError}</p>}
              <button className="btn lg block" style={{ marginTop: 20 }} disabled={busy}>
                {busy ? '甜蜜值凝聚中…' : '🔮 开启糖果之门'}
              </button>
            </form>
            <p className="login-foot">✦ 糖果题库 v1.0 · 尝味师专用 · 纯网页端 · 云端甜蜜值同步 ✦</p>
          </div>
        </div>
      </div>
    </div>
  )
}

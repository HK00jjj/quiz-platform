[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:AGENT_BROWSER_SESSION = 'qp-s5'
$w = Split-Path -Parent $MyInvocation.MyCommand.Path
$shots = Join-Path $w 'shots'
$ab = "$env:APPDATA\npm\node_modules\agent-browser\bin\agent-browser-win32-x64.exe"
function Ev($c) { & $ab eval $c }

# 不要在这里调 `close`：无活动会话时它会死等（已实测卡死）。残留进程只能用 Stop-Process 清。
& $ab open 'http://127.0.0.1:5179/quiz-platform/' 2>$null | Out-Null
& $ab set viewport 390 844 2>$null | Out-Null
Start-Sleep -Seconds 8
Ev "location.hash='#/'" | Out-Null
Start-Sleep -Seconds 2
Ev "document.querySelector('button.btn.lg').click(); 'entered'" | Out-Null
Start-Sleep -Seconds 4

Write-Output '--- BEFORE @390x844 ---'
Ev "JSON.stringify({hash:location.hash,card:(()=>{const b=document.querySelector('.q-card').getBoundingClientRect();return{w:+b.width.toFixed(1),h:+b.height.toFixed(1),ratio:+(b.width/b.height).toFixed(3)}})(),sc:(()=>{const s=document.querySelector('.q-face-scroll'),c=getComputedStyle(s);return{sh:s.scrollHeight,ch:s.clientHeight,over:s.scrollHeight>s.clientHeight+1,top:s.scrollTop,behavior:c.scrollBehavior,overscroll:c.overscrollBehaviorY,gutter:c.scrollbarGutter}})(),seal:!!document.querySelector('.seal-lock')})"

# React 18 自动批处理：同一个 eval 里先点选项再点提交，提交时按钮仍是 disabled，揭晓根本不会发生。
# 必须拆成两次 eval，中间等 state 落地。
Write-Output '--- PICK ANSWER (separate eval) ---'
Ev "const o=document.querySelector('.opt-row');if(o)o.click();const j=document.querySelector('.judge-card');if(j)j.click();const f=document.querySelector('.fill-item input');if(f){f.value='x';f.dispatchEvent(new Event('input',{bubbles:true}))}const t=document.querySelector('.rune-textarea');if(t){t.value='x';t.dispatchEvent(new Event('input',{bubbles:true}))}'picked'" | Out-Null
Start-Sleep -Milliseconds 800
Ev "JSON.stringify({btn:((document.querySelector('.q-face-foot button')||{}).innerText||'').trim(),disabled:(document.querySelector('.q-face-foot button')||{}).disabled})"

Write-Output '--- SAMPLER ON + TRIGGER REVEAL ---'
Ev "window.__f=[];let __l=performance.now();function __t(){const n=performance.now();const s=document.querySelector('.q-face-scroll');window.__f.push([+(n-__l).toFixed(1),s?+s.scrollTop.toFixed(1):0]);__l=n;if(window.__f.length<120)requestAnimationFrame(__t)}requestAnimationFrame(__t);'sampling'" | Out-Null
Ev "document.querySelector('.q-face-foot button').click();'revealed'" | Out-Null
Start-Sleep -Seconds 3

Write-Output '--- FRAME TIMING (逐帧: 帧间隔 + scrollTop，用于判定慢帧是否落在滚动窗口内) ---'
Ev "(()=>{const f=window.__f;if(!f||f.length<3)return 'NOSAMPLE';const d=f.slice(1);const ds=d.map(x=>x[0]);const avg=ds.reduce((a,b)=>a+b,0)/ds.length;const srt=ds.slice().sort((a,b)=>a-b);const moved=[];for(let i=1;i<d.length;i++){if(Math.abs(d[i][1]-d[i-1][1])>0.3)moved.push(i)}const win=moved.length?{firstFrame:moved[0],lastFrame:moved[moved.length-1],frames:moved.length,maxMs:+Math.max.apply(null,moved.map(i=>d[i][0])).toFixed(1),avgMs:+(moved.reduce((a,i)=>a+d[i][0],0)/moved.length).toFixed(2),slowInWindow:moved.filter(i=>d[i][0]>20).length}:null;return JSON.stringify({frames:f.length,fps:+(1000/avg).toFixed(1),p95Ms:+srt[Math.floor(srt.length*0.95)].toFixed(1),maxMs:Math.max.apply(null,ds),slowIdx:ds.map((v,i)=>v>20?i:-1).filter(i=>i>=0),scrollWin:win,scrollTopFrom:f[0][1],scrollTopTo:f[f.length-1][1]})})()"

Write-Output '--- AFTER ---'
Ev "JSON.stringify({sealGone:!document.querySelector('.seal-lock'),sc:(()=>{const s=document.querySelector('.q-face-scroll');return{sh:s.scrollHeight,ch:s.clientHeight,top:+s.scrollTop.toFixed(1),atEnd:s.scrollTop>=s.scrollHeight-s.clientHeight-2}})(),gp:(()=>{const s=document.querySelector('.q-face-scroll'),g=document.querySelector('.grade-panel');if(!g)return null;const a=g.getBoundingClientRect(),b=s.getBoundingClientRect();return{topIn:+(a.top-b.top).toFixed(1),bottomIn:+(a.bottom-b.top).toFixed(1),viewportH:+b.height.toFixed(1),fullyInside:a.top>=b.top-1&&a.bottom<=b.bottom+1}})(),ans:(()=>{const a=document.querySelector('.answer-scroll-box');return a?{h:+a.getBoundingClientRect().height.toFixed(1),anim:getComputedStyle(a).animationName}:null})()})"
# screenshot 放在最末尾：它实测过会卡死，放后面则卡住也不影响已输出的测量数据

Write-Output '--- SCROLL DURING SAMPLING (was it moving smoothly?) ---'
Ev "JSON.stringify({note:'second sample: manual smooth scroll to end',before:(()=>{const s=document.querySelector('.q-face-scroll');return s.scrollTop})()})"
Ev "window.__g=[];let __m=performance.now();const __s=document.querySelector('.q-face-scroll');function __u(){const n=performance.now();window.__g.push({d:+(n-__m).toFixed(1),t:+__s.scrollTop.toFixed(1)});__m=n;if(window.__g.length<40)requestAnimationFrame(__u)}__s.scrollTo({top:0,behavior:'instant'});requestAnimationFrame(__u);__s.scrollTo({top:__s.scrollHeight});'rescrolling'" | Out-Null
Start-Sleep -Seconds 2
Ev "(()=>{const g=window.__g;if(!g||g.length<3)return 'NOSAMPLE';const d=g.slice(1).map(x=>x.d);const avg=d.reduce((a,b)=>a+b,0)/d.length;const steps=g.map(x=>x.t);const moved=steps.filter((v,i)=>i>0&&Math.abs(v-steps[i-1])>0.5).length;return JSON.stringify({frames:g.length,avgMs:+avg.toFixed(2),fps:+(1000/avg).toFixed(1),maxMs:Math.max(...d),interpolatedSteps:moved,from:steps[0],to:steps[steps.length-1],smoothNotTeleport:moved>3})})()"

Write-Output '--- DONE ---'
& $ab screenshot (Join-Path $shots 'v-scroll-mobile.png') 2>$null | Out-Null
Write-Output '--- SHOT SAVED ---'

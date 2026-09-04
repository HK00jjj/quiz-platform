[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# 会话名带上一次清理后的新名：旧会话的状态文件会指向已死的 CDP 端口，
# 导致每条命令都等一次 TCP 超时（os error 10060），8 条就能耗光 280s
$env:AGENT_BROWSER_SESSION = 'qp-d1'
$w = Split-Path -Parent $MyInvocation.MyCommand.Path
$shots = Join-Path $w 'shots'
$ab = "$env:APPDATA\npm\node_modules\agent-browser\bin\agent-browser-win32-x64.exe"
function Ev($c) { & $ab eval $c }

# 布局填充探针：卡牌尺寸/占视口比例/下方留白/页面是否溢出/牌面滚动是否溢出
$fill = "JSON.stringify({vp:{w:innerWidth,h:innerHeight},wrap:(()=>{const b=document.querySelector('.q-card-wrap').getBoundingClientRect();return{w:+b.width.toFixed(1),h:+b.height.toFixed(1),top:+b.top.toFixed(1),bottom:+b.bottom.toFixed(1),ratio:+(b.width/b.height).toFixed(3)}})(),face:(()=>{const f=document.querySelector('.q-face');if(!f)return null;const b=f.getBoundingClientRect();return{w:+b.width.toFixed(1),h:+b.height.toFixed(1)}})(),gapBelow:+(innerHeight-document.querySelector('.q-card-wrap').getBoundingClientRect().bottom).toFixed(1),fillPct:+(document.querySelector('.q-card-wrap').getBoundingClientRect().height/innerHeight*100).toFixed(1),docOverflow:document.documentElement.scrollHeight>document.documentElement.clientHeight+1,docSH:document.documentElement.scrollHeight,docCH:document.documentElement.clientHeight,sc:(()=>{const s=document.querySelector('.q-face-scroll');return{sh:s.scrollHeight,ch:s.clientHeight,over:s.scrollHeight>s.clientHeight+1}})(),type:(document.querySelector('.q-tags .stamp')||{}).title})"

# eval 复用同一个 JS 上下文，顶层 const 第二次执行会报 "Identifier has already been declared"，必须包 IIFE
$pick = "(()=>{const o=document.querySelector('.opt-row');if(o)o.click();const j=document.querySelector('.judge-card');if(j)j.click();const f=document.querySelector('.fill-item input');if(f){f.value='x';f.dispatchEvent(new Event('input',{bubbles:true}))}const t=document.querySelector('.rune-textarea');if(t){t.value='x';t.dispatchEvent(new Event('input',{bubbles:true}))}return 'picked'})()"
$reveal = "(()=>{document.querySelector('.q-face-foot button').click();return 'revealed'})()"
$rate = "(()=>{const r=document.querySelector('.rate-btn.r-remember');if(r)r.click();return 'rated'})()"

$judge = "JSON.stringify({count:((document.querySelector('.practice-count')||{}).innerText||'').trim(),type:(document.querySelector('.q-tags .stamp')||{}).title,pair:(()=>{const p=document.querySelector('.judge-pair');if(!p)return null;const cs=getComputedStyle(p);return{dir:cs.flexDirection,align:cs.alignItems,gap:cs.gap,h:+p.getBoundingClientRect().height.toFixed(1)}})(),cards:[...document.querySelectorAll('.judge-card')].map(c=>{const b=c.getBoundingClientRect(),cs=getComputedStyle(c);return{w:+b.width.toFixed(1),h:+b.height.toFixed(1),ar:+(b.width/b.height).toFixed(2),cx:+(b.left+b.width/2).toFixed(1),bgSize:cs.backgroundSize,bgPos:cs.backgroundPosition}}),faceCx:(()=>{const f=document.querySelector('.q-face').getBoundingClientRect();return+(f.left+f.width/2).toFixed(1)})(),faceW:(()=>{const f=document.querySelector('.q-face').getBoundingClientRect();return+f.width.toFixed(1)})(),labelFont:(()=>{const l=document.querySelector('.judge-label');if(!l)return null;const cs=getComputedStyle(l);return cs.fontSize+' w'+cs.fontWeight+' ls'+cs.letterSpacing})(),sc:(()=>{const s=document.querySelector('.q-face-scroll');return{sh:s.scrollHeight,ch:s.clientHeight,over:s.scrollHeight>s.clientHeight+1}})(),docOverflow:document.documentElement.scrollHeight>document.documentElement.clientHeight+1})"

$center = "JSON.stringify({vpCx:+(innerWidth/2).toFixed(1),wrap:(()=>{const b=document.querySelector('.q-card-wrap').getBoundingClientRect();return{cx:+(b.left+b.width/2).toFixed(1),gapL:+b.left.toFixed(1),gapR:+(innerWidth-b.right).toFixed(1),gapT:+b.top.toFixed(1),gapB:+(innerHeight-b.bottom).toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}})(),faceCx:(()=>{const b=document.querySelector('.q-face').getBoundingClientRect();return+(b.left+b.width/2).toFixed(1)})(),zoneCx:['.zone-q','.zone-a','.zone-s'].map(s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return+(b.left+b.width/2).toFixed(1)}),judgeCx:[...document.querySelectorAll('.judge-card')].map(c=>{const b=c.getBoundingClientRect();return+(b.left+b.width/2).toFixed(1)}),judgeSize:[...document.querySelectorAll('.judge-card')].map(c=>{const b=c.getBoundingClientRect();return b.width.toFixed(1)+'x'+b.height.toFixed(1)}),judgePair:(()=>{const p=document.querySelector('.judge-pair');if(!p)return null;const cs=getComputedStyle(p);return cs.flexDirection+'/'+cs.justifyContent})(),labelAlign:(()=>{const c=document.querySelector('.judge-card');if(!c)return null;const cs=getComputedStyle(c);return cs.alignItems+'/'+cs.justifyContent+'/'+cs.backgroundSize})(),scPad:(()=>{const s=document.querySelector('.q-face-scroll'),cs=getComputedStyle(s);return{gutter:cs.scrollbarGutter,cl:+s.clientWidth.toFixed(1),sl:+(s.getBoundingClientRect().left).toFixed(1),sr:+(s.getBoundingClientRect().right).toFixed(1)}})(),docOverflow:document.documentElement.scrollHeight>document.documentElement.clientHeight+1,sc:(()=>{const s=document.querySelector('.q-face-scroll');return{sh:s.scrollHeight,ch:s.clientHeight,over:s.scrollHeight>s.clientHeight+1}})()})"

& $ab open 'http://127.0.0.1:5179/quiz-platform/' 2>$null | Out-Null
& $ab set viewport 390 844 2>$null | Out-Null
Start-Sleep -Seconds 8
Ev "location.hash='#/'" | Out-Null
Start-Sleep -Seconds 2
Ev "document.querySelector('button.btn.lg').click(); 'entered'" | Out-Null
Start-Sleep -Seconds 4

Write-Output '===== FILL @390x844 (first question) ====='
Ev $fill
Write-Output '----- CENTER @390x844 -----'
Ev $center

# 推进到判断题：每步独立 eval（React 18 批处理会让同一次 eval 内的连点失效）
for ($i = 1; $i -le 6; $i++) {
  $n = Ev "document.querySelectorAll('.judge-card').length"
  Write-Output "  step $i : judge cards = $n"
  if ("$n" -match '[1-9]') { break }
  Ev $pick | Out-Null; Start-Sleep -Milliseconds 700
  Ev $reveal | Out-Null; Start-Sleep -Milliseconds 1700
  Ev $rate | Out-Null; Start-Sleep -Milliseconds 1300
}

Write-Output '===== JUDGE STACK @390x844 ====='
Ev $judge
Write-Output '----- CENTER @390x844 (judge) -----'
Ev $center

& $ab set viewport 1280 900 2>$null | Out-Null
Start-Sleep -Seconds 3
Write-Output '===== FILL @1280x900 ====='
Ev $fill
Write-Output '===== JUDGE STACK @1280x900 ====='
Ev $judge
Write-Output '----- CENTER @1280x900 (judge) -----'
Ev $center

# 截图全部放最后：screenshot 实测过会卡死，放后面则卡住也不影响已输出的测量数据
Write-Output '===== SCREENSHOTS ====='
& $ab screenshot (Join-Path $shots 'v-judge-d.png') 2>$null | Out-Null
Write-Output '  desktop shot ok'
& $ab set viewport 390 844 2>$null | Out-Null
Start-Sleep -Seconds 2
& $ab screenshot (Join-Path $shots 'v-judge-m.png') 2>$null | Out-Null
Write-Output '  mobile judge shot ok'

Write-Output '===== ERRORS ====='
& $ab console 2>$null | Select-String -Pattern 'error|Error' | Select-Object -First 6
Write-Output '===== DONE ====='

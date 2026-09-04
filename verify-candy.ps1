[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# 会话名可由外部传入：僵尸会话的状态文件会指向已死的 CDP 端口，换名字比反复重试有效
if ($env:QB_SESSION) { $env:AGENT_BROWSER_SESSION = $env:QB_SESSION }
else { $env:AGENT_BROWSER_SESSION = 'qp-c3' }
$w = Split-Path -Parent $MyInvocation.MyCommand.Path
$shots = Join-Path $w 'shots'
$ab = "$env:APPDATA\npm\node_modules\agent-browser\bin\agent-browser-win32-x64.exe"
function Ev($c) { & $ab eval $c }

# 全局糖果化探针：底色/字体/气泡/哥特残留/三格导航
$candy = "JSON.stringify({vp:{w:innerWidth,h:innerHeight},body:(()=>{const cs=getComputedStyle(document.body);return{bgImage:cs.backgroundImage.slice(0,58),font:cs.fontFamily.slice(0,26),color:cs.color}})(),bubbles:document.querySelectorAll('.bubble').length,gothicLeft:{abyss:document.querySelectorAll('.abyss-silhouette').length,star:document.querySelectorAll('.abyss-star').length},nav:(()=>{const n=document.querySelector('.bottom-nav');if(!n)return null;const cs=getComputedStyle(n);return{labels:[...n.querySelectorAll('.nav-item>span:last-child')].map(s=>s.innerText),imgs:n.querySelectorAll('img').length,radius:cs.borderTopLeftRadius,blur:cs.backdropFilter.slice(0,20),active:(n.querySelector('.nav-item.active>span:last-child')||{}).innerText}})(),head:(document.querySelector('.page-head h1,.page-head h2')||{}).innerText})"

# 答题卡糖果化探针
$card = "JSON.stringify({card:(()=>{const c=document.querySelector('.q-card');if(!c)return null;const cs=getComputedStyle(c);return{radius:cs.borderTopLeftRadius,borderW:cs.borderTopWidth,borderC:cs.borderTopColor,blur:cs.backdropFilter.slice(0,18),bgC:cs.backgroundColor,borderImage:cs.borderImageSource.slice(0,22)}})(),face:(()=>{const cs=getComputedStyle(document.querySelector('.q-face'));return{bgImg:cs.backgroundImage.slice(0,22),bgC:cs.backgroundColor}})(),stampImgs:document.querySelectorAll('.q-tags .stamp').length,typeCandy:(document.querySelector('.type-candy')||{}).innerText,zoneQ:(()=>{const z=document.querySelector('.zone-q');if(!z)return null;const cs=getComputedStyle(z);return{radius:cs.borderTopLeftRadius,bg:cs.backgroundColor}})(),optRow:(()=>{const o=document.querySelector('.opt-row');if(!o)return null;const cs=getComputedStyle(o);return{radius:cs.borderTopLeftRadius,bg:cs.backgroundColor,borderC:cs.borderTopColor,color:cs.color}})(),stem:(()=>{const s=document.querySelector('.q-stem');if(!s)return null;const cs=getComputedStyle(s);return{color:cs.color,weight:cs.fontWeight,font:cs.fontFamily.slice(0,20),size:cs.fontSize}})(),seal:(()=>{const s=document.querySelector('.seal-wax');if(!s)return null;const cs=getComputedStyle(s);return{imgs:s.querySelectorAll('img').length,radius:cs.borderTopLeftRadius,bg:cs.backgroundImage.slice(0,34)}})(),wrap:(()=>{const b=document.querySelector('.q-card-wrap').getBoundingClientRect();return{w:+b.width.toFixed(1),h:+b.height.toFixed(1),gapB:+(innerHeight-b.bottom).toFixed(1)}})(),sc:(()=>{const s=document.querySelector('.q-face-scroll');return{sh:s.scrollHeight,ch:s.clientHeight,over:s.scrollHeight>s.clientHeight+1}})(),docOverflow:document.documentElement.scrollHeight>document.documentElement.clientHeight+1})"

# 判断题两颗糖果
$judge = "JSON.stringify({pair:(()=>{const cs=getComputedStyle(document.querySelector('.judge-pair'));return{dir:cs.flexDirection,gap:cs.gap}})(),cards:[...document.querySelectorAll('.judge-card')].map(c=>{const b=c.getBoundingClientRect(),cs=getComputedStyle(c);return{w:+b.width.toFixed(1),h:+b.height.toFixed(1),pctOfZone:+(b.width/document.querySelector('.q-answer-zone').getBoundingClientRect().width*100).toFixed(1),radius:cs.borderTopLeftRadius,bgImg:cs.backgroundImage.slice(0,20),borderC:cs.borderTopColor}}),labels:[...document.querySelectorAll('.judge-label')].map(l=>l.innerText+'@'+getComputedStyle(l).color),sc:(()=>{const s=document.querySelector('.q-face-scroll');return{sh:s.scrollHeight,ch:s.clientHeight,over:s.scrollHeight>s.clientHeight+1}})()})"

$pick = "(()=>{const o=document.querySelector('.opt-row');if(o)o.click();const j=document.querySelector('.judge-card');if(j)j.click();const f=document.querySelector('.fill-item input');if(f){f.value='x';f.dispatchEvent(new Event('input',{bubbles:true}))}const t=document.querySelector('.rune-textarea');if(t){t.value='x';t.dispatchEvent(new Event('input',{bubbles:true}))}return 'picked'})()"
$reveal = "(()=>{document.querySelector('.q-face-foot button').click();return 'revealed'})()"
$rate = "(()=>{const r=document.querySelector('.rate-btn.r-remember');if(r)r.click();return 'rated'})()"

# 预检：先用 HTTP 确认页面真的能返回。否则 open 会无限死等（已实测踩过三次：
# dev server 挂了 / 渲染阻塞的外链字体 / 僵尸会话），每次白烧 280s
try {
  $pre = Invoke-WebRequest 'http://127.0.0.1:5179/quiz-platform/' -UseBasicParsing -TimeoutSec 12
  Write-Output "preflight: HTTP $($pre.StatusCode) / $($pre.RawContentLength) B / session=$($env:AGENT_BROWSER_SESSION)"
} catch {
  Write-Output "preflight FAILED: $($_.Exception.Message) —— 页面不可达，直接退出，不让 open 死等"
  exit 1
}

& $ab open 'http://127.0.0.1:5179/quiz-platform/' 2>$null | Out-Null
& $ab set viewport 390 844 2>$null | Out-Null
Start-Sleep -Seconds 9
Ev "location.hash='#/'" | Out-Null
Start-Sleep -Seconds 2

Write-Output '===== CANDY GLOBAL @390x844 (learn page) ====='
Ev $candy

Ev "document.querySelector('button.btn.lg').click(); 'entered'" | Out-Null
Start-Sleep -Seconds 4
Write-Output '===== CANDY CARD @390x844 ====='
Ev $card

for ($i = 1; $i -le 6; $i++) {
  $n = Ev "document.querySelectorAll('.judge-card').length"
  Write-Output "  step $i : judge = $n"
  if ("$n" -match '[1-9]') { break }
  Ev $pick | Out-Null; Start-Sleep -Milliseconds 700
  Ev $reveal | Out-Null; Start-Sleep -Milliseconds 1700
  Ev $rate | Out-Null; Start-Sleep -Milliseconds 1300
}
Write-Output '===== JUDGE CANDY @390x844 ====='
Ev $judge

& $ab set viewport 1280 900 2>$null | Out-Null
Start-Sleep -Seconds 3
Write-Output '===== CANDY CARD @1280x900 ====='
Ev $card
Write-Output '===== JUDGE CANDY @1280x900 ====='
Ev $judge

Write-Output '===== SCREENSHOTS ====='
& $ab screenshot (Join-Path $shots 'c-judge-d.png') 2>$null | Out-Null
Write-Output '  desktop ok'
& $ab set viewport 390 844 2>$null | Out-Null
Start-Sleep -Seconds 2
& $ab screenshot (Join-Path $shots 'c-judge-m.png') 2>$null | Out-Null
Write-Output '  mobile judge ok'
Ev "location.hash='#/'" | Out-Null
Start-Sleep -Seconds 2
& $ab screenshot (Join-Path $shots 'c-learn-m.png') 2>$null | Out-Null
Write-Output '  mobile learn ok'

Write-Output '===== ERRORS ====='
& $ab console 2>$null | Select-String -Pattern 'error|Error' | Select-Object -First 8
Write-Output '===== DONE ====='

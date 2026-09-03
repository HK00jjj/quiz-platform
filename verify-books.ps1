[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
if ($env:QB_SESSION) { $env:AGENT_BROWSER_SESSION = $env:QB_SESSION } else { $env:AGENT_BROWSER_SESSION = 'qp-bk2' }
$w = Split-Path -Parent $MyInvocation.MyCommand.Path
$shots = Join-Path $w 'shots'
$ab = "$env:APPDATA\npm\node_modules\agent-browser\bin\agent-browser-win32-x64.exe"
function Ev($c) { & $ab eval $c }

try {
  $pre = Invoke-WebRequest 'http://127.0.0.1:5179/quiz-platform/' -UseBasicParsing -TimeoutSec 12
  Write-Output "preflight: HTTP $($pre.StatusCode) / $($pre.RawContentLength) B / session=$($env:AGENT_BROWSER_SESSION)"
} catch { Write-Output "preflight FAILED: $($_.Exception.Message)"; exit 1 }

# 书架状态探针
$shelf = "JSON.stringify({hash:location.hash,cards:[...document.querySelectorAll('.book-card:not(.book-new)')].map(c=>({name:(c.querySelector('.book-name')||{}).innerText||(c.querySelector('.book-rename')?'(editing)':'?'),meta:(c.querySelector('.book-meta')||{}).innerText,on:c.classList.contains('on'),empty:c.classList.contains('empty'),spine:getComputedStyle(c.querySelector('.book-spine')).backgroundColor})),current:(document.querySelector('.book-current')||{}).innerText,note:(document.querySelector('.book-note')||{}).innerText,newCard:!!document.querySelector('.book-new'),form:!!document.querySelector('.book-form'),confirm:!!document.querySelector('.book-confirm'),ops:document.querySelectorAll('.book-op').length})"
# 学习页探针：验证「切书=换数据上下文」是否真的生效
$learn = "JSON.stringify({hash:location.hash,gems:[...document.querySelectorAll('.count-gem')].map(e=>e.innerText.trim()),empty:!!document.querySelector('.empty-state'),bodyHit:(document.body.innerText.match(/(还没有|暂无|0 题|空)/g)||[]).slice(0,4),head:document.body.innerText.replace(/\\s+/g,' ').slice(0,90)})"
# React 受控输入必须用原生 setter + input 事件，直接赋 .value 不会触发 onChange
$setv = "window.__setv=(el,v)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));return v};'ok'"

& $ab open 'http://127.0.0.1:5179/quiz-platform/' 2>$null | Out-Null
& $ab set viewport 1280 900 2>$null | Out-Null
Start-Sleep -Seconds 9
Ev $setv | Out-Null
Ev "location.hash='#/settings'" | Out-Null
Start-Sleep -Seconds 3

Write-Output '===== 1. 书架初始（应有 2 本演示书：28题 + 0题）====='
Ev $shelf

Write-Output '===== 2. 切到空书 ====='
Ev "(()=>{const c=document.querySelectorAll('.book-card:not(.book-new)');c[1].click();return 'clicked '+c.length})()" | Out-Null
Start-Sleep -Seconds 2
Ev $shelf

Write-Output '===== 3. 隔离性验证：学习页应变成 0 题 ====='
Ev "location.hash='#/'" | Out-Null
Start-Sleep -Seconds 2
Ev $learn

Write-Output '===== 4. 切回第一本，学习页应恢复 28 题 ====='
Ev "location.hash='#/settings'" | Out-Null
Start-Sleep -Seconds 2
Ev "(()=>{document.querySelectorAll('.book-card:not(.book-new)')[0].click();return 'ok'})()" | Out-Null
Start-Sleep -Seconds 2
Ev "location.hash='#/'" | Out-Null
Start-Sleep -Seconds 2
Ev $learn

Write-Output '===== 5. 新建题库 ====='
Ev "location.hash='#/settings'" | Out-Null
Start-Sleep -Seconds 2
Ev "(()=>{document.querySelector('.book-new').click();return 'form opened'})()" | Out-Null
Start-Sleep -Seconds 1
Ev "(()=>{const i=document.getElementById('book-name-input');if(!i)return 'NO INPUT';window.__setv(i,'高等数学');const d=document.querySelectorAll('.color-dot');d[3].click();const ic=document.querySelectorAll('.icon-pick');ic[2].click();return 'filled'})()" | Out-Null
Start-Sleep -Milliseconds 600
Ev "(()=>{const b=[...document.querySelectorAll('.book-form .btn')].find(x=>/创建/.test(x.innerText));if(!b)return 'NO BTN';b.click();return 'created'})()" | Out-Null
Start-Sleep -Seconds 2
Ev $shelf

Write-Output '===== 6. 重命名新书 ====='
Ev "(()=>{const cards=[...document.querySelectorAll('.book-card:not(.book-new)')];const t=cards[cards.length-1];t.querySelector('.book-op').click();return 'editing'})()" | Out-Null
Start-Sleep -Milliseconds 700
Ev "(()=>{const i=document.querySelector('.book-rename');if(!i)return 'NO RENAME INPUT';window.__setv(i,'改名后的题库');i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return 'renamed'})()" | Out-Null
Start-Sleep -Seconds 2
Ev $shelf

Write-Output '===== 7. 删除新书（需输入书名二次确认）====='
Ev "(()=>{const cards=[...document.querySelectorAll('.book-card:not(.book-new)')];const t=cards[cards.length-1];t.querySelectorAll('.book-op')[2].click();return 'confirm opened'})()" | Out-Null
Start-Sleep -Milliseconds 700
Ev "(()=>{const c=document.querySelector('.book-confirm');if(!c)return 'NO CONFIRM';const i=c.querySelector('input');window.__setv(i,'改名后的题库');return 'typed'})()" | Out-Null
Start-Sleep -Milliseconds 600
Ev "(()=>{const b=[...document.querySelectorAll('.book-confirm .btn')].find(x=>/确认删除/.test(x.innerText));if(!b)return 'NO BTN';if(b.disabled)return 'STILL DISABLED';b.click();return 'deleted'})()" | Out-Null
Start-Sleep -Seconds 2
Ev $shelf

Write-Output '===== 8. 删除后学习页应仍是 28 题（未误伤）====='
Ev "location.hash='#/'" | Out-Null
Start-Sleep -Seconds 2
Ev $learn

Write-Output '===== SCREENSHOT ====='
Ev "location.hash='#/settings'" | Out-Null
Start-Sleep -Seconds 2
& $ab screenshot (Join-Path $shots 'v-bookshelf.png') 2>$null | Out-Null
Write-Output '  shot ok'
& $ab set viewport 390 844 2>$null | Out-Null
Start-Sleep -Seconds 2
& $ab screenshot (Join-Path $shots 'v-bookshelf-m.png') 2>$null | Out-Null
Write-Output '  mobile shot ok'

Write-Output '===== ERRORS ====='
& $ab console 2>$null | Select-String -Pattern 'error|Error|Warning' | Select-Object -First 8
Write-Output '===== DONE ====='

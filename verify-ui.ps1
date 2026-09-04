[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:AGENT_BROWSER_SESSION = 'qp-verify'
$w = Split-Path -Parent $MyInvocation.MyCommand.Path
$shots = Join-Path $w 'shots'
New-Item -ItemType Directory -Force -Path $shots | Out-Null
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $w 'probe.js')))
# 直接调真实 exe：agent-browser.cmd 包装器走 cmd.exe，命令行上限 8191 字符，
# 而 base64 探针已达 8232 → "The command line is too long"；PowerShell 直调 exe 上限 32767
$ab = "$env:APPDATA\npm\node_modules\agent-browser\bin\agent-browser-win32-x64.exe"

function Probe($label) { Write-Output "===== $label ====="; & $ab eval -b $b64 2>$null }
function Shot($name) { & $ab screenshot (Join-Path $shots $name) 2>$null | Out-Null; Write-Output "  [shot] $name" }
function Nav($hash) { & $ab eval "location.hash='$hash'" 2>$null | Out-Null }
function Js($code) { & $ab eval $code 2>$null }
function Errs($label) {
  $e = & $ab console 2>$null | Select-String -Pattern '\[error\]'
  if ($e) { Write-Output "  !! ERRORS @ ${label}"; $e | Select-Object -First 4 } else { Write-Output "  [console] no error @ ${label}" }
}

# 无中文选择器：CTA 优先取 .btn.lg，退回第一张入口卡片
$enterPractice = "const el=[...document.querySelectorAll('button.btn')].find(b=>b.className.includes('lg'))||document.querySelector('.entry-card'); if(el) el.click(); el?(el.className+' | '+(el.getAttribute('href')||'')):'NOENTRY'"
$pickAnswer = "const o=document.querySelector('.opt-row'); if(o)o.click(); const j=document.querySelector('.judge-card'); if(j)j.click(); const fi=document.querySelector('.fill-item input'); if(fi){fi.value='x';fi.dispatchEvent(new Event('input',{bubbles:true}))}; (o?'opt':j?'judge':fi?'fill':'subj')"
$reveal = "const b=document.querySelector('.q-face-foot button'); if(b)b.click(); b?b.className:'NOBTN'"

# 必须先 open：会话被 close 后不 open 的话，eval 会跑在 about:blank 上，探针全部量空
& $ab open 'http://127.0.0.1:5179/quiz-platform/' 2>$null | Out-Null
& $ab set viewport 1280 900 2>$null | Out-Null
Start-Sleep -Seconds 8   # 开机仪式 3.4s + 首屏加载

Nav '#/settings'; Start-Sleep -Seconds 2
Probe 'SETTINGS @1280x900'; Shot 'v-settings.png'

Nav '#/bank'; Start-Sleep -Seconds 3
Probe 'BANK @1280x900'; Shot 'v-bank.png'
Js "document.querySelector('.bank-item').click(); 'clicked'" | Out-Null
Start-Sleep -Seconds 2
Probe 'BANK FLIPPED'; Shot 'v-bank-flip.png'

Nav '#/'; Start-Sleep -Seconds 2
Write-Output '===== ENTER PRACTICE ====='; Js $enterPractice
Start-Sleep -Seconds 4
Probe 'PRACTICE @1280x900'; Shot 'v-practice.png'; Errs 'PRACTICE'
Write-Output '===== PICK + REVEAL ====='; Js $pickAnswer; Start-Sleep -Seconds 1; Js $reveal
Start-Sleep -Seconds 2
Probe 'PRACTICE FEEDBACK'; Shot 'v-practice-feedback.png'; Errs 'FEEDBACK'
Write-Output '===== RATE -> FLIP -> AUTO NEXT ====='
$mtx = "JSON.stringify({m:getComputedStyle(document.querySelector('.q-flipper')).transform,front:document.querySelector('.q-flipper').classList.contains('is-front'),coverBg:getComputedStyle(document.querySelector('.card-flip-cover')).backgroundColor})"
Js "document.querySelector('.rate-btn.r-remember').click(); 'rated'" | Out-Null
Start-Sleep -Milliseconds 100; Write-Output '  [t~100ms]'; & $ab eval $mtx 2>$null
& $ab screenshot (Join-Path $shots 'v-flip-mid1.png') 2>$null | Out-Null
Start-Sleep -Milliseconds 110; Write-Output '  [t~250ms]'; & $ab eval $mtx 2>$null
& $ab screenshot (Join-Path $shots 'v-flip-mid2.png') 2>$null | Out-Null
Start-Sleep -Seconds 2
Probe 'PRACTICE AFTER AUTO-ADVANCE'; Shot 'v-practice-next.png'; Errs 'AUTO-NEXT'

# req3 复现场景：答题中途用 hash 直接离开（不走按钮、不触发 abortSession），导航必须仍在
Write-Output '===== NAV STABILITY (leave practice by hash) ====='
Nav '#/bank'; Start-Sleep -Seconds 2
Js "JSON.stringify({hash:location.hash,nav:document.querySelectorAll('.bottom-nav .nav-item').length,active:(document.querySelector('.nav-item.active')||{}).innerText||null,cards:document.querySelectorAll('.bank-item').length})"
Nav '#/'; Start-Sleep -Seconds 2
Js "JSON.stringify({hash:location.hash,nav:document.querySelectorAll('.bottom-nav .nav-item').length,active:(document.querySelector('.nav-item.active')||{}).innerText||null})"
Nav '#/stats'; Start-Sleep -Seconds 2
Js "JSON.stringify({hash:location.hash,nav:document.querySelectorAll('.bottom-nav .nav-item').length,active:(document.querySelector('.nav-item.active')||{}).innerText||null})"
Nav '#/settings'; Start-Sleep -Seconds 2
Js "JSON.stringify({hash:location.hash,nav:document.querySelectorAll('.bottom-nav .nav-item').length,active:(document.querySelector('.nav-item.active')||{}).innerText||null})"
Shot 'v-nav-after-leave.png'; Errs 'NAV'

# req4 复现场景：题库牌墓滚到屏外再翻面（content-visibility 曾把 preserve-3d 压平）
Write-Output '===== BANK FLIP AFTER SCROLL ====='
Nav '#/bank'; Start-Sleep -Seconds 2
Js "window.scrollTo(0,1400); 'scrolled'" | Out-Null; Start-Sleep -Seconds 1
Js "const c=document.querySelectorAll('.bank-item');const t=c[c.length-1];t.scrollIntoView({block:'center'});t.click();'clicked-last'" | Out-Null
Start-Sleep -Seconds 2
Js "JSON.stringify({flipped:document.querySelectorAll('.bank-item.flipped').length,frontVis:getComputedStyle(document.querySelector('.bank-item.flipped .tarot-face.front')).visibility,backVis:getComputedStyle(document.querySelector('.bank-item.flipped .tarot-face.back')).visibility,backText:document.querySelector('.bank-item.flipped .tarot-face.back').innerText.replace(/\s+/g,' ').slice(0,40)})"
Shot 'v-bank-flip-scrolled.png'

& $ab set viewport 390 844 2>$null | Out-Null
Start-Sleep -Seconds 1
Nav '#/bank'; Start-Sleep -Seconds 3
Probe 'BANK @390x844'; Shot 'v-bank-mobile.png'
Nav '#/'; Start-Sleep -Seconds 3
Write-Output '===== MOBILE ENTER PRACTICE ====='; Js $enterPractice
Start-Sleep -Seconds 5
Probe 'PRACTICE @390x844'; Shot 'v-practice-mobile.png'

Write-Output '===== VITALS ====='
& $ab vitals 2>$null
Write-Output '===== CONSOLE (last) ====='
& $ab console 2>$null | Select-Object -Last 20
Write-Output '===== SCRIPT DONE ====='

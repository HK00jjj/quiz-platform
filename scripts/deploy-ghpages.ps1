param([string]$token)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$deploy = Join-Path $root 'deploy'
$dist = Join-Path $root 'app\dist'

function Retry([scriptblock]$sb, [string]$name, [int]$times = 12, [int]$waitSec = 15) {
  for ($i = 1; $i -le $times; $i++) {
    try {
      & $sb
      if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) { Write-Output "[ok] $name (try $i)"; return }
      Write-Output "[retry] $name exit=$LASTEXITCODE (try $i)"
    } catch {
      Write-Output "[retry] $name err=$($_.Exception.Message) (try $i)"
    }
    Start-Sleep -Seconds $waitSec
  }
  throw "$name failed after $times tries"
}

# 1. clone
if (Test-Path $deploy) { Remove-Item $deploy -Recurse -Force }
Retry { git clone --depth 1 --branch gh-pages https://github.com/HK00jjj/quiz-platform.git $deploy 2>&1 | Write-Output } 'clone'

# 2. wipe tracked content (keep .git), copy dist
Get-ChildItem $deploy -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
Copy-Item (Join-Path $dist '*') $deploy -Recurse -Force

# 3. commit
Push-Location $deploy
git add -A
git -c user.name='HK00jjj' -c user.email='hk00jjj@users.noreply.github.com' commit -m 'feat: tarot-style full redesign (Arcane Archive / Abyss Gaze edition)' | Write-Output
Pop-Location

# 4. push with token
$pushUrl = "https://HK00jjj" + ':' + $token + "@github.com/HK00jjj/quiz-platform.git"
Retry {
  Push-Location $deploy
  git -c credential.helper= push $pushUrl gh-pages 2>&1 | Write-Output
  Pop-Location
} 'push' 15 20
Write-Output 'DEPLOY DONE'

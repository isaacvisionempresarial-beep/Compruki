# Empuja main a origin (upstream). Intenta el fork de Railway si hay permiso.
# Uso: powershell -NoProfile -File scripts/ship-remotes.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
  throw "No hay repositorio git."
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
  throw "Ship solo desde main (ahora: $branch)."
}

Write-Host "→ origin (isaacvisionempresarial-beep/Compruki)"
git push origin HEAD:main

$forkUrl = "git@github.com-isaacvision:paternina1978/Compruki.git"
$hasFork = git remote | Select-String -Pattern "^fork$"
if (-not $hasFork) {
  git remote add fork $forkUrl
}

Write-Host "→ fork (paternina1978/Compruki) para Railway"
$forkOk = $true
git push fork HEAD:main 2>&1 | ForEach-Object { $_ }
if ($LASTEXITCODE -ne 0) { $forkOk = $false }
git push fork HEAD:principal 2>&1 | Out-Null

if (-not $forkOk) {
  Write-Host ""
  Write-Host "Sin permiso de push al fork. En GitHub (cuenta paternina1978):"
  Write-Host "  paternina1978/Compruki → Sync fork → Update branch"
  Write-Host "Luego Railway redeploya solo."
  exit 0
}

Write-Host "Listo. Origin y fork actualizados."

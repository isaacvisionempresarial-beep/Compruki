# Empuja main a origin (upstream) y al fork de Railway (paternina1978).
# Uso: pwsh scripts/ship-remotes.ps1

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
git push fork HEAD:main
git push fork HEAD:principal 2>$null

Write-Host "Listo. Si Railway apunta al fork, redeploya o espera el auto-deploy."

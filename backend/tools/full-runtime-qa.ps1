$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

Write-Host "ATELIER FULL RUNTIME QA" -ForegroundColor Cyan
Write-Host "Root: $root"

function Require-Cmd([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Required command not found: $Name" }
}

Require-Cmd node
Require-Cmd npm
Require-Cmd psql

Write-Host "`n[1/7] Node / npm" -ForegroundColor Yellow
node -v
npm -v

Write-Host "`n[2/7] Environment files" -ForegroundColor Yellow
if (-not (Test-Path "backend/.env")) { Copy-Item "backend/.env.example" "backend/.env" }
if (-not (Test-Path "frontend/.env.local")) { Copy-Item "frontend/.env.local.example" "frontend/.env.local" }

$backendEnv = Get-Content "backend/.env"
if (-not ($backendEnv -match '^JWT_SECRET=')) {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $secret = [Convert]::ToBase64String($bytes)
  $backendEnv += "JWT_SECRET=$secret"
  Set-Content "backend/.env" $backendEnv
}

Write-Host "`n[3/7] Install all dependencies" -ForegroundColor Yellow
npm run install:all

Write-Host "`n[4/7] Generate + deploy + seed database" -ForegroundColor Yellow
npm run db:setup

Write-Host "`n[5/7] Production build" -ForegroundColor Yellow
npm run build

Write-Host "`n[6/7] Start production services" -ForegroundColor Yellow
$npmExe = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmExe) { $npmExe = (Get-Command npm).Source }
$backend = Start-Process -FilePath $npmExe -ArgumentList "--prefix backend run start" -WorkingDirectory $root -PassThru -WindowStyle Hidden
try {
  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 500
    try { $health = Invoke-RestMethod "http://127.0.0.1:4000/api/health" -TimeoutSec 3; break } catch { $health = $null }
  } while ((Get-Date) -lt $deadline)
  if (-not $health -or $health.database -ne "ok") { throw "Backend health check failed or database is not ok." }

  $frontend = Start-Process -FilePath $npmExe -ArgumentList "--prefix frontend run start" -WorkingDirectory $root -PassThru -WindowStyle Hidden
  try {
    $deadline = (Get-Date).AddSeconds(45)
    do {
      Start-Sleep -Milliseconds 500
      try { $page = Invoke-WebRequest "http://127.0.0.1:3000/" -UseBasicParsing -TimeoutSec 3; break } catch { $page = $null }
    } while ((Get-Date) -lt $deadline)
    if (-not $page -or $page.StatusCode -ne 200) { throw "Storefront did not return HTTP 200." }

    Write-Host "`n[7/7] Runtime API + Chromium browser QA" -ForegroundColor Yellow
    npm run qa:api
    npm run qa:browser

    Write-Host "`nFULL RUNTIME QA = PASS" -ForegroundColor Green
    exit 0
  }
  finally {
    if ($frontend) { Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue }
  }
}
finally {
  if ($backend) { Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue }
}

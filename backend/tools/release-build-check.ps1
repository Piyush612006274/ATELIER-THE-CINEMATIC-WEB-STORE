$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

# Build-only sample config helps Prisma generation and Next.js production builds.
# These files are not overwritten if the developer already has local settings.
if (-not (Test-Path 'backend/.env')) {
  Copy-Item 'backend/.env.example' 'backend/.env'
  Write-Warning 'Created backend/.env from the example. Edit DATABASE_URL and secrets before starting the app or running live tests.'
}
if (-not (Test-Path 'frontend/.env.local')) {
  Copy-Item 'frontend/.env.local.example' 'frontend/.env.local'
  Write-Warning 'Created frontend/.env.local from the example. Review production API settings before deployment.'
}

function Invoke-Stage {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )
  Write-Host "`n===== $Name =====" -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE. No PASS status is reported for later stages."
  }
  Write-Host "PASS :: $Name" -ForegroundColor Green
}

try {
  Invoke-Stage 'Install storefront dependencies' 'npm' @('ci', '--prefix', 'frontend', '--no-audit', '--no-fund')
  Invoke-Stage 'Install backend dependencies' 'npm' @('ci', '--prefix', 'backend', '--no-audit', '--no-fund')
  Invoke-Stage 'Source/config verification' 'npm' @('run', 'verify')
  Invoke-Stage 'Security API static audit' 'node' @('backend/tools/security-api-audit.mjs')
  Invoke-Stage 'UI fix static audit' 'node' @('backend/tools/ui-fix-audit.mjs')
  Invoke-Stage 'Dashboard regression static audit' 'node' @('backend/tools/dashboard-ui-regression.mjs')
  Invoke-Stage 'Admin function static audit' 'node' @('backend/tools/admin-function-audit.mjs')
  Invoke-Stage 'Integration config static audit' 'node' @('backend/tools/integration-config-audit.mjs')
  Invoke-Stage 'Full TypeScript typecheck' 'npm' @('run', 'typecheck')
  Invoke-Stage 'Production build' 'npm' @('run', 'build')
  Write-Host "`nBUILD GATE PASSED. This does not replace database/API/browser/payment end-to-end tests." -ForegroundColor Green
}
catch {
  Write-Error $_
  exit 1
}

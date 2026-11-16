param([Parameter(Mandatory=$true)][string]$Message,[switch]$WithoutEnv)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$repoPath = (Get-Location).Path.Replace('\','/')
$envPath = Join-Path (Get-Location) '.env.local'
$backupPath = Join-Path (Get-Location) '.tools/checkpoint-env.backup'
$moved = $false
try {
  if ($WithoutEnv -and (Test-Path -LiteralPath $envPath)) {
    if (Test-Path -LiteralPath $backupPath) { throw 'Une sauvegarde env existe déjà' }
    Move-Item -LiteralPath $envPath -Destination $backupPath
    $moved = $true
  }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Tests en échec' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Build en échec' }
} finally {
  if ($moved) { Move-Item -LiteralPath $backupPath -Destination $envPath }
}
& git -c "safe.directory=$repoPath" add .
if ($LASTEXITCODE -ne 0) { throw 'git add en échec' }
& git -c "safe.directory=$repoPath" commit -m $Message
if ($LASTEXITCODE -ne 0) { throw 'Commit en échec' }
& git -c "safe.directory=$repoPath" push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push en échec' }
& npm.cmd exec --yes --package=vercel@65.16.0 -- vercel --prod --yes
if ($LASTEXITCODE -ne 0) { throw 'Déploiement en échec' }

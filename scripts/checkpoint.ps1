param([Parameter(Mandatory=$true)][string]$Message,[switch]$WithoutEnv,[switch]$WithoutSecrets)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$repoPath = (Get-Location).Path.Replace('\','/')
$envPath = Join-Path (Get-Location) '.env.local'
$backupPath = Join-Path (Get-Location) '.tools/checkpoint-env.backup'
$moved = $false
$geminiPath = Join-Path (Get-Location) 'gemini-key.txt'
$geminiBackup = Join-Path (Get-Location) '.tools/checkpoint-gemini.backup'
$geminiMoved = $false
New-Item -ItemType Directory -Path (Join-Path (Get-Location) '.tools') -Force | Out-Null
try {
  if (($WithoutEnv -or $WithoutSecrets) -and (Test-Path -LiteralPath $envPath)) {
    if (Test-Path -LiteralPath $backupPath) { throw 'Une sauvegarde env existe déjà' }
    Move-Item -LiteralPath $envPath -Destination $backupPath
    $moved = $true
  }
  if ($WithoutSecrets -and (Test-Path -LiteralPath $geminiPath)) {
    if (Test-Path -LiteralPath $geminiBackup) { throw 'Une sauvegarde Gemini existe déjà' }
    Move-Item -LiteralPath $geminiPath -Destination $geminiBackup
    $geminiMoved = $true
  }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Tests en échec' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Build en échec' }
  $keyMatches = @(Get-ChildItem -LiteralPath dist -Recurse -File | Select-String -Pattern 'AIza[0-9A-Za-z_-]{30,}' -List)
  if ($keyMatches.Count -gt 0) { throw 'Une clé Google a été détectée dans le bundle' }
} finally {
  if ($geminiMoved) { Move-Item -LiteralPath $geminiBackup -Destination $geminiPath }
  if ($moved) { Move-Item -LiteralPath $backupPath -Destination $envPath }
}
if (Test-Path -LiteralPath $geminiPath) {
  $taskSecret = (Get-Content -LiteralPath $geminiPath -Raw).Trim()
  $exactMatches = @(Get-ChildItem -LiteralPath dist -Recurse -File | Where-Object { $taskSecret -and [System.IO.File]::ReadAllText($_.FullName).Contains($taskSecret) })
  if ($exactMatches.Count -gt 0) { throw 'La clé locale a été détectée dans le bundle' }
}
& git -c "safe.directory=$repoPath" add .
if ($LASTEXITCODE -ne 0) { throw 'git add en échec' }
& git -c "safe.directory=$repoPath" commit -m $Message
if ($LASTEXITCODE -ne 0) { throw 'Commit en échec' }
& git -c "safe.directory=$repoPath" push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push en échec' }
Write-Output "Commit poussé. Pour un changement applicatif, SQL ou d’environnement, poursuivre le déploiement Oracle décrit dans AGENTS.md."

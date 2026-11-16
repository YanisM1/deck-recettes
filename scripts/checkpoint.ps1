param([Parameter(Mandatory=$true)][string]$Message)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$repoPath = (Get-Location).Path.Replace('\','/')
& npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Tests en échec' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build en échec' }
& git -c "safe.directory=$repoPath" add .
if ($LASTEXITCODE -ne 0) { throw 'git add en échec' }
& git -c "safe.directory=$repoPath" commit -m $Message
if ($LASTEXITCODE -ne 0) { throw 'Commit en échec' }
& git -c "safe.directory=$repoPath" push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push en échec' }
& npm.cmd exec --yes --package=vercel@65.16.0 -- vercel --prod --yes
if ($LASTEXITCODE -ne 0) { throw 'Déploiement en échec' }

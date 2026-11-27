param([string]$Revision = 'HEAD', [string]$Kit)

$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if (!$Kit) { $Kit = Join-Path (Split-Path -Parent $repository) '_migration_oracle' }
$key = (Resolve-Path -LiteralPath (Join-Path $Kit 'ssh-key-2026-11-25.key')).Path
$knownHosts = (Resolve-Path -LiteralPath (Join-Path $Kit 'deploy/known_hosts')).Path
$server = 'ubuntu@84.235.237.224'
$gitArgs = @('-c', ('safe.directory=' + $repository.Replace('\','/')), '-C', $repository)
$commit = git @gitArgs rev-parse --verify --end-of-options "$Revision^{commit}"
if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40}$') { throw 'Révision Git invalide.' }

$tracked = @(git @gitArgs ls-tree -r --name-only $commit)
if ($LASTEXITCODE -ne 0) { throw 'Lecture du contenu Git impossible.' }
$private = $tracked | Where-Object {
  $_ -match '(?i)(^|/)(?:_migration_oracle|node_modules|\.tools|\.vercel)(?:/|$)|(^|/)\.env(?!\.example$)|\.(key|pem)$|(^|/)gemini-key\.txt$'
}
if ($private -or $tracked -notcontains 'package-lock.json') { throw 'Archive Git inattendue ou fichiers privés présents.' }

$release = "$commit-$([Guid]::NewGuid().ToString('N'))"
$archive = Join-Path ([IO.Path]::GetTempPath()) "deckchef-$release.tar"
$remote = "/opt/oracle-apps/source/.recipe-$release.tar"
$sshArgs = @('-i', $key, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', '-o', 'StrictHostKeyChecking=yes', '-o', "UserKnownHostsFile=$knownHosts")

try {
  git @gitArgs archive --format=tar "--output=$archive" $commit
  if ($LASTEXITCODE -ne 0) { throw 'Création du fichier tar impossible.' }

  scp.exe @sshArgs $archive ($server + ':' + $remote)
  if ($LASTEXITCODE -ne 0) { throw 'Transfert de Recipe vers Oracle en échec.' }

  $command = @'
set -eu
cd /opt/oracle-apps
test "$(uname -m)" = aarch64
exec 9>source/.recipe-deploy.lock
flock -w 120 9
archive='__ARCHIVE__'
previous="$archive.previous"
cp -p source/recipe.tar "$previous"
mv "$archive" source/recipe.tar
if ! bash ./build-apps.sh recipe; then
  mv "$previous" source/recipe.tar
  exit 1
fi
test "$(sudo docker image inspect oracle-recipe:local --format '{{.Os}}/{{.Architecture}}')" = linux/arm64
test "$(sudo docker inspect web-recipe-app-1 --format '{{.State.Running}}')" = true
sudo docker ps --filter label=com.docker.compose.project=web-recipe --format '{{.Names}} {{.Image}} {{.Status}}'
'@
  ssh.exe @sshArgs $server ($command.Replace('__ARCHIVE__', $remote).Replace([string][char]13, ''))
  if ($LASTEXITCODE -ne 0) { throw 'Construction ou démarrage du conteneur Recipe en échec.' }
} finally {
  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
}

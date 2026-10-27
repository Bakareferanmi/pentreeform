param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Revision)
$ErrorActionPreference = 'Stop'
if (!(Test-Path '.\wrangler.jsonc') -or !(Test-Path '.\package.json')) {
    throw 'Run this script inside your pentreeform-setup project folder.'
}
if ((Get-Content '.\wrangler.jsonc' -Raw) -notmatch '"name"\s*:\s*"pentreeform"') {
    throw 'This folder is not configured for the pentreeform Worker.'
}
$project = (Get-Location).Path
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ('pentreeform-update-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
try {
    $archive = Join-Path $staging 'source.zip'
    Write-Host 'Downloading the complete app source...'
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/Bakareferanmi/pentreeform/archive/$Revision.zip" -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $staging
    $source = Join-Path $staging "pentreeform-$Revision"
    $directories = @('src', 'public', 'shared', 'worker', 'migrations', 'tests', 'docs')
    $files = @('index.html', 'package.json', 'package-lock.json', 'vite.config.js')
    foreach ($entry in ($directories + $files)) {
        if (!(Test-Path (Join-Path $source $entry))) { throw "Downloaded source is missing $entry. No project files were updated." }
    }
    # Copy complete source directories so extracted components and imports stay together.
    # Cloudflare/Vercel configuration, local environment files and secrets are untouched.
    foreach ($directory in $directories) {
        $destination = Join-Path $project $directory
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
        Copy-Item -Path (Join-Path $source "$directory\*") -Destination $destination -Recurse -Force
        Write-Host "Updated $directory"
    }
    foreach ($file in $files) {
        Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $project $file) -Force
    }
} finally {
    if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}
& npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Deployment was not started.' }
& npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Database changes and deployment were not started.' }
Write-Host 'Applying account migrations. Existing account data is preserved.'
& npx wrangler d1 migrations apply pentreeform --remote
if ($LASTEXITCODE -ne 0) { throw 'Database update failed. Deployment was not started.' }
& npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Check the output above.' }
Write-Host 'Pentreeform updated. Automatic welcome emails are enabled for new verified accounts.'

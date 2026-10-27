param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Revision,
    [string]$OwnerEmail
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path '.\wrangler.jsonc') -or !(Test-Path '.\package.json')) {
    throw 'Run this script inside your pentreeform-setup project folder.'
}
if ((Get-Content '.\wrangler.jsonc' -Raw) -notmatch '"name"\s*:\s*"pentreeform"') {
    throw 'This folder is not configured for the pentreeform Worker.'
}
if (!$OwnerEmail) { $OwnerEmail = Read-Host 'Email of your existing verified Pentreeform account' }
$OwnerEmail = $OwnerEmail.Trim().ToLowerInvariant()
if ($OwnerEmail.Length -gt 254 -or $OwnerEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
    throw 'Enter the email address you use to sign in to Pentreeform.'
}
# Use an exact, escaped SQL value. Account data is never inferred from the first user.
$escapedEmail = $OwnerEmail.Replace("'", "''")
$sql = "SELECT id, name, email, verified FROM users WHERE lower(email)='$escapedEmail';"
Write-Host 'Checking the owner account in your configured remote database...'
$lookupOutput = & npx wrangler d1 execute pentreeform --remote --json --command $sql
if ($LASTEXITCODE -ne 0) { throw 'Owner lookup failed. No source or secrets were changed.' }
$lookup = ($lookupOutput -join "`n") | ConvertFrom-Json
$accounts = @($lookup | ForEach-Object { $_.results })
if ($accounts.Count -ne 1 -or $accounts[0].verified -ne 1 -or $accounts[0].id -notmatch '^[a-f0-9]{32}$') {
    throw 'Exactly one existing verified account must match. Sign up and verify your email first, then run this updater again.'
}
$ownerId = [string]$accounts[0].id
Write-Host "Admin will be restricted to $($accounts[0].email)."
$project = (Get-Location).Path
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ('pentreeform-admin-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
try {
    $archive = Join-Path $staging 'source.zip'
    Write-Host 'Downloading the complete pinned app source...'
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/Bakareferanmi/pentreeform/archive/$Revision.zip" -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $staging
    $source = Join-Path $staging "pentreeform-$Revision"
    $directories = @('src', 'public', 'shared', 'worker', 'migrations', 'tests', 'docs', 'scripts')
    $files = @('index.html', 'package.json', 'package-lock.json', 'vite.config.js')
    foreach ($entry in ($directories + $files)) {
        if (!(Test-Path (Join-Path $source $entry))) { throw "Downloaded source is missing $entry. No project files were updated." }
    }
    # Preserve deployment configuration, environment files and existing Worker secrets.
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
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Database changes and deployment were not started.' }
& npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Database changes and deployment were not started.' }
Write-Host 'Applying pending migrations. Existing accounts and welcome-email claims are preserved.'
& npx wrangler d1 migrations apply pentreeform --remote
if ($LASTEXITCODE -ne 0) { throw 'Database update failed. Deployment was not started.' }
# The secret value is the database account ID, never an email or password.
$ownerId | & npx wrangler secret put ADMIN_USER_ID
if ($LASTEXITCODE -ne 0) { throw 'Owner configuration failed. Deployment was not started.' }
& npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Check the output above.' }
Write-Host 'Admin is ready at https://pentreeform.vercel.app/admin. Sign in using the configured owner account.'

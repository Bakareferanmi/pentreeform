param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Revision)
$ErrorActionPreference = 'Stop'
if (!(Test-Path '.\wrangler.jsonc') -or !(Test-Path '.\package.json')) {
    throw 'Run this script inside your pentreeform-setup project folder.'
}
if ((Get-Content '.\wrangler.jsonc' -Raw) -notmatch '"name"\s*:\s*"pentreeform"') {
    throw 'This folder is not configured for the pentreeform Worker.'
}
$source = "https://raw.githubusercontent.com/Bakareferanmi/pentreeform/$Revision"
$files = @(
    'worker/auth.js', 'worker/google.js', 'worker/health.js', 'worker/index.js',
    'src/LiveRoot.jsx', 'src/routes.js', 'migrations/0005_google_account_linking.sql',
    'tests/fixture.js', 'tests/google.test.js', 'tests/google-link-ui.cjs',
    'docs/DEPLOYMENT.md', 'package.json'
)
foreach ($file in $files) {
    $folder = Split-Path -Parent $file
    if ($folder -and !(Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
    Invoke-WebRequest -UseBasicParsing -Uri "$source/$file" -OutFile $file
    Write-Host "Updated $file"
}
Write-Host 'Adding the Google connection table. Existing account data is preserved.'
& npx wrangler d1 migrations apply pentreeform --remote
if ($LASTEXITCODE -ne 0) { throw 'Database update failed. Deployment was not started.' }
& npm run deploy
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Check the output above.' }
Write-Host 'Google sign-in update deployed. Confirm your password once after choosing Google.'

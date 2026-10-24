param([ValidateSet('android14','android17','xiaomi12','tablet146')][string]$Profile)
$ErrorActionPreference='Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    Remove-Item Env:GERAINA_USE_LOCAL_FRONTEND -ErrorAction SilentlyContinue
    $env:GERAINA_DEVICE_PROFILE=$Profile
    $env:GERAINA_RELEASE_VERSION='1.2.0'
    $env:GERAINA_RELEASE_CODE='5'
    node scripts/run-usability-android.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Signed Android usability checks failed.' }
    $env:GERAINA_TEST_APP_ID='com.dagangos.geraina'
    $env:GERAINA_TEST_APK=Join-Path (Get-Location) 'releases\Geraina-POS-1.2.0.apk'
    node scripts/run-offline-android.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Signed Android offline checks failed.' }
} finally { Pop-Location }

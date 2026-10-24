param([switch]$SkipBuild, [ValidateSet('phone','tablet7','tablet10','tablet13','tablet146','xiaomi12','android14','android17')][string]$Profile='phone', [ValidateSet('portrait','landscape')][string]$Orientation='portrait')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & node scripts/check-test-account.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Test account preflight failed.' }
    & ./scripts/Start-TestEmulator.ps1 -Profile $Profile
    if (!$SkipBuild) {
        # Keep Gradle on the installed compilation SDK; the emulator SDK is isolated.
        $env:ANDROID_HOME = Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'
        $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
        & ./gradlew.bat assembleDebug --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Test APK build failed.' }
    }
    $env:GERAINA_DEVICE_PROFILE=$Profile
    $env:GERAINA_ORIENTATION=$Orientation
    & node scripts/run-android-bench.cjs
    if ($LASTEXITCODE -ne 0) { throw "Android tests reported a failure. Open app/build/reports/android-bench/latest-$Profile-$Orientation.json." }
    if ($Profile -eq 'phone') { & ./scripts/Export-AndroidReport.ps1 }
} finally { Pop-Location }

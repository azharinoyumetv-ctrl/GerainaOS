param([ValidateSet('phone','tablet7','tablet10','tablet13','tablet146','xiaomi12','android14','android17')][string]$Profile = 'phone')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$gerainaRoot = Split-Path -Parent $projectRoot
$sdkRoot = Join-Path $gerainaRoot 'android-sdk'
$installedSdk = Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'
$adb = Join-Path $installedSdk 'platform-tools\adb.exe'
$emulator = Join-Path $sdkRoot 'emulator\emulator.exe'
$deviceProfile = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'android-device-profiles.json') -Raw | ConvertFrom-Json).$Profile
$serial = "emulator-$($deviceProfile.port)"
if (!(Test-Path -LiteralPath $emulator)) { throw 'Run Prepare-TestEmulator.ps1 first.' }
if (!(Test-Path -LiteralPath (Join-Path $sdkRoot 'platform-tools\adb.exe'))) {
    Copy-Item -LiteralPath (Join-Path $installedSdk 'platform-tools') -Destination $sdkRoot -Recurse
}
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_AVD_HOME = Join-Path $sdkRoot 'avd'
$env:ANDROID_USER_HOME = Join-Path $sdkRoot 'user-home'
New-Item -ItemType Directory -Path $env:ANDROID_USER_HOME -Force | Out-Null
$logDir = Join-Path $projectRoot 'app\build\reports\android-bench'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$state = & $adb -s $serial get-state 2>$null
if ($state -ne 'device') {
    & (Join-Path $sdkRoot 'emulator\emulator-check.exe') accel
    if ($LASTEXITCODE -ne 0) { throw 'Android emulator hardware acceleration is unavailable. See the acceleration check output.' }
    $process = Start-Process -FilePath $emulator -ArgumentList @('-avd',$deviceProfile.avd,'-port',[string]$deviceProfile.port,'-no-window','-no-audio','-no-boot-anim','-no-snapshot','-gpu','swiftshader','-memory','3072','-cores','4','-no-metrics') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir "$Profile-emulator-stdout.txt") -RedirectStandardError (Join-Path $logDir "$Profile-emulator-stderr.txt") -PassThru
    [IO.File]::WriteAllText((Join-Path $sdkRoot "$Profile-emulator.pid"), [string]$process.Id)
    Write-Output "Starting the headless $($deviceProfile.label) emulator…"
}
$deadline = (Get-Date).AddMinutes(5)
do {
    $booted = & $adb -s $serial shell getprop sys.boot_completed 2>$null
    if ($booted -eq '1') { break }
    if ($process -and $process.HasExited) {
        Get-Content -LiteralPath (Join-Path $logDir "$Profile-emulator-stderr.txt") -Tail 20
        throw 'The Android emulator exited before boot completed.'
    }
    Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)
if ($booted -ne '1') { throw 'Android did not finish booting within five minutes.' }
$networkDeadline = (Get-Date).AddSeconds(60)
do {
    & $adb -s $serial shell ping -c 1 -W 3 dagangos.com *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $networkDeadline)
if ($LASTEXITCODE -ne 0) { throw 'The Android emulator cannot reach the Geraina host.' }
& $adb -s $serial shell settings put global window_animation_scale 0
& $adb -s $serial shell settings put global transition_animation_scale 0
& $adb -s $serial shell settings put global animator_duration_scale 0
Write-Output "Android test device is ready: $serial"

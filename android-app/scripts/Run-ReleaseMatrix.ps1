param([ValidateSet('android14','android17','xiaomi12','tablet146')][string[]]$Profiles = @('android14','android17','xiaomi12','tablet146'), [switch]$ResumeFirstOffline)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$reportRoot=Join-Path $projectRoot 'app/build/reports/final-release-matrix'
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
$adb=Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk/platform-tools/adb.exe'
$deviceProfiles=Get-Content (Join-Path $PSScriptRoot 'android-device-profiles.json') -Raw | ConvertFrom-Json
$state=@{status='running';profiles=@();profile=$null;phase='starting'}
function Save-State { $state | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $reportRoot 'progress.json') -Encoding utf8 }
function Run-NodeCheck([string]$name) {
    $state.phase=$name; Save-State
    $log=Join-Path $reportRoot "$($state.profile)-$name.log"
    node (Join-Path $PSScriptRoot "$name.cjs") *> $log
    if($LASTEXITCODE -ne 0) { Get-Content -LiteralPath $log -Tail 15; throw "$($state.profile): $name failed" }
    Write-Output "PASS $($state.profile): $name"
}
Push-Location $projectRoot
try {
    Remove-Item Env:GERAINA_UPDATE_MODE -ErrorAction SilentlyContinue
    $profileIndex=0
    foreach($profile in $Profiles) {
        $state.profile=$profile; $state.phase='start-emulator'; Save-State
        $serial="emulator-$($deviceProfiles.$profile.port)"
        try {
            & (Join-Path $PSScriptRoot 'Start-TestEmulator.ps1') -Profile $profile *> (Join-Path $reportRoot "$profile-start.log")
            $state.phase='usability-and-offline'; Save-State
            if($ResumeFirstOffline -and $profileIndex -eq 0) {
                $env:GERAINA_DEVICE_PROFILE=$profile
                $env:GERAINA_TEST_APP_ID='com.dagangos.geraina'
                $env:GERAINA_TEST_APK=Join-Path $projectRoot 'releases/Geraina-POS-1.2.6.apk'
                Run-NodeCheck 'run-offline-android'
            } else { & (Join-Path $PSScriptRoot 'Run-FinalVerification.ps1') -Profile $profile *> (Join-Path $reportRoot "$profile-usability-and-offline.log") }
            $env:GERAINA_DEVICE_PROFILE=$profile
            Run-NodeCheck 'verify-bank-qris'
            Run-NodeCheck 'verify-updater-android'
            Run-NodeCheck 'verify-pos-accounts'
            if($deviceProfiles.$profile.kind -eq 'tablet') { Run-NodeCheck 'check-rotation-draft' }
            $state.profiles+=@{profile=$profile;status='passed'}; Save-State
            $profileIndex++
        } finally { & $adb -s $serial emu kill *> $null }
    }
    $state.status='passed'; $state.phase='finished'; Save-State
} catch { $state.status='failed';$state.error=$_.Exception.Message;Save-State;throw }
finally { Pop-Location }

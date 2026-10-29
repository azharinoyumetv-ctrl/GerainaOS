param([int]$VersionCode = 21, [string]$VersionName = '1.2.16', [ValidateSet('website','play')][string]$Distribution = 'website')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($VersionCode -lt 1 -or $VersionName -notmatch '^\d+\.\d+\.\d+$') { throw 'Use a positive version code and a version such as 1.0.0.' }
$publishedManifest = Join-Path $projectRoot '../../public/downloads/geraina/latest.json'
if (Test-Path -LiteralPath $publishedManifest) {
    $published = Get-Content -Raw -LiteralPath $publishedManifest | ConvertFrom-Json
    if ($VersionCode -le $published.versionCode) { throw 'Use a version code newer than the published app. Published release files must not be replaced.' }
}
if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'keystore.properties'))) { throw 'Run Prepare-UploadKey.ps1 once before building a release.' }
Push-Location $projectRoot
try {
    & .\gradlew.bat testReleaseUnitTest lintRelease assembleRelease bundleRelease assembleReleaseAndroidTest "-PgerainaVersionCode=$VersionCode" "-PgerainaVersionName=$VersionName" "-PgerainaDistribution=$Distribution" --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android release verification or build failed.' }
    & (Join-Path $PSScriptRoot 'Verify-Distribution.ps1') -Distribution $Distribution
    $releaseDir = Join-Path $projectRoot 'releases'
    if ($Distribution -eq 'play') { $releaseDir = Join-Path $releaseDir 'play' }
    New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
    $prefix = "Geraina-POS-$VersionName"
    Copy-Item -LiteralPath 'app/build/outputs/apk/release/app-release.apk' -Destination (Join-Path $releaseDir "$prefix.apk")
    Copy-Item -LiteralPath 'app/build/outputs/bundle/release/app-release.aab' -Destination (Join-Path $releaseDir "$prefix.aab")
    Copy-Item -LiteralPath 'app/build/outputs/mapping/release/mapping.txt' -Destination (Join-Path $releaseDir "$prefix-mapping.txt")
    $files = Get-ChildItem -LiteralPath $releaseDir -File | Where-Object { $_.Name -like "$prefix*" -and $_.Extension -in @('.apk', '.aab') }
    $hashes = $files | Get-FileHash -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  $([IO.Path]::GetFileName($_.Path))" }
    [IO.File]::WriteAllLines((Join-Path $releaseDir "$prefix-SHA256.txt"), $hashes)
    Write-Output "Release files: $releaseDir"
} finally { Pop-Location }

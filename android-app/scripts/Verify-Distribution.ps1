param([Parameter(Mandatory=$true)][ValidateSet('website','play')][string]$Distribution)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$apk = Join-Path $projectRoot 'app/build/outputs/apk/release/app-release.apk'
$aab = Join-Path $projectRoot 'app/build/outputs/bundle/release/app-release.aab'
$bundletool = Join-Path $projectRoot 'build/tools/bundletool-all-1.18.3.jar'
$aapt = Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk/build-tools/36.0.0/aapt2.exe'
foreach ($required in @($apk,$aab,$bundletool,$aapt)) {
    if (!(Test-Path -LiteralPath $required)) { throw "Distribution verification input is missing: $required" }
}
$permissions = & $aapt dump permissions $apk
if ($LASTEXITCODE -ne 0) { throw 'Cannot read APK permissions.' }
$bundleManifest = & java -jar $bundletool dump manifest "--bundle=$aab"
if ($LASTEXITCODE -ne 0) { throw 'Cannot read bundle manifest.' }
$xml = [xml]($bundleManifest -join "`n")
$androidNs = 'http://schemas.android.com/apk/res/android'
$apkInstaller = ($permissions -join "`n").Contains('android.permission.REQUEST_INSTALL_PACKAGES')
$bundleInstaller = @($xml.manifest.'uses-permission' | Where-Object { $_.GetAttribute('name',$androidNs) -eq 'android.permission.REQUEST_INSTALL_PACKAGES' }).Count -gt 0
$bundleProvider = @($xml.manifest.application.provider | Where-Object { $_.GetAttribute('authorities',$androidNs) -eq 'com.dagangos.geraina.updates' }).Count -gt 0
$expected = $Distribution -eq 'website'
if ($apkInstaller -ne $expected -or $bundleInstaller -ne $expected -or $bundleProvider -ne $expected) {
    throw 'Installer permission/provider does not match the requested distribution.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Check compiled code as well as the manifest; permission removal alone is insufficient.
$websiteMarkers = @('android.settings.MANAGE_UNKNOWN_APP_SOURCES','application/vnd.android.package-archive','website-updates')
foreach ($package in @($apk,$aab)) {
    $zip = [IO.Compression.ZipFile]::OpenRead($package)
    try {
        $dexText = foreach ($entry in $zip.Entries | Where-Object { $_.FullName -match '(?:^|/)classes\d*\.dex$' }) {
            $stream=$entry.Open(); $memory=[IO.MemoryStream]::new()
            try { $stream.CopyTo($memory); [Text.Encoding]::UTF8.GetString($memory.ToArray()) }
            finally { $stream.Dispose(); $memory.Dispose() }
        }
        $code = $dexText -join "`n"
        foreach ($marker in $websiteMarkers) {
            if ($code.Contains($marker) -ne $expected) { throw "Compiled updater does not match distribution: $marker" }
        }
        if ($Distribution -eq 'play' -and !$code.Contains('https://play.google.com/store/apps/details?id=')) {
            throw 'The Play update destination is missing.'
        }
    } finally { $zip.Dispose() }
}
Write-Output "Verified $Distribution APK and AAB: installer permission, provider and compiled update path agree."

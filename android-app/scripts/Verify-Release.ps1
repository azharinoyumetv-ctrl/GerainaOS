param([string]$VersionName = '1.2.5')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sdk = Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'
$buildTools = Join-Path $sdk 'build-tools\36.0.0'
$apk = Join-Path $projectRoot "releases\Geraina-POS-$VersionName.apk"
$bundle = Join-Path $projectRoot "releases\Geraina-POS-$VersionName.aab"
$bundletool = Join-Path $projectRoot 'build\tools\bundletool-all-1.18.3.jar'
if (!(Test-Path -LiteralPath $bundletool)) { throw 'The verified local bundletool jar is not present.' }
& java -jar $bundletool validate "--bundle=$bundle" *> (Join-Path $projectRoot 'build\bundle-validation.txt')
if ($LASTEXITCODE -ne 0) { throw 'Android bundle validation failed. See build/bundle-validation.txt.' }
& (Join-Path $buildTools 'apksigner.bat') verify --verbose --print-certs $apk *> (Join-Path $projectRoot 'build\apk-signature.txt')
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
& (Join-Path $buildTools 'zipalign.exe') -c -P 16 4 $apk
if ($LASTEXITCODE -ne 0) { throw 'APK 16 KB alignment verification failed.' }
$signature = [IO.File]::ReadAllText((Join-Path $projectRoot 'build\apk-signature.txt'))
if (!$signature.Contains('52e14a39a7da4f5f528838f33602860e35960373070a6132d08f682487494ec8')) {
    throw 'The upload signing certificate changed unexpectedly.'
}

# Read the private value without printing it, and inspect decompressed entries.
$privateConfig = Join-Path (Split-Path -Parent $projectRoot) '.env.android-test'
$privateLine = Get-Content -LiteralPath $privateConfig | Where-Object { $_ -match '^GERAINA_TEST_PASSWORD=' } | Select-Object -First 1
$privateValue = $privateLine.Substring($privateLine.IndexOf('=') + 1).Trim().Trim('"').Trim("'")
if (!$privateValue) { throw 'Private package scan configuration is missing.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($package in @($apk, $bundle)) {
    $zip = [IO.Compression.ZipFile]::OpenRead($package)
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -match '(?:^|/)(?:\.env[^/]*|keystore\.properties|[^/]+\.jks)$') { throw 'Private configuration was included in an Android package.' }
            if (!$entry.Length) { continue }
            $entryStream = $entry.Open()
            $memory = [IO.MemoryStream]::new()
            try {
                $entryStream.CopyTo($memory)
                if ([Text.Encoding]::UTF8.GetString($memory.ToArray()).Contains($privateValue)) { throw 'A private test credential was included in an Android package.' }
            } finally { $entryStream.Dispose(); $memory.Dispose() }
        }
    } finally { $zip.Dispose() }
}
Write-Output 'Signed APK, unchanged upload certificate, bundle structure, 16 KB alignment, and private-credential exclusion verified.'

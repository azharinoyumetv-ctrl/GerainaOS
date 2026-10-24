param([ValidateSet('phone','tablet7','tablet10','tablet13','tablet146','xiaomi12','android14','android17')][string]$Profile = 'phone')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$gerainaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sdkRoot = Join-Path $gerainaRoot 'android-sdk'
$downloadRoot = Join-Path $sdkRoot 'downloads'
New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null

function Install-GoogleArchive([string]$Name, [string]$Url, [string]$Sha1, [long]$Size, [string]$Destination, [string]$ReadyFile) {
    if (Test-Path -LiteralPath $ReadyFile) { Write-Output "$Name is already installed."; return }
    $archive = Join-Path $downloadRoot "$Name.zip"
    Write-Output "Downloading $Name from Google's Android SDK repository…"
    & node (Join-Path $PSScriptRoot 'download-android-archive.cjs') $Url $archive $Size $Sha1
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $Name" }
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA1).Hash.ToLower() -ne $Sha1) { throw "Archive verification failed: $Name" }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Write-Output "Extracting verified $Name archive…"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($archive, $Destination)
    if (!(Test-Path -LiteralPath $ReadyFile)) { throw "Installation incomplete: $Name" }
}

Install-GoogleArchive 'emulator' 'https://dl.google.com/android/repository/emulator-windows_x64-16428233.zip' '488ed747e82de7e9bb5247becd1ac043c7e5e85d' 455342868 $sdkRoot (Join-Path $sdkRoot 'emulator\emulator.exe')
$deviceProfile = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'android-device-profiles.json') -Raw | ConvertFrom-Json).$Profile
$api = if ($deviceProfile.api) { $deviceProfile.api } else { '36' }
switch ($api) {
    '34' { $imageName='android-34-aosp'; $imageArchive='x86_64-34_r04.zip'; $imageChecksum='5f6a249f9bc3b1b4c459b13ce2eb646c9680bed1'; $imageSize=720747116 }
    '37.0' { $imageName='android-37-aosp'; $imageArchive='x86_64-37.0_r06.zip'; $imageChecksum='8842a57a6b146423debb46c1496a9c0986aa1b9e'; $imageSize=907680404 }
    default { $imageName='android-36-aosp'; $imageArchive='x86_64-36_r02.zip'; $imageChecksum='829c076e8ff448a336097ae25a355b495ba36e2c'; $imageSize=844217077 }
}
$imageDestination=Join-Path $sdkRoot "system-images\android-$api\default"
Install-GoogleArchive $imageName "https://dl.google.com/android/repository/sys-img/android/$imageArchive" $imageChecksum $imageSize $imageDestination (Join-Path $imageDestination 'x86_64\system.img')
$avdHome = Join-Path $sdkRoot 'avd'
$avdPath = Join-Path $avdHome "$($deviceProfile.avd).avd"
New-Item -ItemType Directory -Path $avdPath -Force | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false
$avdIni = "avd.ini.encoding=UTF-8`npath=$avdPath`ntarget=android-$api`n"
[IO.File]::WriteAllText((Join-Path $avdHome "$($deviceProfile.avd).ini"), $avdIni, $utf8)
$config = @'
AvdId=Geraina_API_36
avd.ini.encoding=UTF-8
abi.type=x86_64
tag.id=default
tag.display=Default Android System Image
image.sysdir.1=system-images/android-36/default/x86_64/
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.ramSize=3072
hw.lcd.width=1080
hw.lcd.height=2400
hw.lcd.density=420
hw.keyboard=yes
hw.gpu.enabled=yes
hw.gpu.mode=swiftshader
hw.audioInput=no
hw.audioOutput=no
hw.sdCard=no
disk.dataPartition.size=6G
showDeviceFrame=no
skin.dynamic=yes
PlayStore.enabled=false
fastboot.forceColdBoot=yes
runtime.network.speed=full
runtime.network.latency=none
'@
$config = $config.Replace('system-images/android-36/default/x86_64/',"system-images/android-$api/default/x86_64/")
$config = $config.Replace('AvdId=Geraina_API_36',"AvdId=$($deviceProfile.avd)").Replace('hw.lcd.width=1080',"hw.lcd.width=$($deviceProfile.width)").Replace('hw.lcd.height=2400',"hw.lcd.height=$($deviceProfile.height)").Replace('hw.lcd.density=420',"hw.lcd.density=$($deviceProfile.density)")
$config += "`nhw.lcd.xdpi=$($deviceProfile.xdpi)`nhw.lcd.ydpi=$($deviceProfile.xdpi)`nhw.mainKeys=no`n"
[IO.File]::WriteAllText((Join-Path $avdPath 'config.ini'), $config, $utf8)
Write-Output "$($deviceProfile.label) prepared: $($deviceProfile.width) x $($deviceProfile.height), $($deviceProfile.density) dpi. Runtime and virtual-device files are ignored by Git."

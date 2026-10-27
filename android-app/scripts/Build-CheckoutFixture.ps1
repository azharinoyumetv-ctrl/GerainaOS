# Test-only external activity. It cannot access the network or make a payment.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$output = Join-Path $projectRoot 'app/build/checkout-fixture'
$sdkRoot = Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk'
$buildTools = Join-Path $sdkRoot 'build-tools/36.0.0'
$androidJar = Join-Path $sdkRoot 'platforms/android-36/android.jar'
$javaRoot = 'C:/Program Files/Eclipse Adoptium/jdk-17.0.19.10-hotspot/bin'
New-Item -ItemType Directory -Path $output,(Join-Path $output 'classes'),(Join-Path $output 'dex') -Force | Out-Null
$manifest = @'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.dagangos.geraina.checkoutfixture"><uses-sdk android:minSdkVersion="34" android:targetSdkVersion="36"/><application android:label="Geraina unpaid checkout fixture" android:testOnly="true" android:theme="@android:style/Theme.Material.Light.NoActionBar"><activity android:name=".CheckoutActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="https" android:host="checkout.xendit.co" android:pathPrefix="/web/geraina-checkout-fixture"/></intent-filter></activity></application></manifest>
'@
$source = @'
package com.dagangos.geraina.checkoutfixture;
public class CheckoutActivity extends android.app.Activity {
  public void onCreate(android.os.Bundle state) {
    super.onCreate(state);
    android.widget.TextView view = new android.widget.TextView(this);
    view.setText("UNPAID CHECKOUT FIXTURE\nNo payment method selected.\nPress Android Back to return to Geraina.\nThis app has no Internet permission.");
    view.setTextSize(24); view.setPadding(40,100,40,40); setContentView(view);
  }
}
'@
[IO.File]::WriteAllText((Join-Path $output 'AndroidManifest.xml'),$manifest,[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $output 'CheckoutActivity.java'),$source,[Text.UTF8Encoding]::new($false))
& (Join-Path $buildTools 'aapt2.exe') link --manifest (Join-Path $output 'AndroidManifest.xml') -I $androidJar -o (Join-Path $output 'resources.apk')
if ($LASTEXITCODE -ne 0) { throw 'Fixture manifest compilation failed' }
& (Join-Path $javaRoot 'javac.exe') -source 17 -target 17 -classpath $androidJar -d (Join-Path $output 'classes') (Join-Path $output 'CheckoutActivity.java')
if ($LASTEXITCODE -ne 0) { throw 'Fixture activity compilation failed' }
& (Join-Path $buildTools 'd8.bat') --min-api 34 --lib $androidJar --output (Join-Path $output 'dex') (Join-Path $output 'classes/com/dagangos/geraina/checkoutfixture/CheckoutActivity.class')
if ($LASTEXITCODE -ne 0) { throw 'Fixture dex compilation failed' }
$env:GERAINA_CHECKOUT_FIXTURE_DIR = $output
@'
import os,zipfile
from pathlib import Path
p=Path(os.environ['GERAINA_CHECKOUT_FIXTURE_DIR'])
with zipfile.ZipFile(p/'resources.apk','a') as z: z.write(p/'dex/classes.dex','classes.dex')
'@ | & (Join-Path (Split-Path -Parent $projectRoot) 'backend/venv/Scripts/python.exe') -
if ($LASTEXITCODE -ne 0) { throw 'Fixture packaging failed' }
$key = Join-Path $output 'fixture.keystore'
if (!(Test-Path -LiteralPath $key)) {
  & (Join-Path $javaRoot 'keytool.exe') -genkeypair -keystore $key -storepass android -keypass android -alias fixture -keyalg RSA -validity 3650 -dname 'CN=Disposable checkout test fixture'
  if ($LASTEXITCODE -ne 0) { throw 'Fixture key generation failed' }
}
& (Join-Path $buildTools 'zipalign.exe') -f 4 (Join-Path $output 'resources.apk') (Join-Path $output 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'Fixture alignment failed' }
& (Join-Path $buildTools 'apksigner.bat') sign --ks $key --ks-pass pass:android --key-pass pass:android --out (Join-Path $output 'checkout-fixture.apk') (Join-Path $output 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'Fixture signing failed' }
Write-Output (Join-Path $output 'checkout-fixture.apk')

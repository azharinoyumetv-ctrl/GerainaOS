param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot 'keystore.properties'
$signingDir = Join-Path $projectRoot 'signing'
$keyPath = Join-Path $signingDir 'geraina-upload.jks'
if ((Test-Path -LiteralPath $configPath) -or (Test-Path -LiteralPath $keyPath)) {
    throw 'An upload key or signing configuration already exists. Reuse it; never overwrite a release key.'
}
$keytool = (Get-Command keytool -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $signingDir -Force | Out-Null
$randomBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($randomBytes)
$rng.Dispose()
$password = [Convert]::ToBase64String($randomBytes)
$env:GERAINA_KEY_PASSWORD = $password
try {
    & $keytool -genkeypair -keystore $keyPath -storetype JKS -alias geraina-upload -keyalg RSA -keysize 3072 -validity 10000 -storepass:env GERAINA_KEY_PASSWORD -keypass:env GERAINA_KEY_PASSWORD -dname 'CN=Geraina POS, OU=Mobile, O=PT DagangOS Digital Indonesia, L=Subang, C=ID' -noprompt
    if ($LASTEXITCODE -ne 0) { throw 'Upload key generation failed.' }
    $content = "storeFile=signing/geraina-upload.jks`nstorePassword=$password`nkeyAlias=geraina-upload`nkeyPassword=$password`n"
    [IO.File]::WriteAllText($configPath, $content, (New-Object Text.UTF8Encoding $false))
    & $keytool -exportcert -keystore $keyPath -alias geraina-upload -storepass:env GERAINA_KEY_PASSWORD -rfc -file (Join-Path $signingDir 'geraina-upload-certificate.pem')
    if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed.' }
    Write-Output 'Upload key created. Back up signing/ and keystore.properties securely before the first Play upload.'
    Write-Output 'Private key and passwords are ignored by Git. Passwords have not been printed.'
} finally {
    Remove-Item Env:\GERAINA_KEY_PASSWORD -ErrorAction SilentlyContinue
    $password = $null
}

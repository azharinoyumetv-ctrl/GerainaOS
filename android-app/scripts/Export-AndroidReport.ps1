param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$reportsRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'app\build\reports\android-bench'))
$latest = Get-Content -LiteralPath (Join-Path $reportsRoot 'latest-report.json') -Raw | ConvertFrom-Json
$sourceHtml = [IO.Path]::GetFullPath($latest.path)
if (!$sourceHtml.StartsWith($reportsRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The latest Android report is outside this project.'
}
$sourceDir = Split-Path -Parent $sourceHtml
$report = Get-Content -LiteralPath (Join-Path $sourceDir 'report.json') -Raw | ConvertFrom-Json
if ($report.status -ne 'passed') { throw 'Only a complete passing Android run is exported to the release folder.' }
$destination = Join-Path $projectRoot 'releases\android-test-report'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Get-ChildItem -LiteralPath $sourceDir -File | Where-Object {
    $_.Name -in @('report.html','report.json') -or $_.Extension -eq '.png'
} | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $destination }
Write-Output "Exported $($report.checks.Count) passing Android checks with screenshots to releases/android-test-report."

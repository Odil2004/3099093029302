param(
  [string]$OutDir = "github-upload",
  [int]$MaxMB = 20
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outPath = Join-Path $root $OutDir

if (Test-Path $outPath) {
  Remove-Item -Recurse -Force $outPath
}
New-Item -ItemType Directory -Path $outPath | Out-Null

$maxBytes = $MaxMB * 1MB

$excludeDirs = @(
  "node_modules",
  "data",
  ".git",
  ".github"
)

$excludeFiles = @(
  ".env",
  "wIUCcr9vNDIMYYSl6FEF+CY1HZF72_fY.mp4"
)

Get-ChildItem -Path $root -Recurse -File -Force | ForEach-Object {
  $full = $_.FullName
  $rel = $full.Substring($root.Length).TrimStart("\","/")

  foreach ($d in $excludeDirs) {
    if ($rel -like "$d/*" -or $rel -eq $d) { return }
  }
  if ($rel -like "$OutDir/*" -or $rel -like "$OutDir\\*" -or $rel -eq $OutDir) { return }
  if ($rel -match "(^|[\\\\/])github-upload") { return }
  if ($rel -match "(^|[\\\\/])github-") { return }

  if ($excludeFiles -contains $rel) { return }
  if ($_.Length -gt $maxBytes) { return }

  $dest = Join-Path $outPath $rel
  $destDir = Split-Path -Parent $dest
  if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }
  Copy-Item -Force $full $dest
}

Write-Host "Готово: $outPath"
Write-Host "Загрузи содержимое папки в GitHub через веб-интерфейс."

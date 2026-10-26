# 기억 서재 (마리나라 엔진용 기억 모듈) — Windows 설치·업데이트
# 마리나라 폴더에서 PowerShell을 열고:
#   irm https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main/install.ps1 | iex
# 다시 실행하면 업데이트입니다. 기억 데이터는 마리나라 데이터 폴더에 있어서 지워지지 않습니다.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$base = if ($env:MEMORY_MODULE_BASE) { $env:MEMORY_MODULE_BASE } else { 'https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/main' }
$files = @(
  'memory-module/marinara-memory-runtime.cjs',
  'memory-module/memory-cli.cjs',
  'memory-module/lib/ledger.cjs',
  'memory-module/lib/service.cjs',
  'memory-module/lib/scenes.cjs',
  'memory-module/lib/recall.cjs',
  'memory-module/lib/speakers.cjs',
  'memory-module/lib/vectors.cjs'
)

Write-Host ''
Write-Host '== 기억 서재 설치·업데이트 (Windows) =='

$candidates = @($env:MARINARA_DIR, (Get-Location).Path, (Join-Path $env:LOCALAPPDATA 'Marinara-Engine'), (Join-Path $env:USERPROFILE 'Marinara-Engine')) | Where-Object { $_ }
$dir = $candidates | Where-Object { Test-Path (Join-Path $_ 'packages\server') } | Select-Object -First 1
if (-not $dir) {
  Write-Host ''
  Write-Host '[설치 실패] 마리나라 폴더를 찾지 못했습니다. 마리나라 폴더(start.bat이 있는 곳)에서 PowerShell을 열고 다시 실행해 주세요.'
  return
}
Write-Host "마리나라 폴더를 찾았습니다: $dir"

New-Item -ItemType Directory -Force -Path (Join-Path $dir 'memory-module\lib') | Out-Null
foreach ($f in $files) {
  $out = Join-Path $dir ($f -replace '/', '\')
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$f" -OutFile "$out.download"
  Move-Item -Force "$out.download" $out
}
Write-Host "[1/3] 기억 모듈 파일을 받았습니다: $(Join-Path $dir 'memory-module')"

# ASCII only: cmd reads .bat files in the console code page.
$bat = @'
@echo off
rem Starts Marinara Engine with the memory module (memory library). Use this instead of start.bat.
cd /d "%~dp0"
set "NODE_OPTIONS=--require="%~dp0memory-module\marinara-memory-runtime.cjs" %NODE_OPTIONS%"
call "%~dp0start.bat" %*
'@
$batPath = Join-Path $dir 'start-memory.bat'
Set-Content -Path $batPath -Value $bat -Encoding Ascii
Write-Host "[2/3] 실행 파일을 만들었습니다: $batPath"

try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut((Join-Path $desktop 'Marinara + 기억 서재.lnk'))
  $link.TargetPath = $batPath
  $link.WorkingDirectory = $dir
  $icon = Join-Path $dir 'MarinaraLauncher.exe'
  if (Test-Path $icon) { $link.IconLocation = $icon }
  $link.Save()
  Write-Host "[3/3] 바탕화면에 'Marinara + 기억 서재' 바로가기를 만들었습니다."
} catch {
  Write-Host '[3/3] 바로가기는 만들지 못했습니다. start-memory.bat을 직접 실행해 주세요.'
}
Write-Host ''
Write-Host '이제부터 마리나라를 start-memory.bat (또는 바탕화면 바로가기)로 켜 주세요.'
Write-Host '이미 켜져 있다면 끄고 다시 켜 주세요. start.bat이나 MarinaraLauncher로 켜면 기억 모듈 없이 켜집니다.'

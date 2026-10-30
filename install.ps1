# 기억 서재 (마리나라 엔진용 기억 모듈) — Windows 설치·업데이트
# 마리나라 폴더에서 PowerShell을 열고:
#   irm https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/marinara-2.4.6/install.ps1 | iex
# 이전 버전으로 되돌리기:
#   $env:MEMORY_MODULE_ACTION='rollback'; irm https://raw.githubusercontent.com/tlsiddl/marinara-memory-module/marinara-2.4.6/install.ps1 | iex
# 다시 실행하면 업데이트입니다. 기억 데이터는 마리나라 데이터 폴더에 있어서 지워지지 않습니다.
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$repo = 'tlsiddl/marinara-memory-module'
$action = if ($env:MEMORY_MODULE_ACTION) { $env:MEMORY_MODULE_ACTION } else { 'install' }
$env:MEMORY_MODULE_ACTION = $null
$files = @(
  'memory-module/marinara-memory-runtime.cjs',
  'memory-module/memory-cli.cjs',
  'memory-module/lib/ledger.cjs',
  'memory-module/lib/service.cjs',
  'memory-module/lib/scenes.cjs',
  'memory-module/lib/recall.cjs',
  'memory-module/lib/speakers.cjs',
  'memory-module/lib/vectors.cjs',
  'memory-module/lib/translate.cjs'
)

function Get-Version($path) {
  $m = Select-String -Path $path -Pattern "^const VERSION = '([^']*)'" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($m) { $m.Matches[0].Groups[1].Value } else { '?' }
}

# Accept a folder, launcher file, or a subfolder of an installation.
# Validate both the Windows entry point and server directory before writing.
function Resolve-MarinaraRoot([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return }
  try {
    $Path = [Environment]::ExpandEnvironmentVariables($Path.Trim().Trim('"'))
    $item = Get-Item -LiteralPath $Path -ErrorAction Stop
    if ($item.PSProvider.Name -ne 'FileSystem') { return }
    $folder = if ($item.PSIsContainer) { $item } else { $item.Directory }
    while ($null -ne $folder) {
      if ((Test-Path -LiteralPath (Join-Path $folder.FullName 'start.bat') -PathType Leaf) -and
          (Test-Path -LiteralPath (Join-Path $folder.FullName 'packages\server') -PathType Container)) {
        return $folder.FullName
      }
      $folder = $folder.Parent
    }
  } catch {}
}

Write-Host ''
$dir = $null
if ($env:MARINARA_DIR) {
  $dir = Resolve-MarinaraRoot $env:MARINARA_DIR
  if (-not $dir) {
    Write-Host "[폴더 확인] MARINARA_DIR에 지정한 위치가 올바르지 않습니다: $env:MARINARA_DIR"
  }
} else {
  # Prefer the installation whose directory the user deliberately opened.
  $dir = Resolve-MarinaraRoot (Get-Location).Path
}
if (-not $dir) {
  $candidates = New-Object 'System.Collections.Generic.List[string]'
  foreach ($baseDir in @($env:LOCALAPPDATA, $env:USERPROFILE, $env:ProgramFiles, [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'))) {
    if ($baseDir) { [void]$candidates.Add((Join-Path $baseDir 'Marinara-Engine')) }
  }
  if ($env:LOCALAPPDATA) {
    [void]$candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\Marinara-Engine'))
  }
  # Shortcuts locate custom installs on other drives without scanning whole disks.
  try {
    $shortcutShell = New-Object -ComObject WScript.Shell
    foreach ($special in @('Desktop', 'CommonDesktopDirectory', 'StartMenu', 'CommonStartMenu')) {
      $shortcutDir = [Environment]::GetFolderPath($special)
      if (-not $shortcutDir) { continue }
      foreach ($shortcutFile in @(Get-ChildItem -LiteralPath $shortcutDir -Filter '*Marinara*.lnk' -Recurse -File -ErrorAction SilentlyContinue)) {
        try {
          $shortcut = $shortcutShell.CreateShortcut($shortcutFile.FullName)
          if ($shortcut.TargetPath) { [void]$candidates.Add($shortcut.TargetPath) }
          if ($shortcut.WorkingDirectory) { [void]$candidates.Add($shortcut.WorkingDirectory) }
        } catch {}
      }
    }
  } catch {}
  $found = @($candidates | ForEach-Object { Resolve-MarinaraRoot $_ } | Sort-Object -Unique)
  if ($found.Count -eq 1 -and -not $env:MARINARA_DIR) {
    $dir = $found[0]
  } elseif ($found.Count -gt 0) {
    Write-Host '설치 위치를 선택해 주세요. 다른 위치라면 Enter를 누르세요.'
    for ($i = 0; $i -lt $found.Count; $i++) { Write-Host "  $($i + 1). $($found[$i])" }
    while (-not $dir) {
      $choice = Read-Host '번호 (Enter: 직접 폴더 선택)'
      if ([string]::IsNullOrWhiteSpace($choice)) { break }
      $index = 0
      if ([int]::TryParse($choice, [ref]$index) -and $index -ge 1 -and $index -le $found.Count) {
        $dir = $found[$index - 1]
      } else { Write-Host '목록에 있는 번호를 입력해 주세요.' }
    }
  }
}
if (-not $dir) {
  Write-Host 'start.bat과 packages 폴더가 들어 있는 마리나라 폴더를 선택해 주세요.'
  try {
    $folderShell = New-Object -ComObject Shell.Application
    $picked = $folderShell.BrowseForFolder(0, 'Marinara Engine - start.bat folder', 0x51, 0)
    if ($null -ne $picked) { $dir = Resolve-MarinaraRoot $picked.Self.Path }
  } catch {}
  while (-not $dir) {
    $typed = Read-Host '마리나라 폴더 경로 (따옴표 포함 가능, Enter: 취소)'
    if ([string]::IsNullOrWhiteSpace($typed)) {
      Write-Host '[취소] 설치를 취소했습니다. 기존 파일은 변경하지 않았습니다.'
      return
    }
    $dir = Resolve-MarinaraRoot $typed
    if (-not $dir) {
      Write-Host '[폴더 확인] start.bat과 packages\server를 찾지 못했습니다. 경로를 다시 입력해 주세요.'
    }
  }
}
Write-Host "설치 대상: $dir"
$m = Join-Path $dir 'memory-module'
$prev = Join-Path $m '.prev'

if ($action -eq 'rollback') {
  Write-Host '== 기억 서재 이전 버전으로 되돌리기 (Windows) =='
  if (-not (Test-Path (Join-Path $prev 'marinara-memory-runtime.cjs'))) {
    Write-Host "[실패] 되돌릴 이전 버전이 없습니다 ($prev)."
    return
  }
  foreach ($f in $files) {
    $rel = ($f -replace '^memory-module/', '') -replace '/', '\'
    $src = Join-Path $prev $rel
    if (Test-Path $src) { Copy-Item -Force $src (Join-Path $m $rel) }
  }
  Write-Host "이전 버전 v$(Get-Version (Join-Path $m 'marinara-memory-runtime.cjs')) 으로 되돌렸습니다. 마리나라를 끄고 start-memory.bat으로 다시 켜 주세요."
  return
}

Write-Host '== 기억 서재 설치·업데이트 (Windows) =='
Write-Host "마리나라 폴더를 찾았습니다: $dir"

# Every file from one and the same commit, so an update never mixes two versions.
$ref = 'marinara-2.4.6'
try {
  $sha = (Invoke-RestMethod -UseBasicParsing -TimeoutSec 15 -Uri "https://api.github.com/repos/$repo/commits/marinara-2.4.6").sha
  if ($sha -match '^[0-9a-f]{40}$') { $ref = $sha }
} catch {}
$base = if ($env:MEMORY_MODULE_BASE) { $env:MEMORY_MODULE_BASE } else { "https://raw.githubusercontent.com/$repo/$ref" }

# All files go to a holding folder first and are checked; only then do they replace the old ones,
# and the old ones are kept in memory-module\.prev.
$new = Join-Path $m '.incoming'
if (Test-Path $new) { Remove-Item -Recurse -Force $new }
New-Item -ItemType Directory -Force -Path (Join-Path $new 'lib') | Out-Null
try {
  foreach ($f in $files) {
    $out = Join-Path $new (($f -replace '^memory-module/', '') -replace '/', '\')
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 -Uri "$base/$f" -OutFile $out
    if ((Get-Item $out).Length -eq 0) { throw "$f 가 비어 있습니다" }
  }
  if (-not (Select-String -Path (Join-Path $new 'marinara-memory-runtime.cjs') -Pattern 'const VERSION' -Quiet)) { throw '받은 파일이 올바르지 않습니다' }
} catch {
  Remove-Item -Recurse -Force $new -ErrorAction SilentlyContinue
  Write-Host ''
  Write-Host "[설치 실패] 파일을 받지 못했습니다 ($($_.Exception.Message)). 인터넷 연결을 확인하고 다시 실행해 주세요. 기존 기억 모듈은 그대로입니다."
  return
}
if (Test-Path (Join-Path $m 'marinara-memory-runtime.cjs')) {
  if (Test-Path $prev) { Remove-Item -Recurse -Force $prev }
  New-Item -ItemType Directory -Force -Path (Join-Path $prev 'lib') | Out-Null
  foreach ($f in $files) {
    $rel = ($f -replace '^memory-module/', '') -replace '/', '\'
    $cur = Join-Path $m $rel
    if (Test-Path $cur) { Copy-Item -Force $cur (Join-Path $prev $rel) }
  }
}
New-Item -ItemType Directory -Force -Path (Join-Path $m 'lib') | Out-Null
foreach ($f in $files) {
  $rel = ($f -replace '^memory-module/', '') -replace '/', '\'
  Move-Item -Force (Join-Path $new $rel) (Join-Path $m $rel)
}
Remove-Item -Recurse -Force $new
Write-Host "[1/3] 기억 모듈 v$(Get-Version (Join-Path $m 'marinara-memory-runtime.cjs')) 파일을 받았습니다: $m"
if (Test-Path $prev) { Write-Host "      (이전 버전은 $prev 에 남겨 두었습니다)" }

# ASCII only: cmd reads .bat files in the console code page.
$bat = @'
@echo off
rem Starts Marinara Engine with the memory module (memory library). Use this instead of start.bat.
setlocal DisableDelayedExpansion
cd /d "%~dp0"
rem NODE_OPTIONS treats backslashes inside quotes as escapes. Use forward slashes.
set "MEMORY_MODULE_ROOT=%~dp0"
set "MEMORY_MODULE_ROOT=%MEMORY_MODULE_ROOT:\=/%"
set "NODE_OPTIONS=--require="%MEMORY_MODULE_ROOT%memory-module/marinara-memory-runtime.cjs" %NODE_OPTIONS%"
call "%~dp0start.bat" %*
endlocal & exit /b %errorlevel%
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



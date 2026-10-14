$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$xpi = Join-Path $root 'dist\paperloom-0.8.31-dev.xpi'
$expected = '8643ab3e89b10c5d6f5b3a3f079e0c9b875abc21c04feb9ed0fd0e1e70ab6912'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $xpi).Hash.ToLower() -ne $expected) { throw 'Build digest mismatch' }
$p = Get-Process -Id 27772 -ErrorAction Stop
if ($p.ProcessName -ne 'zotero' -or $p.Path -ne 'D:\zotero\zotero.exe') { throw 'Unexpected process' }
if (-not $p.CloseMainWindow()) { throw 'Graceful shutdown was not accepted' }
if (-not $p.WaitForExit(60000)) { throw 'Zotero still running; installation not started' }
$backup = Join-Path $root ('.local\pre-install-0831-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
New-Item -ItemType Directory -Path $backup | Out-Null
$data = 'C:\Users\Administrator\Zotero\paperloom'
foreach ($name in @('sessions','graphics')) { if (Test-Path (Join-Path $data $name)) { Copy-Item -LiteralPath (Join-Path $data $name) -Destination (Join-Path $backup $name) -Recurse } }
$installed = 'C:\Users\Administrator\AppData\Roaming\Zotero\Zotero\Profiles\t1g6sjqd.default\extensions\paperloom@local.research.xpi'
Copy-Item -LiteralPath $installed -Destination (Join-Path $backup 'paperloom-previous.xpi')
Copy-Item -LiteralPath $xpi -Destination $installed -Force
Start-Process -FilePath 'D:\zotero\zotero.exe'
Write-Output ('Installed scoped XPI after normal exit; latest sessions/graphics backup: ' + $backup)

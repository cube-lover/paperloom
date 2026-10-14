$ErrorActionPreference = 'Stop'
$p = Get-Process -Id 25064 -ErrorAction Stop
if ($p.ProcessName -ne 'zotero') { throw 'Observed process is not Zotero' }
$exe = $p.Path
if ($exe -ne 'D:\zotero\zotero.exe') { throw 'Unexpected Zotero executable' }
if (-not $p.CloseMainWindow()) { throw 'Graceful close was not accepted; process left running' }
if (-not $p.WaitForExit(60000)) { throw 'Zotero is still open, possibly waiting for a dialog; no forced termination' }
Start-Process -FilePath $exe
Write-Output 'Zotero closed normally and restarted. Verify mailbox and checkpoints.'

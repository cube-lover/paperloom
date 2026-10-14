$ErrorActionPreference = 'Stop'
$p=Get-Process -Id 25072 -ErrorAction Stop
if ($p.ProcessName -ne 'zotero') { throw 'Unexpected process' }
if (-not $p.CloseMainWindow()) { throw 'Close not accepted' }
if (-not $p.WaitForExit(60000)) { throw 'Process still open' }
# Pi redirects APPDATA; explicitly select the existing user profile on relaunch.
$env:APPDATA='C:\Users\Administrator\AppData\Roaming'
$env:LOCALAPPDATA='C:\Users\Administrator\AppData\Local'
$env:USERPROFILE='C:\Users\Administrator'
Start-Process -FilePath 'D:\zotero\zotero.exe' -ArgumentList @('-profile','C:\Users\Administrator\AppData\Roaming\Zotero\Zotero\Profiles\t1g6sjqd.default')
Write-Output 'Launched the exact existing Zotero profile; no profile/data migration.'

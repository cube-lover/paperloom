$ErrorActionPreference='Stop'
$src='D:\Users\Administrator\Pi-Agent\home\pi-cwd-20260926\paperloom\dist\paperloom-0.8.38-dev.xpi'
$dst='C:\Users\Administrator\AppData\Roaming\Zotero\Zotero\Profiles\t1g6sjqd.default\extensions\paperloom@local.research.xpi'
$procs=@(Get-Process -Name zotero -ErrorAction SilentlyContinue)
foreach($p in $procs){ if($p.MainWindowHandle -ne 0){ $null=$p.CloseMainWindow() } }
foreach($p in $procs){ try{ $p.WaitForExit(60000) | Out-Null } catch {} }
Start-Sleep -Seconds 3
Copy-Item -LiteralPath $src -Destination $dst -Force
$env:APPDATA='C:\Users\Administrator\AppData\Roaming'
$env:LOCALAPPDATA='C:\Users\Administrator\AppData\Local'
$env:USERPROFILE='C:\Users\Administrator'
Start-Process -FilePath 'D:\zotero\zotero.exe' -ArgumentList @('-profile','C:\Users\Administrator\AppData\Roaming\Zotero\Zotero\Profiles\t1g6sjqd.default')
Write-Output 'reinstalled and relaunched'

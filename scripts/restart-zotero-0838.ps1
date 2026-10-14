$ErrorActionPreference='Continue'
$procs=@(Get-Process -Name zotero -ErrorAction SilentlyContinue)
foreach($p in $procs){ if($p.MainWindowHandle -ne 0){ $null=$p.CloseMainWindow(); Write-Output ("close requested: "+$p.Id) } }
Start-Sleep -Seconds 8
$left=@(Get-Process -Name zotero -ErrorAction SilentlyContinue)
foreach($p in $left){ Write-Output ("still running: "+$p.Id+" main="+$p.MainWindowHandle); $null=$p.CloseMainWindow() }
Start-Sleep -Seconds 10
$left=@(Get-Process -Name zotero -ErrorAction SilentlyContinue)
Write-Output ("remaining: "+$left.Count)
if($left.Count -eq 0){
  $env:APPDATA='C:\Users\Administrator\AppData\Roaming'
  $env:LOCALAPPDATA='C:\Users\Administrator\AppData\Local'
  $env:USERPROFILE='C:\Users\Administrator'
  Start-Process -FilePath 'D:\zotero\zotero.exe' -ArgumentList @('-profile','C:\Users\Administrator\AppData\Roaming\Zotero\Zotero\Profiles\t1g6sjqd.default')
  Write-Output 'relaunched with the exact existing profile'
}

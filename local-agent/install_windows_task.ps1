$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runner = Join-Path $repo 'local-agent\run_capture.cmd'
$taskName = 'Shobi Master Weekly Capture'

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$runner`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 11:00PM
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Installed task: $taskName"
Write-Host "Schedule: every Monday at 23:00 local time"
Write-Host "StartWhenAvailable: enabled (runs later if the PC was off)"
Write-Host "Runner: $runner"

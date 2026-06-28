$stopRequest = Join-Path $PSScriptRoot 'stop.request'
$lockFile = Join-Path $PSScriptRoot 'supervisor.pid'

if (-not (Test-Path -LiteralPath $lockFile)) {
  Write-Output 'Kyrovia supervisor lock was not found; stopping any live Kyrovia backend/tunnel processes.'
} else {
  $supervisorPid = [int](Get-Content -LiteralPath $lockFile -Raw)
  $supervisor = Get-Process -Id $supervisorPid -ErrorAction SilentlyContinue

  if ($supervisor) {
    New-Item -ItemType File -Path $stopRequest -Force | Out-Null
    Write-Output 'Kyrovia manual stop requested. Waiting for the supervisor to close the backend and tunnel...'

    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Seconds 1
      if (-not (Get-Process -Id $supervisorPid -ErrorAction SilentlyContinue)) {
        break
      }
    }
  }

  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stopRequest -Force -ErrorAction SilentlyContinue
}

$processes = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and (
    $_.CommandLine -match 'start-kyrovia-supervisor\.js' -or
    $_.CommandLine -match 'start-kyrovia-tunnel\.js' -or
    $_.CommandLine -match '\\localtunnel\\bin\\lt\.js' -or
    $_.CommandLine -match 'lt\.cmd.*--subdomain kyrovia' -or
    $_.CommandLine -match '\\backend\\node_modules\\.*nodemon.*server\.js' -or
    $_.CommandLine -match 'nodemon server\.js'
  )
}

foreach ($process in $processes) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

$portOwners = Get-NetTCPConnection -LocalPort 5050 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($ownerPid in $portOwners) {
  Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath (Join-Path $PSScriptRoot 'active-public-url.txt') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $PSScriptRoot 'requested-public-url.txt') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $PSScriptRoot 'requested-provider.txt') -Force -ErrorAction SilentlyContinue

Write-Output 'Kyrovia live mode stopped manually.'

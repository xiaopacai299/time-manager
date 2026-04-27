$ErrorActionPreference = "SilentlyContinue"

function Stop-ProcessTree([int[]]$ids) {
  foreach ($id in $ids) {
    if ($id) {
      cmd /c "taskkill /PID $id /T /F" | Out-Null
    }
  }
}

function Stop-Port3000Listeners {
  $listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen
  if ($listeners) {
    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    if ($pids) {
      Write-Host "[server:dev:clean] stop process on :3000 -> $($pids -join ', ')"
      Stop-ProcessTree -ids $pids
    }
  }
}

# 1) Kill direct listeners first.
Stop-Port3000Listeners

# 2) Kill stale server watchers that may re-bind the port.
$serverWatchers = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match "node|tsx" -and $_.CommandLine -match "packages\\\\server|tsx watch src/index.ts|pnpm --filter @time-manger/server dev" }
if ($serverWatchers) {
  $watcherIds = $serverWatchers | Select-Object -ExpandProperty ProcessId -Unique
  Write-Host "[server:dev:clean] stop stale watchers -> $($watcherIds -join ', ')"
  Stop-ProcessTree -ids $watcherIds
}

# 3) Re-check port after a short delay to avoid race.
Start-Sleep -Milliseconds 500
Stop-Port3000Listeners

# 4) Start from 3001 to avoid sticky/respawned processes on 3000.
$port = 3001
while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
  $port++
}
Write-Host "[server:dev:clean] using port :$port"
$env:PORT = "$port"

Write-Host "[server:dev:clean] starting server..."
pnpm run server:dev

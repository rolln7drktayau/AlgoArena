$ErrorActionPreference = "SilentlyContinue"

$ports = @(8000, 5173, 5174, 4174)
$pids = @()

foreach ($port in $ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        if ($listener.OwningProcess -and -not ($pids -contains $listener.OwningProcess)) {
            $pids += $listener.OwningProcess
        }
    }
}

if ($pids.Count -eq 0) {
    Write-Host "No AlgoArena dev ports are listening."
    exit 0
}

foreach ($pidValue in $pids) {
    try {
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Stopping PID $pidValue ($($process.ProcessName))"
            Stop-Process -Id $pidValue -Force
        }
    } catch {
        Write-Host "Unable to stop PID $pidValue"
    }
}

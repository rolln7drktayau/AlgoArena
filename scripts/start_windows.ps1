param(
    [switch]$SkipInstall,
    [switch]$NoToast,
    [switch]$NoOpenBrowser,
    [int]$StartupTimeoutSec = 45
)

$ErrorActionPreference = "Stop"

function Get-ProjectRoot {
    $scriptPath = $PSCommandPath
    if (-not $scriptPath -and $MyInvocation.MyCommand.Path) {
        $scriptPath = $MyInvocation.MyCommand.Path
    }
    if (-not $scriptPath) {
        $scriptPath = Join-Path (Get-Location).Path "scripts\start_windows.ps1"
    }

    $scriptDir = Split-Path -Parent $scriptPath
    $candidateRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

    if ((Test-Path (Join-Path $candidateRoot "backend")) -and (Test-Path (Join-Path $candidateRoot "frontend"))) {
        return $candidateRoot
    }
    return (Get-Location).Path
}

function Show-ToastMessage {
    param(
        [string]$Title,
        [string]$Message
    )

    if ($NoToast) {
        return
    }

    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
        [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null

        $safeTitle = [System.Security.SecurityElement]::Escape($Title)
        $safeMessage = [System.Security.SecurityElement]::Escape($Message)
        $xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>$safeTitle</text>
      <text>$safeMessage</text>
    </binding>
  </visual>
</toast>
"@

        $xmlDoc = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xmlDoc.LoadXml($xml)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xmlDoc)
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("AlgoArena")
        $notifier.Show($toast)
    }
    catch {
        Write-Host "Toast notification unavailable on this host." -ForegroundColor Yellow
    }
}

function Test-PortListening {
    param([int]$Port)

    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $listener
}

function Wait-HttpReady {
    param(
        [string]$Url,
        [int]$TimeoutSec
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
            Start-Sleep -Milliseconds 600
        }
    }
    return $false
}

$RootDir = Get-ProjectRoot
Set-Location $RootDir

if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv .venv
}

if (-not $SkipInstall) {
    Write-Host "Installing backend dependencies..."
    & "$RootDir\.venv\Scripts\python.exe" -m pip install -r "$RootDir\backend\requirements.txt"

    if (-not (Test-Path "$RootDir\frontend\node_modules")) {
        Write-Host "Installing frontend dependencies..."
        Set-Location "$RootDir\frontend"
        npm install
        Set-Location $RootDir
    }
}

$backendCmd = "Set-Location '$RootDir'; .\.venv\Scripts\Activate.ps1; uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --ws wsproto"
$frontendCmd = "Set-Location '$RootDir\frontend'; npm run dev -- --host 0.0.0.0 --port 5173"

if (-not (Test-PortListening -Port 8000)) {
    Write-Host "Starting backend in a new PowerShell window..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null
}
else {
    Write-Host "Backend already listening on port 8000."
}

if (-not (Test-PortListening -Port 5173)) {
    Write-Host "Starting frontend in a new PowerShell window..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null
}
else {
    Write-Host "Frontend already listening on port 5173."
}

$backendReady = Wait-HttpReady -Url "http://localhost:8000/api/health" -TimeoutSec $StartupTimeoutSec
$frontendReady = Wait-HttpReady -Url "http://localhost:5173" -TimeoutSec $StartupTimeoutSec

Write-Host "Services status:"
Write-Host ("  Backend:  {0}" -f ($(if ($backendReady) { "ready" } else { "not ready" })))
Write-Host ("  Frontend: {0}" -f ($(if ($frontendReady) { "ready" } else { "not ready" })))
Write-Host "  Backend docs: http://localhost:8000/docs"
Write-Host "  Frontend:     http://localhost:5173"

if ($backendReady -and $frontendReady) {
    if (-not $NoOpenBrowser) {
        Start-Process "http://localhost:5173" | Out-Null
    }
    Show-ToastMessage -Title "AlgoArena" -Message "Services prêtes: http://localhost:5173"
}
else {
    Show-ToastMessage -Title "AlgoArena" -Message "Démarrage en cours. Vérifie les fenêtres backend/frontend."
}

Write-Host ""
Write-Host "Tips:"
Write-Host "  -SkipInstall   : skip dependency installation"
Write-Host "  -NoToast       : disable Windows toast notifications"
Write-Host "  -NoOpenBrowser : do not auto-open the app URL"

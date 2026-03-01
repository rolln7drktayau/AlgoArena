param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
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

$backendCmd = "Set-Location '$RootDir'; .\.venv\Scripts\Activate.ps1; uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"
$frontendCmd = "Set-Location '$RootDir\frontend'; npm run dev -- --host 0.0.0.0 --port 5173"

Write-Host "Starting backend in a new PowerShell window..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null

Write-Host "Starting frontend in a new PowerShell window..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null

Write-Host "Services starting:"
Write-Host "  Backend:  http://localhost:8000/docs"
Write-Host "  Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Tip: run with -SkipInstall to skip dependency installation."


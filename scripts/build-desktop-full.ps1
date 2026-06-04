param(
    [switch]$SkipPortablePython
)

$ErrorActionPreference = "Stop"
$RootDir = (Resolve-Path (Join-Path (Split-Path -Parent $PSCommandPath) "..")).Path
Set-Location $RootDir

Write-Host "Checking Node..."
node --version
npm --version

Write-Host "Checking Python..."
python --version

if (-not $SkipPortablePython) {
    powershell -ExecutionPolicy Bypass -File .\scripts\prepare_portable_python_windows.ps1
}

Write-Host "Installing root dependencies..."
npm install

Write-Host "Installing frontend dependencies..."
npm --prefix frontend install

Write-Host "Building frontend and desktop installer..."
npm run desktop:dist:win

Write-Host "Desktop build complete. Check dist-electron/."

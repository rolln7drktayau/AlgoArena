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
    if ($LASTEXITCODE -ne 0) { throw "Portable runtime preparation failed." }
}

Write-Host "Installing root dependencies..."
npm ci
if ($LASTEXITCODE -ne 0) { throw "Root dependency installation failed." }

Write-Host "Installing frontend dependencies..."
npm --prefix frontend ci
if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed." }

Write-Host "Building frontend and desktop installer..."
npm run desktop:dist:win
if ($LASTEXITCODE -ne 0) { throw "Desktop build failed." }

Write-Host "Desktop build complete. Check dist-electron/."

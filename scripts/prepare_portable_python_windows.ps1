param(
    [string]$PythonVersion = "3.11.9",
    [string]$Architecture = "amd64"
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path (Split-Path -Parent $PSCommandPath) "..")).Path
$TargetDir = Join-Path $RootDir "desktop\python"
$DownloadDir = Join-Path $RootDir "build\portable-python"
$ZipName = "python-$PythonVersion-embed-$Architecture.zip"
$Url = "https://www.python.org/ftp/python/$PythonVersion/$ZipName"
$ZipPath = Join-Path $DownloadDir $ZipName

New-Item -ItemType Directory -Force -Path $DownloadDir | Out-Null
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

Write-Host "Downloading portable Python: $Url"
Invoke-WebRequest -Uri $Url -OutFile $ZipPath

Write-Host "Extracting to $TargetDir"
Expand-Archive -LiteralPath $ZipPath -DestinationPath $TargetDir -Force

$pth = Get-ChildItem -Path $TargetDir -Filter "python*._pth" | Select-Object -First 1
if ($pth) {
    $content = Get-Content -LiteralPath $pth.FullName
    $content = $content | ForEach-Object {
        if ($_ -eq "#import site") { "import site" } else { $_ }
    }
    # Embedded Python ignores PYTHONPATH; add the application root and installed packages explicitly.
    $content += "..\.."
    $content += "Lib\site-packages"
    Set-Content -LiteralPath $pth.FullName -Value $content -Encoding ASCII
}

$pythonExe = Join-Path $TargetDir "python.exe"
if (-not (Test-Path $pythonExe)) {
    throw "Portable python.exe was not found after extraction."
}

Write-Host "Bootstrapping pip"
$getPip = Join-Path $DownloadDir "get-pip.py"
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
& $pythonExe $getPip
if ($LASTEXITCODE -ne 0) { throw "pip bootstrap failed." }

Write-Host "Installing backend requirements into portable Python"
& $pythonExe -m pip install -r (Join-Path $RootDir "backend\requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }

Write-Host "Portable Python ready: $pythonExe"

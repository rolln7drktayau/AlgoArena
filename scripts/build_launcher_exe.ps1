param(
    [string]$OutputPath = ".\dist\AlgoArenaLauncher.exe"
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SourceScript = Join-Path $RootDir "scripts\start_windows.ps1"

if (-not (Test-Path $SourceScript)) {
    throw "Launcher source script not found: $SourceScript"
}

if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $ResolvedOutput = $OutputPath
}
else {
    $ResolvedOutput = Join-Path $RootDir $OutputPath
}

$OutputDir = Split-Path -Parent $ResolvedOutput
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "dotnet SDK not found. Install .NET SDK to build the launcher EXE."
}

$BuildRoot = Join-Path $env:TEMP "algoarena-launcher-build"
$PublishDir = Join-Path $BuildRoot "publish"
New-Item -ItemType Directory -Path $BuildRoot -Force | Out-Null
New-Item -ItemType Directory -Path $PublishDir -Force | Out-Null

$projectFile = Join-Path $BuildRoot "AlgoArenaLauncher.csproj"
$programFile = Join-Path $BuildRoot "Program.cs"

$csproj = @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <PublishSingleFile>true</PublishSingleFile>
    <SelfContained>false</SelfContained>
    <PublishTrimmed>false</PublishTrimmed>
    <DebugType>none</DebugType>
    <DebugSymbols>false</DebugSymbols>
    <AssemblyName>AlgoArenaLauncher</AssemblyName>
  </PropertyGroup>
</Project>
"@

$program = @"
using System.Diagnostics;
using System.Text;

static string FindProjectRoot(string startDirectory)
{
    var current = new DirectoryInfo(startDirectory);
    for (var i = 0; i < 8 && current != null; i++)
    {
        var candidate = Path.Combine(current.FullName, "scripts", "start_windows.ps1");
        if (File.Exists(candidate))
            return current.FullName;
        current = current.Parent;
    }
    return startDirectory;
}

static string Quote(string value)
{
    if (string.IsNullOrEmpty(value))
        return "\"\"";
    if (!value.Contains(' ') && !value.Contains('"'))
        return value;
    return "\"" + value.Replace("\"", "\\\"") + "\"";
}

var baseDir = AppContext.BaseDirectory;
var projectRoot = FindProjectRoot(baseDir);
var launcherScript = Path.Combine(projectRoot, "scripts", "start_windows.ps1");

if (!File.Exists(launcherScript))
{
    Console.Error.WriteLine($"Cannot find launcher script: {launcherScript}");
    return 1;
}

var argsBuilder = new StringBuilder();
argsBuilder.Append("-ExecutionPolicy Bypass -File ");
argsBuilder.Append(Quote(launcherScript));
foreach (var arg in args)
{
    argsBuilder.Append(' ');
    argsBuilder.Append(Quote(arg));
}

var psi = new ProcessStartInfo
{
    FileName = "powershell",
    Arguments = argsBuilder.ToString(),
    UseShellExecute = false
};

using var process = Process.Start(psi);
if (process == null)
{
    Console.Error.WriteLine("Failed to start PowerShell process.");
    return 1;
}

process.WaitForExit();
return process.ExitCode;
"@

$csproj | Set-Content -Path $projectFile -Encoding UTF8
$program | Set-Content -Path $programFile -Encoding UTF8

Write-Host "Building launcher EXE..."
dotnet publish $projectFile -c Release -r win-x64 -o $PublishDir --self-contained false /p:PublishSingleFile=true /p:DebugType=None /p:DebugSymbols=false | Out-Null

$builtExe = Join-Path $PublishDir "AlgoArenaLauncher.exe"
if (-not (Test-Path $builtExe)) {
    throw "EXE generation failed. Expected file not found: $builtExe"
}

Copy-Item -Path $builtExe -Destination $ResolvedOutput -Force

Write-Host ""
Write-Host "EXE generated:"
Write-Host "  $ResolvedOutput"
Write-Host ""
Write-Host "Run examples:"
Write-Host "  $ResolvedOutput"

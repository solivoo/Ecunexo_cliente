# Arranca EcuNexo.Api liberando antes el puerto de desarrollo (evita "address already in use").
# Uso desde ecunexo_api:
#   .\scripts\Start-DevApi.ps1
#   .\scripts\Start-DevApi.ps1 -NoBrowser
#   .\scripts\Start-DevApi.ps1 -- --urls http://localhost:5090

param(
    [int]$Port = 5088,
    [switch]$NoBrowser,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ApiProject = Join-Path $RepoRoot 'src/EcuNexo.Api/EcuNexo.Api.csproj'

& (Join-Path $PSScriptRoot 'Stop-DevApiPort.ps1') -Port $Port

$dotnetArgs = @('run', '--project', $ApiProject)
if ($NoBrowser) {
    $dotnetArgs += @('--launch-profile', 'http-no-browser')
}

if ($ExtraArgs.Count -gt 0) {
    $dotnetArgs += $ExtraArgs
}

Write-Host "Iniciando API en http://localhost:$Port ..."
Set-Location $RepoRoot
dotnet @dotnetArgs

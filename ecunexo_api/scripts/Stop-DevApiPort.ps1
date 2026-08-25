# Libera el puerto HTTP de desarrollo (por defecto 5088) matando el proceso que lo escucha.
# Uso: .\scripts\Stop-DevApiPort.ps1
#      .\scripts\Stop-DevApiPort.ps1 -Port 5088

param(
    [int]$Port = 5088,
    [switch]$Quiet
)

function Get-ListeningProcessIds {
    param([int]$Port)

    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)
    }

    $pattern = ":\s*$Port\s"
    $pids = @()
    netstat -ano | Select-String $pattern | ForEach-Object {
        $line = $_.Line.Trim() -split '\s+'
        if ($line.Length -ge 1) {
            $pids += [int]$line[-1]
        }
    }

    return @($pids | Sort-Object -Unique)
}

$pids = Get-ListeningProcessIds -Port $Port
if ($pids.Count -eq 0) {
    if (-not $Quiet) {
        Write-Host "Puerto $Port libre (sin proceso escuchando)."
    }
    exit 0
}

foreach ($procId in $pids) {
    if ($procId -le 0) {
        continue
    }

    try {
        $proc = Get-Process -Id $procId -ErrorAction Stop
        if (-not $Quiet) {
            Write-Host "Deteniendo PID $procId ($($proc.ProcessName)) en puerto $Port..."
        }
        Stop-Process -Id $procId -Force -ErrorAction Stop
    }
    catch {
        Write-Warning "No se pudo detener PID ${procId}: $_"
    }
}

if (-not $Quiet) {
    Write-Host "Puerto $Port liberado."
}

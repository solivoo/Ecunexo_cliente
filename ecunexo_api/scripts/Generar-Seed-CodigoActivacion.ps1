<#
.SYNOPSIS
  Genera la huella SHA-256 de un código de activación (igual que EcuNexo.Core.Tenancy.ActivationCodeHasher en C#)
  y opcionalmente un INSERT de ejemplo para PostgreSQL.

.DESCRIPTION
  Algoritmo: UTF-8 de "{Pepper}|{CodigoNormalizado}" donde CodigoNormalizado = Trim + ToUpperInvariant.
  Salida hex en MAYÚSCULAS, como Convert.ToHexString en .NET.

.PARAMETER Pepper
  Mismo valor que ActivationCodes:Pepper en appsettings (obligatorio).

.PARAMETER Codigo
  Texto en claro que escribirá el cliente (ej. DEV-ECUNEXO-ACTIVATION).

.PARAMETER EmitirSql
  Si se pasa, imprime un INSERT listo para tenancy.activation_codes (revisa el UUID y el xmin si tu BD lo exige).

.EXAMPLE
  .\scripts\Generar-Seed-CodigoActivacion.ps1 -Pepper 'ecunexo-dev-pepper-only-not-for-production-use' -Codigo 'DEV-ECUNEXO-ACTIVATION' -EmitirSql
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $Pepper,

  [Parameter(Mandatory = $true)]
  [string] $Codigo,

  [switch] $EmitirSql
)

$ErrorActionPreference = 'Stop'

function Get-ActivationCodeHash {
  param([string] $P, [string] $Raw)

  $normalized = $Raw.Trim().ToUpperInvariant()
  $payload = $P + '|' + $normalized
  $enc = New-Object System.Text.UTF8Encoding $false
  $bytes = $enc.GetBytes($payload)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha.ComputeHash($bytes)
  }
  finally {
    $sha.Dispose()
  }
  return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '')
}

if ([string]::IsNullOrWhiteSpace($Pepper)) {
  throw 'Pepper no puede estar vacío.'
}

$hash = Get-ActivationCodeHash -P $Pepper -Raw $Codigo
Write-Host ''
Write-Host '=== Huella (code_hash) ===' -ForegroundColor Cyan
Write-Host $hash
Write-Host ''
Write-Host 'Comprueba la huella con ActivationCodeHasher en EcuNexo.Core (mismo pepper y codigo).' -ForegroundColor DarkGray
Write-Host ''

if ($EmitirSql) {
  $id = [guid]::NewGuid().ToString('D').ToLowerInvariant()
  $mods = '["identity","catalog","warehousing","inventory","facturacion"]'
  $planLabel = 'Plan manual (seed)'
  $maxTenants = 10
  $maxUsers = 100
  $maxWarehouses = 50
  $slots = $maxTenants

  $sql = @"
-- Ejecutar en la BD ecunexo (ajusta id si choca con PK).
-- Si falla por columna xmin: inserta primero con la Api en Development o usa EF.
INSERT INTO tenancy.activation_codes (
  id,
  code_hash,
  plan_label,
  max_tenants,
  max_users,
  max_warehouses,
  enabled_module_codes,
  expires_at_utc,
  provisioning_slots_remaining,
  created_at_utc,
  consumed_at_utc,
  consumed_by_tenant_id,
  xmin
) VALUES (
  '$id'::uuid,
  '$hash',
  '$($planLabel.Replace("'", "''"))',
  $maxTenants,
  $maxUsers,
  $maxWarehouses,
  '$mods'::jsonb,
  (NOW() AT TIME ZONE 'utc') + interval '50 years',
  $slots,
  NOW() AT TIME ZONE 'utc',
  NULL,
  NULL,
  '\x00000000'::xid
);
"@
  Write-Host '=== SQL de ejemplo (revisar antes de ejecutar) ===' -ForegroundColor Cyan
  Write-Host $sql
}

Write-Host 'En Development, al arrancar la Api se inserta el codigo DEV-ECUNEXO-ACTIVATION si activation_codes esta vacia (DevelopmentActivationCodeSeeder).' -ForegroundColor Green
Write-Host ''

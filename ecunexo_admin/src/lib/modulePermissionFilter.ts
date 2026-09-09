/** Módulos de producto que aparecen en códigos de permiso (prefijo antes del primer punto). */
const KNOWN_PRODUCT_MODULES = new Set([
  'identity',
  'catalog',
  'warehousing',
  'inventory',
  'facturacion',
  'contabilidad',
  'training',
  'support',
])

export function productModuleFromPermissionCode(code: string): string | null {
  const trimmed = code.trim().toLowerCase()
  const dot = trimmed.indexOf('.')
  if (dot <= 0) return null
  let prefix = trimmed.slice(0, dot)
  if (prefix === 'invoicing') prefix = 'facturacion'
  if (prefix === 'accounting') prefix = 'contabilidad'
  return KNOWN_PRODUCT_MODULES.has(prefix) ? prefix : null
}

/**
 * Misma regla que ModulePermissionFilter.IsModuleEnabled / IsPermittedForModules en el API:
 * módulo contratado si figura en entitlements O en enabledModules.
 * (La licencia puede listar p. ej. catalog solo en enabledModules sin fila de tier.)
 */
export function isPermissionAllowedForModules(
  permissionCode: string,
  enabledModules: readonly string[] | null | undefined,
  entitlements?: ReadonlyArray<{ moduleCode: string }> | null
): boolean {
  const product = productModuleFromPermissionCode(permissionCode)
  if (!product) return true

  const matches = (raw: string): boolean => {
    const key = raw.trim().toLowerCase()
    const canonical =
      key === 'invoicing' ? 'facturacion' : key === 'accounting' ? 'contabilidad' : key
    return canonical === product
  }

  const inEntitlements =
    !!entitlements &&
    entitlements.length > 0 &&
    entitlements.some((e) => matches(e.moduleCode))

  const inEnabled =
    !!enabledModules &&
    enabledModules.length > 0 &&
    enabledModules.some((m) => matches(m))

  if (inEntitlements || inEnabled) return true

  // Sin lista de módulos en ninguno → sin restricción (legacy).
  if ((!entitlements || entitlements.length === 0) && (!enabledModules || enabledModules.length === 0)) {
    return true
  }

  return false
}

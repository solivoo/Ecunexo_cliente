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
 * Misma regla que ModulePermissionFilter en el API:
 * sin módulos contratados → todo permitido; con lista/entitlements → solo esos.
 */
export function isPermissionAllowedForModules(
  permissionCode: string,
  enabledModules: readonly string[] | null | undefined,
  entitlements?: ReadonlyArray<{ moduleCode: string }> | null
): boolean {
  const product = productModuleFromPermissionCode(permissionCode)
  if (!product) return true

  if (entitlements && entitlements.length > 0) {
    return entitlements.some(
      (e) => e.moduleCode.trim().toLowerCase() === product || (
        e.moduleCode.trim().toLowerCase() === 'invoicing' && product === 'facturacion'
      ) || (
        e.moduleCode.trim().toLowerCase() === 'accounting' && product === 'contabilidad'
      )
    )
  }

  if (!enabledModules || enabledModules.length === 0) return true

  return enabledModules.some((m) => {
    const key = m.trim().toLowerCase()
    const canonical =
      key === 'invoicing' ? 'facturacion' : key === 'accounting' ? 'contabilidad' : key
    return canonical === product
  })
}

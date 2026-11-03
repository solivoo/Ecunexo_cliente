import type { LockedModulesMode } from '@/lib/appPreferences'
import type { NavigationNode } from '@/types/navigation'

/**
 * Oculta entradas inaccesibles.
 * - Secciones sin ruta: solo si tienen hijos visibles.
 * - Hojas bloqueadas por permiso: se ocultan.
 * - Hojas bloqueadas por módulo no contratado: según `lockedModulesMode` ('hidden' = se ocultan, 'locked' = se muestran con candado).
 */
export function filterNavigationTree(
  nodes?: NavigationNode[] | null,
  lockedModulesMode: LockedModulesMode = 'hidden',
  resolvedLimits?: Record<string, number> | null,
): NavigationNode[] {
  if (!nodes || !Array.isArray(nodes)) {
    return []
  }
  const maxWarehouses = resolvedLimits?.['warehousing.max_warehouses']
  const hideSingleWarehouseMenu = typeof maxWarehouses === 'number' && maxWarehouses <= 1
  const result: NavigationNode[] = []

  for (const node of nodes) {
    if (
      hideSingleWarehouseMenu &&
      (node.requiredModule?.toLowerCase() === 'warehousing' ||
        node.id === 'warehousing' ||
        node.id === 'warehousing-list')
    ) {
      continue
    }

    const children = filterNavigationTree(node.children, lockedModulesMode, resolvedLimits)
    const hasRoute = Boolean(node.route?.trim())
    const isSection = !hasRoute
    const isModuleLocked = node.disabled && node.lockKind === 'module'
    const visible = node.placeholder
      ? true
      : isModuleLocked
        ? lockedModulesMode === 'locked'
        : isSection
          ? children.length > 0
          : !node.disabled || children.length > 0

    if (!visible) {
      continue
    }
    result.push({ ...node, children })
  }

  return result
}

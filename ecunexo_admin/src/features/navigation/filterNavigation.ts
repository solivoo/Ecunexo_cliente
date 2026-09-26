import type { NavigationNode } from '@/types/navigation'

/**
 * Oculta entradas inaccesibles.
 * - Secciones sin ruta: solo si tienen hijos visibles.
 * - Hojas bloqueadas por permiso: se ocultan.
 * - Hojas bloqueadas por módulo no contratado: se muestran (candado visible para vender el plan).
 */
export function filterNavigationTree(nodes?: NavigationNode[] | null): NavigationNode[] {
  if (!nodes || !Array.isArray(nodes)) {
    return []
  }
  const result: NavigationNode[] = []

  for (const node of nodes) {
    const children = filterNavigationTree(node.children)
    const hasRoute = Boolean(node.route?.trim())
    const isSection = !hasRoute
    const isModuleLocked = node.disabled && node.lockKind === 'module'
    const visible = node.placeholder
      ? true
      : isModuleLocked
        ? true
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

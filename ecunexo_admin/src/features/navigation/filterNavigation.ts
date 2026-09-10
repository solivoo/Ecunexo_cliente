import type { NavigationNode } from '@/types/navigation'

/**
 * Oculta entradas inaccesibles.
 * - Secciones sin ruta: solo si tienen hijos visibles.
 * - Hojas: solo si no están disabled (salvo placeholder).
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
    const visible = node.placeholder
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

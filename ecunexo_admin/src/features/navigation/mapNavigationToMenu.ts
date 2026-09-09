import type { MenuConfig, MenuItem, MenuSubItem } from 'glubox'
import type { NavigationNode } from '@/types/navigation'

/** Acciones de página o redundancias: no van al sidebar */
const SIDEBAR_EXCLUDED_IDS = new Set([
  'sub-companies-create',
  'org-companies-create',
  // Evitar duplicar pantallas de Equipo y Seguridad bajo Configuración:
  'configuracion-empleados',
  'configuracion-roles',
  'configuracion-permisos',
  'configuracion-politicas',
])

const SIDEBAR_EXCLUDED_ROUTES = new Set([
  'organizacion/empresas/nueva',
  '/organizacion/empresas/nueva',
])

function isCompanyFormRoute(route: string): boolean {
  return (
    route.endsWith('/organizacion/empresas/nueva') ||
    /\/organizacion\/empresas\/[^/]+\/editar$/.test(route) ||
    /\/equipo\/departamentos\/[^/]+\/editar$/.test(route)
  )
}

function omitFromSidebar(node: NavigationNode): boolean {
  if (SIDEBAR_EXCLUDED_IDS.has(node.id)) {
    return true
  }
  if (!node.route) {
    return false
  }
  const normalized = node.route.startsWith('/') ? node.route : `/${node.route}`
  return (
    SIDEBAR_EXCLUDED_ROUTES.has(node.route) ||
    SIDEBAR_EXCLUDED_ROUTES.has(normalized) ||
    isCompanyFormRoute(normalized)
  )
}

function forSidebar(nodes: NavigationNode[]): NavigationNode[] {
  const result: NavigationNode[] = []
  for (const node of nodes) {
    if (omitFromSidebar(node)) {
      continue
    }
    const children = forSidebar(node.children)
    result.push({ ...node, children })
  }
  return result
}

const materialToLucide: Record<string, string> = {
  dashboard: 'layout-dashboard',
  domain: 'building-2',
  analytics: 'bar-chart-3',
  settings: 'settings',
  group: 'users',
  admin_panel_settings: 'shield',
  key: 'key',
  inventory_2: 'package',
  receipt: 'receipt',
  'shopping-cart': 'shopping-cart',
  'shield-check': 'shield-check',
}

function mapIcon(icon: string | null): string | undefined {
  if (!icon) {
    return undefined
  }

  return materialToLucide[icon] ?? icon
}

function toPath(route: string | null): string | undefined {
  if (!route) {
    return undefined
  }

  return route.startsWith('/') ? route : `/${route}`
}

function formatNodeLabel(node: NavigationNode): string {
  let label = node.label
  // Diferenciar la sección operativa de empresa de las preferencias de usuario
  if (node.id === 'configuracion' && label.toLowerCase() === 'configuración') {
    label = 'Ajustes de Empresa'
  }
  if (node.placeholder) {
    return `${label} · Próximamente`
  }
  if (node.disabled && node.disabledReason) {
    return `${label} · ${node.disabledReason}`
  }
  return label
}

function resolveNodePath(node: NavigationNode): string | undefined {
  if (node.disabled || node.placeholder) {
    return undefined
  }
  return toPath(node.route)
}

function mapNode(node: NavigationNode): MenuItem {
  const children =
    node.children.length > 0 ? node.children.map(mapNodeAsSubItem) : undefined

  return {
    id: node.id,
    label: formatNodeLabel(node),
    icon: mapIcon(node.icon),
    path: children ? undefined : resolveNodePath(node),
    position: 'top',
    children,
  }
}

function mapNodeAsSubItem(node: NavigationNode): MenuSubItem {
  const children =
    node.children.length > 0 ? node.children.map(mapNodeAsSubItem) : undefined

  return {
    id: node.id,
    label: formatNodeLabel(node),
    path: children ? undefined : resolveNodePath(node),
    children,
  }
}

const APP_SETTINGS_READ = 'platform.settings.read'

function hasPermission(permissions: readonly string[], code: string): boolean {
  return permissions.some((item) => item.toLowerCase() === code.toLowerCase())
}

export function navigationToMenuConfig(
  nodes: NavigationNode[],
  userPermissions: readonly string[] = [],
): MenuConfig {
  const items = [...forSidebar(nodes).map(mapNode)]
  if (hasPermission(userPermissions, APP_SETTINGS_READ)) {
    items.push({
      id: 'app-settings',
      label: 'Preferencias',
      icon: 'sliders-horizontal',
      path: '/app/configuracion',
      position: 'bottom',
      permissions: [APP_SETTINGS_READ],
    })
  }

  return { items }
}

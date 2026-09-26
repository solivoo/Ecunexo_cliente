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
  // Emisor y SRI ya está centralizado bajo Ajustes de Empresa:
  'facturacion-emisor',
  'facturacion-emisor-config',
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
  build: 'wrench',
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
  const label = node.label
  // Diferenciar la sección operativa de empresa de las preferencias de usuario
  if (node.id === 'configuracion' && label.toLowerCase() === 'configuración') {
    return 'Ajustes de Empresa'
  }
  return label
}

/**
 * Estado de bloqueo para el Sidebar: candado + tooltip con el motivo.
 * El label se mantiene limpio (sin concatenar el motivo).
 */
function lockProps(
  node: NavigationNode,
): Pick<MenuItem, 'disabled' | 'locked' | 'disabledReason'> {
  const locked =
    node.disabled &&
    (node.lockKind === 'module' ||
      node.lockKind === 'permission' ||
      node.lockKind === 'placeholder')

  return {
    disabled: node.disabled,
    locked: Boolean(locked),
    disabledReason: node.disabledReason ?? undefined,
  }
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
    ...lockProps(node),
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
    ...lockProps(node),
  }
}

const APP_SETTINGS_READ = 'platform.settings.read'
const TENANT_READ = 'tenancy.tenant.read'

function hasPermission(permissions: readonly string[], code: string): boolean {
  return permissions.some((item) => item.toLowerCase() === code.toLowerCase())
}

export function navigationToMenuConfig(
  nodes: NavigationNode[],
  userPermissions: readonly string[] = [],
): MenuConfig {
  const items = [...forSidebar(nodes).map(mapNode)]
  if (
    userPermissions.length === 0 ||
    hasPermission(userPermissions, APP_SETTINGS_READ) ||
    hasPermission(userPermissions, TENANT_READ)
  ) {
    items.push({
      id: 'app-settings',
      label: 'Configuración',
      icon: 'settings',
      path: '/app/configuracion',
      position: 'bottom',
    })
  }

  return { items }
}

function collectMenuPaths(items: readonly MenuSubItem[], bucket: string[]): void {
  for (const item of items) {
    if (item.path) {
      bucket.push(item.path)
    }
    if (item.children?.length) {
      collectMenuPaths(item.children, bucket)
    }
  }
}

/**
 * Ruta de menú que corresponde al `pathname` actual.
 * Resuelve rutas con parámetros (p. ej. `/catalogo/items/123`) al ítem base del menú
 * para que el módulo correcto quede expandido y resaltado en el sidebar.
 */
export function resolveMenuActivePath(pathname: string, menu: MenuConfig): string {
  const paths: string[] = []
  collectMenuPaths(menu.items, paths)

  let best: string | null = null
  for (const path of paths) {
    const matches = pathname === path || pathname.startsWith(`${path}/`)
    if (matches && (best === null || path.length > best.length)) {
      best = path
    }
  }

  return best ?? pathname
}

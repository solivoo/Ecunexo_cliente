import type { MenuConfig } from 'glubox'

function findLabel(items: MenuConfig['items'], pathname: string): string | null {
  for (const item of items) {
    if (item.path === pathname) {
      return item.label
    }

    if (item.children?.length) {
      const childLabel = findLabel(item.children, pathname)
      if (childLabel) {
        return childLabel
      }
    }
  }

  return null
}

function inventoryNewTitle(search: string): string {
  const tipo = new URLSearchParams(search).get('tipo')
  if (tipo === '1') return 'Nuevo egreso'
  if (tipo === '2') return 'Nueva transferencia'
  if (tipo === '3') return 'Nuevo ajuste'
  return 'Nueva recepción'
}

function staticTitle(pathname: string, search: string): string | null {
  if (pathname === '/organizacion/empresas/nueva') return 'Crear empresa'
  if (/^\/organizacion\/empresas\/[^/]+\/editar$/.test(pathname)) return 'Editar empresa'
  if (/^\/equipo\/departamentos\/[^/]+\/editar$/.test(pathname)) return 'Editar departamento'
  if (pathname === '/app/configuracion') return 'Configuración'
  if (pathname === '/catalogo/items/nuevo') return 'Nuevo ítem'
  if (/^\/catalogo\/items\/[^/]+$/.test(pathname)) return 'Editar ítem'
  if (pathname === '/catalogo/categorias/nueva') return 'Nueva categoría'
  if (pathname === '/bodegas/nueva') return 'Nueva bodega'
  if (/^\/bodegas\/[^/]+$/.test(pathname)) return 'Editar bodega'
  if (pathname === '/inventario/documentos/nuevo') return inventoryNewTitle(search)
  if (/^\/inventario\/documentos\/[^/]+$/.test(pathname)) return 'Documento de inventario'
  return null
}

export function getPageTitle(
  pathname: string,
  menu: MenuConfig,
  fallback = 'EcuNexo',
  search = ''
): string {
  return findLabel(menu.items, pathname) ?? staticTitle(pathname, search) ?? fallback
}

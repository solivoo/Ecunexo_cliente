import { CatalogItemKind, CatalogItemStatus } from '@/types/catalogApi'

export function catalogItemKindLabel(kind: number): string {
  switch (kind) {
    case CatalogItemKind.Physical:
      return 'Físico'
    case CatalogItemKind.Service:
      return 'Servicio'
    default:
      return String(kind)
  }
}

export function catalogItemStatusLabel(status: number): string {
  switch (status) {
    case CatalogItemStatus.Active:
      return 'Activo'
    case CatalogItemStatus.Inactive:
      return 'Inactivo'
    default:
      return String(status)
  }
}

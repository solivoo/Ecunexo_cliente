import {
  InventoryDocumentStatus,
  InventoryDocumentType,
  InventoryMovementDirection,
  InventoryReceiptOrigin,
} from '@/types/inventoryApi'

export function inventoryDocumentTypeLabel(type: number): string {
  switch (type) {
    case InventoryDocumentType.Receipt:
      return 'Recepción'
    case InventoryDocumentType.Issue:
      return 'Egreso'
    case InventoryDocumentType.Transfer:
      return 'Transferencia'
    case InventoryDocumentType.Adjustment:
      return 'Ajuste'
    default:
      return String(type)
  }
}

export function inventoryDocumentStatusLabel(status: number): string {
  switch (status) {
    case InventoryDocumentStatus.Draft:
      return 'Borrador'
    case InventoryDocumentStatus.Approved:
      return 'Aprobado'
    case InventoryDocumentStatus.Cancelled:
      return 'Anulado'
    case InventoryDocumentStatus.InTransit:
      return 'En tránsito'
    default:
      return String(status)
  }
}

export function inventoryReceiptOriginLabel(origin: number | null | undefined): string {
  switch (origin) {
    case InventoryReceiptOrigin.Opening:
      return 'Inventario inicial'
    case InventoryReceiptOrigin.Purchase:
      return 'Compra'
    case InventoryReceiptOrigin.Return:
      return 'Devolución'
    case InventoryReceiptOrigin.Other:
      return 'Otro'
    default:
      return '—'
  }
}

export function inventoryMovementDirectionLabel(direction: number): string {
  switch (direction) {
    case InventoryMovementDirection.In:
      return 'Entrada'
    case InventoryMovementDirection.Out:
      return 'Salida'
    default:
      return String(direction)
  }
}

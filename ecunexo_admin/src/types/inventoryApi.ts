export const InventoryDocumentType = {
  Receipt: 0,
  Issue: 1,
  Transfer: 2,
  Adjustment: 3,
} as const

export type InventoryDocumentType = (typeof InventoryDocumentType)[keyof typeof InventoryDocumentType]

export const InventoryDocumentStatus = {
  Draft: 0,
  Approved: 1,
  Cancelled: 2,
  InTransit: 3,
} as const

export type InventoryDocumentStatus = (typeof InventoryDocumentStatus)[keyof typeof InventoryDocumentStatus]

export const InventoryMovementDirection = {
  In: 0,
  Out: 1,
} as const

export type InventoryMovementDirection =
  (typeof InventoryMovementDirection)[keyof typeof InventoryMovementDirection]

export const InventoryReceiptOrigin = {
  Opening: 0,
  Purchase: 1,
  Return: 2,
  Other: 3,
} as const

export type InventoryReceiptOrigin =
  (typeof InventoryReceiptOrigin)[keyof typeof InventoryReceiptOrigin]

export type WarehouseListItemDto = {
  id: string
  name: string
  code: string | null
  isMain: boolean
  isSystem: boolean
  systemRole: number
  createdAt: string
}

export type WarehouseDetailDto = {
  id: string
  name: string
  code: string | null
  addressJson: string
  isMain: boolean
  isSystem: boolean
  systemRole: number
  createdAt: string
  updatedAt: string | null
}

export type UpdateWarehouseBody = {
  name: string
  code?: string | null
  addressLine1?: string | null
  city?: string | null
  notes?: string | null
}

export type CreateWarehouseBody = {
  name: string
  code?: string | null
  isMain?: boolean
}

export type CreateWarehouseResponseDto = {
  warehouseId: string
  tenantId: string
}

export type StockListItemDto = {
  id: string
  catalogItemId: string
  catalogItemName: string
  sku: string | null
  warehouseId: string
  warehouseName: string
  quantity: number
  minimumQuantity: number | null
  isBelowMinimum: boolean
  updatedAt: string | null
  customAttributesJson?: string | null
}

export type InventoryDocumentListItemDto = {
  id: string
  documentType: InventoryDocumentType
  status: InventoryDocumentStatus
  warehouseId: string
  warehouseName: string
  destinationWarehouseId: string | null
  destinationWarehouseName: string | null
  lineCount: number
  notes: string | null
  receiptOrigin: InventoryReceiptOrigin | null
  sourceDocumentNumber: string | null
  createdAt: string
  approvedAt: string | null
}

export type InventoryDocumentLineDto = {
  catalogItemId: string
  catalogItemName: string
  quantity: number
}

export type InventoryDocumentDetailDto = {
  id: string
  documentType: InventoryDocumentType
  status: InventoryDocumentStatus
  warehouseId: string
  warehouseName: string
  destinationWarehouseId: string | null
  destinationWarehouseName: string | null
  notes: string | null
  receiptOrigin: InventoryReceiptOrigin | null
  sourceDocumentNumber: string | null
  createdAt: string
  shippedAt: string | null
  approvedAt: string | null
  lines: InventoryDocumentLineDto[]
}

export type CreateInventoryDocumentBody = {
  documentType: InventoryDocumentType
  warehouseId: string
  destinationWarehouseId?: string | null
  notes?: string | null
  receiptOrigin?: InventoryReceiptOrigin | null
  sourceDocumentNumber?: string | null
  lines: { catalogItemId: string; quantity: number }[]
}

export type CreateInventoryDocumentResponseDto = {
  documentId: string
  tenantId: string
  status: InventoryDocumentStatus
}

export type InventoryMovementListItemDto = {
  id: string
  catalogItemId: string
  catalogItemName: string
  warehouseId: string
  warehouseName: string
  documentId: string
  direction: InventoryMovementDirection
  quantity: number
  occurredAt: string
}

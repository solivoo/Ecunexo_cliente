import { api } from '@/lib/apiClient'
import type {
  CreateInventoryDocumentBody,
  CreateInventoryDocumentResponseDto,
  CreateWarehouseBody,
  CreateWarehouseResponseDto,
  InventoryDocumentDetailDto,
  InventoryDocumentListItemDto,
  InventoryMovementListItemDto,
  StockListItemDto,
  UpdateWarehouseBody,
  WarehouseDetailDto,
  WarehouseListItemDto,
} from '@/types/inventoryApi'

export async function listWarehouses(tenantId: string): Promise<WarehouseListItemDto[]> {
  const { data } = await api.get<WarehouseListItemDto[]>(`/api/v1/tenants/${tenantId}/warehouses`)
  return data
}

export async function createWarehouse(
  tenantId: string,
  body: CreateWarehouseBody
): Promise<CreateWarehouseResponseDto> {
  const { data } = await api.post<CreateWarehouseResponseDto>(
    `/api/v1/tenants/${tenantId}/warehouses`,
    body
  )
  return data
}

export async function getWarehouse(
  tenantId: string,
  warehouseId: string
): Promise<WarehouseDetailDto> {
  const { data } = await api.get<WarehouseDetailDto>(
    `/api/v1/tenants/${tenantId}/warehouses/${warehouseId}`
  )
  return data
}

export async function updateWarehouse(
  tenantId: string,
  warehouseId: string,
  body: UpdateWarehouseBody
): Promise<{ warehouseId: string; tenantId: string }> {
  const { data } = await api.put<{ warehouseId: string; tenantId: string }>(
    `/api/v1/tenants/${tenantId}/warehouses/${warehouseId}`,
    body
  )
  return data
}

export async function listStock(
  tenantId: string,
  opts?: { warehouseId?: string; belowMinimumOnly?: boolean }
): Promise<StockListItemDto[]> {
  const { data } = await api.get<StockListItemDto[]>(`/api/v1/tenants/${tenantId}/inventory/stock`, {
    params: {
      warehouseId: opts?.warehouseId,
      belowMinimumOnly: opts?.belowMinimumOnly ? true : undefined,
    },
  })
  return data
}

export async function setStockMinimum(
  tenantId: string,
  stockId: string,
  minimumQuantity: number | null
): Promise<{ stockId: string; quantity: number; minimumQuantity: number | null; isBelowMinimum: boolean }> {
  const { data } = await api.put(
    `/api/v1/tenants/${tenantId}/inventory/stock/${stockId}/minimum`,
    { minimumQuantity }
  )
  return data
}

export async function listInventoryDocuments(tenantId: string): Promise<InventoryDocumentListItemDto[]> {
  const { data } = await api.get<InventoryDocumentListItemDto[]>(
    `/api/v1/tenants/${tenantId}/inventory/documents`
  )
  return data
}

export async function getInventoryDocument(
  tenantId: string,
  documentId: string
): Promise<InventoryDocumentDetailDto> {
  const { data } = await api.get<InventoryDocumentDetailDto>(
    `/api/v1/tenants/${tenantId}/inventory/documents/${documentId}`
  )
  return data
}

export async function createInventoryDocument(
  tenantId: string,
  body: CreateInventoryDocumentBody
): Promise<CreateInventoryDocumentResponseDto> {
  const { data } = await api.post<CreateInventoryDocumentResponseDto>(
    `/api/v1/tenants/${tenantId}/inventory/documents`,
    body
  )
  return data
}

export async function approveInventoryDocument(tenantId: string, documentId: string): Promise<void> {
  await api.post(`/api/v1/tenants/${tenantId}/inventory/documents/${documentId}/approve`)
}

export async function receiveInventoryTransfer(tenantId: string, documentId: string): Promise<void> {
  await api.post(`/api/v1/tenants/${tenantId}/inventory/documents/${documentId}/receive`)
}

export async function listInventoryMovements(tenantId: string): Promise<InventoryMovementListItemDto[]> {
  const { data } = await api.get<InventoryMovementListItemDto[]>(
    `/api/v1/tenants/${tenantId}/inventory/movements`
  )
  return data
}

import { api } from '@/lib/apiClient'
import type {
  CreateExpenseTypePayload,
  CreatePurchasePayload,
  CreatePurchaseProformaPayload,
  CreateSupplierPayload,
  ExpenseTypeDto,
  ListPurchasesResponse,
  ParseSriPurchaseXmlResponse,
  PurchaseDetailDto,
  PurchaseFilterParams,
  PurchaseProformaDto,
  PurchaseProformaFilterParams,
  ReceivePurchasePayload,
  SupplierDto,
  SupplierFilterParams,
  UpdateExpenseTypePayload,
  UpdateSupplierPayload,
} from '@/types/purchasesApi'

// ======================== PROVEEDORES ========================

export async function listSuppliers(
  tenantId: string,
  params?: SupplierFilterParams
): Promise<SupplierDto[]> {
  const queryParams: Record<string, string> = {}
  if (params?.search?.trim()) {
    queryParams.search = params.search.trim()
  }
  if (params?.activeOnly !== undefined) {
    queryParams.activeOnly = String(params.activeOnly)
  }

  const { data } = await api.get<SupplierDto[]>(
    `/api/v1/tenants/${tenantId}/purchases/suppliers`,
    { params: queryParams }
  )
  return data
}

export async function getSupplierById(
  tenantId: string,
  supplierId: string
): Promise<SupplierDto> {
  const { data } = await api.get<SupplierDto>(
    `/api/v1/tenants/${tenantId}/purchases/suppliers/${supplierId}`
  )
  return data
}

export async function createSupplier(
  tenantId: string,
  payload: CreateSupplierPayload
): Promise<SupplierDto> {
  const { data } = await api.post<SupplierDto>(
    `/api/v1/tenants/${tenantId}/purchases/suppliers`,
    payload
  )
  return data
}
export async function getSupplierByTaxId(
  tenantId: string,
  taxId: string
): Promise<SupplierDto | null> {
  try {
    const { data } = await api.get<SupplierDto>(
      `/api/v1/tenants/${tenantId}/purchases/suppliers/by-tax-id/${encodeURIComponent(taxId.trim())}`
    )
    return data
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return null
    }
    throw err
  }
}

export async function getOrCreateSupplier(
  tenantId: string,
  payload: CreateSupplierPayload
): Promise<SupplierDto> {
  const cleanTaxId = payload.taxId.trim()
  try {
    return await createSupplier(tenantId, {
      ...payload,
      taxId: cleanTaxId,
      returnExistingIfExists: true,
    })
  } catch (err: any) {
    const errCode = err?.response?.data?.code || err?.code || ''
    const errMsg = (err?.response?.data?.message || err?.message || '').toLowerCase()
    const isDuplicate =
      err?.response?.status === 409 ||
      errCode.includes('duplicate') ||
      errMsg.includes('ya existe un proveedor') ||
      errMsg.includes('identificación fiscal')

    if (isDuplicate) {
      try {
        const found = await getSupplierByTaxId(tenantId, cleanTaxId)
        if (found) return found
      } catch {
        // Fallback a listSuppliers
      }

      const list = await listSuppliers(tenantId, { search: cleanTaxId, activeOnly: false })
      const matched = list.find((s) => s.taxId.trim().toLowerCase() === cleanTaxId.toLowerCase())
      if (matched) return matched

      const matchedByName = list.find(
        (s) => s.businessName.trim().toLowerCase() === payload.businessName.trim().toLowerCase()
      )
      if (matchedByName) return matchedByName
    }

    throw err
  }
}

export async function updateSupplier(
  tenantId: string,
  supplierId: string,
  payload: UpdateSupplierPayload
): Promise<SupplierDto> {
  const { data } = await api.put<SupplierDto>(
    `/api/v1/tenants/${tenantId}/purchases/suppliers/${supplierId}`,
    payload
  )
  return data
}

export async function deleteSupplier(
  tenantId: string,
  supplierId: string
): Promise<boolean> {
  const { data } = await api.delete<boolean>(
    `/api/v1/tenants/${tenantId}/purchases/suppliers/${supplierId}`
  )
  return data
}

// ======================== TIPOS DE GASTO SRI ========================

export async function listExpenseTypes(
  tenantId: string,
  activeOnly?: boolean
): Promise<ExpenseTypeDto[]> {
  const params: Record<string, string> = {}
  if (activeOnly !== undefined) {
    params.activeOnly = String(activeOnly)
  }

  const { data } = await api.get<ExpenseTypeDto[]>(
    `/api/v1/tenants/${tenantId}/purchases/expense-types`,
    { params }
  )
  return data
}

export async function createExpenseType(
  tenantId: string,
  payload: CreateExpenseTypePayload
): Promise<ExpenseTypeDto> {
  const { data } = await api.post<ExpenseTypeDto>(
    `/api/v1/tenants/${tenantId}/purchases/expense-types`,
    payload
  )
  return data
}

export async function updateExpenseType(
  tenantId: string,
  expenseTypeId: string,
  payload: UpdateExpenseTypePayload
): Promise<ExpenseTypeDto> {
  const { data } = await api.put<ExpenseTypeDto>(
    `/api/v1/tenants/${tenantId}/purchases/expense-types/${expenseTypeId}`,
    payload
  )
  return data
}

export async function deleteExpenseType(
  tenantId: string,
  expenseTypeId: string
): Promise<boolean> {
  const { data } = await api.delete<boolean>(
    `/api/v1/tenants/${tenantId}/purchases/expense-types/${expenseTypeId}`
  )
  return data
}

export async function seedDefaultExpenseTypes(
  tenantId: string
): Promise<number> {
  const { data } = await api.post<number>(
    `/api/v1/tenants/${tenantId}/purchases/expense-types/seed`
  )
  return data
}

// ======================== PROFORMAS DE COMPRA ========================

export async function listPurchaseProformas(
  tenantId: string,
  params?: PurchaseProformaFilterParams
): Promise<PurchaseProformaDto[]> {
  const queryParams: Record<string, string> = {}
  if (params?.supplierId) {
    queryParams.supplierId = params.supplierId
  }
  if (params?.status !== undefined) {
    queryParams.status = String(params.status)
  }
  if (params?.from) {
    queryParams.from = params.from
  }
  if (params?.to) {
    queryParams.to = params.to
  }

  const { data } = await api.get<PurchaseProformaDto[]>(
    `/api/v1/tenants/${tenantId}/purchases/proformas`,
    { params: queryParams }
  )
  return data
}

export async function getPurchaseProformaById(
  tenantId: string,
  proformaId: string
): Promise<PurchaseProformaDto> {
  const { data } = await api.get<PurchaseProformaDto>(
    `/api/v1/tenants/${tenantId}/purchases/proformas/${proformaId}`
  )
  return data
}

export async function createPurchaseProforma(
  tenantId: string,
  payload: CreatePurchaseProformaPayload
): Promise<PurchaseProformaDto> {
  const { data } = await api.post<PurchaseProformaDto>(
    `/api/v1/tenants/${tenantId}/purchases/proformas`,
    payload
  )
  return data
}

export async function approvePurchaseProforma(
  tenantId: string,
  proformaId: string
): Promise<PurchaseProformaDto> {
  const { data } = await api.post<PurchaseProformaDto>(
    `/api/v1/tenants/${tenantId}/purchases/proformas/${proformaId}/approve`
  )
  return data
}

export async function rejectPurchaseProforma(
  tenantId: string,
  proformaId: string,
  reason?: string
): Promise<PurchaseProformaDto> {
  const { data } = await api.post<PurchaseProformaDto>(
    `/api/v1/tenants/${tenantId}/purchases/proformas/${proformaId}/reject`,
    { reason }
  )
  return data
}

// ======================== FACTURAS / DOCUMENTOS DE COMPRA ========================

export async function listPurchases(
  tenantId: string,
  params?: PurchaseFilterParams
): Promise<ListPurchasesResponse> {
  const queryParams: Record<string, string> = {}
  if (params?.supplierId) {
    queryParams.supplierId = params.supplierId
  }
  if (params?.status !== undefined) {
    queryParams.status = String(params.status)
  }
  if (params?.from) {
    queryParams.from = params.from
  }
  if (params?.to) {
    queryParams.to = params.to
  }
  if (params?.search?.trim()) {
    queryParams.search = params.search.trim()
  }

  const { data } = await api.get<ListPurchasesResponse>(
    `/api/v1/tenants/${tenantId}/purchases/documents`,
    { params: queryParams }
  )
  return data
}

export async function getPurchaseById(
  tenantId: string,
  purchaseId: string
): Promise<PurchaseDetailDto> {
  const { data } = await api.get<PurchaseDetailDto>(
    `/api/v1/tenants/${tenantId}/purchases/documents/${purchaseId}`
  )
  return data
}

export async function parseSriPurchaseXml(
  tenantId: string,
  xmlContent: string
): Promise<ParseSriPurchaseXmlResponse> {
  const { data } = await api.post<ParseSriPurchaseXmlResponse>(
    `/api/v1/tenants/${tenantId}/purchases/documents/parse-xml`,
    { xmlContent }
  )
  return data
}

export async function createPurchase(
  tenantId: string,
  payload: CreatePurchasePayload
): Promise<{ purchaseId: string; invoiceNumber: string }> {
  const { data } = await api.post<{ purchaseId: string; invoiceNumber: string }>(
    `/api/v1/tenants/${tenantId}/purchases/documents`,
    payload
  )
  return data
}

export async function receivePurchase(
  tenantId: string,
  purchaseId: string,
  payload?: ReceivePurchasePayload
): Promise<{ purchaseId: string; status: number; itemsReceivedInStock: number }> {
  const { data } = await api.post<{ purchaseId: string; status: number; itemsReceivedInStock: number }>(
    `/api/v1/tenants/${tenantId}/purchases/documents/${purchaseId}/receive`,
    payload ?? {}
  )
  return data
}

// ======================== LIQUIDACIONES DE COMPRA (SRI 03) ========================

export async function listPurchaseSettlements(
  tenantId: string,
  params?: PurchaseFilterParams
): Promise<ListPurchasesResponse> {
  const queryParams: Record<string, string> = {}
  if (params?.supplierId) {
    queryParams.supplierId = params.supplierId
  }
  if (params?.status !== undefined) {
    queryParams.status = String(params.status)
  }
  if (params?.from) {
    queryParams.from = params.from
  }
  if (params?.to) {
    queryParams.to = params.to
  }
  if (params?.search?.trim()) {
    queryParams.search = params.search.trim()
  }

  const { data } = await api.get<ListPurchasesResponse>(
    `/api/v1/tenants/${tenantId}/purchases/settlements`,
    { params: queryParams }
  )
  return data
}

export async function createPurchaseSettlement(
  tenantId: string,
  payload: CreatePurchasePayload
): Promise<{ purchaseId: string; invoiceNumber: string }> {
  const { data } = await api.post<{ purchaseId: string; invoiceNumber: string }>(
    `/api/v1/tenants/${tenantId}/purchases/settlements`,
    payload
  )
  return data
}


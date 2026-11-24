import { api } from '@/lib/apiClient'

/* ==================== MÉTODOS DE ENVÍO ==================== */

const methodsBase = (tenantId: string) => `/api/v1/tenants/${tenantId}/logistics/shipping-methods`

export async function listShippingMethods(
  tenantId: string,
  params?: { onlyActive?: boolean }
): Promise<import('@/types/shippingApi').ShippingMethodDto[]> {
  const { data } = await api.get<import('@/types/shippingApi').ShippingMethodDto[]>(methodsBase(tenantId), {
    params,
  })
  return data
}

export async function createShippingMethod(
  tenantId: string,
  body: import('@/types/shippingApi').CreateShippingMethodBody
): Promise<import('@/types/shippingApi').ShippingMethodDto> {
  const { data } = await api.post<import('@/types/shippingApi').ShippingMethodDto>(methodsBase(tenantId), body)
  return data
}

export async function updateShippingMethod(
  tenantId: string,
  methodId: string,
  body: import('@/types/shippingApi').UpdateShippingMethodBody
): Promise<import('@/types/shippingApi').ShippingMethodDto> {
  const { data } = await api.put<import('@/types/shippingApi').ShippingMethodDto>(`${methodsBase(tenantId)}/${methodId}`, body)
  return data
}

export async function deleteShippingMethod(
  tenantId: string,
  methodId: string
): Promise<void> {
  await api.delete(`${methodsBase(tenantId)}/${methodId}`)
}

export async function listEcuadorProvinces(): Promise<
  import('@/types/shippingApi').EcuadorProvinceDto[]
> {
  const { data } = await api.get<import('@/types/shippingApi').EcuadorProvinceDto[]>(
    '/api/v1/logistics/ecuador/provinces'
  )
  return data
}

export async function listCantonShippingRates(
  tenantId: string,
  provinceId: string,
  shippingMethodId?: string | null,
  originCantonId?: string | null
): Promise<import('@/types/shippingApi').CantonShippingRateItemDto[]> {
  const params: Record<string, string> = { provinceId }
  if (shippingMethodId) params.shippingMethodId = shippingMethodId
  if (originCantonId) params.originCantonId = originCantonId
  const { data } = await api.get<import('@/types/shippingApi').CantonShippingRateItemDto[]>(
    `/api/v1/tenants/${tenantId}/logistics/canton-rates`,
    { params }
  )
  return data
}

export async function upsertCantonShippingRatesBulk(
  tenantId: string,
  body: import('@/types/shippingApi').UpsertCantonShippingRatesBulkBody
): Promise<{ upsertedCount: number }> {
  const { data } = await api.put<{ upsertedCount: number }>(
    `/api/v1/tenants/${tenantId}/logistics/canton-rates/bulk`,
    body
  )
  return data
}

export async function calculateShippingCost(
  tenantId: string,
  body: import('@/types/shippingApi').CalculateShippingCostBody
): Promise<import('@/types/shippingApi').ShippingCostCalculationResultDto> {
  const { data } = await api.post<
    import('@/types/shippingApi').ShippingCostCalculationResultDto
  >(`/api/v1/tenants/${tenantId}/logistics/canton-rates/calculate`, body)
  return data
}

import { api } from '@/lib/apiClient'
import type {
  CreateShippingRateRuleBody,
  ResolveShippingRatesBody,
  ResolvedShippingOptionDto,
  ShippingRateRuleDto,
  UpdateShippingRateRuleBody,
} from '@/types/shippingApi'

const base = (tenantId: string) => `/api/v1/tenants/${tenantId}/logistics/shipping-rates`

export async function listShippingRates(
  tenantId: string,
  params?: {
    carrier?: string
    zone?: string
    onlyActive?: boolean
  }
): Promise<ShippingRateRuleDto[]> {
  const { data } = await api.get<ShippingRateRuleDto[]>(base(tenantId), {
    params,
  })
  return data
}

export async function createShippingRate(
  tenantId: string,
  body: CreateShippingRateRuleBody
): Promise<ShippingRateRuleDto> {
  const { data } = await api.post<ShippingRateRuleDto>(base(tenantId), body)
  return data
}

export async function updateShippingRate(
  tenantId: string,
  ruleId: string,
  body: UpdateShippingRateRuleBody
): Promise<ShippingRateRuleDto> {
  const { data } = await api.put<ShippingRateRuleDto>(`${base(tenantId)}/${ruleId}`, body)
  return data
}

export async function deleteShippingRate(
  tenantId: string,
  ruleId: string
): Promise<void> {
  await api.delete(`${base(tenantId)}/${ruleId}`)
}

export async function resolveShippingRates(
  tenantId: string,
  body: ResolveShippingRatesBody
): Promise<ResolvedShippingOptionDto[]> {
  const { data } = await api.post<ResolvedShippingOptionDto[]>(`${base(tenantId)}/resolve`, body)
  return data
}

/* ==================== ZONAS DE ENVÍO ==================== */

const zonesBase = (tenantId: string) => `/api/v1/tenants/${tenantId}/logistics/shipping-zones`

export async function listShippingZones(
  tenantId: string,
  params?: { onlyActive?: boolean }
): Promise<import('@/types/shippingApi').ShippingZoneDto[]> {
  const { data } = await api.get<import('@/types/shippingApi').ShippingZoneDto[]>(zonesBase(tenantId), {
    params,
  })
  return data
}

export async function createShippingZone(
  tenantId: string,
  body: import('@/types/shippingApi').CreateShippingZoneBody
): Promise<import('@/types/shippingApi').ShippingZoneDto> {
  const { data } = await api.post<import('@/types/shippingApi').ShippingZoneDto>(zonesBase(tenantId), body)
  return data
}

export async function updateShippingZone(
  tenantId: string,
  zoneId: string,
  body: import('@/types/shippingApi').UpdateShippingZoneBody
): Promise<import('@/types/shippingApi').ShippingZoneDto> {
  const { data } = await api.put<import('@/types/shippingApi').ShippingZoneDto>(`${zonesBase(tenantId)}/${zoneId}`, body)
  return data
}

export async function deleteShippingZone(
  tenantId: string,
  zoneId: string
): Promise<void> {
  await api.delete(`${zonesBase(tenantId)}/${zoneId}`)
}

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

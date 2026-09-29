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

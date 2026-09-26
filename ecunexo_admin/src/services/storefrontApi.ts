import { api } from '@/lib/apiClient'
import type { CreateStorefrontDomainBody, StorefrontDomainDto } from '@/types/storefrontApi'

const base = (tenantId: string) =>
  `/api/v1/tenants/${tenantId}/ecommerce/storefront/domains`

export async function listStorefrontDomains(tenantId: string): Promise<StorefrontDomainDto[]> {
  const { data } = await api.get<StorefrontDomainDto[]>(base(tenantId))
  return data
}

export async function createStorefrontDomain(
  tenantId: string,
  body: CreateStorefrontDomainBody
): Promise<StorefrontDomainDto> {
  const { data } = await api.post<StorefrontDomainDto>(base(tenantId), body)
  return data
}

export async function verifyStorefrontDomain(
  tenantId: string,
  domainId: string
): Promise<StorefrontDomainDto> {
  const { data } = await api.post<StorefrontDomainDto>(`${base(tenantId)}/${domainId}/verify`)
  return data
}

export async function setPrimaryStorefrontDomain(
  tenantId: string,
  domainId: string
): Promise<StorefrontDomainDto> {
  const { data } = await api.put<StorefrontDomainDto>(`${base(tenantId)}/${domainId}/primary`)
  return data
}

export async function deleteStorefrontDomain(
  tenantId: string,
  domainId: string
): Promise<void> {
  await api.delete(`${base(tenantId)}/${domainId}`)
}

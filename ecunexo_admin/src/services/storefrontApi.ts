import { api } from '@/lib/apiClient'
import type {
  CreateEcommerceBlockedContactInput,
  CreateStorefrontDomainBody,
  EcommerceBlockedContact,
  EcommerceStorefrontSettings,
  StorefrontDomainDto,
  UpdateEcommerceStorefrontSettingsInput,
} from '@/types/storefrontApi'

const base = (tenantId: string) =>
  `/api/v1/tenants/${tenantId}/ecommerce/storefront/domains`

const settingsBase = (tenantId: string) =>
  `/api/v1/tenants/${tenantId}/ecommerce/storefront/settings`

const blockedContactsBase = (tenantId: string) =>
  `/api/v1/tenants/${tenantId}/ecommerce/blocked-contacts`

export async function getEcommerceStorefrontSettings(
  tenantId: string
): Promise<EcommerceStorefrontSettings> {
  const { data } = await api.get<EcommerceStorefrontSettings>(settingsBase(tenantId))
  return data
}

export async function updateEcommerceStorefrontSettings(
  tenantId: string,
  input: UpdateEcommerceStorefrontSettingsInput
): Promise<EcommerceStorefrontSettings> {
  const { data } = await api.put<EcommerceStorefrontSettings>(settingsBase(tenantId), input)
  return data
}

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

export async function listEcommerceBlockedContacts(
  tenantId: string
): Promise<EcommerceBlockedContact[]> {
  const { data } = await api.get<EcommerceBlockedContact[]>(blockedContactsBase(tenantId))
  return data
}

export async function createEcommerceBlockedContact(
  tenantId: string,
  input: CreateEcommerceBlockedContactInput
): Promise<EcommerceBlockedContact> {
  const { data } = await api.post<EcommerceBlockedContact>(blockedContactsBase(tenantId), input)
  return data
}

export async function deleteEcommerceBlockedContact(
  tenantId: string,
  contactId: string
): Promise<void> {
  await api.delete(`${blockedContactsBase(tenantId)}/${contactId}`)
}

import { api } from '@/lib/apiClient'

export interface DeveloperApiScopeItemDto {
  readonly code: string
  readonly moduleCode: string
  readonly moduleLabel: string
  readonly title: string
  readonly description: string
  readonly isModuleEntitled: boolean
}

export interface TenantApiKeyItemDto {
  readonly id: string
  readonly tenantId: string
  readonly name: string
  readonly keyPrefix: string
  readonly scopes: readonly string[]
  readonly createdAt: string
  readonly createdBy: string | null
  readonly expiresAt: string | null
  readonly revokedAt: string | null
  readonly lastUsedAt: string | null
  readonly status: 'active' | 'expired' | 'revoked'
}

export interface CreatedTenantApiKeyDto {
  readonly id: string
  readonly tenantId: string
  readonly name: string
  readonly keyPrefix: string
  readonly plainTextKey: string
  readonly scopes: readonly string[]
  readonly createdAt: string
  readonly expiresAt: string | null
}

export interface CreateTenantApiKeyRequest {
  readonly name: string
  readonly scopes: readonly string[]
  readonly expiresAt?: string | null
}

export async function listDeveloperApiScopes(
  tenantId: string
): Promise<DeveloperApiScopeItemDto[]> {
  const { data } = await api.get<DeveloperApiScopeItemDto[]>(
    `/api/v1/tenants/${tenantId}/api-keys/scopes`
  )
  return data
}

export async function listTenantApiKeys(tenantId: string): Promise<TenantApiKeyItemDto[]> {
  const { data } = await api.get<TenantApiKeyItemDto[]>(`/api/v1/tenants/${tenantId}/api-keys`)
  return data
}

export async function createTenantApiKey(
  tenantId: string,
  body: CreateTenantApiKeyRequest
): Promise<CreatedTenantApiKeyDto> {
  const { data } = await api.post<CreatedTenantApiKeyDto>(
    `/api/v1/tenants/${tenantId}/api-keys`,
    body
  )
  return data
}

export async function revokeTenantApiKey(tenantId: string, apiKeyId: string): Promise<void> {
  await api.delete(`/api/v1/tenants/${tenantId}/api-keys/${apiKeyId}`)
}

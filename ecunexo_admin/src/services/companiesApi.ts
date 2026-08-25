import { api } from '@/lib/apiClient'
import type {
  ListSubscriptionCompaniesDto,
  ProvisionCompanyBody,
  ProvisionCompanyResponseDto,
  UpdateSubscriptionCompanyBody,
  UpdateSubscriptionCompanyResponseDto,
} from '@/types/companiesApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'

export interface EnterCompanySessionResult {
  accessToken: string
  expiresAt: string
  userId: string
  tenantId: string
  isSubscriptionHolder: boolean
}

export type CompanyStatusResult = {
  tenantId: string
  status: number
}

export async function listSubscriptionCompanies(): Promise<ListSubscriptionCompaniesDto> {
  const { data } = await api.get<ListSubscriptionCompaniesDto>('/api/v1/subscription/companies')
  return data
}

export async function provisionSubscriptionCompany(
  body: ProvisionCompanyBody
): Promise<ProvisionCompanyResponseDto> {
  const { data } = await api.post<ProvisionCompanyResponseDto>(
    '/api/v1/subscription/companies',
    body
  )
  return data
}

export async function enterCompanySession(tenantId: string): Promise<EnterCompanySessionResult> {
  const { data } = await api.post<EnterCompanySessionResult>(
    `/api/v1/subscription/companies/${tenantId}/session`
  )
  return data
}

export async function getSubscriptionCompany(tenantId: string): Promise<GetTenantByIdDto> {
  const { data } = await api.get<GetTenantByIdDto>(`/api/v1/tenants/${tenantId}`)
  return data
}

export async function updateSubscriptionCompany(
  tenantId: string,
  body: UpdateSubscriptionCompanyBody
): Promise<UpdateSubscriptionCompanyResponseDto> {
  const { data } = await api.put<UpdateSubscriptionCompanyResponseDto>(
    `/api/v1/subscription/companies/${tenantId}`,
    body
  )
  return data
}

export async function deleteSubscriptionCompany(tenantId: string): Promise<CompanyStatusResult> {
  const { data } = await api.delete<CompanyStatusResult>(
    `/api/v1/subscription/companies/${tenantId}`
  )
  return data
}

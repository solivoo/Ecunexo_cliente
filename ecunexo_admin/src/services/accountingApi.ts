import { api } from '@/lib/apiClient'
import type {
  AccountDto,
  AccountFilterParams,
  CreateAccountPayload,
  UpdateAccountPayload,
} from '@/types/accountingApi'

export async function listAccounts(
  tenantId: string,
  params?: AccountFilterParams
): Promise<AccountDto[]> {
  const queryParams: Record<string, string> = {}
  if (params?.search?.trim()) {
    queryParams.search = params.search.trim()
  }
  if (params?.type !== undefined) {
    queryParams.type = String(params.type)
  }
  if (params?.allowsMovementOnly !== undefined) {
    queryParams.allowsMovementOnly = String(params.allowsMovementOnly)
  }
  if (params?.activeOnly !== undefined) {
    queryParams.activeOnly = String(params.activeOnly)
  }

  const { data } = await api.get<AccountDto[]>(
    `/api/v1/tenants/${tenantId}/accounting/accounts`,
    { params: queryParams }
  )
  return data
}

export async function createAccount(
  tenantId: string,
  payload: CreateAccountPayload
): Promise<AccountDto> {
  const { data } = await api.post<AccountDto>(
    `/api/v1/tenants/${tenantId}/accounting/accounts`,
    payload
  )
  return data
}

export async function updateAccount(
  tenantId: string,
  accountId: string,
  payload: UpdateAccountPayload
): Promise<AccountDto> {
  const { data } = await api.put<AccountDto>(
    `/api/v1/tenants/${tenantId}/accounting/accounts/${accountId}`,
    payload
  )
  return data
}

export async function deleteAccount(
  tenantId: string,
  accountId: string
): Promise<boolean> {
  const { data } = await api.delete<boolean>(
    `/api/v1/tenants/${tenantId}/accounting/accounts/${accountId}`
  )
  return data
}

export async function seedStandardPlan(tenantId: string): Promise<number> {
  const { data } = await api.post<number>(
    `/api/v1/tenants/${tenantId}/accounting/accounts/seed`
  )
  return data
}

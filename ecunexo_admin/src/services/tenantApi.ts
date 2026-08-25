import { api } from '@/lib/apiClient'
import { listTenantUsers } from '@/services/identityApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'

export { listTenantUsers }

export async function getTenant(tenantId: string): Promise<GetTenantByIdDto> {
  const { data } = await api.get<GetTenantByIdDto>(`/api/v1/tenants/${tenantId}`)
  return data
}

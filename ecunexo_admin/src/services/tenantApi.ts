import { api } from '@/lib/apiClient'
import { listTenantUsers } from '@/services/identityApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'

export { listTenantUsers }

export async function getTenant(tenantId: string): Promise<GetTenantByIdDto> {
  const { data } = await api.get<GetTenantByIdDto>(`/api/v1/tenants/${tenantId}`)
  return data
}

export type SigningCertificateStatusDto = {
  readonly isConfigured: boolean
  readonly subject: string | null
  readonly subjectTaxId: string | null
  readonly issuer: string | null
  readonly validFrom: string | null
  readonly validTo: string | null
  readonly serialNumber: string | null
  readonly daysRemaining: number
  readonly isExpired: boolean
  readonly originalFileName: string | null
  readonly updatedAt: string | null
}

export async function getSigningCertificateStatus(tenantId: string): Promise<SigningCertificateStatusDto> {
  const { data } = await api.get<SigningCertificateStatusDto>(
    `/api/v1/tenants/${tenantId}/signing-certificate/status`
  )
  return data
}

export async function uploadSigningCertificate(
  tenantId: string,
  file: File,
  password: string
): Promise<SigningCertificateStatusDto> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('password', password)

  const { data } = await api.post<SigningCertificateStatusDto>(
    `/api/v1/tenants/${tenantId}/signing-certificate`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return data
}

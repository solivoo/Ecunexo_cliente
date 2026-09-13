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

export type UpdateTenantSriLegalBody = {
  taxId?: string | null
  legalName?: string | null
  tradeName?: string | null
  city?: string | null
  establishmentCode?: string | null
  address?: string | null
  accountingRequired: boolean
  isRimpe: boolean
  rimpeKind?: string | null
  preferElectronicInvoice: boolean
  isExporter: boolean
  isLargeTaxpayer: boolean
  isSpecialTaxpayer: boolean
  isWithholdingAgent: boolean
}

export async function updateTenantSriLegal(
  tenantId: string,
  body: UpdateTenantSriLegalBody
): Promise<{ tenantId: string }> {
  const { data } = await api.put<{ tenantId: string }>(
    `/api/v1/tenants/${tenantId}/sri-legal`,
    body
  )
  return data
}


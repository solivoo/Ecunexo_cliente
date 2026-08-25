import { api } from '@/lib/apiClient'

export type BrandLogoListItem = {
  readonly id: string
  readonly originalFileName: string
  readonly extension: string
  readonly contentType: string
  readonly byteSize: number
  readonly createdAt: string
  readonly fileUrl: string
}

export type BrandLogoCatalog = {
  readonly lightLogoId: string | null
  readonly darkLogoId: string | null
  readonly preferWordmark: boolean
  readonly items: readonly BrandLogoListItem[]
}

export async function listBrandLogos(tenantId: string): Promise<BrandLogoCatalog> {
  const { data } = await api.get<BrandLogoCatalog>(`/api/v1/tenants/${tenantId}/brand-logos`)
  return data
}

export async function uploadBrandLogo(
  tenantId: string,
  file: File
): Promise<{ logoId: string; fileUrl: string }> {
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post<{ logoId: string; fileUrl: string }>(
    `/api/v1/tenants/${tenantId}/brand-logos`,
    body
  )
  return data
}

export async function selectBrandLogos(
  tenantId: string,
  body: {
    readonly lightLogoId: string | null
    readonly darkLogoId: string | null
    readonly preferWordmark: boolean
  }
): Promise<void> {
  await api.put(`/api/v1/tenants/${tenantId}/brand-logos/selection`, body)
}

export async function deleteBrandLogo(tenantId: string, logoId: string): Promise<void> {
  await api.delete(`/api/v1/tenants/${tenantId}/brand-logos/${logoId}`)
}

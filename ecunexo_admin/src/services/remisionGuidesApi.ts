import { api } from '@/lib/apiClient'
import type {
  CreateRemisionGuidePayload,
  CreateRemisionGuideResponse,
  ListRemisionGuidesResponse,
  RemisionGuideDetailDto,
  RemisionGuideFilterParams,
  UpdateRemisionGuideStatusPayload,
} from '@/types/remisionGuidesApi'

export async function listRemisionGuides(
  tenantId: string,
  params?: RemisionGuideFilterParams
): Promise<ListRemisionGuidesResponse> {
  const queryParams: Record<string, string> = {}
  if (params?.status !== undefined) {
    queryParams.status = String(params.status)
  }
  if (params?.from) {
    queryParams.from = params.from
  }
  if (params?.to) {
    queryParams.to = params.to
  }
  if (params?.search?.trim()) {
    queryParams.search = params.search.trim()
  }

  const { data } = await api.get<ListRemisionGuidesResponse>(
    `/api/v1/tenants/${tenantId}/billing/remision-guides`,
    { params: queryParams }
  )
  return data
}

export async function getRemisionGuideById(
  tenantId: string,
  id: string
): Promise<RemisionGuideDetailDto> {
  const { data } = await api.get<RemisionGuideDetailDto>(
    `/api/v1/tenants/${tenantId}/billing/remision-guides/${id}`
  )
  return data
}

export async function createRemisionGuide(
  tenantId: string,
  payload: CreateRemisionGuidePayload
): Promise<CreateRemisionGuideResponse> {
  const { data } = await api.post<CreateRemisionGuideResponse>(
    `/api/v1/tenants/${tenantId}/billing/remision-guides`,
    payload
  )
  return data
}

export async function updateRemisionGuideStatus(
  tenantId: string,
  id: string,
  payload: UpdateRemisionGuideStatusPayload
): Promise<boolean> {
  const { data } = await api.patch<boolean>(
    `/api/v1/tenants/${tenantId}/billing/remision-guides/${id}/status`,
    payload
  )
  return data
}

export async function downloadRemisionGuideXml(
  tenantId: string,
  id: string,
  documentNumber: string
): Promise<void> {
  const response = await api.get(
    `/api/v1/tenants/${tenantId}/billing/remision-guides/${id}/xml`,
    { responseType: 'blob' }
  )

  const url = window.URL.createObjectURL(new Blob([response.data as BlobPart], { type: 'application/xml' }))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `GuiaRemision_${documentNumber}.xml`)
  document.body.appendChild(link)
  link.click()
  link.parentNode?.removeChild(link)
  window.URL.revokeObjectURL(url)
}

import { api } from '@/lib/apiClient'
import type {
  BatchDetailDto,
  BatchListItemDto,
  BatchPreviewResponse,
  CancelBatchResponse,
  ConfirmPhotoUploadBody,
  CreateCustomerBody,
  CreateRepairDispatchBody,
  ImportBatchResponseDto,
  PresignedUploadResponse,
  PublicDispatchVerificationDto,
  RepairCustomerDto,
  RepairDispatchDto,
  RepairEquipmentDto,
  RepairEquipmentPhotoDto,
  UpdateEquipmentStatusBody,
} from '@/types/repairsApi'

export async function listRepairBatches(
  tenantId: string,
  params?: { customerId?: string; status?: number }
): Promise<BatchListItemDto[]> {
  const { data } = await api.get<BatchListItemDto[]>(
    `/api/v1/tenants/${tenantId}/repairs/batches`,
    { params }
  )
  return data
}

export async function getRepairBatch(
  tenantId: string,
  batchId: string
): Promise<BatchDetailDto> {
  const { data } = await api.get<BatchDetailDto>(
    `/api/v1/tenants/${tenantId}/repairs/batches/${batchId}`
  )
  return data
}

export async function listBatchEquipments(
  tenantId: string,
  batchId: string,
  status?: number
): Promise<RepairEquipmentDto[]> {
  const { data } = await api.get<RepairEquipmentDto[]>(
    `/api/v1/tenants/${tenantId}/repairs/batches/${batchId}/equipments`,
    { params: status !== undefined ? { status } : undefined }
  )
  return data
}

export async function importRepairBatch(
  tenantId: string,
  formData: FormData
): Promise<ImportBatchResponseDto> {
  const { data } = await api.post<ImportBatchResponseDto>(
    `/api/v1/tenants/${tenantId}/repairs/batches/import`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return data
}

export async function previewRepairBatch(
  tenantId: string,
  formData: FormData
): Promise<BatchPreviewResponse> {
  const { data } = await api.post<BatchPreviewResponse>(
    `/api/v1/tenants/${tenantId}/repairs/batches/preview`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return data
}

export async function cancelRepairBatch(
  tenantId: string,
  batchId: string,
  reason: string
): Promise<CancelBatchResponse> {
  const { data } = await api.post<CancelBatchResponse>(
    `/api/v1/tenants/${tenantId}/repairs/batches/${batchId}/cancel`,
    { reason }
  )
  return data
}

export async function downloadRepairTemplate(
  tenantId: string,
  templateId?: string
): Promise<Blob> {
  const url = templateId
    ? `/api/v1/tenants/${tenantId}/repairs/templates/${templateId}/download-excel`
    : `/api/v1/tenants/${tenantId}/repairs/templates/download-default-excel`

  const response = await api.get(url, {
    responseType: 'blob',
  })
  return response.data as Blob
}

export async function listRepairCustomers(
  tenantId: string
): Promise<RepairCustomerDto[]> {
  const { data } = await api.get<RepairCustomerDto[]>(
    `/api/v1/tenants/${tenantId}/repairs/customers`
  )
  return data
}

export async function createRepairCustomer(
  tenantId: string,
  body: CreateCustomerBody
): Promise<RepairCustomerDto> {
  const { data } = await api.post<RepairCustomerDto>(
    `/api/v1/tenants/${tenantId}/repairs/customers`,
    body
  )
  return data
}

export async function updateEquipmentStatus(
  tenantId: string,
  equipmentId: string,
  body: UpdateEquipmentStatusBody
): Promise<{ equipmentId: string; newStatus: number; previousStatus: number; updatedAt: string }> {
  const { data } = await api.patch(
    `/api/v1/tenants/${tenantId}/repairs/equipments/${equipmentId}/status`,
    body
  )
  return data
}

export async function getPhotoUploadUrl(
  tenantId: string,
  equipmentId: string,
  stage: string,
  fileName: string,
  contentType?: string
): Promise<PresignedUploadResponse> {
  const { data } = await api.post<PresignedUploadResponse>(
    `/api/v1/tenants/${tenantId}/repairs/equipments/${equipmentId}/photos/presigned-upload`,
    { stage, fileName, contentType }
  )
  return data
}

export async function confirmPhotoUpload(
  tenantId: string,
  equipmentId: string,
  body: ConfirmPhotoUploadBody
): Promise<RepairEquipmentPhotoDto> {
  const { data } = await api.post<RepairEquipmentPhotoDto>(
    `/api/v1/tenants/${tenantId}/repairs/equipments/${equipmentId}/photos/confirm`,
    body
  )
  return data
}

export async function listEquipmentPhotos(
  tenantId: string,
  equipmentId: string
): Promise<RepairEquipmentPhotoDto[]> {
  const { data } = await api.get<RepairEquipmentPhotoDto[]>(
    `/api/v1/tenants/${tenantId}/repairs/equipments/${equipmentId}/photos`
  )
  return data
}

export async function createRepairDispatch(
  tenantId: string,
  body: CreateRepairDispatchBody
): Promise<{
  dispatchId: string
  dispatchNumber: string
  verificationHash: string
  dispatchedCount: number
  dispatchedAt: string
}> {
  const { data } = await api.post(
    `/api/v1/tenants/${tenantId}/repairs/dispatches`,
    body
  )
  return data
}

export async function listRepairDispatches(
  tenantId: string
): Promise<RepairDispatchDto[]> {
  const { data } = await api.get<RepairDispatchDto[]>(
    `/api/v1/tenants/${tenantId}/repairs/dispatches`
  )
  return data
}

export async function getRepairDispatch(
  tenantId: string,
  dispatchId: string
): Promise<RepairDispatchDto> {
  const { data } = await api.get<RepairDispatchDto>(
    `/api/v1/tenants/${tenantId}/repairs/dispatches/${dispatchId}`
  )
  return data
}

export async function verifyDispatchPublic(
  verificationHash: string
): Promise<PublicDispatchVerificationDto> {
  const { data } = await api.get<PublicDispatchVerificationDto>(
    `/api/v1/public/repairs/verify-dispatch/${verificationHash}`
  )
  return data
}

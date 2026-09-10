export const DamageLevel = {
  Level1: 1,
  Level2: 2,
  Level3: 3,
  Irreparable: 4,
} as const

export type DamageLevel = (typeof DamageLevel)[keyof typeof DamageLevel]

export const RepairBatchStatus = {
  Received: 0,
  InProgress: 1,
  PartiallyDispatched: 2,
  Completed: 3,
  Closed: 4,
  Cancelled: 5,
} as const

export type RepairBatchStatus = (typeof RepairBatchStatus)[keyof typeof RepairBatchStatus]

export const RepairEquipmentStatus = {
  Received: 0,
  Diagnosing: 1,
  InRepair: 2,
  QualityCheck: 3,
  ReadyToDispatch: 4,
  Dispatched: 5,
  Invoiced: 6,
  Irreparable: 7,
  Cancelled: 8,
} as const

export type RepairEquipmentStatus = (typeof RepairEquipmentStatus)[keyof typeof RepairEquipmentStatus]

export const PhotoStage = {
  DamageInitial: 1,
  InRepair: 2,
  QualityFinal: 3,
} as const

export type PhotoStage = (typeof PhotoStage)[keyof typeof PhotoStage]

export const RepairDispatchStatus = {
  Draft: 0,
  Confirmed: 1,
  Invoiced: 2,
} as const

export type RepairDispatchStatus = (typeof RepairDispatchStatus)[keyof typeof RepairDispatchStatus]

export type RepairCustomerDto = {
  id: string
  name: string
  taxId: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  contactPerson: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
}

export type CustomerDto = RepairCustomerDto

export type CreateCustomerBody = {
  name: string
  taxId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  contactPerson?: string | null
  notes?: string | null
}

export type UpdateCustomerBody = {
  name: string
  taxId?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  contactPerson?: string | null
  notes?: string | null
  isActive?: boolean
}

export type BatchListItemDto = {
  id: string
  batchNumber: string
  customerId: string
  customerName: string
  status: RepairBatchStatus
  totalCount: number
  receivedCount: number
  inRepairCount: number
  readyCount: number
  dispatchedCount: number
  progressPercentage: number
  receivedAt: string
  expectedCompletionAt: string | null
}

export type BatchDetailDto = {
  id: string
  batchNumber: string
  customerId: string
  customerName: string
  customerTaxId: string | null
  status: RepairBatchStatus
  agreedRateN1: number | null
  agreedRateN2: number | null
  agreedRateN3: number | null
  contractReference: string | null
  totalCount: number
  receivedCount: number
  inRepairCount: number
  readyCount: number
  dispatchedCount: number
  progressPercentage: number
  receivedAt: string
  expectedCompletionAt: string | null
  cancelledReason?: string | null
  cancelledAt?: string | null
}

export type RepairEquipmentPhotoDto = {
  id: string
  equipmentId: string
  stage: PhotoStage
  fileName: string
  caption: string | null
  capturedAt: string
  downloadUrl: string
}

export type RepairEquipmentEventDto = {
  id: string
  equipmentId: string
  eventType: string
  fromStatus: RepairEquipmentStatus | null
  toStatus: RepairEquipmentStatus | null
  notes: string | null
  createdAt: string
  createdBy: string | null
}

export type RepairEquipmentDto = {
  id: string
  tenantId: string
  batchId: string
  assignedTechnicianId: string | null
  serialNumber: string
  model: string
  brand: string
  productLine: string | null
  damageLevel: DamageLevel
  status: RepairEquipmentStatus
  diagnosticNotes: string | null
  repairNotes: string | null
  qualityCheckNotes: string | null
  passedQualityCheck: boolean | null
  diagnosedAt: string | null
  repairedAt: string | null
  qualityCheckedAt: string | null
  serviceFeeApplied: number | null
  customAttributesJson: string
  photos?: RepairEquipmentPhotoDto[]
  events?: RepairEquipmentEventDto[]
}

export type UpdateEquipmentStatusBody = {
  targetStatus: RepairEquipmentStatus
  technicianId?: string | null
  notes?: string | null
  confirmedDamageLevel?: DamageLevel | null
  serviceFee?: number | null
}

export type PresignedUploadResponse = {
  uploadUrl: string
  s3Bucket: string
  s3Key: string
  expiresInMinutes: number
}

export type ConfirmPhotoUploadBody = {
  stage: PhotoStage
  s3Bucket: string
  s3Key: string
  fileName: string
  fileSizeBytes: number
  contentType?: string | null
  caption?: string | null
}

export type RepairDispatchItemDto = {
  id: string
  dispatchId: string
  equipmentId: string
  equipment?: RepairEquipmentDto
}

export type RepairDispatchDto = {
  id: string
  tenantId: string
  batchId: string
  dispatchNumber: string
  status: RepairDispatchStatus
  carrierName: string | null
  carrierDocument: string | null
  carrierVehiclePlate: string | null
  verificationHash: string
  qrCodeUrl: string | null
  notes: string | null
  invoiceId: string | null
  dispatchedAt: string | null
  createdAt: string
  items: RepairDispatchItemDto[]
}

export type CreateRepairDispatchBody = {
  batchId: string
  dispatchNumber: string
  equipmentIds: string[]
  carrierName?: string | null
  carrierDocument?: string | null
  carrierVehiclePlate?: string | null
  notes?: string | null
}

export type PublicDispatchEquipmentItemDto = {
  serialNumber: string
  model: string
  brand: string
  damageLevel: string
}

export type PublicDispatchVerificationDto = {
  dispatchNumber: string
  customerName: string
  status: string
  carrierName: string | null
  carrierVehiclePlate: string | null
  dispatchedAt: string | null
  totalEquipments: number
  equipments: PublicDispatchEquipmentItemDto[]
}

export type ImportBatchResponseDto = {
  batchId: string
  batchNumber: string
  totalImported: number
  level1Count: number
  level2Count: number
  level3Count: number
  importedAt: string
}

/* Helper labels and badge tones */

export function damageLevelLabel(level: DamageLevel): string {
  switch (level) {
    case DamageLevel.Level1:
      return 'Nivel 1 (Leve / Estético)'
    case DamageLevel.Level2:
      return 'Nivel 2 (Medio / Chapa)'
    case DamageLevel.Level3:
      return 'Nivel 3 (Grave / Estructural)'
    case DamageLevel.Irreparable:
      return 'Irreparable (Scrap)'
    default:
      return `Nivel ${level}`
  }
}

export function damageLevelBadgeTone(level: DamageLevel): 'info' | 'warning' | 'danger' | 'neutral' {
  switch (level) {
    case DamageLevel.Level1:
      return 'info'
    case DamageLevel.Level2:
      return 'warning'
    case DamageLevel.Level3:
      return 'danger'
    case DamageLevel.Irreparable:
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function repairBatchStatusLabel(status: RepairBatchStatus): string {
  switch (status) {
    case RepairBatchStatus.Received:
      return 'Recibido'
    case RepairBatchStatus.InProgress:
      return 'En Proceso'
    case RepairBatchStatus.PartiallyDispatched:
      return 'Despacho Parcial'
    case RepairBatchStatus.Completed:
      return 'Completado'
    case RepairBatchStatus.Closed:
      return 'Cerrado'
    case RepairBatchStatus.Cancelled:
      return 'Anulado'
    default:
      return `Estado ${status}`
  }
}

export function repairBatchStatusBadgeTone(status: RepairBatchStatus): 'info' | 'warning' | 'success' | 'neutral' | 'danger' {
  switch (status) {
    case RepairBatchStatus.Received:
      return 'info'
    case RepairBatchStatus.InProgress:
      return 'warning'
    case RepairBatchStatus.PartiallyDispatched:
      return 'warning'
    case RepairBatchStatus.Completed:
      return 'success'
    case RepairBatchStatus.Closed:
      return 'neutral'
    case RepairBatchStatus.Cancelled:
      return 'danger'
    default:
      return 'neutral'
  }
}

export function repairEquipmentStatusLabel(status: RepairEquipmentStatus): string {
  switch (status) {
    case RepairEquipmentStatus.Received:
      return 'Recibido'
    case RepairEquipmentStatus.Diagnosing:
      return 'En Diagnóstico'
    case RepairEquipmentStatus.InRepair:
      return 'En Reparación'
    case RepairEquipmentStatus.QualityCheck:
      return 'Control de Calidad'
    case RepairEquipmentStatus.ReadyToDispatch:
      return 'Listo para Retiro'
    case RepairEquipmentStatus.Dispatched:
      return 'Despachado'
    case RepairEquipmentStatus.Invoiced:
      return 'Facturado'
    case RepairEquipmentStatus.Irreparable:
      return 'Irreparable'
    case RepairEquipmentStatus.Cancelled:
      return 'Sin Procesar (Lote Anulado)'
    default:
      return `Estado ${status}`
  }
}

export function repairEquipmentStatusBadgeTone(
  status: RepairEquipmentStatus
): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
  switch (status) {
    case RepairEquipmentStatus.Received:
      return 'neutral'
    case RepairEquipmentStatus.Diagnosing:
      return 'warning'
    case RepairEquipmentStatus.InRepair:
      return 'warning'
    case RepairEquipmentStatus.QualityCheck:
      return 'info'
    case RepairEquipmentStatus.ReadyToDispatch:
      return 'success'
    case RepairEquipmentStatus.Dispatched:
      return 'success'
    case RepairEquipmentStatus.Invoiced:
      return 'neutral'
    case RepairEquipmentStatus.Irreparable:
      return 'danger'
    case RepairEquipmentStatus.Cancelled:
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function photoStageLabel(stage: PhotoStage): string {
  switch (stage) {
    case PhotoStage.DamageInitial:
      return 'Ingreso / Daño Inicial'
    case PhotoStage.InRepair:
      return 'En Reparación / Proceso'
    case PhotoStage.QualityFinal:
      return 'Control de Calidad Final'
    default:
      return `Fase ${stage}`
  }
}

export type BatchPreviewItemDto = {
  rowNumber: number
  serialNumber: string
  brand: string
  model: string
  productLine: string | null
  damageLevel: number
  damageLevelName: string
}

export type BatchPreviewResponse = {
  isValid: boolean
  totalRows: number
  errors: string[]
  warnings: string[]
  level1Count: number
  level2Count: number
  level3Count: number
  items: BatchPreviewItemDto[]
}

export type CancelBatchResponse = {
  batchId: string
  status: number
  statusName: string
  cancelledAt: string
  reason: string
}


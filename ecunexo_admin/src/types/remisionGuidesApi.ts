export const RemisionGuideStatus = {
  Draft: 1,
  Issued: 2,
  Authorized: 3,
  InTransit: 4,
  Delivered: 5,
  Cancelled: 6,
} as const

export type RemisionGuideStatus = typeof RemisionGuideStatus[keyof typeof RemisionGuideStatus]

export type RemisionGuideSummaryDto = {
  readonly id: string
  readonly documentNumber: string
  readonly accessKey: string
  readonly issueDate: string
  readonly status: RemisionGuideStatus
  readonly carrierName: string
  readonly licensePlate: string
  readonly recipientName: string
  readonly routeDescription: string
  readonly startDate: string
  readonly endDate: string
  readonly itemsCount: number
  readonly authorizationNumber?: string | null
  readonly authorizationDate?: string | null
}

export type ListRemisionGuidesResponse = {
  readonly guides: readonly RemisionGuideSummaryDto[]
  readonly totalCount: number
  readonly authorizedCount: number
  readonly inTransitCount: number
  readonly deliveredCount: number
  readonly draftCount: number
}

export type RemisionGuideItemDetailDto = {
  readonly id: string
  readonly itemCode: string
  readonly description: string
  readonly quantity: number
  readonly unitOfMeasure?: string | null
  readonly internalReference?: string | null
}

export type RemisionGuideDetailDto = {
  readonly id: string
  readonly tenantId: string
  readonly establishment: string
  readonly emissionPoint: string
  readonly sequential: string
  readonly documentNumber: string
  readonly accessKey: string
  readonly issueDate: string
  readonly status: RemisionGuideStatus
  readonly authorizationNumber?: string | null
  readonly authorizationDate?: string | null
  readonly sriMessages?: string | null
  readonly xmlContent?: string | null
  readonly carrierIdentificationType: string
  readonly carrierIdentification: string
  readonly carrierName: string
  readonly carrierEmail?: string | null
  readonly carrierPhone?: string | null
  readonly licensePlate: string
  readonly startingAddress: string
  readonly startDate: string
  readonly endDate: string
  readonly recipientIdentificationType: string
  readonly recipientIdentification: string
  readonly recipientName: string
  readonly recipientAddress: string
  readonly transferReason: string
  readonly routeDescription: string
  readonly supportDocumentType?: string | null
  readonly supportDocumentNumber?: string | null
  readonly supportDocumentAuth?: string | null
  readonly customsDocumentNumber?: string | null
  readonly items: readonly RemisionGuideItemDetailDto[]
  readonly createdAt: string
}

export type CreateRemisionGuideItemPayload = {
  readonly itemCode: string
  readonly description: string
  readonly quantity: number
  readonly unitOfMeasure?: string | null
  readonly internalReference?: string | null
}

export type CreateRemisionGuidePayload = {
  readonly establishment: string
  readonly emissionPoint: string
  readonly sequential?: string | null
  readonly issueDate: string
  readonly startingAddress: string
  readonly startDate: string
  readonly endDate: string
  readonly carrierIdentificationType: string
  readonly carrierIdentification: string
  readonly carrierName: string
  readonly licensePlate: string
  readonly recipientIdentificationType: string
  readonly recipientIdentification: string
  readonly recipientName: string
  readonly recipientAddress: string
  readonly transferReason: string
  readonly routeDescription: string
  readonly carrierEmail?: string | null
  readonly carrierPhone?: string | null
  readonly supportDocumentType?: string | null
  readonly supportDocumentNumber?: string | null
  readonly supportDocumentAuth?: string | null
  readonly customsDocumentNumber?: string | null
  readonly items?: readonly CreateRemisionGuideItemPayload[] | null
  readonly emitSri?: boolean
}

export type CreateRemisionGuideResponse = {
  readonly guideId: string
  readonly documentNumber: string
  readonly accessKey: string
  readonly status: RemisionGuideStatus
  readonly authorizationNumber?: string | null
  readonly xmlContent?: string | null
}

export type UpdateRemisionGuideStatusPayload = {
  readonly newStatus: RemisionGuideStatus
  readonly reason?: string | null
}

export type RemisionGuideFilterParams = {
  readonly status?: RemisionGuideStatus
  readonly from?: string
  readonly to?: string
  readonly search?: string
}

export type CreateEmitterBody = {
  readonly ruc: string
  readonly businessName: string
  readonly mainAddress: string
  readonly tradeName?: string | null
}

export type CreateEmitterResponse = {
  readonly emitterId: string
  readonly ruc: string
}

export type SequentialNextResponse = {
  readonly nextSequential: string
  readonly establishment: string
  readonly emissionPoint: string
}

export type SetSequentialNextBody = {
  readonly nextSequential: string
  readonly establishment?: string | null
  readonly emissionPoint?: string | null
  readonly address?: string | null
}

export type CreateInvoiceLineTaxBody = {
  readonly taxCode: string
  readonly rateCode: string
  readonly rate: number
  readonly taxableBase: number
  readonly value: number
}

export type CreateInvoiceLineBody = {
  readonly lineNumber: number
  readonly description: string
  readonly quantity: number
  readonly unitPrice: number
  readonly discount: number
  readonly lineTotalWithoutTax: number
  readonly taxes: readonly CreateInvoiceLineTaxBody[]
  readonly mainCode?: string | null
  readonly catalogItemId?: string | null
  readonly itemKind?: string | null
}

export type CreateInvoiceBody = {
  readonly emitterRuc: string
  readonly establishment: string
  readonly emissionPoint: string
  readonly sequential: string
  readonly issueDate: string
  readonly counterparty: {
    readonly identificationType: string
    readonly identification: string
    readonly businessName: string
    readonly address?: string | null
    readonly email?: string | null
    readonly phone?: string | null
  }
  readonly paymentFormCode?: string | null
  readonly additionalNote?: string | null
  readonly paymentTermDays?: number
  readonly lines: readonly CreateInvoiceLineBody[]
}

export type CreateCreditNoteBody = {
  readonly motivo: string
  readonly issueDate?: string | null
}

export type CreateCreditNoteResponse = {
  readonly creditNoteId: string
  readonly invoiceId: string
  readonly state: string
  readonly sequential: string
  readonly grandTotal: number
  readonly accessKey: string | null
  readonly sriTransmissionState: string | null
  readonly message: string
}

export type PreviewXmlResponse = {
  readonly invoiceId: string
  readonly accessKey: string
  readonly isValid: boolean
  readonly errors: readonly string[]
  readonly xml: string
}

export type SriMessageDto = {
  readonly identifier: string
  readonly text: string
  readonly detail: string | null
  readonly type: string
}

export type InvoiceActionResponse = {
  readonly invoiceId: string
  readonly state: string
  readonly accessKey: string | null
  readonly sriTransmissionState: string | null
  readonly message: string
  readonly messages?: readonly SriMessageDto[]
}

export type CreateInvoiceResponse = {
  readonly invoiceId: string
  readonly state: string
  readonly sequential: string
  readonly grandTotal: number
  readonly accessKey: string | null
  readonly sriTransmissionState: string | null
  readonly message: string
}

export type InvoiceListItem = {
  readonly invoiceId: string
  readonly issueDate: string
  readonly establishment: string
  readonly emissionPoint: string
  readonly sequential: string
  readonly accessKey: string | null
  readonly counterpartyName: string
  readonly counterpartyIdentification: string
  readonly grandTotal: number
  readonly state: string
  readonly sriTransmissionState: string | null
  readonly createdAt: string
  /** Solo true en la factura pendiente con menor secuencial (estab+pto+tipo). */
  readonly canResend?: boolean
  readonly documentType?: string
  readonly canVoid?: boolean
  readonly isVoided?: boolean
  readonly modifiedInvoiceId?: string | null
  readonly counterpartyIdentificationType?: string
  readonly voidPath?: string | null
  readonly voidDeadline?: string | null
  readonly voidMessage?: string | null
}

export type InvoiceListResponse = {
  readonly items: readonly InvoiceListItem[]
  readonly totalCount: number
  readonly page: number
  readonly pageSize: number
}

export type InvoiceStateResponse = {
  readonly invoiceId: string
  readonly state: string
  readonly accessKey: string | null
  readonly sriTransmissionState: string | null
  readonly messages: readonly SriMessageDto[]
}

export type InvoiceDetailLineTax = {
  readonly taxCode: string
  readonly rateCode: string
  readonly rate: number
  readonly taxableBase: number
  readonly value: number
}

export type InvoiceDetailLine = {
  readonly lineNumber: number
  readonly description: string
  readonly quantity: number
  readonly unitPrice: number
  readonly discount: number
  readonly lineTotalWithoutTax: number
  readonly taxes: readonly InvoiceDetailLineTax[]
  readonly mainCode?: string | null
}

export type InvoiceDetail = {
  readonly invoiceId: string
  readonly issueDate: string
  readonly establishment: string
  readonly emissionPoint: string
  readonly sequential: string
  readonly accessKey: string | null
  readonly state: string
  readonly sriTransmissionState: string | null
  readonly subtotalWithoutTax: number
  readonly grandTotal: number
  readonly emitter: {
    readonly ruc: string
    readonly businessName: string
    readonly tradeName: string | null
    readonly mainAddress: string
  }
  readonly counterparty: {
    readonly identificationType: string
    readonly identification: string
    readonly businessName: string
    readonly address: string | null
    readonly email: string | null
    readonly phone: string | null
  }
  readonly lines: readonly InvoiceDetailLine[]
  readonly taxTotals: readonly {
    readonly taxCode: string
    readonly rateCode: string
    readonly taxableBase: number
    readonly value: number
  }[]
  readonly hasSignedXml: boolean
  readonly hasUnsignedXml: boolean
  readonly paymentFormCode?: string
  readonly additionalNote?: string | null
  readonly paymentTermDays?: number
  readonly authorizationDate?: string | null
  readonly softwareProviderRuc?: string | null
  readonly softwareProviderName?: string | null
  readonly softwareFooterLine?: string | null
  readonly documentType?: string
  readonly motivo?: string | null
  readonly modifiedInvoiceId?: string | null
  readonly modifiedDocumentNumber?: string | null
  readonly modifiedIssueDate?: string | null
  readonly canVoid?: boolean
  readonly isVoided?: boolean
}

export type InvoiceXmlDownload = {
  readonly invoiceId: string
  readonly accessKey: string | null
  readonly source: string
  readonly xml: string
}

export type RideProviderSettings = {
  readonly ruc: string | null
  readonly legalName: string
  readonly footerLine: string
  readonly usesEmitterFallback: boolean
}

export type UpdateRideProviderBody = {
  readonly ruc: string | null
  readonly legalName: string
  readonly footerLine: string
}

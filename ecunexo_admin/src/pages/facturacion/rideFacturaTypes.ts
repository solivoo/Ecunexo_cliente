import type { InvoiceDetail } from '@/types/billingApi'

export type RideLegalExtras = {
  readonly accountingRequired: boolean
  readonly isRimpe: boolean
  readonly logoUrl: string | null
  readonly companyName: string | null
  readonly taxId: string | null
  readonly contactEmail: string | null
  readonly contactPhone: string | null
  readonly rideThankYouText: string | null
  readonly matrizAddress: string | null
  readonly primaryColorHex: string | null
}

export type RideFacturaDocumentProps = {
  readonly invoice: InvoiceDetail
  readonly legal?: RideLegalExtras | null
  readonly barcodeDataUrl?: string | null
  readonly authorizationDateTime?: string | null
}

export type RideTotals = {
  readonly discountTotal: number
  readonly subtotal15: number
  readonly subtotal5: number
  readonly subtotal0: number
  readonly subtotalNoObjeto: number
  readonly iva15: number
  readonly iva5: number
}

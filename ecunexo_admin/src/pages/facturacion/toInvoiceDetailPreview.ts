import {
  computeTotals,
  type InvoiceCounterpartyValues,
  type InvoiceHeaderValues,
  type InvoiceLineDraft,
} from '@/pages/facturacion/invoiceFormTypes'
import type { CompanyDefaults } from '@/pages/facturacion/invoiceEmitApi'
import { ivaRateCode, toCreateInvoiceBody } from '@/pages/facturacion/toCreateInvoiceBody'
import type { InvoiceDetail } from '@/types/billingApi'

export function toInvoiceDetailPreview(args: {
  readonly header: InvoiceHeaderValues
  readonly counterparty: InvoiceCounterpartyValues
  readonly lines: readonly InvoiceLineDraft[]
  readonly company: CompanyDefaults | null
  readonly companyLabel: string
}): InvoiceDetail {
  const body = toCreateInvoiceBody(args.header, args.counterparty, args.lines)
  const totals = computeTotals(args.lines)
  const peeked = args.header.sequential.trim()
  const sequential =
    peeked && peeked !== '—' ? peeked.replace(/\D/g, '').padStart(9, '0').slice(-9) : '000000000'

  return {
    invoiceId: 'preview',
    issueDate: body.issueDate,
    establishment: body.establishment,
    emissionPoint: body.emissionPoint,
    sequential,
    accessKey: null,
    state: 'Draft',
    sriTransmissionState: null,
    subtotalWithoutTax: totals.subtotal,
    grandTotal: totals.grandTotal,
    emitter: {
      ruc: body.emitterRuc,
      businessName: args.company?.legalName.trim() || args.companyLabel,
      tradeName: args.company?.tradeName ?? null,
      mainAddress: args.company?.address ?? '',
    },
    counterparty: {
      identificationType: body.counterparty.identificationType,
      identification: body.counterparty.identification,
      businessName: body.counterparty.businessName,
      address: body.counterparty.address ?? null,
      email: body.counterparty.email ?? null,
      phone: body.counterparty.phone ?? null,
    },
    lines: body.lines.map((line) => ({
      lineNumber: line.lineNumber,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      lineTotalWithoutTax: line.lineTotalWithoutTax,
      taxes: line.taxes,
      mainCode: line.mainCode,
    })),
    taxTotals: totals.ivaBuckets.map((bucket) => ({
      taxCode: '2',
      rateCode: ivaRateCode(bucket.rate),
      taxableBase: bucket.taxableBase,
      value: bucket.iva,
    })),
    hasSignedXml: false,
    hasUnsignedXml: false,
    paymentFormCode: body.paymentFormCode ?? '01',
    additionalNote: body.additionalNote,
    paymentTermDays: body.paymentTermDays ?? 0,
    documentType: '01',
  }
}

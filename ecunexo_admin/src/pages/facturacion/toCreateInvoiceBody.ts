import {
  computeLine,
  normalizeCounterpartyForEmit,
  normalizeEstablishmentCode,
  normalizeLineIvaRate,
  type InvoiceCounterpartyValues,
  type InvoiceHeaderValues,
  type InvoiceLineDraft,
} from '@/pages/facturacion/invoiceFormTypes'
import type { CreateInvoiceBody } from '@/types/billingApi'

/** Código porcentaje SRI para IVA. */
export function ivaRateCode(rate: number): string {
  if (rate === 0) return '0'
  if (rate === 5) return '5'
  if (rate === 15) return '4'
  return String(Math.trunc(rate))
}

export function toCreateInvoiceBody(
  header: InvoiceHeaderValues,
  counterparty: InvoiceCounterpartyValues,
  lines: readonly InvoiceLineDraft[]
): CreateInvoiceBody {
  const buyer = normalizeCounterpartyForEmit(counterparty)
  const mappedLines = lines
    .filter((l) => l.description.trim().length > 0 || l.productId)
    .map((line, index) => {
      const computed = computeLine(line)
      const rate = normalizeLineIvaRate(line.ivaRate)
      return {
        lineNumber: index + 1,
        description: line.description.trim() || line.sku || `Línea ${index + 1}`,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        lineTotalWithoutTax: computed.lineNet,
        mainCode: line.sku.trim().slice(0, 25) || null,
        catalogItemId: line.catalogItemId,
        itemKind: line.itemKind,
        taxes: [
          {
            taxCode: '2',
            rateCode: ivaRateCode(rate),
            rate,
            taxableBase: computed.lineNet,
            value: computed.lineIva,
          },
        ],
      }
    })

  return {
    emitterRuc: header.emitterRuc.trim(),
    establishment: normalizeEstablishmentCode(header.establishment),
    emissionPoint: header.emissionPoint.trim().padStart(3, '0').slice(-3),
    // El secuencial lo asigna siempre Billing desde BD (candado). La UI solo lo muestra.
    sequential: 'auto',
    issueDate: header.issueDate,
    counterparty: {
      identificationType: buyer.identificationType,
      identification: buyer.identification.trim(),
      businessName: buyer.businessName.trim(),
      address: buyer.address.trim() || null,
      email: buyer.email.trim() || null,
      phone: buyer.phone.trim() || null,
    },
    paymentFormCode: header.paymentFormCode || '01',
    additionalNote: header.additionalNote.trim() || null,
    paymentTermDays: Number.isFinite(header.paymentTermDays)
      ? Math.max(0, Math.trunc(header.paymentTermDays))
      : 0,
    lines: mappedLines,
  }
}

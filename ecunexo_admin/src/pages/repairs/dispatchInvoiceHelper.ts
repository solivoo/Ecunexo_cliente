import {
  DEFAULT_LINE_IVA_RATE,
  DEFAULT_PAYMENT_FORM_CODE,
  type InvoiceCounterpartyValues,
  type InvoiceHeaderValues,
  type InvoiceLineDraft,
} from '@/pages/facturacion/invoiceFormTypes'
import { loadIssuerDefaults, saveInvoiceDraft } from '@/pages/facturacion/invoiceEmitApi'
import { getDispatchInvoicePreview, linkDispatchInvoice } from '@/services/repairsApi'

export async function createAndLinkDispatchInvoice(
  tenantId: string,
  dispatchId: string
): Promise<{ invoiceId: string }> {
  const preview = await getDispatchInvoicePreview(tenantId, dispatchId)
  if (!preview.canInvoice) {
    throw new Error(preview.blockingReason ?? 'Este despacho no puede facturarse aún.')
  }

  const defaults = await loadIssuerDefaults(tenantId)
  const today = new Date().toISOString().slice(0, 10)
  const header: InvoiceHeaderValues = {
    emitterRuc: defaults.emitterRuc,
    establishment: defaults.establishment || '001',
    emissionPoint: '001',
    sequential: 'auto',
    issueDate: today,
    paymentFormCode: DEFAULT_PAYMENT_FORM_CODE,
    additionalNote: preview.additionalNote,
    paymentTermDays: 0,
  }

  const counterparty: InvoiceCounterpartyValues = {
    identificationType: preview.counterparty.identificationType || '04',
    identification: preview.counterparty.identification,
    businessName: preview.counterparty.businessName,
    address: preview.counterparty.address ?? '',
    email: preview.counterparty.email ?? '',
    phone: preview.counterparty.phone ?? '',
  }

  const lines: InvoiceLineDraft[] = preview.lines.map((line, index) => ({
    id: `dispatch-line-${index}`,
    productId: '',
    sku: line.mainCode ?? `REP-N${line.damageLevel}`,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: 0,
    ivaRate: DEFAULT_LINE_IVA_RATE,
    catalogItemId: line.catalogItemId ?? null,
    itemKind: 'service',
  }))

  const created = await saveInvoiceDraft({
    header,
    counterparty,
    lines,
    company: defaults.company,
    companyLabel: defaults.company.legalName,
    mode: 'draft',
    tenantId,
  })

  await linkDispatchInvoice(tenantId, dispatchId, created.invoiceId)
  return { invoiceId: created.invoiceId }
}

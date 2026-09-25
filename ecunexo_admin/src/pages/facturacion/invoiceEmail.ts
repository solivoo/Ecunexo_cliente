import { buildRidePdfFromDetail } from '@/pages/facturacion/invoiceDownloads'
import { getInvoiceDetail, getInvoiceXml } from '@/services/billingApi'
import { sendInvoiceAuthorizedEmail } from '@/services/settingsApi'
import { store } from '@/store'
import { selectTenantId } from '@/store/authSlice'
import type { InvoiceDetail } from '@/types/billingApi'

export type InvoiceEmailAttachmentPayload = {
  readonly fileName: string
  readonly contentType: string
  readonly contentBase64: string
}

export type InvoiceEmailSendResult = {
  readonly sent: boolean
  readonly to: string
  readonly attachments: readonly string[]
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el adjunto.'))
    reader.readAsDataURL(blob)
  })
}

function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function documentFileBase(detail: InvoiceDetail): string {
  const kind = detail.documentType === '04' ? 'nc' : 'factura'
  return `${kind}-${detail.establishment}-${detail.emissionPoint}-${detail.sequential}`
}

/**
 * Genera los adjuntos del correo al cliente reutilizando el RIDE del frontend
 * y el XML firmado/autorizado descargado de Billing.Api.
 */
export async function buildInvoiceEmailAttachments(
  emitterId: string,
  invoiceId: string,
  detail?: InvoiceDetail
): Promise<{ readonly detail: InvoiceDetail; readonly attachments: InvoiceEmailAttachmentPayload[] }> {
  const resolved = detail ?? (await getInvoiceDetail(emitterId, invoiceId))
  const [ride, xml] = await Promise.all([
    buildRidePdfFromDetail(resolved),
    getInvoiceXml(emitterId, invoiceId),
  ])
  const base = documentFileBase(resolved)
  const xmlSuffix = xml.source === 'signed' ? '' : `-${xml.source}`

  return {
    detail: resolved,
    attachments: [
      {
        fileName: ride.filename,
        contentType: 'application/pdf',
        contentBase64: await blobToBase64(ride.blob),
      },
      {
        fileName: `${base}${xmlSuffix}.xml`,
        contentType: 'application/xml',
        contentBase64: textToBase64(xml.xml),
      },
    ],
  }
}

/**
 * Envía al cliente la factura autorizada con RIDE PDF y XML adjuntos.
 * Requiere que el comprobante tenga correo registrado en la contraparte.
 */
export async function sendAuthorizedInvoiceEmail(args: {
  readonly emitterId: string
  readonly invoiceId: string
  readonly tenantId?: string | null
  readonly detail?: InvoiceDetail
}): Promise<InvoiceEmailSendResult> {
  const { detail, attachments } = await buildInvoiceEmailAttachments(
    args.emitterId,
    args.invoiceId,
    args.detail
  )

  const to = detail.counterparty.email?.trim() ?? ''
  if (!to) {
    throw new Error('El cliente no tiene correo registrado en la factura.')
  }

  const tenantId = args.tenantId?.trim() || selectTenantId(store.getState())
  if (!tenantId) {
    throw new Error('No hay empresa activa para enviar el correo.')
  }

  const response = await sendInvoiceAuthorizedEmail(tenantId, {
    billingInvoiceId: args.invoiceId,
    counterpartyEmail: to,
    counterpartyName: detail.counterparty.businessName?.trim() || 'Cliente',
    documentType: detail.documentType ?? '01',
    serieSecuencial: `${detail.establishment}-${detail.emissionPoint}-${detail.sequential}`,
    accessKey: detail.accessKey,
    grandTotal: detail.grandTotal,
    attachments,
  })

  return {
    sent: response.sent,
    to: response.to,
    attachments: response.attachments ?? attachments.map((a) => a.fileName),
  }
}

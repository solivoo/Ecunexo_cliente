import { pdf } from '@react-pdf/renderer'
import JsBarcode from 'jsbarcode'
import { createElement } from 'react'
import {
  RideFacturaDocument,
  type RideLegalExtras,
} from '@/pages/facturacion/RideFacturaDocument'
import { resolveTenantMark } from '@/features/organization/resolveTenantMark'
import { rasterizeRideLogo } from '@/pages/facturacion/rasterizeRideLogo'
import { getInvoiceDetail, getInvoiceXml } from '@/services/billingApi'
import { getTenant } from '@/services/tenantApi'
import { store } from '@/store'
import { selectTenantId } from '@/store/authSlice'
import type { InvoiceDetail } from '@/types/billingApi'

export type RidePdfResult = {
  readonly blob: Blob
  readonly filename: string
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function docFileBase(invoice: InvoiceDetail): string {
  const kind = invoice.documentType === '04' ? 'nc' : 'factura'
  return `${kind}-${invoice.establishment}-${invoice.emissionPoint}-${invoice.sequential}`
}

function buildAccessKeyBarcode(accessKey: string): string | null {
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, accessKey, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 48,
      width: 1.1,
      background: '#ffffff',
      lineColor: '#000000',
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

async function loadRideLegalExtras(): Promise<RideLegalExtras | null> {
  const tenantId = selectTenantId(store.getState())
  if (!tenantId) return null
  try {
    const tenant = await getTenant(tenantId)
    const mark = resolveTenantMark({
      name: tenant.name,
      preferWordmark: tenant.preferWordmark,
      logoLightUrl: tenant.logoLightUrl,
      logoDarkUrl: tenant.logoDarkUrl,
      logoUrl: tenant.logoUrl,
      theme: 'light',
    })
    const logoUrl = mark.kind === 'image' ? await rasterizeRideLogo(mark.src) : null
    return {
      accountingRequired: tenant.accountingRequired,
      isRimpe: tenant.isRimpe,
      logoUrl,
      companyName: tenant.name.trim() || null,
      taxId: tenant.taxId?.trim() || null,
      contactEmail: tenant.contactEmail ?? null,
      contactPhone: tenant.contactPhone ?? null,
      rideThankYouText: tenant.rideThankYouText ?? null,
      matrizAddress: tenant.address,
      primaryColorHex: tenant.primaryColorHex,
    }
  } catch {
    return null
  }
}

/** Genera el PDF RIDE desde un detalle ya resuelto (emisión o previsualización). */
export async function buildRidePdfFromDetail(detail: InvoiceDetail): Promise<RidePdfResult> {
  const legal = await loadRideLegalExtras()
  const barcodeDataUrl = detail.accessKey ? buildAccessKeyBarcode(detail.accessKey) : null
  const doc = createElement(RideFacturaDocument, {
    invoice: detail,
    legal,
    barcodeDataUrl,
    authorizationDateTime: detail.authorizationDate ?? null,
  })

  const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
  return { blob, filename: `${docFileBase(detail)}-ride.pdf` }
}

/** Genera el PDF RIDE sin descargarlo. */
export async function buildInvoiceRidePdf(
  emitterId: string,
  invoiceId: string
): Promise<RidePdfResult> {
  const detail = await getInvoiceDetail(emitterId, invoiceId)
  return buildRidePdfFromDetail(detail)
}

export async function downloadInvoiceXml(
  emitterId: string,
  invoiceId: string
): Promise<{ filename: string; source: string }> {
  const data = await getInvoiceXml(emitterId, invoiceId)
  const name = `factura-${invoiceId.slice(0, 8)}-${data.source}.xml`
  downloadBlob(new Blob([data.xml], { type: 'application/xml;charset=utf-8' }), name)
  return { filename: name, source: data.source }
}

export async function downloadInvoiceRide(
  emitterId: string,
  invoiceId: string
): Promise<RidePdfResult> {
  const result = await buildInvoiceRidePdf(emitterId, invoiceId)
  downloadBlob(result.blob, result.filename)
  return result
}

/** Abre el diálogo nativo de impresión del PDF. */
export async function printPdfBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Imprimir RIDE')
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
  iframe.src = url
  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Tiempo de espera al cargar el PDF para imprimir.'))
      }, 20_000)

      iframe.onload = () => {
        window.clearTimeout(timeout)
        try {
          const win = iframe.contentWindow
          if (!win) {
            reject(new Error('No se pudo abrir el PDF para imprimir.'))
            return
          }
          win.focus()
          win.print()
          resolve()
        } catch (err: unknown) {
          reject(err instanceof Error ? err : new Error('No se pudo imprimir el PDF.'))
        }
      }
      iframe.onerror = () => {
        window.clearTimeout(timeout)
        reject(new Error('No se pudo cargar el PDF para imprimir.'))
      }
    })
  } finally {
    window.setTimeout(() => {
      iframe.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
}

export async function printInvoiceRide(
  emitterId: string,
  invoiceId: string
): Promise<RidePdfResult> {
  const result = await buildInvoiceRidePdf(emitterId, invoiceId)
  await printPdfBlob(result.blob)
  return result
}

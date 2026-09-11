import { pdf } from '@react-pdf/renderer'
import JsBarcode from 'jsbarcode'
import { createElement } from 'react'
import {
  DispatchDeliveryNotePdf,
  type DispatchPdfCompanyInfo,
} from '@/pages/repairs/pdf/DispatchDeliveryNotePdf'
import { resolveTenantMark } from '@/features/organization/resolveTenantMark'
import { rasterizeRideLogo } from '@/pages/facturacion/rasterizeRideLogo'
import { getTenant } from '@/services/tenantApi'
import { getRepairBatch, getRepairDispatch } from '@/services/repairsApi'
import { store } from '@/store'
import type { BatchDetailDto, RepairDispatchDto } from '@/types/repairsApi'

export type DispatchPdfResult = {
  readonly blob: Blob
  readonly filename: string
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildBarcodeDataUrl(text: string): string | null {
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height: 38,
      width: 1.2,
      background: '#ffffff',
      lineColor: '#000000',
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export async function loadTenantPdfInfo(tenantId: string): Promise<DispatchPdfCompanyInfo | null> {
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
      name: tenant.name.trim() || 'CENTRO INTEGRAL DE REPARACIONES',
      taxId: tenant.taxId?.trim() || null,
      address: tenant.address?.trim() || null,
      contactEmail: tenant.contactEmail?.trim() || null,
      contactPhone: tenant.contactPhone?.trim() || null,
      logoUrl,
      primaryColorHex: tenant.primaryColorHex || '#059669',
    }
  } catch {
    return null
  }
}

export async function buildDispatchDeliveryNotePdf(
  tenantId: string,
  dispatch: RepairDispatchDto,
  batchOverride?: BatchDetailDto | null,
  issuerNameOverride?: string | null,
  issuerRoleOverride?: string | null
): Promise<DispatchPdfResult> {
  // Asegurar que el despacho contenga la lista completa de equipos con sus números de serie
  let resolvedDispatch = dispatch
  const hasIncompleteItems =
    !resolvedDispatch.items ||
    resolvedDispatch.items.length === 0 ||
    resolvedDispatch.items.some((i) => !i.equipment)

  if (hasIncompleteItems && tenantId && dispatch.id) {
    try {
      const full = await getRepairDispatch(tenantId, dispatch.id)
      if (full && full.items && full.items.length > 0) {
        resolvedDispatch = full
      }
    } catch {
      // Continuar con el objeto provisto si la recarga falla
    }
  }

  const [company, batch] = await Promise.all([
    loadTenantPdfInfo(tenantId),
    batchOverride ??
      (resolvedDispatch.batchId
        ? getRepairBatch(tenantId, resolvedDispatch.batchId).catch(() => null)
        : Promise.resolve(null)),
  ])

  // Obtener el usuario activo de la cuenta para certificar la salida
  const auth = store.getState().auth
  const issuerName =
    issuerNameOverride ??
    auth.userName ??
    auth.userEmail ??
    'Responsable de Control y Taller'
  const issuerRole =
    issuerRoleOverride ??
    (auth.isSubscriptionHolder
      ? 'Administrador Titular'
      : 'Supervisor de Taller y Despacho')

  const barcodeDataUrl = resolvedDispatch.dispatchNumber
    ? buildBarcodeDataUrl(resolvedDispatch.dispatchNumber)
    : null
  const qrVerificationUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verificar/despacho/${resolvedDispatch.verificationHash}`
      : `https://ecunexo.com/verificar/despacho/${resolvedDispatch.verificationHash}`

  const doc = createElement(DispatchDeliveryNotePdf, {
    dispatch: resolvedDispatch,
    company,
    batchNumber: batch?.batchNumber,
    customerName: batch?.customerName,
    contractReference: batch?.contractReference,
    barcodeDataUrl,
    qrVerificationUrl,
    issuerName,
    issuerRole,
  })

  const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
  const cleanNumber = (resolvedDispatch.dispatchNumber || resolvedDispatch.id).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  )
  const filename = `Acta-Despacho-${cleanNumber}.pdf`

  return { blob, filename }
}

export async function downloadDispatchDeliveryNotePdf(
  tenantId: string,
  dispatch: RepairDispatchDto,
  batchOverride?: BatchDetailDto | null,
  issuerNameOverride?: string | null,
  issuerRoleOverride?: string | null
): Promise<{ filename: string }> {
  const { blob, filename } = await buildDispatchDeliveryNotePdf(
    tenantId,
    dispatch,
    batchOverride,
    issuerNameOverride,
    issuerRoleOverride
  )
  downloadBlob(blob, filename)
  return { filename }
}

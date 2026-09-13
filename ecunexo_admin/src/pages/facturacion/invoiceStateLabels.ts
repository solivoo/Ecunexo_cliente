/** Etiquetas y variantes visuales de estados de factura / transmisión SRI. */

export type InvoiceStateTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const DOCUMENT_STATE_LABELS: Record<string, string> = {
  Draft: 'Borrador',
  Signed: 'Firmada',
  PendingReception: 'Pendiente envío',
  Received: 'Recibida',
  Returned: 'Devuelta',
  Processing: 'En proceso',
  Authorized: 'Autorizada',
  NotAuthorized: 'No autorizada',
}

const DOCUMENT_STATE_TONES: Record<string, InvoiceStateTone> = {
  Draft: 'neutral',
  Signed: 'info',
  PendingReception: 'info',
  Received: 'info',
  Returned: 'danger',
  Processing: 'warning',
  Authorized: 'success',
  NotAuthorized: 'danger',
}

const TRANSMISSION_LABELS: Record<string, string> = {
  Received: 'RECIBIDA',
  Returned: 'DEVUELTA',
  Authorized: 'AUTORIZADA',
  NotAuthorized: 'NO AUTORIZADA',
  Processing: 'EN PROCESO',
}

export function invoiceStateLabel(state: string | null | undefined): string {
  if (!state) return '—'
  return DOCUMENT_STATE_LABELS[state] ?? state
}

export function invoiceStateTone(state: string | null | undefined): InvoiceStateTone {
  if (!state) return 'neutral'
  return DOCUMENT_STATE_TONES[state] ?? 'neutral'
}

export function sriTransmissionLabel(state: string | null | undefined): string {
  if (!state) return '—'
  return TRANSMISSION_LABELS[state] ?? state
}

export function sriTransmissionTone(state: string | null | undefined): InvoiceStateTone {
  return invoiceStateTone(state)
}

export type SriEnvironmentTone = 'warning' | 'success' | 'neutral'

export type SriEnvironmentDetails = {
  readonly isTest: boolean
  readonly isProduction: boolean
  readonly label: string
  readonly shortLabel: string
  readonly tone: SriEnvironmentTone
  readonly tooltip: string
}

export function sriEnvironmentInfo(accessKey: string | null | undefined): SriEnvironmentDetails {
  if (!accessKey || accessKey.length < 24) {
    return {
      isTest: false,
      isProduction: false,
      label: 'Borrador',
      shortLabel: 'Borrador',
      tone: 'neutral',
      tooltip: 'Comprobante en borrador preliminar sin clave de acceso SRI.',
    }
  }
  const isProd = accessKey[23] === '2'
  if (isProd) {
    return {
      isTest: false,
      isProduction: true,
      label: 'Producción',
      shortLabel: 'PROD',
      tone: 'success',
      tooltip: 'Emitido en ambiente de producción SRI (cel.sri.gob.ec). Con plena validez tributaria.',
    }
  }
  return {
    isTest: true,
    isProduction: false,
    label: 'Pruebas (Sin validez)',
    shortLabel: 'PRUEBAS',
    tone: 'warning',
    tooltip: 'Emitido en ambiente de pruebas (celcer.sri.gob.ec). NO tiene validez tributaria ni fiscal.',
  }
}


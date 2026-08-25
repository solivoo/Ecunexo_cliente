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

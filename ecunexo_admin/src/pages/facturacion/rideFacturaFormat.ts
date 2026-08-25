import type { InvoiceDetail } from '@/types/billingApi'

const EMPTY_TOKENS = new Set(['none', 'null', 'undefined'])

const PAYMENT_FORM_RIDE_LABELS: Readonly<Record<string, string>> = {
  '01': 'Sin Utilización del Sistema Financiero',
  '15': 'Compensación de deudas',
  '16': 'Tarjeta de débito',
  '17': 'Dinero electrónico',
  '18': 'Tarjeta prepago',
  '19': 'Tarjeta de crédito',
  '20': 'Otros con Utilización del Sistema Financiero',
  '21': 'Endoso de títulos',
}

export function rideValue(value: string | null | undefined): string {
  return rideText(value) || '—'
}

/** Nunca pinta None/null/undefined en el RIDE. */
export function rideText(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ''
  if (trimmed.length === 0) return ''
  return EMPTY_TOKENS.has(trimmed.toLowerCase()) ? '' : trimmed
}

export function money(n: number): string {
  return n.toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function moneyUsd(n: number): string {
  return `$${money(n)}`
}

export function formatIssueDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function formatAuthDateTime(iso: string | null | undefined): string {
  const raw = rideText(iso)
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`
}

export function ambienteFromAccessKey(accessKey: string | null): string {
  if (!accessKey || accessKey.length < 24) return 'PRUEBAS'
  return accessKey[23] === '2' ? 'PRODUCCION' : 'PRUEBAS'
}

export function yesNo(value: boolean): string {
  return value ? 'SI' : 'NO'
}

export function paymentFormRideLabel(code: string | undefined): string {
  const normalized = (code ?? '01').trim()
  return PAYMENT_FORM_RIDE_LABELS[normalized] ?? normalized
}

export type RideAdditionalRow = {
  readonly label: string
  readonly value: string
}

export function rideAdditionalRows(invoice: InvoiceDetail): RideAdditionalRow[] {
  const rows: RideAdditionalRow[] = []
  const providerRuc = rideText(invoice.softwareProviderRuc)
  if (providerRuc) rows.push({ label: 'RUC Proveedor', value: providerRuc })
  const note = rideText(invoice.additionalNote)
  if (note) rows.push({ label: 'Descripción', value: note })
  const email = rideText(invoice.counterparty.email)
  if (email) rows.push({ label: 'Email', value: email })
  const phone = rideText(invoice.counterparty.phone)
  if (phone) rows.push({ label: 'Teléfono', value: phone })
  return rows
}

export function isHttpUrl(value: string | null | undefined): boolean {
  const raw = rideText(value)
  return /^https?:\/\//i.test(raw) || raw.startsWith('data:image/')
}

/** Nombre visible del emisor: tenant (fuente de verdad), luego comercial, luego razón social. */
export function rideIssuerName(
  companyName: string | null | undefined,
  tradeName: string | null | undefined,
  businessName: string | null | undefined
): string {
  return rideText(companyName) || rideText(tradeName) || rideText(businessName)
}

export function rideIssuerRuc(
  taxId: string | null | undefined,
  emitterRuc: string | null | undefined
): string {
  return rideText(taxId) || rideText(emitterRuc)
}

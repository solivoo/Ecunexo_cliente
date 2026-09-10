export type InvoiceHeaderValues = {
  readonly emitterRuc: string
  readonly establishment: string
  readonly emissionPoint: string
  readonly sequential: string
  readonly issueDate: string
  readonly paymentFormCode: string
  readonly additionalNote: string
  readonly paymentTermDays: number
}

export type InvoiceCounterpartyValues = {
  readonly identificationType: string
  readonly identification: string
  readonly businessName: string
  readonly address: string
  readonly email: string
  readonly phone: string
}

export type InvoiceLineItemKind = 'physical' | 'service'

export type InvoiceLineDraft = {
  readonly id: string
  readonly productId: string
  readonly sku: string
  readonly description: string
  readonly quantity: number
  readonly unitPrice: number
  readonly discount: number
  /** Porcentaje IVA de la línea (0 | 5 | 15). */
  readonly ivaRate: number
  /** Snapshot catálogo tenant (sin FK en Billing). */
  readonly catalogItemId: string | null
  readonly itemKind: InvoiceLineItemKind | null
}

export type InvoiceLineComputed = InvoiceLineDraft & {
  readonly lineNet: number
  readonly lineIva: number
}

export type InvoiceIvaBucket = {
  readonly rate: number
  readonly taxableBase: number
  readonly iva: number
}

export type InvoiceTotals = {
  readonly subtotal: number
  readonly discountTotal: number
  readonly ivaBuckets: readonly InvoiceIvaBucket[]
  readonly ivaTotal: number
  readonly grandTotal: number
}

export const DEFAULT_LINE_IVA_RATE = 15

export const ID_TYPE_OPTIONS = [
  { value: '04', label: 'RUC' },
  { value: '05', label: 'Cédula' },
  { value: '06', label: 'Pasaporte' },
  { value: '07', label: 'Consumidor final' },
  { value: '08', label: 'Identificación del exterior' },
] as const

/** Formas de pago SRI (tabla 24) — códigos habituales. */
export const PAYMENT_FORM_OPTIONS = [
  { value: '01', label: 'Efectivo / sin sistema financiero' },
  { value: '15', label: 'Compensación de deudas' },
  { value: '16', label: 'Tarjeta de débito' },
  { value: '17', label: 'Dinero electrónico' },
  { value: '18', label: 'Tarjeta prepago' },
  { value: '19', label: 'Tarjeta de crédito' },
  { value: '20', label: 'Otros (sistema financiero)' },
  { value: '21', label: 'Endoso de títulos' },
] as const

export const DEFAULT_PAYMENT_FORM_CODE = '01'

/** Tipo SRI 07 + identificación fija exigida para consumidor final. */
export const ID_TYPE_CONSUMIDOR_FINAL = '07'
export const CONSUMIDOR_FINAL_IDENTIFICATION = '9999999999999'
export const CONSUMIDOR_FINAL_BUSINESS_NAME = 'CONSUMIDOR FINAL'
/** Tope SRI: facturas a consumidor final no pueden superar USD 50 (importe total). */
export const CONSUMIDOR_FINAL_MAX_TOTAL_USD = 50

export function isConsumidorFinalType(type: string): boolean {
  return type === ID_TYPE_CONSUMIDOR_FINAL
}

/** Mapea identificación del directorio comercial → código SRI de comprador. */
export function customerIdentificationToSriType(identificationType: number): string {
  switch (identificationType) {
    case 1:
      return '04' // RUC
    case 2:
      return '05' // Cédula
    case 3:
      return '06' // Pasaporte
    case 4:
      return ID_TYPE_CONSUMIDOR_FINAL
    default:
      return '04'
  }
}

/** Al elegir/cambiar tipo de ID: rellena o limpia campos de consumidor final. */
export function applyCounterpartyIdType(
  prev: InvoiceCounterpartyValues,
  nextType: string
): InvoiceCounterpartyValues {
  if (isConsumidorFinalType(nextType)) {
    return {
      ...prev,
      identificationType: nextType,
      identification: CONSUMIDOR_FINAL_IDENTIFICATION,
      businessName: CONSUMIDOR_FINAL_BUSINESS_NAME,
    }
  }

  if (isConsumidorFinalType(prev.identificationType)) {
    return {
      ...prev,
      identificationType: nextType,
      identification: '',
      businessName: '',
    }
  }

  return { ...prev, identificationType: nextType }
}

/** Normaliza comprador antes de enviar (fuerza valores SRI si tipo 07). */
export function normalizeCounterpartyForEmit(
  counterparty: InvoiceCounterpartyValues
): InvoiceCounterpartyValues {
  if (!isConsumidorFinalType(counterparty.identificationType)) {
    return counterparty
  }
  return {
    ...counterparty,
    identification: CONSUMIDOR_FINAL_IDENTIFICATION,
    businessName: CONSUMIDOR_FINAL_BUSINESS_NAME,
  }
}

export const IVA_RATE_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '15', label: '15%' },
] as const

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizeLineIvaRate(rate: number): number {
  if (rate === 0 || rate === 5 || rate === 15) return rate
  return DEFAULT_LINE_IVA_RATE
}

export function computeLine(line: InvoiceLineDraft): InvoiceLineComputed {
  const gross = line.quantity * line.unitPrice
  const lineNet = roundMoney(Math.max(0, gross - line.discount))
  const rate = normalizeLineIvaRate(line.ivaRate)
  const lineIva = roundMoney(lineNet * (rate / 100))
  return { ...line, ivaRate: rate, lineNet, lineIva }
}

export function computeTotals(lines: readonly InvoiceLineDraft[]): InvoiceTotals {
  const computed = lines.map(computeLine)
  const subtotal = roundMoney(computed.reduce((s, l) => s + l.lineNet, 0))
  const discountTotal = roundMoney(lines.reduce((s, l) => s + l.discount, 0))

  const byRate = new Map<number, { taxableBase: number; iva: number }>()
  for (const line of computed) {
    const prev = byRate.get(line.ivaRate) ?? { taxableBase: 0, iva: 0 }
    byRate.set(line.ivaRate, {
      taxableBase: roundMoney(prev.taxableBase + line.lineNet),
      iva: roundMoney(prev.iva + line.lineIva),
    })
  }

  const ivaBuckets = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, bucket]) => ({
      rate,
      taxableBase: bucket.taxableBase,
      iva: bucket.iva,
    }))

  const ivaTotal = roundMoney(ivaBuckets.reduce((s, b) => s + b.iva, 0))

  return {
    subtotal,
    discountTotal,
    ivaBuckets,
    ivaTotal,
    grandTotal: roundMoney(subtotal + ivaTotal),
  }
}

export function formatMoney(value: number): string {
  return value.toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function validateCounterpartyForEmit(
  counterparty: InvoiceCounterpartyValues,
  grandTotal?: number
): string | null {
  const c = normalizeCounterpartyForEmit(counterparty)
  const id = c.identification.trim()
  const name = c.businessName.trim()

  if (!id || !name) {
    return 'Indicar identificación y razón social del cliente.'
  }

  if (isConsumidorFinalType(c.identificationType)) {
    if (
      grandTotal !== undefined &&
      roundMoney(grandTotal) > CONSUMIDOR_FINAL_MAX_TOTAL_USD
    ) {
      return `Consumidor final solo admite total ≤ USD ${CONSUMIDOR_FINAL_MAX_TOTAL_USD}. Total actual: ${formatMoney(grandTotal)}. Usa RUC o cédula del cliente.`
    }
    return null
  }

  if (c.identificationType === '04' && !/^\d{13}$/.test(id)) {
    return 'Para RUC la identificación debe tener exactamente 13 dígitos.'
  }

  if (c.identificationType === '05' && !/^\d{10}$/.test(id)) {
    return 'Para cédula la identificación debe tener exactamente 10 dígitos.'
  }

  const email = c.email.trim()
  if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'El correo del cliente no es válido.'
  }

  return null
}

export function createEmptyLine(id: string): InvoiceLineDraft {
  return {
    id,
    productId: '',
    sku: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    ivaRate: DEFAULT_LINE_IVA_RATE,
    catalogItemId: null,
    itemKind: null,
  }
}

/** Código SRI de establecimiento: exactamente 3 dígitos. Acepta valores legacy tipo 001-001. */
export function normalizeEstablishmentCode(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return '001'
  const firstSegment = trimmed.split(/[-/\s]/)[0] ?? trimmed
  const digits = firstSegment.replace(/\D/g, '')
  if (digits.length >= 3) return digits.slice(0, 3)
  if (digits.length > 0) return digits.padStart(3, '0')
  return '001'
}

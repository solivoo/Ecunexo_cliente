/** Punto de emisión SRI configurado en Facturación → Emisor (por tenant). */

const STORAGE_PREFIX = 'ecunexo.billing.emissionPoint.'

export function normalizeEmissionPoint(raw: string | null | undefined): string {
  const digits = (raw?.trim() ?? '').replace(/\D/g, '')
  if (digits.length >= 3) return digits.slice(-3)
  if (digits.length > 0) return digits.padStart(3, '0')
  return '001'
}

export function normalizeSequentialInput(raw: string | null | undefined): string {
  const digits = (raw?.trim() ?? '').replace(/\D/g, '')
  if (!digits) return '000000001'
  const n = Number.parseInt(digits, 10)
  if (!Number.isFinite(n) || n < 1) return '000000001'
  if (n > 999_999_999) return '999999999'
  return String(n).padStart(9, '0')
}

export function readBillingEmissionPoint(tenantId: string | null): string {
  if (!tenantId) return '001'
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tenantId)
    if (raw) return normalizeEmissionPoint(raw)
  } catch {
    // ignore
  }
  return '001'
}

export function storeBillingEmissionPoint(tenantId: string, emissionPoint: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + tenantId, normalizeEmissionPoint(emissionPoint))
  } catch {
    // ignore
  }
}

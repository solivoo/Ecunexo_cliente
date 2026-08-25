export type RimpeKindCode = 'none' | 'popular-business' | 'entrepreneur'
export type SalesDocumentKindCode = 'nota-venta' | 'factura-electronica'

export const COMPANY_RIMPE_KIND = [
  { value: 'none', label: 'No (régimen general)' },
  { value: 'popular-business', label: 'Negocio popular' },
  { value: 'entrepreneur', label: 'Emprendedor' },
] as const

export function parseRimpeKind(
  rimpeKind: string | null | undefined,
  isRimpe?: boolean
): RimpeKindCode {
  if (rimpeKind === 'popular-business' || rimpeKind === 'entrepreneur' || rimpeKind === 'none') {
    return rimpeKind
  }
  return isRimpe ? 'entrepreneur' : 'none'
}

export function resolveSalesDocumentKind(
  rimpeKind: RimpeKindCode,
  preferElectronicInvoice: boolean
): SalesDocumentKindCode {
  if (rimpeKind === 'popular-business' && !preferElectronicInvoice) {
    return 'nota-venta'
  }
  return 'factura-electronica'
}

export function salesDocumentLabel(kind: SalesDocumentKindCode): string {
  return kind === 'nota-venta' ? 'Nota de venta' : 'Factura electrónica'
}

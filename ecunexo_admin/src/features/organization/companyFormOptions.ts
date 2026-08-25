export const COMPANY_TIMEZONE_OPTIONS = [
  { value: 'America/Guayaquil', label: 'America/Guayaquil (Ecuador)' },
  { value: 'America/Bogota', label: 'America/Bogota' },
  { value: 'America/Lima', label: 'America/Lima' },
  { value: 'UTC', label: 'UTC' },
] as const

export const COMPANY_LOCALE_OPTIONS = [
  { value: 'es-EC', label: 'es-EC (Español Ecuador)' },
  { value: 'es-CO', label: 'es-CO (Español Colombia)' },
  { value: 'es-PE', label: 'es-PE (Español Perú)' },
  { value: 'en-US', label: 'en-US (English)' },
] as const

export const COMPANY_YES_NO = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
] as const

export type CompanyLegalValues = {
  readonly tradeName: string
  readonly legalName: string
  readonly taxId: string
  readonly city: string
  readonly establishmentCode: string
  readonly address: string
  readonly accountingRequired: string
  readonly rimpeKind: string
  readonly preferElectronicInvoice: boolean
  readonly isExporter: string
  readonly isLargeTaxpayer: boolean
  readonly isSpecialTaxpayer: boolean
  readonly isWithholdingAgent: boolean
}

export type CompanyRideValues = {
  readonly contactEmail: string
  readonly contactPhone: string
  readonly rideThankYouText: string
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function isAccentColorValid(color: string): boolean {
  return color.length === 0 || /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)
}

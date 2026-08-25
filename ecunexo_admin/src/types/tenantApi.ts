/** Contratos Tenancy v1 (camelCase). */

export type GetTenantByIdDto = {
  id: string
  name: string
  timeZoneId: string | null
  locale: string | null
  logoUrl: string | null
  primaryColorHex: string | null
  taxId: string | null
  legalName: string | null
  city: string | null
  establishmentCode: string | null
  address: string | null
  accountingRequired: boolean
  isRimpe: boolean
  rimpeKind?: string
  preferElectronicInvoice?: boolean
  salesDocumentKind?: string
  isExporter: boolean
  isLargeTaxpayer: boolean
  isSpecialTaxpayer: boolean
  isWithholdingAgent: boolean
  contactEmail?: string | null
  contactPhone?: string | null
  rideThankYouText?: string | null
  logoLightId?: string | null
  logoDarkId?: string | null
  preferWordmark?: boolean
  logoLightUrl?: string | null
  logoDarkUrl?: string | null
  status: number
  servicePlanName: string
  maxUsers: number
  maxWarehouses: number
  subscriptionMaxTenants: number
  enabledModules: string[] | null
  createdAt: string
  updatedAt: string | null
}

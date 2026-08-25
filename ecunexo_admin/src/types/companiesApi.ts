/** Contratos empresas de suscripción (camelCase). */

export type SubscriptionCompanyListItemDto = {
  id: string
  name: string
  status: number
  createdAt: string
  isCurrent: boolean
}

export type ListSubscriptionCompaniesDto = {
  maxTenants: number
  usedCount: number
  slotsRemaining: number
  canCreateMore: boolean
  companies: SubscriptionCompanyListItemDto[]
}

export type ProvisionCompanyBody = {
  tenantName: string
  ownerEmail: string
  ownerName: string
  ownerPassword: string
  timeZoneId?: string | null
  locale?: string | null
  logoUrl?: string | null
  primaryColorHex?: string | null
  ownerDepartment?: string | null
  ownerPhone?: string | null
  ownerJobTitle?: string | null
}

export type ProvisionCompanyResponseDto = {
  tenantId: string
  userId: string
  roleId: string
}

export type UpdateSubscriptionCompanyBody = {
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
  rimpeKind: string
  preferElectronicInvoice: boolean
  isExporter: boolean
  isLargeTaxpayer: boolean
  isSpecialTaxpayer: boolean
  isWithholdingAgent: boolean
  contactEmail: string | null
  contactPhone: string | null
  rideThankYouText: string | null
}

export type UpdateSubscriptionCompanyResponseDto = {
  tenantId: string
}

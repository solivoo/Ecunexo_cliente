/** Contratos Vitrina pública / dominios (camelCase). */

export type StorefrontDomainDto = {
  id: string
  domain: string
  isPrimary: boolean
  isVerified: boolean
  txtRecordName: string
  txtRecordValue: string
  verifiedAt: string | null
  createdAt: string
}

export type CreateStorefrontDomainBody = {
  domain: string
}

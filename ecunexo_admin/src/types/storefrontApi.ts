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

export type EcommerceShippingOption = {
  code: string
  cost: number
}

export type EcommerceStorefrontSettings = {
  paymentMethods: string[]
  shippingMethods: EcommerceShippingOption[]
  bankTransferInstructions: string
  paymentHoldHours: number
  reserveOnOrder: boolean
  contactWhatsapp: string
}

export type UpdateEcommerceStorefrontSettingsInput = {
  paymentMethods: string[]
  shippingMethods: EcommerceShippingOption[]
  bankTransferInstructions: string | null
  paymentHoldHours: number
  reserveOnOrder: boolean
  contactWhatsapp: string | null
}

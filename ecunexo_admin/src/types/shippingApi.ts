export interface ShippingRateRuleDto {
  id: string
  tenantId: string
  carrier: string
  zone: string
  name: string
  minQuantity: number
  maxQuantity: number | null
  minOrderAmount: number | null
  price: number
  taxRate: number
  estimatedDays: string | null
  notes: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateShippingRateRuleBody {
  carrier: string
  zone: string
  name: string
  price: number
  minQuantity?: number
  maxQuantity?: number | null
  minOrderAmount?: number | null
  taxRate?: number
  estimatedDays?: string | null
  notes?: string | null
  sortOrder?: number
}

export interface UpdateShippingRateRuleBody {
  carrier: string
  zone: string
  name: string
  price: number
  minQuantity?: number
  maxQuantity?: number | null
  minOrderAmount?: number | null
  taxRate?: number
  estimatedDays?: string | null
  notes?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface ResolveShippingRatesBody {
  zone?: string | null
  totalQuantity: number
  totalOrderAmount?: number
}

export interface ResolvedShippingOptionDto {
  ruleId: string
  carrier: string
  zone: string
  name: string
  basePrice: number
  taxRate: number
  taxAmount: number
  totalPrice: number
  estimatedDays: string | null
  notes: string | null
  isEligible: boolean
  unitsNeeded: number | null
  isRecommended: boolean
}

export interface ShippingZoneDto {
  id: string
  tenantId: string
  code: string
  name: string
  description: string | null
  provinces: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateShippingZoneBody {
  code: string
  name: string
  description?: string | null
  provinces?: string | null
  sortOrder?: number
}

export interface UpdateShippingZoneBody {
  code: string
  name: string
  description?: string | null
  provinces?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface ShippingMethodDto {
  id: string
  tenantId: string
  code: string
  name: string
  description: string | null
  estimatedDays: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateShippingMethodBody {
  code: string
  name: string
  description?: string | null
  estimatedDays?: string | null
  sortOrder?: number
}

export interface UpdateShippingMethodBody {
  code: string
  name: string
  description?: string | null
  estimatedDays?: string | null
  sortOrder?: number
  isActive?: boolean
}

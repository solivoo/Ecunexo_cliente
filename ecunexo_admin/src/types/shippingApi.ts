export interface InvoiceShippingSelectionDto {
  cantonId: string
  cantonName: string
  provinceName: string
  methodName: string
  basePrice: number
  taxRate: number
  taxAmount: number
  totalPrice: number
  isFreeShipping: boolean
  estimatedDays: string | null
}

export type ShippingCoverageScope = 0 | 1 | 2 | 3

export interface ShippingMethodDto {
  id: string
  tenantId: string
  code: string
  name: string
  description: string | null
  estimatedDays: string | null
  sortOrder: number
  coverageScope?: ShippingCoverageScope
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
  coverageScope?: ShippingCoverageScope
}

export interface UpdateShippingMethodBody {
  code: string
  name: string
  description?: string | null
  estimatedDays?: string | null
  sortOrder?: number
  isActive?: boolean
  coverageScope?: ShippingCoverageScope
}

export interface EcuadorProvinceDto {
  id: string
  code: string
  name: string
  region: string
  sortOrder: number
}

export interface CantonShippingRateItemDto {
  cantonId: string
  cantonCode: string
  cantonName: string
  isProvincialCapital: boolean
  rateId: string | null
  isConfigured: boolean
  isEnabled: boolean
  basePrice: number
  baseWeightKg: number
  additionalKgPrice: number
  volumetricDivisor: number
  roundUpExtraKg: boolean
  freeShippingMinAmount: number | null
  taxRate: number
  estimatedDays: string | null
}

export interface CantonShippingRateUpsertItem {
  cantonId: string
  basePrice: number
  baseWeightKg: number
  additionalKgPrice: number
  volumetricDivisor: number
  roundUpExtraKg: boolean
  freeShippingMinAmount: number | null
  taxRate: number
  estimatedDays: string | null
  isEnabled: boolean
}

export interface UpsertCantonShippingRatesBulkBody {
  shippingMethodId: string | null
  originCantonId?: string | null
  items: CantonShippingRateUpsertItem[]
}

export interface CalculateShippingItemBody {
  weightKg: number | null
  quantity: number
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
}

export interface CalculateShippingCostBody {
  cantonId: string
  originCantonId?: string | null
  shippingMethodId?: string | null
  strategy?: 0 | 1
  items?: CalculateShippingItemBody[]
  orderSubtotal: number
  packageDimensions?: {
    lengthCm: number
    widthCm: number
    heightCm: number
  } | null
  overrideActualWeightKg?: number | null
}

export interface ShippingCostCalculationResultDto {
  actualWeightKg: number
  volumetricWeightKg: number
  chargeableWeightKg: number
  volumetricDivisor: number
  baseWeightKg: number
  extraWeightKg: number
  basePrice: number
  extraWeightCost: number
  subtotal: number
  taxRate: number
  taxAmount: number
  totalPrice: number
  isFreeShipping: boolean
  estimatedDays: string | null
  strategyName: string
}

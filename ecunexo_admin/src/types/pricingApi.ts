/** Contratos Gestión de Precios v1 (camelCase). */

export const PromotionType = {
  Percentage: 0,
  FixedAmount: 1,
  FixedPrice: 2,
} as const

export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType]

export const PromotionTargetType = {
  Product: 0,
  Variant: 1,
  Category: 2,
} as const

export type PromotionTargetType = (typeof PromotionTargetType)[keyof typeof PromotionTargetType]

export type PriceListDto = {
  id: string
  code: string
  name: string
  description: string | null
  currency: string
  pricesIncludeTax: boolean
  validFrom: string
  validTo: string | null
  priority: number
  isDefault: boolean
  isActive: boolean
}

export type CreatePriceListBody = {
  code: string
  name: string
  description: string | null
  currency: string | null
  pricesIncludeTax: boolean
  validFrom: string
  validTo: string | null
  priority: number
  isDefault: boolean
}

export type UpdatePriceListBody = Omit<CreatePriceListBody, 'code'>

export type PriceTierDto = {
  quantityFrom: number
  quantityTo: number | null
  unitPrice: number
  isActive?: boolean
}

export type PriceTierBody = {
  quantityFrom: number
  quantityTo: number | null
  unitPrice: number
}

export type ProductPriceListItemDto = {
  id: string
  catalogItemId: string
  itemName: string
  sku: string | null
  priceListId: string
  priceListCode: string
  priceListName: string
  price: number
  validFrom: string
  validTo: string | null
  isActive: boolean
}

export type ProductPriceDetailDto = {
  id: string
  catalogItemId: string
  itemName: string
  sku: string | null
  priceListId: string
  priceListCode: string
  priceListName: string
  price: number
  validFrom: string
  validTo: string | null
  isActive: boolean
  tiers: PriceTierDto[]
}

export type ProductPriceFilters = {
  search?: string
  priceListId?: string
  date?: string
  onlyVigent?: boolean
}

export type CreateProductPriceBody = {
  priceListId: string
  catalogItemId: string
  price: number
  validFrom: string
  validTo: string | null
  reason: string | null
  tiers: PriceTierBody[]
}

export type UpdateProductPriceBody = {
  price: number
  validFrom: string
  validTo: string | null
  reason: string | null
  isActive: boolean | null
  tiers: PriceTierBody[]
}

export type PriceHistoryItemDto = {
  id: string
  catalogItemId: string
  itemName: string
  sku: string | null
  priceListId: string
  priceListCode: string
  priceListName: string
  previousPrice: number | null
  newPrice: number | null
  validFrom: string
  validTo: string | null
  reason: string | null
  changedBy: string | null
  changedAt: string
}

export type PriceHistoryFilters = {
  catalogItemId?: string
  priceListId?: string
  from?: string
  to?: string
}

export type PromotionTargetDto = {
  targetType: PromotionTargetType
  targetReference: string
}

export type PromotionDto = {
  id: string
  code: string
  name: string
  description: string | null
  type: PromotionType
  value: number
  startsAt: string
  endsAt: string | null
  priority: number
  isStackable: boolean
  isActive: boolean
  targets: PromotionTargetDto[]
}

export type CreatePromotionBody = {
  code: string
  name: string
  description: string | null
  type: PromotionType
  value: number
  startsAt: string
  endsAt: string | null
  priority: number
  isStackable: boolean
  targets: PromotionTargetDto[]
}

export type UpdatePromotionBody = Omit<CreatePromotionBody, 'code'>

export type ResolvePriceBody = {
  catalogItemId: string
  quantity: number
  date: string
  priceListId?: string
}

export type PricingResultDto = {
  catalogItemId: string
  priceListId: string
  priceListCode: string
  listPrice: number
  unitPrice: number
  tierPrice: number | null
  tierLabel: string | null
  subtotal: number
  discountAmount: number
  netPrice: number
  taxableBase: number
  taxAmount: number
  finalPrice: number
  taxRate: number
  pricesIncludeTax: boolean
  currency: string
  appliedRules: string[]
}

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
  AllItems: 2,
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
  suggestedMarginPercent?: number | null
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
  suggestedMarginPercent?: number | null
}

export type UpdatePriceListBody = Omit<CreatePriceListBody, 'code'> & {
  isActive?: boolean | null
}

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
  volumeDiscountSchemeId?: string | null
  volumeDiscountSchemeName?: string | null
  averageCost?: number | null
  pricesIncludeTax?: boolean
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
  volumeDiscountSchemeId?: string | null
  volumeDiscountSchemeName?: string | null
  averageCost?: number | null
  pricesIncludeTax?: boolean
}

export type ProductPriceFilters = {
  search?: string
  priceListId?: string
  date?: string
  onlyVigent?: boolean
  catalogItemId?: string
}

export type CreateProductPriceBody = {
  priceListId: string
  catalogItemId: string
  price: number
  validFrom: string
  validTo: string | null
  reason: string | null
  tiers: PriceTierBody[]
  isActive?: boolean
  volumeDiscountSchemeId?: string | null
}

export type UpdateProductPriceBody = {
  price: number
  validFrom: string
  validTo: string | null
  reason: string | null
  isActive: boolean | null
  tiers: PriceTierBody[]
  volumeDiscountSchemeId?: string | null
}

export const VolumeDiscountSchemeType = {
  Percentage: 0,
  FixedAmount: 1,
  FixedPrice: 2,
  PackagePrice: 3,
} as const

export type VolumeDiscountSchemeType =
  (typeof VolumeDiscountSchemeType)[keyof typeof VolumeDiscountSchemeType]

export const VolumeGroupingMode = {
  PerLine: 0,
  PerMatrix: 1,
  PerGroup: 2,
} as const

export type VolumeGroupingMode =
  (typeof VolumeGroupingMode)[keyof typeof VolumeGroupingMode]

export const VolumeRuleTargetType = {
  AllItems: 0,
  Category: 1,
  Matrix: 2,
  Product: 3,
  Variant: 4,
} as const

export type VolumeRuleTargetType =
  (typeof VolumeRuleTargetType)[keyof typeof VolumeRuleTargetType]

export type VolumeDiscountTargetDto = {
  id: string
  targetType: VolumeRuleTargetType
  targetReference: string
  isExclusion: boolean
}

export type VolumeDiscountTargetBody = {
  targetType: VolumeRuleTargetType
  targetReference: string
  isExclusion?: boolean
}

export type VolumeDiscountTierDto = {
  id: string
  quantityFrom: number
  quantityTo: number | null
  value: number
  isActive: boolean
}

export type VolumeDiscountTierBody = {
  quantityFrom: number
  quantityTo: number | null
  value: number
  isActive?: boolean
}

export type VolumeDiscountSchemeDto = {
  id: string
  tenantId: string
  name: string
  description: string | null
  type: VolumeDiscountSchemeType
  groupingMode: VolumeGroupingMode
  minGroupQuantity: number | null
  enforceMinPurchase: boolean
  priority: number
  isActive: boolean
  tiers: VolumeDiscountTierDto[]
  targets: VolumeDiscountTargetDto[]
}

export type CreateVolumeDiscountSchemeBody = {
  name: string
  description?: string | null
  type: VolumeDiscountSchemeType
  tiers?: VolumeDiscountTierBody[]
  groupingMode?: VolumeGroupingMode
  minGroupQuantity?: number | null
  enforceMinPurchase?: boolean
  priority?: number
  targets?: VolumeDiscountTargetBody[]
}

export type UpdateVolumeDiscountSchemeBody = {
  name: string
  description?: string | null
  type: VolumeDiscountSchemeType
  isActive?: boolean
  tiers?: VolumeDiscountTierBody[]
  groupingMode?: VolumeGroupingMode
  minGroupQuantity?: number | null
  enforceMinPurchase?: boolean
  priority?: number
  targets?: VolumeDiscountTargetBody[]
}

export type AssignVolumeDiscountSchemeBody = {
  priceListId: string
  volumeDiscountSchemeId: string | null
  catalogItemIds: string[]
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
  requiresCode?: boolean
  minOrderAmount?: number | null
  usageLimit?: number | null
  timesUsed?: number
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
  requiresCode?: boolean
  minOrderAmount?: number | null
  usageLimit?: number | null
}

export type UpdatePromotionBody = Omit<CreatePromotionBody, 'code'> & {
  isActive?: boolean | null
}

export type BulkPriceItemBody = {
  catalogItemId: string
  price: number
  tiers?: PriceTierBody[]
  volumeDiscountSchemeId?: string | null
}

export type BulkCreateProductPricesBody = {
  priceListId: string
  validFrom: string
  validTo: string | null
  reason: string | null
  items: BulkPriceItemBody[]
}

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
  averageCost?: number | null
  marginPercent?: number | null
  isBelowCost?: boolean
}

export type ResolveCartLineBody = {
  catalogItemId: string
  quantity: number
  lineId?: string
}

export type ResolveCartBody = {
  lines: ResolveCartLineBody[]
  date: string
  priceListId?: string
  couponCode?: string
  pricesIncludeTaxOverride?: boolean
}

export type CartPricingLineResultDto = {
  lineId: string
  catalogItemId: string
  listPrice: number
  unitPrice: number
  quantity: number
  tierLabel: string | null
  subtotal: number
  discountAmount: number
  netPrice: number
  taxableBase: number
  taxAmount: number
  finalPrice: number
  taxRate: number
  pricesIncludeTax: boolean
  appliedRules: string[]
}

export type CartPricingResultDto = {
  priceListId: string
  priceListCode: string
  currency: string
  lines: CartPricingLineResultDto[]
  subtotal: number
  discountAmount: number
  netPrice: number
  taxableBase: number
  taxAmount: number
  finalPrice: number
  appliedRules: string[]
}

export type ProductPriceMatrixCellDto = {
  priceId: string
  price: number
  validFrom: string
  volumeDiscountSchemeId?: string | null
  volumeDiscountSchemeName?: string | null
}

export type ProductPriceMatrixRowDto = {
  catalogItemId: string
  name: string
  sku: string | null
  kind: number
  referenceCost: number | null
  costSource: 'stock' | 'catalog' | null
  volumeDiscountSchemeId: string | null
  volumeDiscountSchemeName: string | null
  cells: Record<string, ProductPriceMatrixCellDto | undefined>
}

export type ProductPriceMatrixPageDto = {
  priceLists: PriceListDto[]
  items: ProductPriceMatrixRowDto[]
  totalCount: number
  totalSellableItems: number
  itemsMissingAnyPrice: number
  page: number
  pageSize: number
}

export type ProductPriceMatrixFilters = {
  page?: number
  pageSize?: number
  search?: string
  onlyMissing?: boolean
  priceListIds?: string[]
  date?: string
}

export type MatrixPriceUpsertEntryBody = {
  priceListId: string
  catalogItemId: string
  price: number
}

export type BulkUpsertMatrixPricesBody = {
  validFrom: string
  validTo: string | null
  reason: string | null
  entries: MatrixPriceUpsertEntryBody[]
}

export type BulkUpsertMatrixPricesResponse = {
  updatedCount: number
  createdCount: number
}

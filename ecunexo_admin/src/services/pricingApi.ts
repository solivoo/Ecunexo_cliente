import { api } from '@/lib/apiClient'
import type {
  CreatePriceListBody,
  CreateProductPriceBody,
  CreatePromotionBody,
  PriceHistoryFilters,
  PriceHistoryItemDto,
  PriceListDto,
  PricingResultDto,
  ProductPriceDetailDto,
  ProductPriceFilters,
  ProductPriceListItemDto,
  PromotionDto,
  ResolvePriceBody,
  UpdatePriceListBody,
  UpdateProductPriceBody,
  UpdatePromotionBody,
} from '@/types/pricingApi'

const base = (tenantId: string) => `/api/v1/tenants/${tenantId}/catalog/pricing`

export async function listPriceLists(
  tenantId: string,
  onlyActive = true
): Promise<PriceListDto[]> {
  const { data } = await api.get<PriceListDto[]>(`${base(tenantId)}/price-lists`, {
    params: { onlyActive },
  })
  return data
}

export async function createPriceList(
  tenantId: string,
  body: CreatePriceListBody
): Promise<{ priceListId: string; tenantId: string }> {
  const { data } = await api.post<{ priceListId: string; tenantId: string }>(
    `${base(tenantId)}/price-lists`,
    body
  )
  return data
}

export async function updatePriceList(
  tenantId: string,
  priceListId: string,
  body: UpdatePriceListBody
): Promise<void> {
  await api.put(`${base(tenantId)}/price-lists/${priceListId}`, body)
}

export async function deletePriceList(tenantId: string, priceListId: string): Promise<void> {
  await api.delete(`${base(tenantId)}/price-lists/${priceListId}`)
}

export async function listProductPrices(
  tenantId: string,
  filters: ProductPriceFilters = {}
): Promise<ProductPriceListItemDto[]> {
  const { data } = await api.get<ProductPriceListItemDto[]>(`${base(tenantId)}/prices`, {
    params: filters,
  })
  return data
}

export async function getProductPrice(
  tenantId: string,
  priceId: string
): Promise<ProductPriceDetailDto> {
  const { data } = await api.get<ProductPriceDetailDto>(`${base(tenantId)}/prices/${priceId}`)
  return data
}

export async function createProductPrice(
  tenantId: string,
  body: CreateProductPriceBody
): Promise<{ productPriceId: string; tenantId: string }> {
  const { data } = await api.post<{ productPriceId: string; tenantId: string }>(
    `${base(tenantId)}/prices`,
    body
  )
  return data
}

export async function updateProductPrice(
  tenantId: string,
  priceId: string,
  body: UpdateProductPriceBody
): Promise<void> {
  await api.put(`${base(tenantId)}/prices/${priceId}`, body)
}

export async function deleteProductPrice(
  tenantId: string,
  priceId: string,
  reason?: string
): Promise<void> {
  await api.delete(`${base(tenantId)}/prices/${priceId}`, { params: { reason } })
}

export async function listPriceHistory(
  tenantId: string,
  filters: PriceHistoryFilters = {}
): Promise<PriceHistoryItemDto[]> {
  const { data } = await api.get<PriceHistoryItemDto[]>(`${base(tenantId)}/prices/history`, {
    params: filters,
  })
  return data
}

export async function listPromotions(
  tenantId: string,
  onlyActive = true
): Promise<PromotionDto[]> {
  const { data } = await api.get<PromotionDto[]>(`${base(tenantId)}/promotions`, {
    params: { onlyActive },
  })
  return data
}

export async function createPromotion(
  tenantId: string,
  body: CreatePromotionBody
): Promise<{ promotionId: string; tenantId: string }> {
  const { data } = await api.post<{ promotionId: string; tenantId: string }>(
    `${base(tenantId)}/promotions`,
    body
  )
  return data
}

export async function updatePromotion(
  tenantId: string,
  promotionId: string,
  body: UpdatePromotionBody
): Promise<void> {
  await api.put(`${base(tenantId)}/promotions/${promotionId}`, body)
}

export async function deletePromotion(tenantId: string, promotionId: string): Promise<void> {
  await api.delete(`${base(tenantId)}/promotions/${promotionId}`)
}

export async function resolvePrice(
  tenantId: string,
  body: ResolvePriceBody
): Promise<PricingResultDto> {
  const { data } = await api.post<PricingResultDto>(`${base(tenantId)}/resolve`, body)
  return data
}

import { api } from '@/lib/apiClient'
import type {
  CatalogItemDetailDto,
  CatalogItemKind,
  CatalogItemListItemDto,
  CategoryListItemDto,
  CreateCatalogItemBody,
  CreateCatalogItemResponseDto,
  CreateCategoryBody,
  CreateCategoryResponseDto,
  UpdateCatalogItemBody,
  UpdateCategoryBody,
} from '@/types/catalogApi'

export async function listCatalogCategories(tenantId: string): Promise<CategoryListItemDto[]> {
  const { data } = await api.get<CategoryListItemDto[]>(
    `/api/v1/tenants/${tenantId}/catalog/categories`
  )
  return data
}

export async function createCatalogCategory(
  tenantId: string,
  body: CreateCategoryBody
): Promise<CreateCategoryResponseDto> {
  const { data } = await api.post<CreateCategoryResponseDto>(
    `/api/v1/tenants/${tenantId}/catalog/categories`,
    body
  )
  return data
}

export async function updateCatalogCategory(
  tenantId: string,
  categoryId: string,
  body: UpdateCategoryBody
): Promise<void> {
  await api.put(`/api/v1/tenants/${tenantId}/catalog/categories/${categoryId}`, body)
}

export async function softDeleteCatalogCategory(
  tenantId: string,
  categoryId: string
): Promise<void> {
  await api.delete(`/api/v1/tenants/${tenantId}/catalog/categories/${categoryId}`)
}

export async function listCatalogItems(
  tenantId: string,
  kind?: CatalogItemKind
): Promise<CatalogItemListItemDto[]> {
  const { data } = await api.get<CatalogItemListItemDto[]>(
    `/api/v1/tenants/${tenantId}/catalog/items`,
    { params: kind === undefined ? undefined : { kind } }
  )
  return data
}

export async function getCatalogItem(
  tenantId: string,
  itemId: string
): Promise<CatalogItemDetailDto> {
  const { data } = await api.get<CatalogItemDetailDto>(
    `/api/v1/tenants/${tenantId}/catalog/items/${itemId}`
  )
  return data
}

export async function createCatalogItem(
  tenantId: string,
  body: CreateCatalogItemBody
): Promise<CreateCatalogItemResponseDto> {
  const { data } = await api.post<CreateCatalogItemResponseDto>(
    `/api/v1/tenants/${tenantId}/catalog/items`,
    body
  )
  return data
}

export async function updateCatalogItem(
  tenantId: string,
  itemId: string,
  body: UpdateCatalogItemBody
): Promise<void> {
  await api.put(`/api/v1/tenants/${tenantId}/catalog/items/${itemId}`, body)
}

export async function softDeleteCatalogItem(tenantId: string, itemId: string): Promise<void> {
  await api.delete(`/api/v1/tenants/${tenantId}/catalog/items/${itemId}`)
}

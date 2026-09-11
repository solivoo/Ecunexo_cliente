import { api } from '@/lib/apiClient'
import type {
  CatalogItemDetailDto,
  CatalogItemImageDto,
  CatalogItemKind,
  CatalogItemListItemDto,
  CatalogItemStatus,
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
  kind?: CatalogItemKind,
  status?: CatalogItemStatus
): Promise<CatalogItemListItemDto[]> {
  const params: Record<string, unknown> = {}
  if (kind !== undefined) params.kind = kind
  if (status !== undefined) params.status = status

  const { data } = await api.get<CatalogItemListItemDto[]>(
    `/api/v1/tenants/${tenantId}/catalog/items`,
    { params: Object.keys(params).length > 0 ? params : undefined }
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

export async function uploadCatalogItemImage(
  tenantId: string,
  itemId: string,
  file: File,
  altText?: string,
  setAsMain?: boolean
): Promise<CatalogItemImageDto> {
  const formData = new FormData()
  formData.append('file', file)
  if (altText) {
    formData.append('altText', altText)
  }
  if (setAsMain !== undefined) {
    formData.append('setAsMain', String(setAsMain))
  }

  const { data } = await api.post<CatalogItemImageDto>(
    `/api/v1/tenants/${tenantId}/catalog/items/${itemId}/images`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  )
  return data
}

export async function deleteCatalogItemImage(
  tenantId: string,
  itemId: string,
  imageId: string
): Promise<void> {
  await api.delete(`/api/v1/tenants/${tenantId}/catalog/items/${itemId}/images/${imageId}`)
}

export async function setCatalogItemMainImage(
  tenantId: string,
  itemId: string,
  imageId: string
): Promise<void> {
  await api.put(`/api/v1/tenants/${tenantId}/catalog/items/${itemId}/images/${imageId}/main`)
}

export async function reorderCatalogItemImages(
  tenantId: string,
  itemId: string,
  imageIds: string[]
): Promise<void> {
  await api.put(`/api/v1/tenants/${tenantId}/catalog/items/${itemId}/images/reorder`, {
    imageIds,
  })
}

export async function updateCatalogItemImageAltText(
  tenantId: string,
  itemId: string,
  imageId: string,
  altText: string
): Promise<void> {
  await api.put(`/api/v1/tenants/${tenantId}/catalog/items/${itemId}/images/${imageId}/alt-text`, {
    altText,
  })
}

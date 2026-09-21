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
  AddCatalogItemVariantBody,
  AddCatalogItemVariantResponseDto,
  ProductTemplateDto,
  CreateProductTemplateBody,
  UpdateProductTemplateBody,
  CreateProductTemplateResponseDto,
  ReassignCatalogItemVariantParentBody,
  ReassignCatalogItemVariantParentResponseDto,
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
  kindOrOptions?:
    | CatalogItemKind
    | { kind?: CatalogItemKind; status?: CatalogItemStatus; onlyRoots?: boolean },
  status?: CatalogItemStatus,
  onlyRoots?: boolean
): Promise<CatalogItemListItemDto[]> {
  const params: Record<string, unknown> = {}
  if (kindOrOptions !== undefined && typeof kindOrOptions === 'object') {
    if (kindOrOptions.kind !== undefined) params.kind = kindOrOptions.kind
    if (kindOrOptions.status !== undefined) params.status = kindOrOptions.status
    if (kindOrOptions.onlyRoots !== undefined) params.onlyRoots = kindOrOptions.onlyRoots
  } else {
    if (kindOrOptions !== undefined) params.kind = kindOrOptions
    if (status !== undefined) params.status = status
    if (onlyRoots !== undefined) params.onlyRoots = onlyRoots
  }

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
  setAsMain?: boolean,
  groupValue?: string
): Promise<CatalogItemImageDto> {
  const formData = new FormData()
  formData.append('file', file)
  if (altText) {
    formData.append('altText', altText)
  }
  if (setAsMain !== undefined) {
    formData.append('setAsMain', String(setAsMain))
  }
  if (groupValue) {
    formData.append('groupValue', groupValue)
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

export async function createCatalogItemMatrix(
  tenantId: string,
  payload: import('@/types/catalogApi').CreateCatalogItemMatrixPayload
): Promise<import('@/types/catalogApi').CreateCatalogItemMatrixResponseDto> {
  const { data } = await api.post<import('@/types/catalogApi').CreateCatalogItemMatrixResponseDto>(
    `/api/v1/tenants/${tenantId}/catalog/items/matrix`,
    payload
  )
  return data
}

export async function listVariantDimensionTemplates(
  tenantId: string
): Promise<import('@/types/catalogApi').VariantDimensionTemplateDto[]> {
  const { data } = await api.get<import('@/types/catalogApi').VariantDimensionTemplateDto[]>(
    `/api/v1/tenants/${tenantId}/catalog/variant-templates`
  )
  return data
}

export async function createVariantDimensionTemplate(
  tenantId: string,
  payload: {
    name: string
    dimensionType: string
    predefinedValuesJson: string
    dataType?: string
    isVariantAxis?: boolean
    unit?: string | null
  }
): Promise<{ id: string; tenantId: string }> {
  const { data } = await api.post<{ id: string; tenantId: string }>(
    `/api/v1/tenants/${tenantId}/catalog/variant-templates`,
    payload
  )
  return data
}

export async function updateVariantDimensionTemplate(
  tenantId: string,
  templateId: string,
  payload: {
    name: string
    dimensionType: string
    predefinedValuesJson: string
    dataType?: string
    isVariantAxis?: boolean
    unit?: string | null
  }
): Promise<{ id: string; tenantId: string }> {
  const { data } = await api.put<{ id: string; tenantId: string }>(
    `/api/v1/tenants/${tenantId}/catalog/variant-templates/${templateId}`,
    payload
  )
  return data
}

export async function deleteVariantDimensionTemplate(
  tenantId: string,
  templateId: string
): Promise<void> {
  await api.delete(
    `/api/v1/tenants/${tenantId}/catalog/variant-templates/${templateId}`
  )
}

export async function addCatalogItemVariant(
  tenantId: string,
  parentId: string,
  body: AddCatalogItemVariantBody
): Promise<AddCatalogItemVariantResponseDto> {
  const { data } = await api.post<AddCatalogItemVariantResponseDto>(
    `/api/v1/tenants/${tenantId}/catalog/items/${parentId}/variants`,
    body
  )
  return data
}

export async function listProductTemplates(tenantId: string): Promise<ProductTemplateDto[]> {
  const { data } = await api.get<ProductTemplateDto[]>(
    `/api/v1/tenants/${tenantId}/catalog/product-templates`
  )
  return data
}

export async function getProductTemplateById(
  tenantId: string,
  templateId: string
): Promise<ProductTemplateDto> {
  const { data } = await api.get<ProductTemplateDto>(
    `/api/v1/tenants/${tenantId}/catalog/product-templates/${templateId}`
  )
  return data
}

export async function createProductTemplate(
  tenantId: string,
  body: CreateProductTemplateBody
): Promise<CreateProductTemplateResponseDto> {
  const { data } = await api.post<CreateProductTemplateResponseDto>(
    `/api/v1/tenants/${tenantId}/catalog/product-templates`,
    body
  )
  return data
}

export async function updateProductTemplate(
  tenantId: string,
  templateId: string,
  body: UpdateProductTemplateBody
): Promise<CreateProductTemplateResponseDto> {
  const { data } = await api.put<CreateProductTemplateResponseDto>(
    `/api/v1/tenants/${tenantId}/catalog/product-templates/${templateId}`,
    body
  )
  return data
}

export async function deleteProductTemplate(
  tenantId: string,
  templateId: string
): Promise<void> {
  await api.delete(
    `/api/v1/tenants/${tenantId}/catalog/product-templates/${templateId}`
  )
}

export async function reassignCatalogItemVariantParent(
  tenantId: string,
  itemId: string,
  body: ReassignCatalogItemVariantParentBody
): Promise<ReassignCatalogItemVariantParentResponseDto> {
  const { data } = await api.post<ReassignCatalogItemVariantParentResponseDto>(
    `/api/v1/tenants/${tenantId}/catalog/items/${itemId}/reassign-parent`,
    body
  )
  return data
}



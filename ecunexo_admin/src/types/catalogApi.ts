/** Contratos Catálogo v1 (camelCase). */

export const CatalogItemKind = {
  Physical: 0,
  Service: 1,
} as const

export type CatalogItemKind = (typeof CatalogItemKind)[keyof typeof CatalogItemKind]

export const CatalogItemStatus = {
  Active: 0,
  Inactive: 1,
} as const

export type CatalogItemStatus = (typeof CatalogItemStatus)[keyof typeof CatalogItemStatus]

export type CatalogAttributeField = {
  key: string
  label?: string
  type?: string
  required?: boolean
}

export type CategoryListItemDto = {
  id: string
  name: string
  description: string | null
  parentId: string | null
  attributeSchemaJson: string
  createdAt: string
}

export type CatalogItemImageDto = {
  id: string
  catalogItemId: string
  originalFileName: string
  altText: string | null
  displayOrder: number
  isMain: boolean
  originalWidth: number
  originalHeight: number
  fileSizeBytes: number
  mimeType: string
  thumbUrl: string
  mediumUrl: string
  largeUrl: string
  createdAt: string
}

export type CatalogItemListItemDto = {
  id: string
  kind: CatalogItemKind
  name: string
  description: string | null
  sku: string | null
  basePrice: number | null
  categoryId: string | null
  categoryName: string | null
  status: CatalogItemStatus
  createdAt: string
  mainImageThumbUrl?: string | null
  mainImageUrl?: string | null
}

export type CatalogItemDetailDto = {
  id: string
  kind: CatalogItemKind
  name: string
  description: string | null
  sku: string | null
  basePrice: number | null
  categoryId: string | null
  categoryName: string | null
  customAttributesJson: string
  status: CatalogItemStatus
  createdAt: string
  updatedAt: string | null
  images: CatalogItemImageDto[]
}

export type CreateCategoryBody = {
  name: string
  description?: string | null
  parentId?: string | null
  attributeSchemaJson?: string | null
}

export type UpdateCategoryBody = CreateCategoryBody

export type CreateCategoryResponseDto = {
  categoryId: string
  tenantId: string
}

export type CreateCatalogItemBody = {
  kind: CatalogItemKind
  name: string
  description?: string | null
  sku?: string | null
  basePrice?: number | null
  categoryId?: string | null
  customAttributesJson?: string | null
}

export type CreateCatalogItemResponseDto = {
  itemId: string
  tenantId: string
}

export type UpdateCatalogItemBody = CreateCatalogItemBody & {
  status?: CatalogItemStatus | null
}

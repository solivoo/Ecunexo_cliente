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

export type HierarchyPathEntry = {
  level: string
  name: string
  value: string
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
  status: CatalogItemStatus
  createdAt: string
  mainImageThumbUrl?: string | null
  mainImageUrl?: string | null
  customAttributesJson?: string | null
  isMatrixParent?: boolean
  parentId?: string | null
  variantCount?: number
  variantDimensionsJson?: string | null
  familyId?: string | null
  familyName?: string | null
  hierarchyPathJson?: string | null
}

export type CatalogItemVariantSummaryDto = {
  id: string
  name: string
  sku: string | null
  basePrice: number | null
  customAttributesJson: string
  status: CatalogItemStatus
  mainImageThumbUrl?: string | null
  imageInherited?: boolean
  imageInheritedFrom?: 'group' | 'model' | null
  dimensionValues?: Record<string, string> | null
  images?: CatalogItemImageDto[] | null
  tags?: string[] | null
  extraColors?: string[] | null
}

export type CatalogMatrixAxisDto = {
  name: string
  type: 'color' | 'size' | 'custom'
  values: string[]
  isPhotoGroup: boolean
}

export type CatalogMatrixDescriptorDto = {
  depth: number
  axes: CatalogMatrixAxisDto[]
  primaryAxis: string | null
  groupValues: string[]
}

export type CatalogItemDetailDto = {
  id: string
  kind: CatalogItemKind
  name: string
  description: string | null
  sku: string | null
  basePrice: number | null
  customAttributesJson: string
  status: CatalogItemStatus
  createdAt: string
  updatedAt: string | null
  images: CatalogItemImageDto[]
  isMatrixParent?: boolean
  parentId?: string | null
  parentName?: string | null
  variantDimensionsJson?: string | null
  variants?: CatalogItemVariantSummaryDto[] | null
  familyId?: string | null
  familyName?: string | null
  hierarchyPathJson?: string | null
  matrixDescriptor?: CatalogMatrixDescriptorDto | null
}

export type CreateCatalogItemBody = {
  kind: CatalogItemKind
  name: string
  description?: string | null
  sku?: string | null
  basePrice?: number | null
  customAttributesJson?: string | null
  familyId?: string | null
  hierarchyPathJson?: string | null
}

export type CreateCatalogItemResponseDto = {
  itemId: string
  tenantId: string
}

export type UpdateCatalogItemBody = CreateCatalogItemBody & {
  status?: CatalogItemStatus | null
}

export type VariantDimensionTemplateDto = {
  id: string
  tenantId: string
  name: string
  dimensionType: string
  predefinedValuesJson: string
  isSystemDefault: boolean
  isInUse?: boolean
  dataType?: string
  isVariantAxis?: boolean
  unit?: string | null
}

export type CreateVariantChildPayload = {
  variantTitle: string
  sku: string
  barcode?: string | null
  basePrice?: number | null
  customAttributesJson?: string | null
  initialStock?: number | null
  initialStockWarehouseId?: string | null
}

export type CreateCatalogItemMatrixPayload = {
  kind: CatalogItemKind
  name: string
  description?: string | null
  modelCode?: string | null
  basePrice?: number | null
  variantDimensionsJson: string
  variants: CreateVariantChildPayload[]
  customAttributesJson?: string | null
  familyId?: string | null
  hierarchyPathJson?: string | null
}

export type CreateCatalogItemMatrixResponseDto = {
  parentItemId: string
  createdVariantsCount: number
  variantItemIds: string[]
}

export type AddCatalogItemVariantBody = {
  variantTitle: string
  sku: string
  basePrice?: number | null
  customAttributesJson?: string | null
  initialStock?: number | null
  initialStockWarehouseId?: string | null
}

export type AddCatalogItemVariantResponseDto = {
  variantItemId: string
  parentItemId: string
  sku: string
  name: string
}

export type ProductTemplateLevel = {
  id: string
  name: string
  hasColor: boolean
  hasImages: boolean
  /** Datos del nivel: se completan una vez y no generan códigos. */
  attributes: string[]
  /**
   * Ejes del nivel: se multiplican con los demás ejes y generan códigos.
   * Ausente en plantillas anteriores; en ese caso el papel de cada atributo
   * se deduce del diccionario y de la posición del nivel.
   */
  axes?: string[]
  photoScope?: 'none' | 'variant' | 'group' | 'model'
  photoGroupBy?: string[]
}

export type ProductTemplateDto = {
  id: string
  tenantId: string
  name: string
  description?: string | null
  hierarchyTreeJson: string
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
  usageCount?: number
}

export type CreateProductTemplateBody = {
  name: string
  description?: string | null
  hierarchyTreeJson: string
  isActive?: boolean
}

export type UpdateProductTemplateBody = CreateProductTemplateBody

export type CreateProductTemplateResponseDto = {
  id: string
  tenantId: string
}

export type ReassignCatalogItemVariantParentBody = {
  targetParentItemId: string | null
  reason: string
}

export type ReassignCatalogItemVariantParentResponseDto = {
  itemId: string
  previousParentId: string | null
  targetParentId: string | null
  reason: string
  itemSku: string
  itemName: string
}

export type ReassignmentAuditRecord = {
  timestamp: string
  moved_by?: string | null
  reason: string
  previous_parent_id?: string | null
  previous_parent_name?: string | null
  previous_parent_sku?: string | null
  target_parent_id?: string | null
  target_parent_name?: string | null
  target_parent_sku?: string | null
}


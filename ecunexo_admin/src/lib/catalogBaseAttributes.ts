import { listSystemBaseAttributes } from '@/services/catalogApi'
import type {
  ListSystemBaseAttributesDto,
  SystemBaseAttributeDto,
  UnitOfMeasureOptionDto,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'

export type SystemBaseAttributeDescriptor = {
  id: string
  name: string
  dimensionType: 'custom' | 'color' | string
  dataType: 'text' | 'number' | 'color' | string
  predefinedValues: readonly string[]
  unit: string | null
  isVariantAxis: boolean
  systemRole: 'item-field' | 'template-axis' | string
  description: string
  aliases: readonly string[]
}

/** Opciones de UoM hidratadas desde la API (vacío hasta el primer load). */
let unitOfMeasureOptions: readonly UnitOfMeasureOptionDto[] = []

let catalog: readonly SystemBaseAttributeDescriptor[] = []
let hydratedTenantId: string | null = null
let itemFieldAliasMap = new Map<string, SystemBaseAttributeDescriptor>()
let allAliasMap = new Map<string, SystemBaseAttributeDescriptor>()

const VARIANT_BUILTIN_COLUMN_IDS = new Set([
  'sys-base-sku',
  'sys-base-barcode',
  'sys-base-cost',
  'sys-base-price',
])

export function normalizeAttrToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function rebuildAliasMaps(attrs: readonly SystemBaseAttributeDescriptor[]) {
  const itemMap = new Map<string, SystemBaseAttributeDescriptor>()
  const allMap = new Map<string, SystemBaseAttributeDescriptor>()
  for (const descriptor of attrs) {
    const keys = [descriptor.name, ...descriptor.aliases]
    for (const k of keys) {
      const norm = normalizeAttrToken(k)
      if (!norm) continue
      allMap.set(norm, descriptor)
      if (descriptor.systemRole === 'item-field') {
        itemMap.set(norm, descriptor)
      }
    }
  }
  itemFieldAliasMap = itemMap
  allAliasMap = allMap
}

function toDescriptor(dto: SystemBaseAttributeDto): SystemBaseAttributeDescriptor {
  return {
    id: dto.id,
    name: dto.name,
    dimensionType: dto.dimensionType,
    dataType: dto.dataType,
    predefinedValues: dto.predefinedValues ?? [],
    unit: dto.unit,
    isVariantAxis: dto.isVariantAxis,
    systemRole: dto.systemRole,
    description: dto.description,
    aliases: dto.aliases ?? [],
  }
}

export function hydrateSystemBaseAttributes(payload: ListSystemBaseAttributesDto, tenantId?: string) {
  catalog = (payload.attributes ?? []).map(toDescriptor)
  unitOfMeasureOptions = payload.unitOfMeasureOptions ?? []
  hydratedTenantId = tenantId ?? hydratedTenantId
  rebuildAliasMaps(catalog)
}

/** Carga el catálogo canónico desde la API (fuente de verdad de dominio). */
export async function ensureSystemBaseAttributesLoaded(tenantId: string): Promise<void> {
  if (!tenantId) return
  if (hydratedTenantId === tenantId && catalog.length > 0) return
  const payload = await listSystemBaseAttributes(tenantId)
  hydrateSystemBaseAttributes(payload, tenantId)
}

export function getSystemBaseAttributes(): readonly SystemBaseAttributeDescriptor[] {
  return catalog
}

/** Compatible con Selects: se rellena al hidratar desde la API. */
export function getUnitOfMeasureOptions(): readonly UnitOfMeasureOptionDto[] {
  return unitOfMeasureOptions
}

export function findConflictingSystemBaseItemAttribute(
  rawName: string
): SystemBaseAttributeDescriptor | undefined {
  const norm = normalizeAttrToken(rawName)
  if (!norm) return undefined
  return itemFieldAliasMap.get(norm)
}

export function findSystemBaseAttribute(
  rawName: string
): SystemBaseAttributeDescriptor | undefined {
  const norm = normalizeAttrToken(rawName)
  if (!norm) return undefined
  return allAliasMap.get(norm)
}

export function isSystemBaseItemFieldKey(rawKey: string): boolean {
  return Boolean(findConflictingSystemBaseItemAttribute(rawKey))
}

export function isVariantBuiltInColumnKey(rawKey: string): boolean {
  const sys = findConflictingSystemBaseItemAttribute(rawKey)
  return Boolean(sys && VARIANT_BUILTIN_COLUMN_IDS.has(sys.id))
}

export function mergeWithSystemBaseAttributes(
  tenantRows: readonly VariantDimensionTemplateDto[],
  tenantId: string,
  systemBase: readonly SystemBaseAttributeDescriptor[] = catalog
): VariantDimensionTemplateDto[] {
  const matchedSystemIds = new Set<string>()

  const enrichedTenantRows = tenantRows.map((row) => {
    const matchedSys = findSystemBaseAttribute(row.name)
    if (!matchedSys) return row
    matchedSystemIds.add(matchedSys.id)
    return {
      ...row,
      isSystemBase: true,
      systemRole: matchedSys.systemRole as VariantDimensionTemplateDto['systemRole'],
      systemDescription: matchedSys.description,
      dataType: row.dataType || matchedSys.dataType,
      unit: row.unit ?? matchedSys.unit,
    }
  })

  const systemDtos: VariantDimensionTemplateDto[] = []
  for (const sys of systemBase) {
    if (matchedSystemIds.has(sys.id)) continue
    systemDtos.push({
      id: sys.id,
      tenantId,
      name: sys.name,
      dimensionType: sys.dimensionType,
      predefinedValuesJson: JSON.stringify(sys.predefinedValues),
      isInUse: true,
      isSystemDefault: true,
      isSystemBase: true,
      systemRole: sys.systemRole as VariantDimensionTemplateDto['systemRole'],
      systemDescription: sys.description,
      dataType: sys.dataType,
      isVariantAxis: sys.isVariantAxis,
      unit: sys.unit,
    })
  }

  return [...systemDtos, ...enrichedTenantRows]
}

export function getTemplateDictionaryAttributes(
  tenantAttributes: readonly VariantDimensionTemplateDto[],
  tenantId = ''
): VariantDimensionTemplateDto[] {
  return mergeWithSystemBaseAttributes(tenantAttributes, tenantId)
}

const BRAND_KEYS = new Set(['marca', 'fabricante', 'marca / fabricante', 'marca/fabricante', 'brand'])
const UNIT_KEYS = new Set([
  'unidad_medida',
  'unidad de medida',
  'unidad medida',
  'unidad',
  'uom',
  'unit of measure',
])
const MIN_ORDER_KEYS = new Set([
  'compra minima',
  'compra minima (cantidad)',
  'cantidad minima',
  'pedido minimo',
  'minorderquantity',
])

export function isCommercialBaseAttributeKey(rawKey: string): boolean {
  const norm = normalizeAttrToken(rawKey)
  return BRAND_KEYS.has(norm) || UNIT_KEYS.has(norm)
}

export function readMinOrderQuantityFromCustomAttributes(
  rows: readonly { key: string; value: string }[],
  fallback = 1
): number {
  for (const row of rows) {
    if (MIN_ORDER_KEYS.has(normalizeAttrToken(row.key)) && row.value.trim()) {
      const parsed = Math.floor(Number(row.value.trim()))
      if (Number.isFinite(parsed) && parsed >= 1) return parsed
    }
  }
  return fallback
}

export function readBrandFromCustomAttributes(
  rows: readonly { key: string; value: string }[]
): string {
  for (const row of rows) {
    if (BRAND_KEYS.has(normalizeAttrToken(row.key)) && row.value.trim()) {
      return row.value.trim()
    }
  }
  return ''
}

export function readUnitOfMeasureFromCustomAttributes(
  rows: readonly { key: string; value: string }[],
  fallback = 'UND'
): string {
  for (const row of rows) {
    if (UNIT_KEYS.has(normalizeAttrToken(row.key)) && row.value.trim()) {
      return row.value.trim()
    }
  }
  return fallback
}

export function upsertBaseCommercialAttributes<T extends { id: string; key: string; value: string }>(
  rows: readonly T[],
  brand: string,
  unitOfMeasure: string
): T[] {
  const withoutBase = rows.filter((row) => !isCommercialBaseAttributeKey(row.key))
  const next: T[] = [...withoutBase]

  if (brand.trim()) {
    next.push({
      id: 'attr-base-brand',
      key: 'marca',
      value: brand.trim(),
    } as T)
  }

  if (unitOfMeasure.trim()) {
    next.push({
      id: 'attr-base-unit',
      key: 'unidad_medida',
      value: unitOfMeasure.trim(),
    } as T)
  }

  return next
}

import type { VariantDimensionTemplateDto } from '@/types/catalogApi'

export interface SystemBaseAttributeDescriptor {
  id: string
  name: string
  dimensionType: 'custom' | 'color'
  dataType: 'text' | 'number' | 'color'
  predefinedValues: readonly string[]
  unit: string | null
  isVariantAxis: boolean
  systemRole: 'item-field' | 'template-axis'
  description: string
  aliases: readonly string[]
}

export const UNIT_OF_MEASURE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'UND', label: 'Unidad (UND)' },
  { value: 'PAR', label: 'Par (PAR)' },
  { value: 'DOC', label: 'Docena (DOC)' },
  { value: 'CJ', label: 'Caja (CJ)' },
  { value: 'PQT', label: 'Paquete (PQT)' },
  { value: 'KG', label: 'Kilogramo (KG)' },
  { value: 'G', label: 'Gramo (G)' },
  { value: 'LT', label: 'Litro (LT)' },
  { value: 'ML', label: 'Mililitro (ML)' },
  { value: 'M', label: 'Metro (M)' },
  { value: 'SERV', label: 'Servicio / Hora (SERV)' },
]

/**
 * Atributos base del sistema incluidos nativamente en todos los ítems del catálogo
 * (tanto productos estándar como plantillas y matrices con variantes).
 */
export const SYSTEM_BASE_ATTRIBUTES: readonly SystemBaseAttributeDescriptor[] = [
  {
    id: 'sys-base-kind',
    name: 'Tipo de ítem',
    dimensionType: 'custom',
    dataType: 'text',
    predefinedValues: ['Físico (con inventario)', 'Servicio (sin stock)'],
    unit: null,
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Clasificación operativa del ítem (físico inventariable o servicio).',
    aliases: ['tipo de item', 'tipo item', 'kind', 'tipo de producto'],
  },
  {
    id: 'sys-base-name',
    name: 'Nombre del producto',
    dimensionType: 'custom',
    dataType: 'text',
    predefinedValues: [],
    unit: null,
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Nombre comercial principal del producto, matriz o variante.',
    aliases: [
      'nombre',
      'nombre del producto',
      'nombre producto',
      'nombre de la matriz',
      'nombre de la matriz producto',
      'name',
      'titulo',
      'titulo del producto',
    ],
  },
  {
    id: 'sys-base-sku',
    name: 'SKU / Código',
    dimensionType: 'custom',
    dataType: 'text',
    predefinedValues: [],
    unit: null,
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Código único de inventario por SKU o código de modelo matriz.',
    aliases: [
      'sku',
      'codigo',
      'sku / codigo',
      'codigo de producto',
      'codigo de matriz',
      'codigo modelo',
      'referencia',
    ],
  },
  {
    id: 'sys-base-barcode',
    name: 'Código de barras (EAN/UPC)',
    dimensionType: 'custom',
    dataType: 'text',
    predefinedValues: [],
    unit: null,
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Identificador comercial de escaneo por código de barras (EAN, UPC, Code128).',
    aliases: [
      'codigo de barras',
      'codigo de barras (ean/upc)',
      'codigo_de_barras',
      'cod. barras',
      'cod barras',
      'barcode',
      'ean',
      'upc',
    ],
  },
  {
    id: 'sys-base-cost',
    name: 'Precio base / Costo ($)',
    dimensionType: 'custom',
    dataType: 'number',
    predefinedValues: [],
    unit: '$',
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Costo unitario de compra/producción para calcular utilidad y margen.',
    aliases: [
      'costo',
      'precio base',
      'precio base / costo',
      'precio base / costo ($)',
      'precio de costo',
      'precio costo',
      'cost',
      'costprice',
    ],
  },
  {
    id: 'sys-base-price',
    name: 'PVP / Precio de venta ($)',
    dimensionType: 'custom',
    dataType: 'number',
    predefinedValues: [],
    unit: '$',
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Precio unitario de venta al público (PVP) para facturación y tienda.',
    aliases: [
      'pvp',
      'pvp ($)',
      'precio',
      'precio de venta',
      'pvp / precio de venta',
      'pvp / precio de venta ($)',
      'price',
      'baseprice',
    ],
  },
  {
    id: 'sys-base-min-order',
    name: 'Compra mínima',
    dimensionType: 'custom',
    dataType: 'number',
    predefinedValues: [],
    unit: 'UND',
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Cantidad mínima de compra requerida por ítem o variante.',
    aliases: [
      'compra minima',
      'compra minima (cantidad)',
      'cantidad minima',
      'pedido minimo',
      'minorderquantity',
    ],
  },
  {
    id: 'sys-base-brand',
    name: 'Marca / Fabricante',
    dimensionType: 'custom',
    dataType: 'text',
    predefinedValues: [],
    unit: null,
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Marca comercial o fabricante del producto (incluido en todos los ítems).',
    aliases: ['marca', 'fabricante', 'marca / fabricante', 'marca/fabricante', 'brand'],
  },
  {
    id: 'sys-base-unit',
    name: 'Unidad de medida',
    dimensionType: 'custom',
    dataType: 'text',
    predefinedValues: UNIT_OF_MEASURE_OPTIONS.map((u) => u.value),
    unit: null,
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Unidad comercial de despacho y presentación (UND, PAR, DOC, CJ, KG, etc.).',
    aliases: [
      'unidad de medida',
      'unidad_medida',
      'unidad medida',
      'unidad',
      'uom',
      'unit of measure',
    ],
  },
  {
    id: 'sys-base-description',
    name: 'Descripción',
    dimensionType: 'custom',
    dataType: 'text',
    predefinedValues: [],
    unit: null,
    isVariantAxis: false,
    systemRole: 'item-field',
    description: 'Descripción comercial y técnica del producto, matriz o variante.',
    aliases: [
      'descripcion',
      'descripcion del producto',
      'descripcion general',
      'descripcion general de la matriz',
      'description',
    ],
  },
  {
    id: 'system-colors',
    name: 'Color',
    dimensionType: 'color',
    dataType: 'color',
    predefinedValues: [],
    unit: null,
    isVariantAxis: true,
    systemRole: 'template-axis',
    description: 'Atributo y eje de color hexadecimal del sistema reutilizable en plantillas y variantes.',
    aliases: ['color', 'colores'],
  },
]

export function normalizeAttrToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

const ITEM_FIELD_ALIAS_MAP = new Map<string, SystemBaseAttributeDescriptor>()
const ALL_SYSTEM_BASE_ALIAS_MAP = new Map<string, SystemBaseAttributeDescriptor>()

for (const descriptor of SYSTEM_BASE_ATTRIBUTES) {
  const keys = [descriptor.name, ...descriptor.aliases]
  for (const k of keys) {
    const norm = normalizeAttrToken(k)
    if (!norm) continue
    ALL_SYSTEM_BASE_ALIAS_MAP.set(norm, descriptor)
    if (descriptor.systemRole === 'item-field') {
      ITEM_FIELD_ALIAS_MAP.set(norm, descriptor)
    }
  }
}

/**
 * Devuelve el atributo base de ficha de ítem si `rawName` colisiona con alguno
 * (ej. Nombre, SKU, Código de barras, Costo, PVP, Compra mínima, Marca, Unidad de medida, Descripción).
 */
export function findConflictingSystemBaseItemAttribute(
  rawName: string
): SystemBaseAttributeDescriptor | undefined {
  const norm = normalizeAttrToken(rawName)
  if (!norm) return undefined
  return ITEM_FIELD_ALIAS_MAP.get(norm)
}

/**
 * Devuelve cualquier atributo base del sistema (incluyendo `Color`) que coincida con `rawName`.
 */
export function findSystemBaseAttribute(
  rawName: string
): SystemBaseAttributeDescriptor | undefined {
  const norm = normalizeAttrToken(rawName)
  if (!norm) return undefined
  return ALL_SYSTEM_BASE_ALIAS_MAP.get(norm)
}

/**
 * Indica si una clave corresponde a un campo base nativo del ítem
 * (que ya se renderiza en la tarjeta «Atributos base del ítem»).
 */
export function isSystemBaseItemFieldKey(rawKey: string): boolean {
  return Boolean(findConflictingSystemBaseItemAttribute(rawKey))
}

/**
 * Indica si una clave corresponde a una columna física fija ya incluida en cada fila
 * de la tabla de variantes (SKU, Código de barras, Costo, PVP).
 */
const VARIANT_BUILTIN_COLUMN_IDS = new Set([
  'sys-base-sku',
  'sys-base-barcode',
  'sys-base-cost',
  'sys-base-price',
])

export function isVariantBuiltInColumnKey(rawKey: string): boolean {
  const sys = findConflictingSystemBaseItemAttribute(rawKey)
  return Boolean(sys && VARIANT_BUILTIN_COLUMN_IDS.has(sys.id))
}

/**
 * Construye las filas de atributos base del sistema para mostrarlas en `Catálogo → Atributos`
 * y en el diccionario de plantillas junto con los atributos personalizados del tenant,
 * evitando duplicar si el tenant ya tiene una fila equivalente en BD (ej. `Marca`, `Color`).
 */
export function mergeWithSystemBaseAttributes(
  tenantRows: readonly VariantDimensionTemplateDto[],
  tenantId: string
): VariantDimensionTemplateDto[] {
  const matchedSystemIds = new Set<string>()

  const enrichedTenantRows = tenantRows.map((row) => {
    const matchedSys = findSystemBaseAttribute(row.name)
    if (!matchedSys) return row
    matchedSystemIds.add(matchedSys.id)
    return {
      ...row,
      isSystemBase: true,
      systemRole: matchedSys.systemRole,
      systemDescription: matchedSys.description,
      dataType: row.dataType || matchedSys.dataType,
      unit: row.unit ?? matchedSys.unit,
    }
  })

  const systemDtos: VariantDimensionTemplateDto[] = []
  for (const sys of SYSTEM_BASE_ATTRIBUTES) {
    if (matchedSystemIds.has(sys.id)) {
      continue
    }
    systemDtos.push({
      id: sys.id,
      tenantId,
      name: sys.name,
      dimensionType: sys.dimensionType,
      predefinedValuesJson: JSON.stringify(sys.predefinedValues),
      isInUse: true,
      isSystemDefault: true,
      isSystemBase: true,
      systemRole: sys.systemRole,
      systemDescription: sys.description,
      dataType: sys.dataType,
      isVariantAxis: sys.isVariantAxis,
      unit: sys.unit,
    })
  }

  return [...systemDtos, ...enrichedTenantRows]
}

/**
 * Devuelve todos los atributos disponibles para el constructor de plantillas
 * (atributos base del sistema + personalizados del tenant) para que el usuario
 * pueda acomodarlos libremente en el nivel o variante que corresponda a su producto.
 */
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

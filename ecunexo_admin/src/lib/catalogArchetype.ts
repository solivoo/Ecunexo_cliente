import type {
  HierarchyPathEntry,
  ProductTemplateLevel,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'

export type DimensionLookup = {
  values: string[]
  isColor: boolean
  dataType: string
  isVariantAxis: boolean
  unit: string | null
}

export function isColorDimension(name: string, type?: string, tplId?: string): boolean {
  const nameLower = (name || '').toLowerCase().trim()
  const typeLower = (type || '').toLowerCase().trim()
  return nameLower.includes('color') || typeLower.includes('color') || tplId === 'system-colors'
}

/** Mapa de atributos del diccionario y escalas: clave en minúscula -> valores normalizados y tipo de dato. */
export function buildDimensionValuesMap(
  templates: readonly VariantDimensionTemplateDto[]
): Map<string, DimensionLookup> {
  const map = new Map<string, DimensionLookup>()

  templates.forEach((t) => {
    try {
      const parsed = JSON.parse(t.predefinedValuesJson)
      if (!Array.isArray(parsed) || parsed.length === 0) return

      const isColor = (t.dimensionType || '').toLowerCase() === 'color' || isColorDimension(t.name)
      const dataType = (t.dataType || (isColor ? 'color' : 'text')).trim().toLowerCase()

      const entry: DimensionLookup = {
        values: parsed.map(String),
        isColor: isColor || dataType === 'color',
        dataType,
        isVariantAxis: t.isVariantAxis !== false,
        unit: t.unit ?? null,
      }
      const lowerName = t.name.trim().toLowerCase()
      if (!map.has(lowerName)) map.set(lowerName, entry)

      const lowerType = (t.dimensionType || '').trim().toLowerCase()
      if (lowerType && !map.has(lowerType)) map.set(lowerType, entry)

      if (lowerType === 'talla' || lowerName.includes('talla')) {
        if (!map.has('talla')) map.set('talla', entry)
        if (!map.has('tallas')) map.set('tallas', entry)
        if (!map.has('size')) map.set('size', entry)
      }
      if (lowerType === 'color' || lowerName.includes('color')) {
        if (!map.has('color')) map.set('color', entry)
        if (!map.has('colores')) map.set('colores', entry)
      }
      if (lowerName.includes('caña') || lowerName.includes('altura')) {
        if (!map.has('caña')) map.set('caña', entry)
        if (!map.has('tipo de caña')) map.set('tipo de caña', entry)
        if (!map.has('altura')) map.set('altura', entry)
        if (!map.has('caña / altura')) map.set('caña / altura', entry)
      }
      if (lowerName.includes('actividad') || lowerType.includes('actividad')) {
        if (!map.has('actividad')) map.set('actividad', entry)
        if (!map.has('disciplina')) map.set('disciplina', entry)
      }
    } catch {
      // Plantillas con JSON inválido se ignoran
    }
  })

  return map
}

export function resolveAttributeLookup(
  map: Map<string, DimensionLookup> | undefined,
  attributeKey: string
): DimensionLookup | undefined {
  return map?.get(attributeKey.trim().toLowerCase())
}

export type ArchetypeAttributeField = {
  key: string
  levelName: string
  levelIndex: number
}

export type PhotoScope = 'variant' | 'group' | 'model'

/**
 * Alcance de captura fotográfica declarado en el arquetipo.
 * Gana el más consolidado: modelo > grupo > variante.
 */
export function resolvePhotoScope(levels: readonly ProductTemplateLevel[]): PhotoScope {
  if (levels.some((l) => l.photoScope === 'model')) return 'model'
  if (levels.some((l) => l.photoScope === 'group')) return 'group'
  return 'variant'
}

function resolveIsVariantAxis(
  map: Map<string, DimensionLookup> | undefined,
  attributeKey: string,
  levelIndex: number,
  totalLevels: number
): boolean {
  const lookup = resolveAttributeLookup(map, attributeKey)
  if (lookup) return lookup.isVariantAxis !== false

  // Sin metadatos tipados: el nivel terminal genera ejes; arriba solo los colores.
  if (levelIndex >= totalLevels) return true
  return isColorDimension(attributeKey)
}

/** Atributos del modelo: todo atributo declarado como no-eje (isVariantAxis=false) y, sin tipado, los intermedios no-color. */
export function getModelAttributeFields(
  levels: readonly ProductTemplateLevel[],
  map?: Map<string, DimensionLookup>
): ArchetypeAttributeField[] {
  if (levels.length === 0) return []

  const seen = new Set<string>()
  const fields: ArchetypeAttributeField[] = []

  levels.forEach((lvl, idx) => {
    const names = lvl.attributes.length > 0 ? lvl.attributes : [lvl.name]
    names.forEach((attr) => {
      const clean = attr.trim()
      const lower = clean.toLowerCase()
      if (!clean || seen.has(lower)) return
      if (resolveIsVariantAxis(map, clean, idx + 1, levels.length)) return
      seen.add(lower)
      fields.push({ key: clean, levelName: lvl.name, levelIndex: idx + 1 })
    })
  })

  return fields
}

/** Ejes físicos: atributos declarados como eje (isVariantAxis=true), con heurística de color/terminal como respaldo. */
export function getVariantDimensionFields(
  levels: readonly ProductTemplateLevel[],
  map?: Map<string, DimensionLookup>
): ArchetypeAttributeField[] {
  if (levels.length === 0) return []

  const seen = new Set<string>()
  const fields: ArchetypeAttributeField[] = []

  const push = (attr: string, levelName: string, levelIndex: number) => {
    const clean = attr.trim()
    const lower = clean.toLowerCase()
    if (!clean || seen.has(lower)) return
    seen.add(lower)
    fields.push({ key: clean, levelName, levelIndex })
  }

  const isTerminal = (idx: number) => idx === levels.length - 1

  levels.forEach((lvl, idx) => {
    const names = lvl.attributes.length > 0 ? lvl.attributes : isTerminal(idx) ? [lvl.name] : []
    names.forEach((attr) => {
      if (!resolveIsVariantAxis(map, attr, idx + 1, levels.length)) return
      push(attr, lvl.name, idx + 1)
    })
  })

  return fields
}

export function buildHierarchyPathJson(
  levels: readonly ProductTemplateLevel[],
  attributes: readonly { key: string; value: string }[],
  map?: Map<string, DimensionLookup>
): string | null {
  const fields = getModelAttributeFields(levels, map)
  if (fields.length === 0) return null

  const entries: HierarchyPathEntry[] = []
  fields.forEach((field) => {
    const lower = field.key.toLowerCase()
    const row = attributes.find((a) => a.key.trim().toLowerCase() === lower)
    const value = row?.value.trim()
    if (!value) return
    entries.push({ level: field.levelName.trim(), name: field.key, value })
  })

  return entries.length > 0 ? JSON.stringify(entries) : null
}

import type {
  HierarchyPathEntry,
  ProductTemplateLevel,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'

const VARIANT_DIMENSION_NAMES = new Set(['talla', 'tallas', 'size', 'color', 'colores'])

export type DimensionLookup = {
  values: string[]
  isColor: boolean
}

export function isColorDimension(name: string, type?: string, tplId?: string): boolean {
  const nameLower = (name || '').toLowerCase().trim()
  const typeLower = (type || '').toLowerCase().trim()
  return nameLower.includes('color') || typeLower.includes('color') || tplId === 'system-colors'
}

/** Mapa de atributos del diccionario y escalas: clave en minúscula -> valores normalizados. */
export function buildDimensionValuesMap(
  templates: readonly VariantDimensionTemplateDto[]
): Map<string, DimensionLookup> {
  const map = new Map<string, DimensionLookup>()

  templates.forEach((t) => {
    try {
      const parsed = JSON.parse(t.predefinedValuesJson)
      if (!Array.isArray(parsed) || parsed.length === 0) return

      const entry: DimensionLookup = {
        values: parsed.map(String),
        isColor: (t.dimensionType || '').toLowerCase() === 'color' || isColorDimension(t.name),
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

export type ArchetypeAttributeField = {
  key: string
  levelName: string
  levelIndex: number
}

/** Atributos del modelo: niveles intermedios (todos menos el terminal), excluyendo ejes variables talla/color. */
export function getModelAttributeFields(
  levels: readonly ProductTemplateLevel[]
): ArchetypeAttributeField[] {
  if (levels.length <= 1) return []

  const seen = new Set<string>()
  const fields: ArchetypeAttributeField[] = []

  levels.slice(0, levels.length - 1).forEach((lvl, idx) => {
    const names = lvl.attributes.length > 0 ? lvl.attributes : [lvl.name]
    names.forEach((attr) => {
      const clean = attr.trim()
      const lower = clean.toLowerCase()
      if (!clean || VARIANT_DIMENSION_NAMES.has(lower) || seen.has(lower)) return
      seen.add(lower)
      fields.push({ key: clean, levelName: lvl.name, levelIndex: idx + 1 })
    })
  })

  return fields
}

/** Ejes físicos: atributos del nivel terminal más cualquier atributo de color de niveles intermedios. */
export function getVariantDimensionFields(
  levels: readonly ProductTemplateLevel[]
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

  levels.slice(0, -1).forEach((lvl, idx) => {
    lvl.attributes.forEach((attr) => {
      if (isColorDimension(attr)) push(attr, lvl.name, idx + 1)
    })
  })

  const terminal = levels[levels.length - 1]
  const terminalAttributes = terminal.attributes.length > 0 ? terminal.attributes : [terminal.name]
  terminalAttributes.forEach((attr) => push(attr, terminal.name, levels.length))

  return fields
}

export function buildHierarchyPathJson(
  levels: readonly ProductTemplateLevel[],
  attributes: readonly { key: string; value: string }[]
): string | null {
  const fields = getModelAttributeFields(levels)
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

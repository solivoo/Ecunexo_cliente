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
  dimensionType: string
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
      const lowerType = (t.dimensionType || '').trim().toLowerCase()

      const entry: DimensionLookup = {
        values: parsed.map(String),
        isColor: isColor || dataType === 'color',
        dataType,
        isVariantAxis: t.isVariantAxis !== false,
        unit: t.unit ?? null,
        dimensionType: lowerType,
      }
      const lowerName = t.name.trim().toLowerCase()
      if (!map.has(lowerName)) map.set(lowerName, entry)

      if (lowerType && !map.has(lowerType)) map.set(lowerType, entry)

      if (lowerType === 'size' || lowerType === 'talla' || lowerName.includes('talla')) {
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

export type TemplateDimension = {
  name: string
  values?: string[]
  isColor?: boolean
  photoGroup?: boolean
  type: 'color' | 'size' | 'custom'
}

/** Ejes declarados explícitamente para compartir fotos (normalizados a minúsculas). */
export function resolvePhotoGroupBy(levels: readonly ProductTemplateLevel[]): string[] {
  return levels
    .flatMap((lvl) => lvl.photoGroupBy ?? [])
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
}

export function isSizeAxisName(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return (
    lower.includes('talla') ||
    lower.includes('size') ||
    lower.includes('medida') ||
    lower.includes('numero') ||
    lower.includes('número')
  )
}

/**
 * Un eje comparte fotos cuando el alcance es `group` y está declarado en `photoGroupBy`;
 * sin declaración explícita se agrupan todos los ejes que no sean tallas/medidas.
 * `isSize` permite reconocer escalas del diccionario cuyo nombre no contiene «talla».
 */
export function isPhotoGroupAxis(
  axisName: string,
  photoScope: PhotoScope,
  explicitGroupBy: readonly string[],
  isSize = isSizeAxisName(axisName)
): boolean {
  if (photoScope !== 'group') return false
  const lower = axisName.trim().toLowerCase()
  if (explicitGroupBy.length > 0) return explicitGroupBy.includes(lower)
  return !isSize
}

/**
 * Deriva las dimensiones físicas (ejes) del arquetipo igual que el alta de ítems:
 * terminal + escalas de talla/color que ascienden, tipadas y con su flag de agrupación de fotos.
 */
export function resolveTemplateDimensions(
  levels: readonly ProductTemplateLevel[],
  map: Map<string, DimensionLookup>
): TemplateDimension[] | undefined {
  if (levels.length === 0) return undefined

  const photoScope = resolvePhotoScope(levels)
  const explicitGroupBy = resolvePhotoGroupBy(levels)
  const dims: TemplateDimension[] = []
  const seen = new Set<string>()

  const push = (rawName: string) => {
    const clean = rawName.trim()
    const lower = clean.toLowerCase()
    if (
      !clean ||
      lower === 'tags' ||
      lower === 'tag' ||
      lower.includes('actividad') ||
      lower.includes('variante') ||
      lower.includes('física')
    ) {
      return
    }
    if (seen.has(lower)) return
    seen.add(lower)

    const found =
      map.get(lower) ||
      (lower.includes('talla') ? map.get('talla') : undefined) ||
      (lower.includes('color') ? map.get('color') : undefined)

    const isSize = found?.dimensionType === 'size' || isSizeAxisName(clean)
    const isColor = found?.isColor || isColorDimension(clean)

    dims.push({
      name: clean,
      values: found?.values,
      isColor,
      photoGroup: isPhotoGroupAxis(clean, photoScope, explicitGroupBy, isSize),
      type: isColor ? 'color' : isSize || found?.dimensionType === 'size' ? 'size' : 'custom',
    })
  }

  getVariantDimensionFields(levels, map).forEach((field) => push(field.key))

  if (levels.some((lvl) => lvl.hasColor) && !dims.some((d) => d.isColor)) {
    dims.push({
      name: 'Color',
      values: [],
      isColor: true,
      photoGroup: isPhotoGroupAxis('Color', photoScope, explicitGroupBy),
      type: 'color',
    })
  }

  if (dims.length === 0) {
    const sizeFound = map.get('talla') || map.get('tallas')
    dims.push({
      name: 'Talla',
      values: sizeFound?.values || ['35-38', '39-41', '42-44'],
      isColor: false,
      photoGroup: false,
      type: 'size',
    })
  }

  return dims
}

/**
 * Regla de posición + metadatos:
 * - Nivel terminal: manda el diccionario (`isVariantAxis=false` ⇒ descriptivo); sin diccionario, es eje.
 * - Niveles intermedios: ascienden los colores y los atributos del diccionario marcados como ejes
 *   (ej. una escala de tallas reutilizable); el texto libre (Marca, Material, Colección…) queda
 *   como ficha del modelo.
 */
export function resolveIsVariantAxis(
  map: Map<string, DimensionLookup> | undefined,
  attributeKey: string,
  levelIndex: number,
  totalLevels: number
): boolean {
  const lookup = resolveAttributeLookup(map, attributeKey)
  const isTerminal = levelIndex >= totalLevels

  if (isTerminal) {
    if (lookup) return lookup.isVariantAxis !== false
    return true
  }

  if (lookup) return lookup.isColor || lookup.isVariantAxis !== false
  return isColorDimension(attributeKey)
}

/** Atributos del modelo: descriptivos de niveles intermedios; los descriptivos del terminal se capturan por variante. */
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
      if (idx === levels.length - 1) return
      seen.add(lower)
      fields.push({ key: clean, levelName: lvl.name, levelIndex: idx + 1 })
    })
  })

  return fields
}

/** Atributos descriptivos declarados en el nivel terminal: se capturan por variante (no generan SKU). */
export function getVariantAttributeFields(
  levels: readonly ProductTemplateLevel[],
  map?: Map<string, DimensionLookup>
): ArchetypeAttributeField[] {
  if (levels.length === 0) return []

  const terminalIndex = levels.length - 1
  const terminal = levels[terminalIndex]
  const names = terminal.attributes.length > 0 ? terminal.attributes : [terminal.name]
  const seen = new Set<string>()
  const fields: ArchetypeAttributeField[] = []

  names.forEach((attr) => {
    const clean = attr.trim()
    const lower = clean.toLowerCase()
    if (!clean || seen.has(lower)) return
    if (resolveIsVariantAxis(map, clean, levels.length, levels.length)) return
    seen.add(lower)
    fields.push({ key: clean, levelName: terminal.name, levelIndex: levels.length })
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

export function findDuplicateSkuValues(skus: readonly string[]): string[] {
  const seen = new Map<string, string>()
  const duplicates = new Map<string, string>()

  for (const raw of skus) {
    const clean = raw.trim()
    if (!clean) continue
    const key = clean.toUpperCase()
    const first = seen.get(key)
    if (first !== undefined) {
      if (!duplicates.has(key)) duplicates.set(key, first)
      continue
    }
    seen.set(key, clean)
  }

  return Array.from(duplicates.values())
}

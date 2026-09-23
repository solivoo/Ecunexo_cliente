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

export type TemplatePhotoChoice = 'none' | PhotoScope

/** La plantilla declara ejes de forma explícita (aunque alguna lista vaya vacía). */
export function templateDeclaresAxes(levels: readonly ProductTemplateLevel[]): boolean {
  return levels.some((lvl) => Array.isArray(lvl.axes))
}

/**
 * Separa datos y ejes para mostrar y editar.
 * Las plantillas nuevas ya traen `axes`. Las anteriores se parten con la regla
 * de diccionario y posición, y el color suelto del nivel entra como eje.
 */
export function normalizeTemplateLevels(
  levels: readonly ProductTemplateLevel[],
  map?: Map<string, DimensionLookup>
): ProductTemplateLevel[] {
  if (templateDeclaresAxes(levels)) {
    return levels.map((lvl) => ({
      ...lvl,
      attributes: lvl.attributes ?? [],
      axes: lvl.axes ?? [],
    }))
  }

  return levels.map((lvl, idx) => {
    const data: string[] = []
    const axes: string[] = []
    for (const attr of lvl.attributes ?? []) {
      const clean = attr.trim()
      if (!clean) continue
      if (resolveIsVariantAxis(map, clean, idx + 1, levels.length)) axes.push(clean)
      else data.push(clean)
    }
    if (lvl.hasColor && !axes.some((name) => isColorDimension(name))) {
      axes.push('Color')
    }
    return { ...lvl, attributes: data, axes }
  })
}

export function readPhotoChoice(levels: readonly ProductTemplateLevel[]): {
  choice: TemplatePhotoChoice
  groupBy: string[]
} {
  if (levels.some((lvl) => lvl.photoScope === 'model')) {
    return { choice: 'model', groupBy: [] }
  }
  if (levels.some((lvl) => lvl.photoScope === 'group')) {
    return { choice: 'group', groupBy: resolvePhotoGroupBy(levels) }
  }
  if (levels.some((lvl) => lvl.photoScope === 'variant' || (lvl.hasImages && !lvl.photoScope))) {
    return { choice: 'variant', groupBy: [] }
  }
  return { choice: 'none', groupBy: [] }
}

/** Una sola decisión de fotos para toda la plantilla, anclada a un nivel. */
export function writePhotoChoice(
  levels: readonly ProductTemplateLevel[],
  choice: TemplatePhotoChoice,
  groupBy: readonly string[] = []
): ProductTemplateLevel[] {
  const last = levels.length - 1
  return levels.map((lvl, idx) => {
    const isAnchor = choice === 'model' ? idx === 0 : idx === last
    if (choice === 'none' || !isAnchor) {
      return { ...lvl, photoScope: 'none' as const, hasImages: false, photoGroupBy: [] }
    }
    return {
      ...lvl,
      photoScope: choice,
      hasImages: true,
      photoGroupBy: choice === 'group' ? [...groupBy] : [],
    }
  })
}

export function describeTemplateLine(
  levels: readonly ProductTemplateLevel[],
  map?: Map<string, DimensionLookup>
): string {
  const source = templateDeclaresAxes(levels) ? levels : normalizeTemplateLevels(levels, map)
  const segments = source
    .map((lvl) => {
      const data = (lvl.attributes ?? []).map((name) => name.trim()).filter(Boolean)
      const axes = (lvl.axes ?? []).map((name) => name.trim()).filter(Boolean)
      const title = lvl.name.trim() || 'Nivel'
      if (data.length > 0 && axes.length > 0) {
        return `${title} (${data.join(', ')}) · ${axes.join(' × ')}`
      }
      if (data.length > 0) return `${title} (${data.join(', ')})`
      if (axes.length > 0) return axes.join(' × ')
      return title
    })
    .filter(Boolean)

  const { choice, groupBy } = readPhotoChoice(levels)
  const photo =
    choice === 'none'
      ? 'Sin fotos'
      : choice === 'model'
        ? 'Fotos del producto'
        : choice === 'variant'
          ? 'Fotos por cada código'
          : `Fotos por ${groupBy.join(' + ') || 'eje'}`

  const hasAxes = source.some((lvl) => (lvl.axes ?? []).some((name) => name.trim()))
  const body = segments.join(' › ') || 'Sin niveles'
  return hasAxes ? `${body}. ${photo}.` : `${body}. Un solo código. ${photo}.`
}

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

  if (templateDeclaresAxes(levels)) {
    const declared = getVariantDimensionFields(levels, map)
    if (declared.length === 0) return undefined
  }

  const photoScope = resolvePhotoScope(levels)
  const explicitGroupBy = resolvePhotoGroupBy(levels)
  const dims: TemplateDimension[] = []
  const seen = new Set<string>()

  const push = (rawName: string) => {
    const clean = rawName.trim()
    const lower = clean.toLowerCase()
    const explicitAxes = templateDeclaresAxes(levels)
    if (
      !clean ||
      lower === 'tags' ||
      lower === 'tag' ||
      (!explicitAxes &&
        (lower.includes('actividad') || lower.includes('variante') || lower.includes('física')))
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

  if (templateDeclaresAxes(levels)) {
    return dims.length > 0 ? dims : undefined
  }

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

  if (templateDeclaresAxes(levels)) {
    const axisNames = new Set(
      levels.flatMap((lvl) => (lvl.axes ?? []).map((name) => name.trim().toLowerCase()))
    )
    levels.forEach((lvl, idx) => {
      lvl.attributes.forEach((attr) => {
        const clean = attr.trim()
        const lower = clean.toLowerCase()
        if (!clean || seen.has(lower) || axisNames.has(lower)) return
        seen.add(lower)
        fields.push({ key: clean, levelName: lvl.name, levelIndex: idx + 1 })
      })
    })
    return fields
  }

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

  if (templateDeclaresAxes(levels)) return []

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

  if (templateDeclaresAxes(levels)) {
    levels.forEach((lvl, idx) => {
      ;(lvl.axes ?? []).forEach((attr) => push(attr, lvl.name, idx + 1))
    })
    return fields
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

const HEX_TOKEN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function isHexColorToken(value: string): boolean {
  return HEX_TOKEN.test(value.trim())
}

/** Quita el nombre del padre (incluso repetido) y los hex; deja solo la variación legible. */
export function formatVariantDisplayName(fullName: string, parentName?: string | null): string {
  let label = (fullName || '').trim()
  if (!label) return '—'

  const parent = (parentName || '').trim()
  if (parent) {
    const prefix = `${parent} - `
    while (label.toLowerCase().startsWith(prefix.toLowerCase())) {
      label = label.slice(prefix.length).trim()
    }
    if (label.toLowerCase() === parent.toLowerCase()) {
      return '—'
    }
  }

  const parts = label
    .split(/\s*[·/|,]\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isHexColorToken(part))

  if (parts.length === 0) {
    return label.replace(HEX_TOKEN, '').replace(/\s*[·/|,]\s*/g, ' · ').replace(/\s+/g, ' ').trim() || '—'
  }

  const seen = new Set<string>()
  const unique: string[] = []
  for (const part of parts) {
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(part)
  }

  return unique.join(' · ')
}

export type VariantAdminSummary = {
  sku: string
  axisLines: { name: string; value: string; isColor: boolean }[]
  fallbackLabel: string
}

/** Etiqueta corta para modales y auditoría (SKU + ejes; sin nombre largo del padre). */
export function buildVariantAdminSummary(
  variant: {
    sku?: string | null
    name?: string | null
    dimensionValues?: Record<string, string> | null
    customAttributesJson?: string | null
  },
  parentName?: string | null,
  axes?: readonly { name: string; type?: string }[]
): VariantAdminSummary {
  const sku = variant.sku?.trim() || 'Sin SKU'
  const axisLines: VariantAdminSummary['axisLines'] = []

  const attrs: Record<string, string> = {}
  if (variant.dimensionValues) {
    for (const [k, v] of Object.entries(variant.dimensionValues)) {
      if (v?.trim()) attrs[k] = v.trim()
    }
  }
  if (Object.keys(attrs).length === 0 && variant.customAttributesJson) {
    try {
      const parsed: unknown = JSON.parse(variant.customAttributesJson)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === 'string' && v.trim()) attrs[k] = v.trim()
        }
      }
    } catch {
      // ignore
    }
  }

  for (const axis of axes ?? []) {
    const target = axis.name.trim().toLowerCase()
    let value = ''
    for (const [k, v] of Object.entries(attrs)) {
      if (k.trim().toLowerCase() === target) {
        value = v
        break
      }
    }
    if (!value) continue
    axisLines.push({
      name: axis.name,
      value,
      isColor: axis.type === 'color' || isHexColorToken(value),
    })
  }

  return {
    sku,
    axisLines,
    fallbackLabel: formatVariantDisplayName(variant.name ?? '', parentName),
  }
}

import type { DimensionLookup } from '@/lib/catalogArchetype'
import { getTemplateDictionaryAttributes } from '@/lib/catalogBaseAttributes'
import type { CustomAttributeRow } from '@/pages/catalog/ItemCustomAttributesEditor'
import type { VariantDimensionTemplateDto } from '@/types/catalogApi'
import {
  createVariantDimensionTemplate,
  listVariantDimensionTemplates,
  updateVariantDimensionTemplate,
} from '@/services/catalogApi'

export type NamedColor = {
  name: string
  hex: string
}

const HEX_RE = /^#?[0-9A-Fa-f]{6}$/

export function normalizeHexColor(value: string): string {
  const t = value.trim()
  if (!HEX_RE.test(t)) return ''
  return t.startsWith('#') ? `#${t.slice(1).toUpperCase()}` : `#${t.toUpperCase()}`
}

export function parseNamedColorsJson(json: string | null | undefined): NamedColor[] {
  if (!json?.trim()) return []
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return []
    const out: NamedColor[] = []
    const seen = new Set<string>()
    for (const entry of parsed) {
      if (typeof entry === 'string') {
        const raw = entry.trim()
        if (!raw) continue
        const asHex = normalizeHexColor(raw)
        const name = asHex || raw
        const hex = asHex || '#808080'
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ name, hex })
        continue
      }
      if (entry && typeof entry === 'object') {
        const rec = entry as Record<string, unknown>
        const name = typeof rec.name === 'string' ? rec.name.trim() : ''
        const hex = normalizeHexColor(typeof rec.hex === 'string' ? rec.hex : '')
        if (!name || !hex) continue
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ name, hex })
      }
    }
    return out
  } catch {
    return []
  }
}

export function serializeNamedColors(colors: readonly NamedColor[]): string {
  return JSON.stringify(
    colors.map((c) => ({
      name: c.name.trim(),
      hex: normalizeHexColor(c.hex),
    }))
  )
}

export function namedColorsToHexMap(colors: readonly NamedColor[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of colors) {
    map[c.name] = c.hex
    map[c.name.toLowerCase()] = c.hex
    map[c.hex] = c.hex
  }
  return map
}

/** Paleta del atributo Color sistema desde el mapa de dimensiones. */
export function paletteFromDimensionMap(
  map: Map<string, DimensionLookup> | undefined
): NamedColor[] {
  if (!map) return []
  const lookup = map.get('color') ?? map.get('colores')
  if (!lookup?.isColor || !lookup.values?.length) return []
  return lookup.values.map((name) => ({
    name,
    hex:
      lookup.colorHexByName?.[name] ??
      lookup.colorHexByName?.[name.toLowerCase()] ??
      '#808080',
  }))
}

const COLOR_ATTR_KEYS = new Set(['color', 'colores', 'color_hex', 'colores_hex'])

/** Lee los colores nombrados guardados en atributos custom (vacío = ninguno). Separados por coma. */
export function readNamedColorsFromAttributes(
  rows: readonly { key: string; value: string }[]
): string[] {
  for (const row of rows) {
    const k = row.key.trim().toLowerCase()
    if (k === 'color' || k === 'colores') {
      const names = row.value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      if (names.length) return names
    }
  }
  return []
}

/**
 * Persiste Color (+ color_hex) en atributos custom; varios colores van separados por coma.
 * Si `colorNames` está vacío, elimina claves de color.
 */
export function upsertNamedColorAttributes(
  rows: readonly CustomAttributeRow[],
  colorNames: readonly string[],
  palette: readonly NamedColor[]
): CustomAttributeRow[] {
  const cleaned = rows.filter((r) => !COLOR_ATTR_KEYS.has(r.key.trim().toLowerCase()))
  const names = colorNames.map((n) => n.trim()).filter(Boolean)
  if (!names.length) return cleaned
  const hexes = names.map(
    (n) => palette.find((c) => c.name.toLowerCase() === n.toLowerCase())?.hex ?? ''
  )
  const next: CustomAttributeRow[] = [
    ...cleaned,
    { id: `attr-color-${Date.now()}`, key: 'Color', value: names.join(', ') },
  ]
  if (hexes.every(Boolean)) {
    next.push({ id: `attr-color-hex-${Date.now()}`, key: 'color_hex', value: hexes.join(', ') })
  }
  return next
}

/** Fila Color del sistema (overlay tenant o DTO virtual system-colors). */
export function findSystemColorAttribute(
  templates: readonly VariantDimensionTemplateDto[]
): VariantDimensionTemplateDto | undefined {
  const byId = templates.find((t) => t.id === 'system-colors')
  if (byId) return byId
  return templates.find((t) => {
    const n = t.name.trim().toLowerCase()
    return (
      n === 'color' ||
      n === 'colores' ||
      (t.dimensionType || '').toLowerCase() === 'color' ||
      (t.dataType || '').toLowerCase() === 'color'
    )
  })
}

export function isSystemColorAttribute(template: VariantDimensionTemplateDto): boolean {
  if (template.id === 'system-colors') return true
  const n = template.name.trim().toLowerCase()
  return (
    Boolean(template.isSystemBase) &&
    (n === 'color' ||
      n === 'colores' ||
      (template.dimensionType || '').toLowerCase() === 'color' ||
      template.id.startsWith('system-colors'))
  )
}

/**
 * Añade (o actualiza hex) un color nombrado en la paleta Color del sistema.
 * Crea la fila overlay tenant si aún es virtual.
 */
export async function upsertSystemNamedColor(
  tenantId: string,
  color: NamedColor,
  currentTemplates?: readonly VariantDimensionTemplateDto[]
): Promise<{ colors: NamedColor[]; templates: VariantDimensionTemplateDto[] }> {
  const name = color.name.trim()
  const hex = normalizeHexColor(color.hex)
  if (!name) throw new Error('El nombre del color es obligatorio.')
  if (!hex) throw new Error('El hexadecimal del color no es válido.')

  const tenantRows = currentTemplates
    ? currentTemplates.filter((t) => t.id !== 'system-colors' && !t.isSystemDefault)
    : await listVariantDimensionTemplates(tenantId)
  const merged = getTemplateDictionaryAttributes(tenantRows, tenantId)
  const overlay =
    tenantRows.find((t) => t.name.trim().toLowerCase() === 'color') ??
    tenantRows.find((t) => (t.dimensionType || '').toLowerCase() === 'color')

  const existingColors = parseNamedColorsJson(
    overlay?.predefinedValuesJson ??
      findSystemColorAttribute(merged)?.predefinedValuesJson ??
      '[]'
  )

  const idx = existingColors.findIndex((c) => c.name.toLowerCase() === name.toLowerCase())
  const nextColors =
    idx >= 0
      ? existingColors.map((c, i) => (i === idx ? { name: existingColors[idx].name, hex } : c))
      : [...existingColors, { name, hex }]

  const payloadJson = serializeNamedColors(nextColors)

  if (overlay && overlay.id !== 'system-colors' && !overlay.isSystemDefault) {
    await updateVariantDimensionTemplate(tenantId, overlay.id, {
      name: overlay.name,
      dimensionType: 'color',
      predefinedValuesJson: payloadJson,
      dataType: 'color',
      isVariantAxis: true,
      unit: null,
    })
  } else {
    await createVariantDimensionTemplate(tenantId, {
      name: 'Color',
      dimensionType: 'color',
      predefinedValuesJson: payloadJson,
      dataType: 'color',
      isVariantAxis: true,
      unit: null,
    })
  }

  const refreshed = await listVariantDimensionTemplates(tenantId)
  return {
    colors: nextColors,
    templates: getTemplateDictionaryAttributes(refreshed, tenantId),
  }
}

export async function saveSystemNamedColors(
  tenantId: string,
  colors: readonly NamedColor[]
): Promise<VariantDimensionTemplateDto[]> {
  const tenantRows = await listVariantDimensionTemplates(tenantId)
  const overlay =
    tenantRows.find((t) => t.name.trim().toLowerCase() === 'color') ??
    tenantRows.find((t) => (t.dimensionType || '').toLowerCase() === 'color')

  const payloadJson = serializeNamedColors(colors)

  if (overlay && overlay.id !== 'system-colors' && !overlay.isSystemDefault) {
    await updateVariantDimensionTemplate(tenantId, overlay.id, {
      name: overlay.name,
      dimensionType: 'color',
      predefinedValuesJson: payloadJson,
      dataType: 'color',
      isVariantAxis: true,
      unit: null,
    })
  } else {
    await createVariantDimensionTemplate(tenantId, {
      name: 'Color',
      dimensionType: 'color',
      predefinedValuesJson: payloadJson,
      dataType: 'color',
      isVariantAxis: true,
      unit: null,
    })
  }

  return getTemplateDictionaryAttributes(await listVariantDimensionTemplates(tenantId), tenantId)
}

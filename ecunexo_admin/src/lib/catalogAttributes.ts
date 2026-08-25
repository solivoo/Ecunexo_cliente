import type { CatalogAttributeField } from '@/types/catalogApi'

export function parseAttributeSchema(raw: string | null | undefined): CatalogAttributeField[] {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const fields: CatalogAttributeField[] = []
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue
      const rec = entry as Record<string, unknown>
      const key = typeof rec.key === 'string' ? rec.key.trim() : ''
      if (!key) continue
      fields.push({
        key,
        label: typeof rec.label === 'string' ? rec.label : key,
        type: typeof rec.type === 'string' ? rec.type : 'string',
        required: rec.required === true,
      })
    }
    return fields
  } catch {
    return []
  }
}

/** Clave técnica estable a partir de la etiqueta visible (el usuario no edita JSON). */
export function slugifyAttributeKey(label: string, fallbackIndex: number): string {
  const base = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base || `campo_${fallbackIndex + 1}`
}

export function serializeAttributeSchema(
  fields: readonly CatalogAttributeField[]
): string {
  const used = new Set<string>()
  const payload: CatalogAttributeField[] = []

  fields.forEach((field, index) => {
    const label = (field.label ?? field.key).trim()
    if (!label) return

    let key = (field.key?.trim() || slugifyAttributeKey(label, index)).slice(0, 40)
    if (!key) key = `campo_${index + 1}`
    if (used.has(key)) {
      let n = 2
      while (used.has(`${key}_${n}`)) n += 1
      key = `${key}_${n}`
    }
    used.add(key)

    const type =
      field.type === 'number' || field.type === 'boolean' || field.type === 'color'
        ? field.type
        : 'string'

    payload.push({
      key,
      label,
      type,
      required: field.required === true,
    })
  })

  return JSON.stringify(payload)
}

export function parseAttributeValues(raw: string | null | undefined): Record<string, string> {
  if (!raw?.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const values: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === null || value === undefined) continue
      if (Array.isArray(value)) {
        values[key] = JSON.stringify(value)
        continue
      }
      values[key] = String(value)
    }
    return values
  } catch {
    return {}
  }
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function isColorAttributeField(field: CatalogAttributeField): boolean {
  if (field.type === 'color') return true
  const key = field.key.trim().toLowerCase()
  const label = (field.label ?? '').trim().toLowerCase()
  return key === 'color' || key === 'colores' || key === 'colour' || label === 'color' || label === 'colores'
}

export function parseColorList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  const trimmed = raw.trim()
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    }
  } catch {
    /* un solo valor suelto (hex o nombre legado) */
  }
  return [trimmed]
}

export function serializeColorList(colors: readonly string[]): string {
  return JSON.stringify([...colors])
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim())
}

export function missingRequiredAttributeLabel(
  fields: readonly CatalogAttributeField[],
  values: Record<string, string>
): string | null {
  for (const field of fields) {
    if (!field.required) continue
    if (isColorAttributeField(field)) {
      if (parseColorList(values[field.key]).length === 0) return field.label ?? field.key
      continue
    }
    if (!(values[field.key] ?? '').trim()) return field.label ?? field.key
  }
  return null
}

export function serializeAttributeValues(
  fields: readonly CatalogAttributeField[],
  values: Record<string, string>
): string {
  const obj: Record<string, string | number | boolean | string[]> = {}
  for (const field of fields) {
    const raw = values[field.key]?.trim() ?? ''
    if (!raw) continue
    if (isColorAttributeField(field)) {
      const colors = parseColorList(raw)
      if (colors.length > 0) obj[field.key] = colors
      continue
    }
    if (field.type === 'number') {
      const n = Number(raw.replace(',', '.'))
      if (!Number.isNaN(n)) obj[field.key] = n
      continue
    }
    if (field.type === 'boolean') {
      obj[field.key] = raw === 'true' || raw === '1'
      continue
    }
    obj[field.key] = raw
  }
  return JSON.stringify(obj)
}

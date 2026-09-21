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

/** Nombres técnicos o etiquetas reservados que ya existen de forma nativa en el ítem */
export const RESERVED_ATTRIBUTE_KEYS = new Set([
  'name',
  'nombre',
  'sku',
  'codigo',
  'codigo_sku',
  'codigosku',
  'referencia',
  'price',
  'precio',
  'baseprice',
  'precio_base',
  'base_price',
  'description',
  'descripcion',
  'category',
  'categoria',
  'categoryid',
  'kind',
  'tipo',
  'status',
  'estado',
])

export function isReservedAttributeKey(keyOrLabel: string): boolean {
  const norm = slugifyAttributeKey(keyOrLabel, 0).toLowerCase()
  return RESERVED_ATTRIBUTE_KEYS.has(norm)
}

export type AttributeSchemaValidationError = {
  rowId?: string
  fieldIndex: number
  message: string
}

export function validateAttributeSchemaFields(
  fields: readonly { rowId?: string; label?: string; key?: string }[]
): AttributeSchemaValidationError | null {
  const seenLabels = new Set<string>()
  const seenKeys = new Set<string>()

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const label = (f.label ?? '').trim()
    if (!label) {
      return {
        rowId: f.rowId,
        fieldIndex: i,
        message: `El campo ${i + 1} requiere un nombre o etiqueta.`,
      }
    }

    const normLabel = label.toLowerCase()
    if (seenLabels.has(normLabel)) {
      return {
        rowId: f.rowId,
        fieldIndex: i,
        message: `El campo «${label}» está repetido. Cada atributo debe tener un nombre único.`,
      }
    }
    seenLabels.add(normLabel)

    if (isReservedAttributeKey(label)) {
      return {
        rowId: f.rowId,
        fieldIndex: i,
        message: `«${label}» ya existe como campo estándar del ítem (Nombre, SKU, Precio, etc.). No se debe duplicar.`,
      }
    }

    const key = (f.key?.trim() || slugifyAttributeKey(label, i)).toLowerCase()
    if (seenKeys.has(key)) {
      return {
        rowId: f.rowId,
        fieldIndex: i,
        message: `La clave técnica del campo «${label}» coincide con otro campo. Elige un nombre distinto.`,
      }
    }
    seenKeys.add(key)
  }

  return null
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

export type DisplayAttributeEntry = {
  group?: string
  key: string
  label: string
  value: string
}

function humanizeAttributeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export function flattenAttributeEntries(raw: string | null | undefined): DisplayAttributeEntry[] {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []

    const results: DisplayAttributeEntry[] = []

    function traverse(obj: Record<string, unknown>, currentGroup?: string) {
      for (const [key, val] of Object.entries(obj)) {
        if (val === null || val === undefined) continue

        if (typeof val === 'object' && !Array.isArray(val)) {
          const groupName = currentGroup
            ? `${currentGroup} · ${humanizeAttributeKey(key)}`
            : humanizeAttributeKey(key)
          traverse(val as Record<string, unknown>, groupName)
          continue
        }

        let formattedVal = ''
        if (Array.isArray(val)) {
          formattedVal = val.join(', ')
        } else if (typeof val === 'boolean') {
          formattedVal = val ? 'Sí' : 'No'
        } else {
          formattedVal = String(val)
        }

        results.push({
          group: currentGroup,
          key,
          label: humanizeAttributeKey(key),
          value: formattedVal,
        })
      }
    }

    traverse(parsed as Record<string, unknown>)
    return results
  } catch {
    return []
  }
}

export function buildAttributeSearchString(raw: string | null | undefined): string {
  const entries = flattenAttributeEntries(raw)
  return entries.map((e) => `${e.label} ${e.value}`).join(' ')
}

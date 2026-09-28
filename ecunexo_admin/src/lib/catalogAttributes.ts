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

/**
 * Descripción de línea para documentos (factura/guía) a partir del ítem de catálogo:
 * nombre + descripción (si aporta) + atributos (Marca/Modelo/Talla/Color…).
 * El backend de facturación acepta hasta 500 caracteres.
 */
export function buildLineDescriptionFromCatalogItem(item: {
  readonly name: string
  readonly description?: string | null
  readonly customAttributesJson?: string | null
}): string {
  const name = item.name.trim()
  const parts: string[] = name ? [name] : []
  const description = (item.description ?? '').trim()
  if (description && !name.toLowerCase().includes(description.toLowerCase())) {
    parts.push(description)
  }
  const attributes = flattenAttributeEntries(item.customAttributesJson)
    .map((entry) => `${entry.label}: ${entry.value}`)
    .join(' · ')
  if (attributes) parts.push(attributes)
  return parts.join(' · ').slice(0, 500)
}

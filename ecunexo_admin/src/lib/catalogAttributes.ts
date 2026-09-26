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

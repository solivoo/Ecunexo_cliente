import { findSystemBaseAttribute } from '@/lib/catalogBaseAttributes'
import { readApiError } from '@/lib/readApiError'
import {
  createVariantDimensionTemplate,
  listVariantDimensionTemplates,
  updateVariantDimensionTemplate,
} from '@/services/catalogApi'

function parseOptionNames(json: string | null | undefined): string[] {
  if (!json?.trim()) return []
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const entry of parsed) {
      const name = typeof entry === 'string' ? entry.trim() : ''
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(name)
    }
    return out
  } catch {
    return []
  }
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Agrega una opción a la lista del atributo (overlay si es base del sistema). */
export async function appendListOption(
  tenantId: string,
  attributeName: string,
  rawValue: string
): Promise<string> {
  const value = rawValue.trim()
  if (!value) throw new Error('Escribe el nombre de la opción.')

  try {
    const rows = await listVariantDimensionTemplates(tenantId)
    const key = attributeName.trim().toLowerCase()
    const overlay = rows.find((row) => row.name.trim().toLowerCase() === key)
    const system = findSystemBaseAttribute(attributeName)
    const current = overlay ? parseOptionNames(overlay.predefinedValuesJson) : [...(system?.predefinedValues ?? [])]

    if (current.some((item) => item.toLowerCase() === value.toLowerCase())) {
      return current.find((item) => item.toLowerCase() === value.toLowerCase()) ?? value
    }

    const next = [...current, value]
    const payloadJson = JSON.stringify(next)

    if (overlay && GUID_RE.test(overlay.id)) {
      await updateVariantDimensionTemplate(tenantId, overlay.id, {
        name: overlay.name,
        dimensionType: overlay.dimensionType || 'custom',
        predefinedValuesJson: payloadJson,
        dataType: overlay.dataType || 'text',
        isVariantAxis: overlay.isVariantAxis !== false,
        unit: overlay.unit ?? null,
      })
      return value
    }

    await createVariantDimensionTemplate(tenantId, {
      name: system?.name ?? attributeName.trim(),
      dimensionType: system?.dimensionType ?? overlay?.dimensionType ?? 'custom',
      predefinedValuesJson: payloadJson,
      dataType: system?.dataType ?? overlay?.dataType ?? 'text',
      isVariantAxis: system?.isVariantAxis ?? overlay?.isVariantAxis ?? false,
      unit: system?.unit ?? overlay?.unit ?? null,
    })
    return value
  } catch (err: unknown) {
    if (err instanceof Error && !('isAxiosError' in err)) throw err
    throw new Error(readApiError(err, 'No se pudo agregar la opción.'))
  }
}

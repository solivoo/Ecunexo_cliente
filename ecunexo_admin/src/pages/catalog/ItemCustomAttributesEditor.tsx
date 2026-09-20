import { useCallback, useEffect, useId, useMemo, useState, type ChangeEvent } from 'react'
import { Button, TextBox } from 'glubox'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { listVariantDimensionTemplates } from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { VariantDimensionTemplateDto } from '@/types/catalogApi'

export type CustomAttributeRow = {
  id: string
  key: string
  value: string
}

export type ItemCustomAttributesEditorProps = {
  readonly attributes: readonly CustomAttributeRow[]
  readonly onChange: (attributes: CustomAttributeRow[]) => void
  readonly categorySuggestions?: readonly string[]
  readonly disabled?: boolean
}

const DEFAULT_PRESET_SUGGESTIONS = [
  'Material',
  'Marca',
  'Garantía',
  'Origen',
  'Composición',
  'Cuidados de Lavado',
  'Modelo / Serie',
]

export function extractTagsFromCustomAttributes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>
      if (Array.isArray(p.tags)) {
        return p.tags.map(String).map((s) => s.trim().replace(/^#+/, '')).filter(Boolean)
      }
      if (typeof p.tags === 'string') {
        return p.tags.split(',').map((s) => s.trim().replace(/^#+/, '')).filter(Boolean)
      }
    }
  } catch {
    // Ignorar JSON malformado
  }
  return []
}

export function serializeCustomAttributes(
  attributes: readonly CustomAttributeRow[],
  tags?: readonly string[]
): string {
  const result: Record<string, unknown> = {}
  for (const attr of attributes) {
    const k = attr.key.trim()
    const v = attr.value.trim()
    if (k && k.toLowerCase() !== 'tags') {
      result[k] = v
    }
  }
  if (tags && tags.length > 0) {
    result['tags'] = tags.map((t) => t.trim().replace(/^#+/, '')).filter(Boolean)
  }
  return JSON.stringify(result)
}

export function deserializeCustomAttributes(raw: string | null | undefined): CustomAttributeRow[] {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([k]) => k.toLowerCase() !== 'tags')
      .map(([k, v], index) => ({
        id: `attr-${index}-${Date.now()}`,
        key: k,
        value: typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''),
      }))
  } catch {
    return []
  }
}

export function ItemCustomAttributesEditor({
  attributes,
  onChange,
  categorySuggestions = [],
  disabled = false,
}: ItemCustomAttributesEditorProps) {
  const baseId = useId()
  const tenantId = useAppSelector(selectTenantId)
  const [templates, setTemplates] = useState<VariantDimensionTemplateDto[]>([])

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void (async () => {
      try {
        const list = await listVariantDimensionTemplates(tenantId)
        if (!cancelled) setTemplates(list)
      } catch {
        if (!cancelled) setTemplates([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  // Mapa de normalización: nombre del atributo -> valores sugeridos
  const templateValuesMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const t of templates) {
      try {
        const parsed = JSON.parse(t.predefinedValuesJson)
        if (Array.isArray(parsed)) {
          const lowerName = t.name.trim().toLowerCase()
          map.set(lowerName, parsed)
          // También mapear palabras clave simplificadas (ej. "tipo de caña / altura" -> "caña")
          if (lowerName.includes('caña')) map.set('caña', parsed)
          if (lowerName.includes('manga')) map.set('manga', parsed)
          if (lowerName.includes('color')) map.set('color', parsed)
          if (lowerName.includes('talla') || lowerName.includes('medias')) map.set('talla', parsed)
        }
      } catch {
        // ignorar
      }
    }
    return map
  }, [templates])

  const currentKeysLower = useMemo(
    () => new Set(attributes.map((a) => a.key.trim().toLowerCase()).filter(Boolean)),
    [attributes]
  )

  const availableSuggestions = useMemo(() => {
    const templateNames = templates.map((t) => t.name.trim())
    const combined = [...templateNames, ...categorySuggestions, ...DEFAULT_PRESET_SUGGESTIONS]
    const seen = new Set<string>()
    const result: string[] = []
    for (const s of combined) {
      const trimmed = s.trim()
      const lower = trimmed.toLowerCase()
      if (trimmed && !seen.has(lower) && !currentKeysLower.has(lower)) {
        seen.add(lower)
        result.push(trimmed)
      }
    }
    return result.slice(0, 10)
  }, [categorySuggestions, currentKeysLower, templates])

  const handleAddRow = useCallback(
    (initialKey = '', initialValue = '') => {
      const newRow: CustomAttributeRow = {
        id: `attr-row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        key: initialKey,
        value: initialValue,
      }
      onChange([...attributes, newRow])
    },
    [attributes, onChange]
  )

  const handleUpdateRow = useCallback(
    (id: string, field: 'key' | 'value', nextVal: string) => {
      onChange(
        attributes.map((attr) => (attr.id === id ? { ...attr, [field]: nextVal } : attr))
      )
    },
    [attributes, onChange]
  )

  const handleRemoveRow = useCallback(
    (id: string) => {
      onChange(attributes.filter((attr) => attr.id !== id))
    },
    [attributes, onChange]
  )

  return (
    <div className="ecu-item-custom-attributes">
      {/* Datalist global para autocompletar nombres de atributos */}
      <datalist id={`${baseId}-known-attr-keys`}>
        {templates.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
        {DEFAULT_PRESET_SUGGESTIONS.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>

      {availableSuggestions.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '8px',
            background: 'var(--glb-surface-ground, rgba(0, 0, 0, 0.02))',
            border: '1px dashed var(--shell-border, rgba(0, 0, 0, 0.1))',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--glb-muted, #64748b)',
            }}
          >
            <Sparkles size={13} aria-hidden />
            <span>Sugerencias del diccionario:</span>
          </div>
          {availableSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={disabled}
              onClick={() => handleAddRow(suggestion)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.78rem',
                fontWeight: 500,
                padding: '0.2rem 0.55rem',
                borderRadius: '12px',
                border: '1px solid var(--shell-border, rgba(0, 0, 0, 0.15))',
                background: 'var(--glb-surface, #fff)',
                color: 'var(--glb-text, #1e293b)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={`Añadir campo «${suggestion}»`}
            >
              <Plus size={11} aria-hidden />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {attributes.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            borderRadius: '8px',
            border: '1px dashed var(--shell-border, rgba(0, 0, 0, 0.12))',
            background: 'var(--glb-surface, #fff)',
            color: 'var(--glb-muted, #64748b)',
            fontSize: '0.875rem',
          }}
        >
          <p style={{ margin: '0 0 0.85rem 0' }}>
            Este producto aún no tiene atributos ni especificaciones adicionales asignadas.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddRow()}
            disabled={disabled}
          >
            <Plus size={14} aria-hidden style={{ marginRight: '0.35rem' }} />
            + Añadir primer atributo
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 1fr) minmax(260px, 1.8fr) 44px',
              gap: '0.75rem',
              alignItems: 'center',
              paddingBottom: '0.25rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--glb-muted, #64748b)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>Nombre del Atributo</span>
            <span>Valor / Detalle Normalizado</span>
            <span style={{ textAlign: 'center' }}>Acción</span>
          </div>

          {attributes.map((attr, index) => {
            const attrKeyLower = attr.key.trim().toLowerCase()
            const suggestedValues =
              templateValuesMap.get(attrKeyLower) ??
              (attrKeyLower.includes('caña') ? templateValuesMap.get('caña') : undefined) ??
              (attrKeyLower.includes('manga') ? templateValuesMap.get('manga') : undefined) ??
              (attrKeyLower.includes('color') ? templateValuesMap.get('color') : undefined) ??
              []

            return (
              <div
                key={attr.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  background: 'var(--glb-surface-ground, rgba(0, 0, 0, 0.015))',
                  border: '1px solid var(--shell-border, rgba(0, 0, 0, 0.08))',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(200px, 1fr) minmax(260px, 1.8fr) 44px',
                    gap: '0.75rem',
                    alignItems: 'center',
                  }}
                >
                  <TextBox
                    id={`${baseId}-key-${index}`}
                    placeholder="Ej. Tipo de Caña, Material, Marca…"
                    value={attr.key}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleUpdateRow(attr.id, 'key', e.target.value)
                    }
                    list={`${baseId}-known-attr-keys`}
                    disabled={disabled}
                    fullWidth
                  />
                  <TextBox
                    id={`${baseId}-val-${index}`}
                    placeholder="Ej. Tobillera, 100% Algodón, 1 Año…"
                    value={attr.value}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleUpdateRow(attr.id, 'value', e.target.value)
                    }
                    disabled={disabled}
                    fullWidth
                  />
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveRow(attr.id)}
                      disabled={disabled}
                      title="Eliminar este atributo"
                      style={{
                        padding: '0.4rem',
                        color: 'var(--glb-danger, #ef4444)',
                        borderColor: 'rgba(239, 68, 68, 0.25)',
                      }}
                    >
                      <Trash2 size={15} aria-hidden />
                    </Button>
                  </div>
                </div>

                {/* Si el atributo tiene valores sugeridos en el diccionario, mostrarlos como chips clicables */}
                {suggestedValues.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexWrap: 'wrap',
                      marginTop: '0.15rem',
                      paddingLeft: '0.25rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--glb-muted, #64748b)',
                        fontWeight: 600,
                      }}
                    >
                      Opciones estandarizadas:
                    </span>
                    {suggestedValues.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleUpdateRow(attr.id, 'value', val)}
                        disabled={disabled}
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.12rem 0.45rem',
                          borderRadius: '10px',
                          border: '1px solid var(--shell-border, rgba(0, 0, 0, 0.15))',
                          background:
                            attr.value.trim().toLowerCase() === val.toLowerCase()
                              ? 'rgba(79, 70, 229, 0.12)'
                              : 'var(--glb-surface, #fff)',
                          color:
                            attr.value.trim().toLowerCase() === val.toLowerCase()
                              ? 'var(--shell-primary, #4f46e5)'
                              : 'var(--glb-text, #1e293b)',
                          fontWeight:
                            attr.value.trim().toLowerCase() === val.toLowerCase() ? 600 : 400,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title={`Seleccionar «${val}»`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddRow()}
              disabled={disabled}
            >
              <Plus size={14} aria-hidden style={{ marginRight: '0.35rem' }} />
              Añadir otro atributo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

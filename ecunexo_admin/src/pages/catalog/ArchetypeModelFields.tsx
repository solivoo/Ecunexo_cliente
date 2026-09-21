import type { ChangeEvent } from 'react'
import { ColorPicker, NumberBox, Select, TextBox } from 'glubox'
import type { ArchetypeAttributeField, DimensionLookup } from '@/lib/catalogArchetype'
import type { CustomAttributeRow } from '@/pages/catalog/ItemCustomAttributesEditor'

type ArchetypeModelFieldsProps = {
  fields: ArchetypeAttributeField[]
  values: readonly CustomAttributeRow[]
  dimensionValuesMap: Map<string, DimensionLookup>
  onChangeValue: (key: string, value: string) => void
  disabled?: boolean
}

function fieldId(field: ArchetypeAttributeField): string {
  const slug = field.key
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `archetype-${field.levelIndex}-${slug || 'campo'}`
}

function buildLabel(field: ArchetypeAttributeField, unit: string | null): string {
  return unit ? `${field.key} (${unit})` : field.key
}

export function ArchetypeModelFields({
  fields,
  values,
  dimensionValuesMap,
  onChangeValue,
  disabled = false,
}: ArchetypeModelFieldsProps) {
  if (fields.length === 0) return null

  const getValue = (key: string) =>
    values.find((r) => r.key.trim().toLowerCase() === key.toLowerCase())?.value ?? ''

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--shell-border, rgba(148, 163, 184, 0.25))',
        backgroundColor: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', marginBottom: '0.875rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Atributos del Modelo</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>
          Especificaciones del arquetipo que acompañan al producto y forman su ruta jerárquica.
        </span>
      </div>
      <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
        {fields.map((field) => {
          const lookup = dimensionValuesMap.get(field.key.trim().toLowerCase())
          const value = getValue(field.key)
          const id = fieldId(field)
          const dataType = lookup?.dataType ?? 'text'
          const unit = lookup?.unit ?? null
          const label = buildLabel(field, unit)
          const hasOptions = (lookup?.values.length ?? 0) > 0

          return (
            <div key={`${field.levelIndex}-${field.key}`} className="ecu-companies-form__field">
              {dataType === 'color' ? (
                <ColorPicker
                  id={id}
                  label={label}
                  labelPosition="outlined"
                  variant="outline"
                  value={value || '#ffffff'}
                  onChange={(hex: string) => onChangeValue(field.key, hex)}
                  disabled={disabled}
                  fullWidth
                />
              ) : dataType === 'boolean' ? (
                <Select
                  id={id}
                  label={label}
                  labelPosition="outlined"
                  variant="outline"
                  options={[
                    { value: '', label: 'Sin definir' },
                    { value: 'true', label: 'Sí' },
                    { value: 'false', label: 'No' },
                  ]}
                  value={value}
                  onChange={(v: string) => onChangeValue(field.key, v)}
                  disabled={disabled}
                  fullWidth
                />
              ) : dataType === 'number' ? (
                <NumberBox
                  id={id}
                  label={label}
                  labelPosition="outlined"
                  variant="outline"
                  value={value}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeValue(field.key, e.target.value)}
                  step={1}
                  disabled={disabled}
                  fullWidth
                />
              ) : hasOptions ? (
                <Select
                  id={id}
                  label={label}
                  labelPosition="outlined"
                  variant="outline"
                  options={[
                    { value: '', label: 'Sin definir' },
                    ...(lookup?.values ?? []).map((v) => ({ value: v, label: v })),
                  ]}
                  value={value}
                  onChange={(v: string) => onChangeValue(field.key, v)}
                  disabled={disabled}
                  fullWidth
                />
              ) : (
                <TextBox
                  id={id}
                  label={label}
                  labelPosition="outlined"
                  variant="outline"
                  value={value}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onChangeValue(field.key, e.target.value)}
                  placeholder={`Ej. ${field.levelName}`}
                  disabled={disabled}
                  fullWidth
                />
              )}
              <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted, #94a3b8)' }}>
                N{field.levelIndex} · {field.levelName}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useMemo, type ChangeEvent } from 'react'
import { ColorPicker, NumberBox, Select, TextBox } from 'glubox'
import { EcuColorListInput, EcuMediaListInput, EcuTagInput } from '@/components/ui'
import { parseMediaValue, type ArchetypeAttributeField, type DimensionLookup } from '@/lib/catalogArchetype'
import type { CustomAttributeRow } from '@/pages/catalog/ItemCustomAttributesEditor'
import type { TenantMediaAssetDto } from '@/types/catalogApi'

type ArchetypeModelFieldsProps = {
  fields: ArchetypeAttributeField[]
  values: readonly CustomAttributeRow[]
  dimensionValuesMap: Map<string, DimensionLookup>
  onChangeValue: (key: string, value: string) => void
  onUploadMedia?: (file: File) => Promise<TenantMediaAssetDto>
  onMediaError?: (message: string) => void
  disabled?: boolean
  bare?: boolean
}

type FieldKind = 'text' | 'number' | 'select' | 'color' | 'colorlist' | 'tags' | 'media'
type FieldGroupKey = 'text' | 'number' | 'select' | 'colors' | 'tags' | 'media'

const GROUP_ORDER: FieldGroupKey[] = ['text', 'number', 'select', 'colors', 'tags', 'media']

const GROUP_META: Record<FieldGroupKey, { title: string; gridClass: string }> = {
  text: { title: 'Texto', gridClass: 'ecu-companies-form__grid--4' },
  number: { title: 'Números', gridClass: 'ecu-companies-form__grid--4' },
  select: { title: 'Listas de selección', gridClass: 'ecu-companies-form__grid--4' },
  colors: { title: 'Colores', gridClass: 'ecu-companies-form__grid--4' },
  tags: { title: 'Etiquetas', gridClass: 'ecu-companies-form__grid--2' },
  media: { title: 'Fotos', gridClass: 'ecu-companies-form__grid--2' },
}

const KIND_GROUP: Record<FieldKind, FieldGroupKey> = {
  text: 'text',
  number: 'number',
  select: 'select',
  color: 'colors',
  colorlist: 'colors',
  tags: 'tags',
  media: 'media',
}

/** Los controles anchos ocupan más de una columna para no romper la fila. */
const KIND_SPAN_CLASS: Partial<Record<FieldKind, string>> = {
  colorlist: 'ecu-companies-form__field--span-2',
  media: 'ecu-companies-form__field--span-2',
}

function resolveFieldKind(dataType: string, hasOptions: boolean): FieldKind {
  if (dataType === 'number') return 'number'
  if (dataType === 'boolean') return 'select'
  if (dataType === 'color') return 'color'
  if (dataType === 'colorlist') return 'colorlist'
  if (dataType === 'media') return 'media'
  if (dataType === 'multiselect') return 'tags'
  if (hasOptions) return 'select'
  return 'text'
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
  onUploadMedia,
  onMediaError,
  disabled = false,
  bare = false,
}: ArchetypeModelFieldsProps) {
  const groups = useMemo(() => {
    const map = new Map<FieldGroupKey, ArchetypeAttributeField[]>()
    for (const field of fields) {
      const lookup = dimensionValuesMap.get(field.key.trim().toLowerCase())
      const kind = resolveFieldKind(lookup?.dataType ?? 'text', (lookup?.values.length ?? 0) > 0)
      const groupKey = KIND_GROUP[kind]
      const list = map.get(groupKey)
      if (list) list.push(field)
      else map.set(groupKey, [field])
    }
    return GROUP_ORDER.map((key) => ({
      key,
      ...GROUP_META[key],
      fields: map.get(key) ?? [],
    })).filter((group) => group.fields.length > 0)
  }, [dimensionValuesMap, fields])

  if (fields.length === 0) return null

  const getValue = (key: string) =>
    values.find((r) => r.key.trim().toLowerCase() === key.toLowerCase())?.value ?? ''

  const showGroupTitles = groups.length > 1

  const renderField = (field: ArchetypeAttributeField) => {
    const lookup = dimensionValuesMap.get(field.key.trim().toLowerCase())
    const value = getValue(field.key)
    const id = fieldId(field)
    const dataType = lookup?.dataType ?? 'text'
    const unit = lookup?.unit ?? null
    const label = buildLabel(field, unit)
    const hasOptions = (lookup?.values.length ?? 0) > 0
    const kind = resolveFieldKind(dataType, hasOptions)
    const multiValues = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    return (
      <div
        key={`${field.levelIndex}-${field.key}`}
        className={`ecu-companies-form__field ${KIND_SPAN_CLASS[kind] ?? ''}`}
      >
        {kind === 'text' ? (
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
        ) : kind === 'number' ? (
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
        ) : kind === 'select' ? (
          <Select
            id={id}
            label={label}
            labelPosition="outlined"
            variant="outline"
            options={
              dataType === 'boolean'
                ? [
                    { value: '', label: 'Sin definir' },
                    { value: 'true', label: 'Sí' },
                    { value: 'false', label: 'No' },
                  ]
                : [
                    { value: '', label: 'Sin definir' },
                    ...(lookup?.values ?? []).map((v) => ({ value: v, label: v })),
                  ]
            }
            value={value}
            onChange={(v: string) => onChangeValue(field.key, v)}
            disabled={disabled}
            fullWidth
          />
        ) : kind === 'color' ? (
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
        ) : kind === 'colorlist' ? (
          <EcuColorListInput
            label={label}
            colors={multiValues}
            onChange={(colors: string[]) => onChangeValue(field.key, colors.join(', '))}
            disabled={disabled}
          />
        ) : kind === 'tags' ? (
          <EcuTagInput
            label={label}
            tags={multiValues}
            suggestedTags={lookup?.values ?? []}
            onChange={(tags: string[]) => onChangeValue(field.key, tags.join(', '))}
            disabled={disabled}
          />
        ) : (
          <EcuMediaListInput
            label={label}
            media={parseMediaValue(value)}
            onChange={(media: TenantMediaAssetDto[]) =>
              onChangeValue(field.key, media.length > 0 ? JSON.stringify(media) : '')
            }
            onUpload={onUploadMedia}
            onError={onMediaError}
            disabled={disabled}
          />
        )}
        <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted, #94a3b8)' }}>
          N{field.levelIndex} · {field.levelName}
        </span>
      </div>
    )
  }

  return (
    <div
      style={
        bare
          ? undefined
          : {
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--shell-border, rgba(148, 163, 184, 0.25))',
              backgroundColor: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
            }
      }
    >
      {bare ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', marginBottom: '0.875rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Datos del producto</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>
            Se completan una vez y acompañan a todas las variaciones.
          </span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {groups.map((group) => (
          <div key={group.key}>
            {showGroupTitles ? (
              <span
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  color: 'var(--glb-muted, #64748b)',
                }}
              >
                {group.title}
              </span>
            ) : null}
            <div className={`ecu-companies-form__grid ${group.gridClass}`}>
              {group.fields.map(renderField)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

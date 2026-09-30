import { useMemo, type ChangeEvent } from 'react'
import { ColorPicker, NumberBox, Select, TextArea, TextBox } from 'glubox'
import { EcuColorListInput, EcuMediaListInput, EcuTagInput } from '@/components/ui'
import {
  isColorDimension,
  parseMediaValue,
  type ArchetypeAttributeField,
  type DimensionLookup,
} from '@/lib/catalogArchetype'
import type { TenantMediaAssetDto } from '@/types/catalogApi'
import './variantMatrixBuilder.css'

export type VariantDimensionOption = {
  name: string
  values: string[]
  type?: string
}

export type VariantPhysicalFieldsProps = {
  readonly sku: string
  readonly onSkuChange: (value: string) => void
  readonly barcode: string
  readonly onBarcodeChange: (value: string) => void
  readonly dimensions: readonly VariantDimensionOption[]
  /** Valores de dimensión; clave = nombre de dimensión en minúsculas. */
  readonly dimensionValues: Record<string, string>
  readonly onDimensionChange: (dimName: string, value: string) => void
  readonly variantAttributeFields: readonly ArchetypeAttributeField[]
  /** Valores de atributos de plantilla; clave = field.key. */
  readonly attributeValues: Record<string, string>
  readonly onAttributeChange: (key: string, value: string) => void
  readonly dimensionValuesMap: Map<string, DimensionLookup>
  readonly disabled?: boolean
  readonly skuError?: boolean
  readonly skuErrorMessage?: string
  readonly onUploadMedia?: (file: File) => Promise<TenantMediaAssetDto>
  readonly onMediaError?: (message: string) => void
  readonly className?: string
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function isNameField(key: string): boolean {
  const n = normalizeKey(key)
  return n === 'nombre' || n === 'name'
}

function isDescField(key: string): boolean {
  const n = normalizeKey(key)
  return n === 'descripcion' || n === 'description'
}

/**
 * Campos físicos de una variante con el mismo layout que la fila de
 * VariantMatrixBuilder (SKU → Nombre → dims → barcode → attrs / TextArea).
 */
export function VariantPhysicalFields({
  sku,
  onSkuChange,
  barcode,
  onBarcodeChange,
  dimensions,
  dimensionValues,
  onDimensionChange,
  variantAttributeFields,
  attributeValues,
  onAttributeChange,
  dimensionValuesMap,
  disabled = false,
  skuError = false,
  skuErrorMessage,
  onUploadMedia,
  onMediaError,
  className,
}: VariantPhysicalFieldsProps) {
  const nameField = useMemo(
    () => variantAttributeFields.find((f) => isNameField(f.key)) ?? null,
    [variantAttributeFields]
  )

  const fieldsAfterSku = useMemo(
    () => variantAttributeFields.filter((f) => !isNameField(f.key)),
    [variantAttributeFields]
  )

  const getAttr = (key: string) => {
    const direct = attributeValues[key]
    if (direct !== undefined) return direct
    const lower = key.trim().toLowerCase()
    for (const [k, v] of Object.entries(attributeValues)) {
      if (k.trim().toLowerCase() === lower) return v
    }
    return ''
  }

  return (
    <div className={`ecu-variant-sub-item-row${className ? ` ${className}` : ''}`}>
      <div className="ecu-variant-sub-item-field">
        <label className="ecu-variant-sub-item-label">SKU *</label>
        <TextBox
          size="sm"
          variant="outline"
          value={sku}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSkuChange(e.target.value.toUpperCase())}
          placeholder="Ej. VAR-001"
          error={skuError}
          errorMessage={skuErrorMessage}
          disabled={disabled}
          fullWidth
        />
      </div>

      {nameField ? (
        <div className="ecu-variant-sub-item-field">
          <label className="ecu-variant-sub-item-label">{nameField.key}</label>
          <TextBox
            size="sm"
            variant="outline"
            value={getAttr(nameField.key)}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onAttributeChange(nameField.key, e.target.value)
            }
            placeholder="Nombre de la variante"
            disabled={disabled}
            fullWidth
          />
        </div>
      ) : null}

      {dimensions.map((dim) => {
        const currentVal = dimensionValues[dim.name.toLowerCase()] ?? ''
        const lookup = dimensionValuesMap.get(dim.name.trim().toLowerCase())
        const availableVals = Array.from(
          new Set([...(dim.values ?? []), ...(lookup?.values ?? [])])
        )
        const isColor =
          dim.type === 'color' || lookup?.isColor || isColorDimension(dim.name)

        return (
          <div key={dim.name} className="ecu-variant-sub-item-field">
            <label className="ecu-variant-sub-item-label">{dim.name}</label>
            {isColor && availableVals.length === 0 ? (
              <ColorPicker
                size="sm"
                variant="outline"
                value={currentVal || '#3b82f6'}
                onChange={(hex: string) => onDimensionChange(dim.name, hex)}
                disabled={disabled}
                fullWidth
              />
            ) : availableVals.length > 0 ? (
              <Select
                size="sm"
                variant="outline"
                value={currentVal}
                onChange={(val: string) => {
                  if (val === '__add_new__') {
                    const created = window.prompt(`Nueva opción para «${dim.name}»:`)
                    if (created?.trim()) onDimensionChange(dim.name, created.trim())
                    return
                  }
                  onDimensionChange(dim.name, val)
                }}
                options={[
                  ...(currentVal && !availableVals.includes(currentVal)
                    ? [{ value: currentVal, label: currentVal }]
                    : []),
                  ...availableVals.map((v) => ({ value: v, label: v })),
                  { value: '__add_new__', label: '+ Nueva...' },
                ]}
                disabled={disabled}
                fullWidth
              />
            ) : (
              <TextBox
                size="sm"
                variant="outline"
                value={currentVal}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onDimensionChange(dim.name, e.target.value)
                }
                disabled={disabled}
                fullWidth
              />
            )}
          </div>
        )
      })}

      <div className="ecu-variant-sub-item-field">
        <label className="ecu-variant-sub-item-label">Cód. Barras</label>
        <TextBox
          size="sm"
          variant="outline"
          value={barcode}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onBarcodeChange(e.target.value.toUpperCase())
          }
          placeholder="EAN / UPC (opc.)"
          disabled={disabled}
          fullWidth
        />
      </div>

      {fieldsAfterSku.map((field) => {
        const lookup = dimensionValuesMap.get(field.key.trim().toLowerCase())
        const dataType = lookup?.dataType ?? 'text'
        const value = getAttr(field.key)
        const isDesc = isDescField(field.key)
        const spanWide =
          dataType === 'media' ||
          dataType === 'colorlist' ||
          dataType === 'multiselect' ||
          isDesc

        return (
          <div
            key={`attr-${field.key}`}
            className={`ecu-variant-sub-item-field${spanWide ? ' ecu-variant-sub-item-field--span-4' : ''}`}
          >
            <label className="ecu-variant-sub-item-label">{field.key}</label>
            {dataType === 'boolean' ? (
              <Select
                size="sm"
                variant="outline"
                value={value}
                onChange={(v: string) => onAttributeChange(field.key, v)}
                options={[
                  { value: '', label: 'Sin definir' },
                  { value: 'true', label: 'Sí' },
                  { value: 'false', label: 'No' },
                ]}
                disabled={disabled}
                fullWidth
              />
            ) : dataType === 'number' ? (
              <NumberBox
                size="sm"
                variant="outline"
                value={value}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onAttributeChange(field.key, e.target.value)
                }
                step={1}
                disabled={disabled}
                fullWidth
              />
            ) : dataType === 'color' ? (
              <ColorPicker
                size="sm"
                variant="outline"
                value={value || '#ffffff'}
                onChange={(hex: string) => onAttributeChange(field.key, hex)}
                disabled={disabled}
                fullWidth
              />
            ) : dataType === 'multiselect' ? (
              <EcuTagInput
                tags={value
                  .split(',')
                  .map((v) => v.trim().replace(/^#+/, '').trim())
                  .filter(Boolean)}
                suggestedTags={lookup?.values ?? []}
                onChange={(tags: string[]) => onAttributeChange(field.key, tags.join(', '))}
                placeholder={`Añadir ${field.key}...`}
                disabled={disabled}
              />
            ) : dataType === 'colorlist' ? (
              <EcuColorListInput
                colors={value
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean)}
                onChange={(colors: string[]) => onAttributeChange(field.key, colors.join(', '))}
                disabled={disabled}
              />
            ) : dataType === 'media' ? (
              <EcuMediaListInput
                media={parseMediaValue(value)}
                onChange={(media: TenantMediaAssetDto[]) =>
                  onAttributeChange(field.key, media.length > 0 ? JSON.stringify(media) : '')
                }
                onUpload={onUploadMedia}
                onError={onMediaError}
                disabled={disabled}
              />
            ) : (lookup?.values.length ?? 0) > 0 ? (
              <Select
                size="sm"
                variant="outline"
                value={value}
                onChange={(v: string) => onAttributeChange(field.key, v)}
                options={[
                  { value: '', label: 'Sin definir' },
                  ...(lookup?.values ?? []).map((v) => ({ value: v, label: v })),
                ]}
                disabled={disabled}
                fullWidth
              />
            ) : isDesc ? (
              <TextArea
                size="sm"
                variant="outline"
                value={value}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  onAttributeChange(field.key, e.target.value)
                }
                placeholder="Descripción de la variante"
                rows={2}
                resize="vertical"
                disabled={disabled}
                fullWidth
              />
            ) : (
              <TextBox
                size="sm"
                variant="outline"
                value={value}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onAttributeChange(field.key, e.target.value)
                }
                disabled={disabled}
                fullWidth
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

import type { ChangeEvent } from 'react'
import { TextBox } from 'glubox'
import { CatalogAttributeColorsField } from '@/pages/catalog/CatalogAttributeColorsField'
import { isColorAttributeField } from '@/lib/catalogAttributes'
import type { CatalogAttributeField } from '@/types/catalogApi'

export type CatalogExtraAttributeFieldsProps = {
  readonly idPrefix: string
  readonly fields: readonly CatalogAttributeField[]
  readonly values: Record<string, string>
  readonly disabled?: boolean
  readonly onChange: (key: string, value: string) => void
}

export function CatalogExtraAttributeFields({
  idPrefix,
  fields,
  values,
  disabled = false,
  onChange,
}: CatalogExtraAttributeFieldsProps) {
  const scalars = fields.filter((field) => !isColorAttributeField(field))
  const colors = fields.filter((field) => isColorAttributeField(field))

  return (
    <>
      {scalars.map((field) => {
        const id = `${idPrefix}-attr-${field.key}`
        const label = field.label ?? field.key
        return (
          <div key={field.key} className="ecu-companies-form__field">
            <TextBox
              id={id}
              label={label}
              labelPosition="outlined"
              variant="outline"
              value={values[field.key] ?? ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(field.key, e.target.value)}
              required={field.required}
              disabled={disabled}
              fullWidth
            />
          </div>
        )
      })}
      {colors.map((field) => {
        const id = `${idPrefix}-attr-${field.key}`
        const label = field.label ?? field.key
        return (
          <div key={field.key} className="ecu-companies-form__field ecu-companies-form__field--span-4">
            <CatalogAttributeColorsField
              id={id}
              label={label}
              value={values[field.key] ?? ''}
              required={field.required}
              disabled={disabled}
              onChange={(next) => onChange(field.key, next)}
            />
          </div>
        )
      })}
    </>
  )
}

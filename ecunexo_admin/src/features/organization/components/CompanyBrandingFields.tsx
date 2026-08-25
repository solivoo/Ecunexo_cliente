import type { ChangeEvent } from 'react'
import { ColorPicker, Select, TextBox } from 'glubox'
import { Building2 } from 'lucide-react'
import {
  COMPANY_LOCALE_OPTIONS,
  COMPANY_TIMEZONE_OPTIONS,
} from '@/features/organization/companyFormOptions'

export type CompanyBrandingValues = {
  readonly tenantName: string
  readonly timeZoneId: string
  readonly locale: string
  readonly logoUrl: string
  readonly primaryColorHex: string
}

export type CompanyBrandingFieldsProps = {
  readonly values: CompanyBrandingValues
  readonly disabled?: boolean
  readonly hint: string
  readonly idPrefix: string
  readonly onChange: <K extends keyof CompanyBrandingValues>(
    key: K,
    value: CompanyBrandingValues[K]
  ) => void
}

export function CompanyBrandingFields({
  values,
  disabled = false,
  hint,
  idPrefix,
  onChange,
}: CompanyBrandingFieldsProps) {
  const emitChange: CompanyBrandingFieldsProps['onChange'] = (key, value) => {
    if (disabled) return
    onChange(key, value)
  }

  return (
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">
        <Building2 size={18} strokeWidth={1.75} aria-hidden /> Empresa
      </h2>
      <p className="ecu-companies-form__hint">{hint}</p>
      <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
        <div className="ecu-companies-form__field">
          <TextBox
            id={`${idPrefix}-name`}
            label="Nombre de la empresa"
            labelPosition="outlined"
            variant="outline"
            value={values.tenantName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => emitChange('tenantName', e.target.value)}
            required
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <Select
            id={`${idPrefix}-tz`}
            label="Zona horaria"
            labelPosition="outlined"
            variant="outline"
            options={[...COMPANY_TIMEZONE_OPTIONS]}
            value={values.timeZoneId}
            onChange={(value: string) => emitChange('timeZoneId', value)}
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <Select
            id={`${idPrefix}-locale`}
            label="Locale"
            labelPosition="outlined"
            variant="outline"
            options={[...COMPANY_LOCALE_OPTIONS]}
            value={values.locale}
            onChange={(value: string) => emitChange('locale', value)}
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <ColorPicker
            id={`${idPrefix}-color`}
            label="Color de acento"
            labelPosition="outlined"
            variant="outline"
            value={values.primaryColorHex}
            placeholder="#3B82F6"
            showClearButton
            onChange={(hex) => emitChange('primaryColorHex', hex)}
            disabled={disabled}
            fullWidth
          />
        </div>
      </div>
    </section>
  )
}

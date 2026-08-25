import type { ChangeEvent } from 'react'
import { Select, TextArea, TextBox } from 'glubox'
import { Scale } from 'lucide-react'
import { CompanyLegalRegimeFields } from '@/features/organization/components/CompanyLegalRegimeFields'
import {
  COMPANY_YES_NO,
  type CompanyLegalValues,
} from '@/features/organization/companyFormOptions'

export type { CompanyLegalValues }

export type CompanyLegalFieldsProps = {
  readonly values: CompanyLegalValues
  readonly disabled?: boolean
  readonly tradeNameReadOnly?: boolean
  readonly hint?: string
  readonly idPrefix: string
  readonly onChange: <K extends keyof CompanyLegalValues>(
    key: K,
    value: CompanyLegalValues[K]
  ) => void
}

export function CompanyLegalFields({
  values,
  disabled = false,
  tradeNameReadOnly = false,
  hint = 'Mismos datos que lee el SRI al emitir. Firma y secuencial se configuran dentro de la empresa.',
  idPrefix,
  onChange,
}: CompanyLegalFieldsProps) {
  const emitChange: CompanyLegalFieldsProps['onChange'] = (key, value) => {
    if (disabled) return
    if (key === 'tradeName' && tradeNameReadOnly) return
    onChange(key, value)
  }

  return (
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">
        <Scale size={18} strokeWidth={1.75} aria-hidden /> Información legal
      </h2>
      <p className="ecu-companies-form__hint">{hint}</p>
      <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
        <div className="ecu-companies-form__field">
          <TextBox
            id={`${idPrefix}-ruc`}
            label="RUC"
            labelPosition="outlined"
            variant="outline"
            value={values.taxId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => emitChange('taxId', e.target.value)}
            placeholder="Ingrese el RUC"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <TextBox
            id={`${idPrefix}-razon`}
            label="Razón social"
            labelPosition="outlined"
            variant="outline"
            value={values.legalName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => emitChange('legalName', e.target.value)}
            placeholder="Ingrese la razón social"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <TextBox
            id={`${idPrefix}-comercial`}
            label="Nombre comercial"
            labelPosition="outlined"
            variant="outline"
            value={values.tradeName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => emitChange('tradeName', e.target.value)}
            placeholder="Nombre de la empresa"
            disabled={disabled || tradeNameReadOnly}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <TextBox
            id={`${idPrefix}-ciudad`}
            label="Ciudad"
            labelPosition="outlined"
            variant="outline"
            value={values.city}
            onChange={(e: ChangeEvent<HTMLInputElement>) => emitChange('city', e.target.value)}
            placeholder="Ingrese una ciudad"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <TextBox
            id={`${idPrefix}-estab`}
            label="Nº de establecimiento"
            labelPosition="outlined"
            variant="outline"
            value={values.establishmentCode}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitChange('establishmentCode', e.target.value)
            }
            placeholder="001"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <Select
            id={`${idPrefix}-obligado`}
            label="Obligado contabilidad"
            labelPosition="outlined"
            variant="outline"
            options={[...COMPANY_YES_NO]}
            value={values.accountingRequired}
            onChange={(value: string) => emitChange('accountingRequired', value)}
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field ecu-companies-form__field--span-2 sri-config-field--row-span-2">
          <TextArea
            id={`${idPrefix}-direccion`}
            label="Dirección"
            labelPosition="outlined"
            variant="outline"
            value={values.address}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => emitChange('address', e.target.value)}
            placeholder="Escriba la dirección"
            rows={5}
            resize="vertical"
            disabled={disabled}
            fullWidth
          />
        </div>
        <CompanyLegalRegimeFields
          values={values}
          disabled={disabled}
          idPrefix={idPrefix}
          onChange={emitChange}
        />
      </div>
    </section>
  )
}

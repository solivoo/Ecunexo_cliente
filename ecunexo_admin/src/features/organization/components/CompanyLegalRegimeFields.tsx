import { CheckButton, Select } from 'glubox'
import {
  COMPANY_YES_NO,
  type CompanyLegalValues,
} from '@/features/organization/companyFormOptions'
import { COMPANY_RIMPE_KIND } from '@/features/organization/rimpeKind'

type CompanyLegalRegimeFieldsProps = {
  readonly values: CompanyLegalValues
  readonly disabled?: boolean
  readonly idPrefix: string
  readonly onChange: <K extends keyof CompanyLegalValues>(
    key: K,
    value: CompanyLegalValues[K]
  ) => void
}

export function CompanyLegalRegimeFields({
  values,
  disabled = false,
  idPrefix,
  onChange,
}: CompanyLegalRegimeFieldsProps) {
  const emitChange: CompanyLegalRegimeFieldsProps['onChange'] = (key, value) => {
    if (disabled) return
    onChange(key, value)
  }

  return (
    <>
      <div className="ecu-companies-form__field sri-config-field-stack sri-config-field--row-span-2">
        <Select
          id={`${idPrefix}-rimpe`}
          label="RIMPE"
          labelPosition="outlined"
          variant="outline"
          options={[...COMPANY_RIMPE_KIND]}
          value={values.rimpeKind}
          onChange={(value: string) => {
            emitChange('rimpeKind', value)
            if (value === 'popular-business') {
              emitChange('isWithholdingAgent', false)
            }
            if (value !== 'popular-business') {
              emitChange('preferElectronicInvoice', false)
            }
          }}
          disabled={disabled}
          fullWidth
        />
        {values.rimpeKind === 'popular-business' ? (
          <p className="ecu-companies-form__hint">
            Negocio popular emite <strong>nota de venta</strong> (talonario SRI). Un recibo no
            sirve. Marca factura electrónica solo si eliges esa opción ante el SRI.
          </p>
        ) : null}
        <Select
          id={`${idPrefix}-exportador`}
          label="Exportador"
          labelPosition="outlined"
          variant="outline"
          options={[...COMPANY_YES_NO]}
          value={values.isExporter}
          onChange={(value: string) => emitChange('isExporter', value)}
          disabled={disabled}
          fullWidth
        />
        {values.rimpeKind === 'popular-business' ? (
          <CheckButton
            variant="ghost"
            checked={values.preferElectronicInvoice}
            onChange={(checked: boolean) => emitChange('preferElectronicInvoice', checked)}
            disabled={disabled}
          >
            Emitir factura electrónica (opción SRI)
          </CheckButton>
        ) : null}
      </div>
      <div className="ecu-companies-form__field">
        <CheckButton
          variant="ghost"
          checked={values.isLargeTaxpayer}
          onChange={(checked: boolean) => emitChange('isLargeTaxpayer', checked)}
          disabled={disabled}
        >
          Gran contribuyente
        </CheckButton>
      </div>
      <div className="ecu-companies-form__field">
        <CheckButton
          variant="ghost"
          checked={values.isSpecialTaxpayer}
          onChange={(checked: boolean) => emitChange('isSpecialTaxpayer', checked)}
          disabled={disabled}
        >
          Contribuyente especial
        </CheckButton>
      </div>
      <div className="ecu-companies-form__field">
        <CheckButton
          variant="ghost"
          checked={values.isWithholdingAgent}
          onChange={(checked: boolean) => emitChange('isWithholdingAgent', checked)}
          disabled={disabled || values.rimpeKind === 'popular-business'}
        >
          Agente de retención
        </CheckButton>
      </div>
    </>
  )
}

import type { ChangeEvent } from 'react'
import { TextBox } from 'glubox'
import { CompanyLegalFields } from '@/features/organization/components/CompanyLegalFields'
import type { CompanyLegalValues } from '@/features/organization/companyFormOptions'

export type SriLegalInfoValues = {
  readonly ruc: string
  readonly razonSocial: string
  readonly nombreComercial: string
  readonly ciudad: string
  readonly establecimiento: string
  readonly puntoEmision: string
  readonly secuencialSiguiente: string
  readonly obligadoContabilidad: string
  readonly direccion: string
  readonly rimpe: string
  readonly exportador: string
  readonly granContribuyente: boolean
  readonly contribuyenteEspecial: boolean
  readonly agenteRetencion: boolean
}

export type SriEmissionValues = {
  readonly establecimiento: string
  readonly puntoEmision: string
  readonly secuencialSiguiente: string
}

function toCompanyLegal(values: SriLegalInfoValues): CompanyLegalValues {
  return {
    taxId: values.ruc,
    legalName: values.razonSocial,
    tradeName: values.nombreComercial,
    city: values.ciudad,
    establishmentCode: values.establecimiento,
    address: values.direccion,
    accountingRequired: values.obligadoContabilidad,
    rimpeKind: values.rimpe,
    preferElectronicInvoice: false,
    isExporter: values.exportador,
    isLargeTaxpayer: values.granContribuyente,
    isSpecialTaxpayer: values.contribuyenteEspecial,
    isWithholdingAgent: values.agenteRetencion,
  }
}

export function SriIdentityCard({
  values,
  disabled = false,
  onChange,
}: {
  readonly values: SriLegalInfoValues
  readonly disabled?: boolean
  readonly onChange?: <K extends keyof SriLegalInfoValues>(
    key: K,
    value: SriLegalInfoValues[K]
  ) => void
}) {
  return (
    <CompanyLegalFields
      idPrefix="sri"
      disabled={disabled || !onChange}
      tradeNameReadOnly={disabled || !onChange}
      hint={
        disabled || !onChange
          ? 'Solo lectura. El titular edita la ficha en Empresas.'
          : 'Datos del emisor. Se sincronizan con la ficha y Billing al guardar.'
      }
      values={toCompanyLegal(values)}
      onChange={(key, value) => {
        if (!onChange) return
        if (key === 'taxId') onChange('ruc', value as string)
        if (key === 'legalName') onChange('razonSocial', value as string)
        if (key === 'tradeName') onChange('nombreComercial', value as string)
        if (key === 'city') onChange('ciudad', value as string)
        if (key === 'establishmentCode') onChange('establecimiento', value as string)
        if (key === 'address') onChange('direccion', value as string)
        if (key === 'accountingRequired') onChange('obligadoContabilidad', value as string)
        if (key === 'rimpeKind') onChange('rimpe', value as string)
        if (key === 'isExporter') onChange('exportador', value as string)
        if (key === 'isLargeTaxpayer') onChange('granContribuyente', value as boolean)
        if (key === 'isSpecialTaxpayer') onChange('contribuyenteEspecial', value as boolean)
        if (key === 'isWithholdingAgent') onChange('agenteRetencion', value as boolean)
      }}
    />
  )
}

/** @deprecated Prefer SriIdentityCard */
export function SriIdentityReadOnlyCard({ values }: { readonly values: SriLegalInfoValues }) {
  return <SriIdentityCard values={values} disabled />
}

export function SriEmissionFields({
  values,
  disabled = false,
  onChange,
  embedded = false,
}: {
  readonly values: SriEmissionValues
  readonly disabled?: boolean
  readonly onChange: <K extends keyof SriEmissionValues>(key: K, value: SriEmissionValues[K]) => void
  readonly embedded?: boolean
}) {
  const emitChange: typeof onChange = (key, value) => {
    if (disabled) return
    onChange(key, value)
  }

  const fields = (
    <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
      <div className="ecu-companies-form__field">
        <TextBox
          id="sri-estab"
          label="Establecimiento"
          labelPosition="outlined"
          variant="outline"
          value={values.establecimiento}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            emitChange('establecimiento', e.target.value)
          }
          placeholder="001"
          disabled={disabled}
          fullWidth
        />
      </div>
      <div className="ecu-companies-form__field">
        <TextBox
          id="sri-pto"
          label="Punto de emisión"
          labelPosition="outlined"
          variant="outline"
          value={values.puntoEmision}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            emitChange('puntoEmision', e.target.value)
          }
          placeholder="001"
          disabled={disabled}
          fullWidth
        />
      </div>
      <div className="ecu-companies-form__field">
        <TextBox
          id="sri-secuencial"
          label="Próximo secuencial"
          labelPosition="outlined"
          variant="outline"
          value={values.secuencialSiguiente}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            emitChange('secuencialSiguiente', e.target.value)
          }
          placeholder="000000001"
          disabled={disabled}
          fullWidth
        />
      </div>
    </div>
  )

  if (embedded) return fields

  return (
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">Emisión SRI</h2>
      {fields}
    </section>
  )
}

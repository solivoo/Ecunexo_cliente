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

export function SriIdentityReadOnlyCard({ values }: { readonly values: SriLegalInfoValues }) {
  return (
    <CompanyLegalFields
      idPrefix="sri"
      disabled
      tradeNameReadOnly
      hint="Identidad de la empresa en solo lectura. El titular la edita en el listado de empresas."
      values={toCompanyLegal(values)}
      onChange={() => undefined}
    />
  )
}

export function SriEmissionFields({
  values,
  disabled = false,
  onChange,
}: {
  readonly values: SriEmissionValues
  readonly disabled?: boolean
  readonly onChange: <K extends keyof SriEmissionValues>(key: K, value: SriEmissionValues[K]) => void
}) {
  const emitChange: typeof onChange = (key, value) => {
    if (disabled) return
    onChange(key, value)
  }

  return (
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">Emisión SRI</h2>
      <p className="ecu-companies-form__hint">
        Punto de emisión y próximo secuencial. El establecimiento viene de la ficha legal y no se
        envía desde aquí.
      </p>
      <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
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
    </section>
  )
}

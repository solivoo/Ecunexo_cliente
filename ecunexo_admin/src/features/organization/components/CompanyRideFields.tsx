import type { ChangeEvent } from 'react'
import { TextArea, TextBox } from 'glubox'
import type { CompanyRideValues } from '@/features/organization/companyFormOptions'

export type CompanyRideFieldsProps = {
  readonly values: CompanyRideValues
  readonly disabled?: boolean
  readonly idPrefix: string
  readonly onChange: <K extends keyof CompanyRideValues>(
    key: K,
    value: CompanyRideValues[K]
  ) => void
}

export function CompanyRideFields({
  values,
  disabled = false,
  idPrefix,
  onChange,
}: CompanyRideFieldsProps) {
  const emitChange: CompanyRideFieldsProps['onChange'] = (key, value) => {
    if (disabled) return
    onChange(key, value)
  }

  return (
    <section className="app-shell__card ecu-companies-form__card">
      <h2 className="app-shell__section-title">RIDE — contacto y pie</h2>
      <p className="ecu-companies-form__hint">
        Correo y teléfono del emisor, y el texto de agradecimiento al pie de la factura. El
        agradecimiento es comercial (no lo exige el SRI). El RUC del proveedor del sistema se
        configura en Emisor / Configuración SRI y sale solo en XML y RIDE.
      </p>
      <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
        <div className="ecu-companies-form__field">
          <TextBox
            id={`${idPrefix}-contact-email`}
            label="Correo del emisor"
            labelPosition="outlined"
            variant="outline"
            type="email"
            value={values.contactEmail}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitChange('contactEmail', e.target.value)
            }
            placeholder="ventas@empresa.com"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field">
          <TextBox
            id={`${idPrefix}-contact-phone`}
            label="Teléfono del emisor"
            labelPosition="outlined"
            variant="outline"
            type="tel"
            value={values.contactPhone}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitChange('contactPhone', e.target.value)
            }
            placeholder="09xxxxxxxx"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
          <TextArea
            id={`${idPrefix}-thank-you`}
            label="Agradecimiento (pie del RIDE)"
            labelPosition="outlined"
            variant="outline"
            value={values.rideThankYouText}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              emitChange('rideThankYouText', e.target.value)
            }
            placeholder="Gracias por su compra. Síguenos en redes…"
            rows={4}
            resize="vertical"
            disabled={disabled}
            fullWidth
          />
        </div>
      </div>
    </section>
  )
}

import type { ChangeEvent } from 'react'
import { Select, TextBox } from 'glubox'
import {
  CONSUMIDOR_FINAL_MAX_TOTAL_USD,
  ID_TYPE_OPTIONS,
  PAYMENT_FORM_OPTIONS,
  isConsumidorFinalType,
  type InvoiceCounterpartyValues,
} from '@/pages/facturacion/invoiceFormTypes'

export type InvoiceClientFieldsProps = {
  readonly counterparty: InvoiceCounterpartyValues
  readonly paymentFormCode: string
  readonly disabled?: boolean
  readonly onCounterpartyChange: <K extends keyof InvoiceCounterpartyValues>(
    key: K,
    value: InvoiceCounterpartyValues[K]
  ) => void
  readonly onPaymentFormChange: (code: string) => void
}

/** Cliente + forma de pago en grilla de 4 columnas alineadas. */
export function InvoiceClientFields({
  counterparty,
  paymentFormCode,
  disabled = false,
  onCounterpartyChange,
  onPaymentFormChange,
}: InvoiceClientFieldsProps) {
  const consumidorFinal = isConsumidorFinalType(counterparty.identificationType)
  const emitParty: InvoiceClientFieldsProps['onCounterpartyChange'] = (key, value) => {
    if (disabled) return
    if (consumidorFinal && (key === 'identification' || key === 'businessName')) return
    onCounterpartyChange(key, value)
  }
  const emitPayment = (code: string) => {
    if (disabled) return
    onPaymentFormChange(code)
  }

  return (
    <section className="factura-emitir__meta-block">
      <header className="factura-emitir__meta-head">
        <h2 className="factura-emitir__meta-label">Cliente</h2>
      </header>

      <div className="factura-emitir__meta-grid factura-emitir__meta-grid--client">
        <div className="factura-emitir__cell factura-emitir__cell--id-type">
          <Select
            id="inv-id-type"
            label="Tipo ID"
            labelPosition="outlined"
            variant="outline"
            options={[...ID_TYPE_OPTIONS]}
            value={counterparty.identificationType}
            onChange={(v) => emitParty('identificationType', v)}
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--id">
          <TextBox
            id="inv-id"
            label="Identificación"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.identification}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('identification', e.target.value)
            }
            placeholder={consumidorFinal ? '9999999999999' : 'RUC / cédula'}
            disabled={disabled || consumidorFinal}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--name">
          <TextBox
            id="inv-name"
            label="Razón social"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.businessName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('businessName', e.target.value)
            }
            placeholder={consumidorFinal ? 'CONSUMIDOR FINAL' : 'Nombre del comprador'}
            disabled={disabled || consumidorFinal}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--payment">
          <Select
            id="inv-payment"
            label="Forma de pago"
            labelPosition="outlined"
            variant="outline"
            options={[...PAYMENT_FORM_OPTIONS]}
            value={paymentFormCode}
            onChange={emitPayment}
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--addr">
          <TextBox
            id="inv-addr"
            label="Dirección"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={counterparty.address}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('address', e.target.value)
            }
            placeholder="Opcional"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--email">
          <TextBox
            id="inv-email"
            label="Correo"
            labelPosition="outlined"
            variant="outline"
            size="md"
            type="email"
            autoComplete="email"
            value={counterparty.email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('email', e.target.value)
            }
            placeholder="factura@cliente.com"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--phone">
          <TextBox
            id="inv-phone"
            label="Teléfono"
            labelPosition="outlined"
            variant="outline"
            size="md"
            type="tel"
            autoComplete="tel"
            value={counterparty.phone}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emitParty('phone', e.target.value)
            }
            placeholder="09xxxxxxxx"
            disabled={disabled}
            fullWidth
          />
        </div>
      </div>

      {consumidorFinal ? (
        <p className="factura-emitir__meta-hint" role="note">
          Consumidor final: ID <code>9999999999999</code>, razón social fija y total ≤ USD{' '}
          {CONSUMIDOR_FINAL_MAX_TOTAL_USD} (SRI).
        </p>
      ) : (
        <p className="factura-emitir__meta-hint">
          El correo se usará para enviar el comprobante electrónico.
        </p>
      )}
    </section>
  )
}

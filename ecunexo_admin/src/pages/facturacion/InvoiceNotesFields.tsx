import type { ChangeEvent } from 'react'
import { NumberBox, TextArea } from 'glubox'
import type { InvoiceHeaderValues } from '@/pages/facturacion/invoiceFormTypes'

export type InvoiceNotesFieldsProps = {
  readonly header: InvoiceHeaderValues
  readonly disabled?: boolean
  readonly onHeaderChange: <K extends keyof InvoiceHeaderValues>(
    key: K,
    value: InvoiceHeaderValues[K]
  ) => void
}

export function InvoiceNotesFields({
  header,
  disabled = false,
  onHeaderChange,
}: InvoiceNotesFieldsProps) {
  const emit = <K extends keyof InvoiceHeaderValues>(key: K, value: InvoiceHeaderValues[K]) => {
    if (disabled) return
    onHeaderChange(key, value)
  }

  return (
    <section className="factura-emitir__meta-block">
      <header className="factura-emitir__meta-head">
        <h2 className="factura-emitir__meta-label">Información adicional</h2>
        <p className="ecu-companies-form__hint">
          Nota comercial de este comprobante. El campo SRI «RUC Proveedor» se añade solo.
        </p>
      </header>
      <div className="factura-emitir__meta-grid factura-emitir__meta-grid--client">
        <div className="factura-emitir__cell factura-emitir__cell--addr">
          <TextArea
            id="inv-additional-note"
            label="Descripción (RIDE)"
            labelPosition="outlined"
            variant="outline"
            value={header.additionalNote}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              emit('additionalNote', e.target.value)
            }
            placeholder="Promoción, observaciones o detalle para el cliente"
            rows={3}
            resize="vertical"
            disabled={disabled}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--payment">
          <NumberBox
            id="inv-payment-term"
            label="Plazo (días)"
            labelPosition="outlined"
            variant="outline"
            size="md"
            min={0}
            step={1}
            showSpinButtons
            value={header.paymentTermDays}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const raw = e.target.value
              if (raw === '') {
                emit('paymentTermDays', 0)
                return
              }
              const parsed = Number(raw)
              emit('paymentTermDays', Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0)
            }}
            placeholder="0"
            disabled={disabled}
            fullWidth
          />
        </div>
      </div>
    </section>
  )
}

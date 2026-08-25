import type { ChangeEvent } from 'react'
import { TextBox } from 'glubox'
import type { InvoiceHeaderValues } from '@/pages/facturacion/invoiceFormTypes'

export type InvoiceIssuerFieldsProps = {
  readonly header: InvoiceHeaderValues
  readonly issuerLocked?: boolean
  readonly disabled?: boolean
  readonly onHeaderChange: <K extends keyof InvoiceHeaderValues>(
    key: K,
    value: InvoiceHeaderValues[K]
  ) => void
}

/** Emisión: solo campos editables; estab/pto/secuencial como metadato del encabezado. */
export function InvoiceIssuerFields({
  header,
  issuerLocked = false,
  disabled = false,
  onHeaderChange,
}: InvoiceIssuerFieldsProps) {

  return (
    <section className="factura-emitir__meta-block">
      <header className="factura-emitir__meta-head">
        <h2 className="factura-emitir__meta-label">Emisión</h2>
        <dl className="factura-emitir__meta-chips" aria-label="Datos de numeración">
          <div className="factura-emitir__meta-chip">
            <dt>Estab.</dt>
            <dd>{header.establishment || '—'}</dd>
          </div>
          <div className="factura-emitir__meta-chip">
            <dt>Pto. emis.</dt>
            <dd>{header.emissionPoint || '—'}</dd>
          </div>
          <div className="factura-emitir__meta-chip">
            <dt>Secuencial</dt>
            <dd>{header.sequential || '—'}</dd>
          </div>
        </dl>
      </header>

      <div className="factura-emitir__meta-grid factura-emitir__meta-grid--issuer">
        <div className="factura-emitir__cell factura-emitir__cell--ruc">
          <TextBox
            id="inv-ruc"
            label="RUC emisor"
            labelPosition="outlined"
            variant="outline"
            size="md"
            value={header.emitterRuc}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (disabled || issuerLocked) return
              onHeaderChange('emitterRuc', e.target.value)
            }}
            placeholder="Configure el RUC en Facturación → Emisor"
            disabled={disabled || issuerLocked}
            fullWidth
          />
        </div>
        <div className="factura-emitir__cell factura-emitir__cell--fecha">
          <TextBox
            id="inv-fecha"
            label="Fecha de emisión"
            labelPosition="outlined"
            variant="outline"
            size="md"
            type="date"
            value={header.issueDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (disabled) return
              onHeaderChange('issueDate', e.target.value)
            }}
            disabled={disabled}
            fullWidth
          />
        </div>
      </div>
    </section>
  )
}

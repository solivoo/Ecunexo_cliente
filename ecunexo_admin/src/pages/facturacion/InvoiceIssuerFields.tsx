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
}: InvoiceIssuerFieldsProps) {
  return (
    <section className="factura-emitir__issuer-bar">
      <div className="factura-emitir__issuer-summary">
        <span className="factura-emitir__issuer-tag">Datos de Emisión</span>
        <div className="factura-emitir__issuer-items">
          <span className="factura-emitir__issuer-item">
            <strong>RUC Emisor:</strong> {header.emitterRuc || '—'}
          </span>
          <span className="factura-emitir__issuer-item">
            <strong>Punto Emisión:</strong> {header.establishment || '001'}-{header.emissionPoint || '001'}
          </span>
          <span className="factura-emitir__issuer-item">
            <strong>Secuencial:</strong> {header.sequential || 'auto'}
          </span>
          <span className="factura-emitir__issuer-item">
            <strong>Fecha Emisión:</strong> {header.issueDate || 'Hoy'}
          </span>
        </div>
      </div>
    </section>
  )
}

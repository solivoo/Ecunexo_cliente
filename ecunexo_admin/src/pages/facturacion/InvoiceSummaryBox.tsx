import {
  formatMoney,
  type InvoiceTotals,
} from '@/pages/facturacion/invoiceFormTypes'

export type InvoiceSummaryBoxProps = {
  readonly totals: InvoiceTotals
}

/** Totales del comprobante: IVA agrupado por tarifa (sin selector global). */
export function InvoiceSummaryBox({ totals }: InvoiceSummaryBoxProps) {
  return (
    <div className="factura-emitir__summary-box">
      <div className="factura-emitir__summary-row">
        <span>Subtotal</span>
        <strong>{formatMoney(totals.subtotal)}</strong>
      </div>
      {totals.discountTotal > 0 ? (
        <div className="factura-emitir__summary-row">
          <span>Descuento</span>
          <strong>{formatMoney(totals.discountTotal)}</strong>
        </div>
      ) : null}
      {totals.ivaBuckets.map((bucket) => (
        <div key={bucket.rate} className="factura-emitir__summary-row">
          <span>IVA {bucket.rate}%</span>
          <strong>{formatMoney(bucket.iva)}</strong>
        </div>
      ))}
      {totals.ivaBuckets.length === 0 ? (
        <div className="factura-emitir__summary-row">
          <span>IVA</span>
          <strong>{formatMoney(0)}</strong>
        </div>
      ) : null}
      <div className="factura-emitir__summary-row factura-emitir__summary-row--total">
        <span>Total</span>
        <strong>{formatMoney(totals.grandTotal)}</strong>
      </div>
    </div>
  )
}

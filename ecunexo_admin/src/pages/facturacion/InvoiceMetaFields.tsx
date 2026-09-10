import { InvoiceClientFields } from '@/pages/facturacion/InvoiceClientFields'
import { InvoiceIssuerFields } from '@/pages/facturacion/InvoiceIssuerFields'
import type {
  InvoiceCounterpartyValues,
  InvoiceHeaderValues,
} from '@/pages/facturacion/invoiceFormTypes'

export type InvoiceMetaFieldsProps = {
  readonly header: InvoiceHeaderValues
  readonly counterparty: InvoiceCounterpartyValues
  readonly issuerLocked?: boolean
  readonly disabled?: boolean
  readonly onHeaderChange: <K extends keyof InvoiceHeaderValues>(
    key: K,
    value: InvoiceHeaderValues[K]
  ) => void
  readonly onCounterpartyChange: <K extends keyof InvoiceCounterpartyValues>(
    key: K,
    value: InvoiceCounterpartyValues[K]
  ) => void
  readonly onCounterpartyReplace?: (next: InvoiceCounterpartyValues) => void
}

/** Cabecera de emisión + cliente en grilla responsive (móvil / tablet / escritorio). */
export function InvoiceMetaFields({
  header,
  counterparty,
  issuerLocked = false,
  disabled = false,
  onHeaderChange,
  onCounterpartyChange,
  onCounterpartyReplace,
}: InvoiceMetaFieldsProps) {
  return (
    <div className="factura-emitir__meta">
      <InvoiceIssuerFields
        header={header}
        issuerLocked={issuerLocked}
        disabled={disabled}
        onHeaderChange={onHeaderChange}
      />
      <InvoiceClientFields
        counterparty={counterparty}
        paymentFormCode={header.paymentFormCode}
        disabled={disabled}
        onCounterpartyChange={onCounterpartyChange}
        onCounterpartyReplace={onCounterpartyReplace}
        onPaymentFormChange={(code) => onHeaderChange('paymentFormCode', code)}
      />
    </div>
  )
}

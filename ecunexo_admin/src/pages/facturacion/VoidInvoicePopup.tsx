import { useEffect, useState, type ChangeEvent } from 'react'
import { Popup, TextArea } from 'glubox'
import { formatMoney } from '@/pages/facturacion/invoiceFormTypes'
import type { InvoiceListItem } from '@/types/billingApi'

export type VoidInvoicePopupProps = {
  readonly invoice: InvoiceListItem | null
  readonly submitting: boolean
  readonly onClose: () => void
  readonly onConfirm: (motivo: string) => void
}

export function VoidInvoicePopup({
  invoice,
  submitting,
  onClose,
  onConfirm,
}: VoidInvoicePopupProps) {
  const [motivo, setMotivo] = useState('Anulación total')

  useEffect(() => {
    if (invoice) setMotivo('Anulación total')
  }, [invoice])
  const trimmed = motivo.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 300
  const docNumber = invoice
    ? `${invoice.establishment}-${invoice.emissionPoint}-${invoice.sequential}`
    : ''

  return (
    <Popup
      open={invoice !== null}
      title="Anular factura"
      onClose={onClose}
      width="min(92vw, 28rem)"
      closeOnOverlayClick={!submitting}
      closeOnEscape={!submitting}
      actions={[
        {
          id: 'cancel',
          label: 'Cancelar',
          variant: 'ghost',
          onClick: onClose,
          disabled: submitting,
        },
        {
          id: 'confirm',
          label: submitting ? 'Enviando…' : 'Emitir nota de crédito',
          variant: 'primary',
          disabled: submitting || !valid || !invoice,
          loading: submitting,
          onClick: () => {
            if (!valid || !invoice) return
            onConfirm(trimmed)
          },
        },
      ]}
    >
      {invoice ? (
        <div className="app-shell__muted">
          <p>
            Se emitirá una nota de crédito (04) por el total de la factura{' '}
            <strong>{docNumber}</strong> ({formatMoney(invoice.grandTotal)}). La factura autorizada
            no se borra; el SRI la deja anulada con este documento.
          </p>
          {invoice.voidMessage ? <p>{invoice.voidMessage}</p> : null}
          <TextArea
            id="void-invoice-motivo"
            label="Motivo"
            labelPosition="outlined"
            variant="outline"
            rows={3}
            maxLength={300}
            value={motivo}
            disabled={submitting}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMotivo(e.target.value)}
          />
        </div>
      ) : null}
    </Popup>
  )
}

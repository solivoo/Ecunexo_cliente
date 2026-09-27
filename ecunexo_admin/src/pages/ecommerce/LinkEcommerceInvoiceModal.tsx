import { useState } from 'react'
import { Popup, TextBox, useToast } from 'glubox'
import { linkEcommerceOrderInvoice } from '@/services/ecommerceApi'
import { readApiError } from '@/lib/readApiError'

interface Props {
  readonly open: boolean
  readonly onClose: () => void
  readonly onLinked: () => void
  readonly tenantId: string
  readonly orderId: string
  readonly orderNumber: string
}

export function LinkEcommerceInvoiceModal({
  open,
  onClose,
  onLinked,
  tenantId,
  orderId,
  orderNumber,
}: Props) {
  const toast = useToast()
  const [invoiceId, setInvoiceId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!invoiceId.trim()) {
      toast.show({ title: 'Validación', message: 'El ID o clave de acceso de factura es obligatorio.', variant: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      await linkEcommerceOrderInvoice(tenantId, orderId, {
        billingInvoiceId: invoiceId.trim(),
      })
      toast.show({
        title: 'Factura SRI Vinculada',
        message: `La factura electrónica fue vinculada exitosamente a la orden ${orderNumber}.`,
        variant: 'success',
      })
      onLinked()
      onClose()
    } catch (err) {
      const msg = readApiError(err, 'No se pudo vincular la factura.')
      toast.show({ title: 'Error', message: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popup
      open={open}
      onClose={onClose}
      title={`Vincular Factura SRI a Pedido ${orderNumber}`}
      width={480}
      actions={[
        {
          id: 'cancel',
          label: 'Cancelar',
          variant: 'outline',
          onClick: onClose,
          disabled: submitting,
        },
        {
          id: 'confirm',
          label: submitting ? 'Guardando...' : 'Vincular Factura',
          variant: 'primary',
          onClick: handleSubmit,
          disabled: submitting,
          loading: submitting,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <p className="ecu-companies-form__hint">
          Ingresa el identificador único de la factura electrónica emitida para asociarla
          permanentemente al pedido.
        </p>

        <TextBox
          id="link-invoice-id"
          label="ID Factura Billing / Clave de Acceso"
          labelPosition="outlined"
          variant="outline"
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          placeholder="Ej. a0b1c2d3-e4f5-…"
          disabled={submitting}
          required
          fullWidth
        />
      </div>
    </Popup>
  )
}

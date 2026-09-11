import { useState } from 'react'
import { Popup, TextBox, useToast } from 'glubox'
import { confirmEcommerceOrderPayment } from '@/services/ecommerceApi'
import { readApiError } from '@/lib/readApiError'

interface Props {
  readonly open: boolean
  readonly onClose: () => void
  readonly onConfirmed: () => void
  readonly tenantId: string
  readonly orderId: string
  readonly orderNumber: string
}

export function ConfirmEcommercePaymentModal({
  open,
  onClose,
  onConfirmed,
  tenantId,
  orderId,
  orderNumber,
}: Props) {
  const toast = useToast()
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await confirmEcommerceOrderPayment(tenantId, orderId, {
        paymentReference: reference.trim() || null,
      })
      toast.show({
        title: 'Pago Confirmado',
        message: `El pago del pedido ${orderNumber} fue validado. La orden pasa a estado Confirmada.`,
        variant: 'success',
      })
      onConfirmed()
      onClose()
    } catch (err) {
      const msg = readApiError(err, 'No se pudo confirmar el pago.')
      toast.show({ title: 'Error', message: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popup
      open={open}
      onClose={onClose}
      title={`Confirmar Pago de Pedido ${orderNumber}`}
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
          label: submitting ? 'Confirmando...' : 'Aprobar Pago',
          variant: 'primary',
          onClick: handleSubmit,
          disabled: submitting,
          loading: submitting,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--glb-muted)' }}>
          Al registrar la acreditación del pago, la orden pasará a estado Confirmada y lista para preparación en bodega.
        </p>

        <div>
          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500 }}>
            Número de Comprobante / Referencia Bancaria
          </label>
          <TextBox
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ej. DEP-982312, TRX-448123"
          />
        </div>
      </div>
    </Popup>
  )
}

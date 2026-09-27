import { useState } from 'react'
import { Popup, TextBox, useToast } from 'glubox'
import { cancelEcommerceOrder } from '@/services/ecommerceApi'
import { readApiError } from '@/lib/readApiError'

interface Props {
  readonly open: boolean
  readonly onClose: () => void
  readonly onCancelled: () => void
  readonly tenantId: string
  readonly orderId: string
  readonly orderNumber: string
}

export function CancelEcommerceOrderModal({
  open,
  onClose,
  onCancelled,
  tenantId,
  orderId,
  orderNumber,
}: Props) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.show({ title: 'Validación', message: 'El motivo de anulación es obligatorio.', variant: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      await cancelEcommerceOrder(tenantId, orderId, {
        reason: reason.trim(),
      })
      toast.show({
        title: 'Pedido Anulado',
        message: `El pedido ${orderNumber} fue anulado. Reserva de stock liberada exitosamente.`,
        variant: 'success',
      })
      onCancelled()
      onClose()
    } catch (err) {
      const msg = readApiError(err, 'No se pudo anular el pedido.')
      toast.show({ title: 'Error', message: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popup
      open={open}
      onClose={onClose}
      title={`Anular Pedido ${orderNumber}`}
      width={480}
      actions={[
        {
          id: 'cancel',
          label: 'Volver',
          variant: 'outline',
          onClick: onClose,
          disabled: submitting,
        },
        {
          id: 'confirm',
          label: submitting ? 'Anulando...' : 'Confirmar Anulación',
          variant: 'danger',
          onClick: handleSubmit,
          disabled: submitting,
          loading: submitting,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <p className="ecu-companies-form__hint">
          Al cancelar la orden, los productos reservados volverán a estar inmediatamente disponibles
          en el inventario para otros clientes.
        </p>

        <TextBox
          id="cancel-reason"
          label="Motivo de la Anulación"
          labelPosition="outlined"
          variant="outline"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. Pago no recibido en el plazo de 24h, cancelación solicitada por cliente…"
          disabled={submitting}
          required
          fullWidth
        />
      </div>
    </Popup>
  )
}

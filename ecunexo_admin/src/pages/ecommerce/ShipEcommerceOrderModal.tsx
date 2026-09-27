import { useState } from 'react'
import { Popup, TextBox, useToast } from 'glubox'
import { shipEcommerceOrder } from '@/services/ecommerceApi'
import { readApiError } from '@/lib/readApiError'

interface Props {
  readonly open: boolean
  readonly onClose: () => void
  readonly onShipped: () => void
  readonly tenantId: string
  readonly orderId: string
  readonly orderNumber: string
}

export function ShipEcommerceOrderModal({
  open,
  onClose,
  onShipped,
  tenantId,
  orderId,
  orderNumber,
}: Props) {
  const toast = useToast()
  const [carrier, setCarrier] = useState('Servientrega')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!carrier.trim()) {
      toast.show({ title: 'Validación', message: 'El transportista/courier es obligatorio.', variant: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      await shipEcommerceOrder(tenantId, orderId, {
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim() || null,
      })
      toast.show({
        title: 'Pedido Despachado',
        message: `El pedido ${orderNumber} fue despachado. Reserva de stock liquidada exitosamente.`,
        variant: 'success',
      })
      onShipped()
      onClose()
    } catch (err) {
      const msg = readApiError(err, 'No se pudo despachar el pedido.')
      toast.show({ title: 'Error', message: msg, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popup
      open={open}
      onClose={onClose}
      title={`Despachar Pedido ${orderNumber}`}
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
          label: submitting ? 'Despachando...' : 'Confirmar Despacho',
          variant: 'primary',
          onClick: handleSubmit,
          disabled: submitting,
          loading: submitting,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <p className="ecu-companies-form__hint">
          Al despachar el pedido, el stock reservado se descontará definitivamente del inventario
          físico (kárdex).
        </p>

        <TextBox
          id="ship-carrier"
          label="Transportista o Courier"
          labelPosition="outlined"
          variant="outline"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          placeholder="Ej. Servientrega, Urbano, Tramaco, Courier Propio"
          disabled={submitting}
          required
          fullWidth
        />

        <TextBox
          id="ship-tracking"
          label="Número de Guía o Rastreo"
          labelPosition="outlined"
          variant="outline"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="Ej. GUIA-0982348712"
          disabled={submitting}
          fullWidth
        />
      </div>
    </Popup>
  )
}

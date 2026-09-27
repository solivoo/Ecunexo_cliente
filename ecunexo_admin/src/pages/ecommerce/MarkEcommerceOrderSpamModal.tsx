import { useState } from 'react'
import { Popup, useToast } from 'glubox'
import { readApiError } from '@/lib/readApiError'
import { cancelEcommerceOrder } from '@/services/ecommerceApi'
import { createEcommerceBlockedContact } from '@/services/storefrontApi'

interface Props {
  readonly open: boolean
  readonly onClose: () => void
  readonly onDone: () => void
  readonly tenantId: string
  readonly orderId: string
  readonly orderNumber: string
  readonly customerEmail: string
  readonly customerPhone: string | null
}

export function MarkEcommerceOrderSpamModal({
  open,
  onClose,
  onDone,
  tenantId,
  orderId,
  orderNumber,
  customerEmail,
  customerPhone,
}: Props) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    const errors: string[] = []

    try {
      await cancelEcommerceOrder(tenantId, orderId, { reason: 'Spam' })
    } catch (err: unknown) {
      errors.push(readApiError(err, 'No se pudo cancelar el pedido.'))
    }

    const contacts = [
      { kind: 'Email' as const, value: customerEmail.trim() },
      { kind: 'Phone' as const, value: (customerPhone ?? '').trim() },
    ].filter((contact) => contact.value.length > 0)

    for (const contact of contacts) {
      try {
        await createEcommerceBlockedContact(tenantId, {
          kind: contact.kind,
          value: contact.value,
          reason: 'Spam',
        })
      } catch (err: unknown) {
        errors.push(readApiError(err, `No se pudo bloquear ${contact.value}.`))
      }
    }

    setSubmitting(false)

    if (errors.length === 0) {
      toast.show({
        title: 'Pedido marcado como spam',
        message: `El pedido ${orderNumber} fue cancelado y el contacto quedó bloqueado.`,
        variant: 'success',
      })
    } else {
      toast.show({
        title: 'Spam con observaciones',
        message: errors.join(' '),
        variant: 'warning',
      })
    }

    onDone()
    onClose()
  }

  return (
    <Popup
      open={open}
      onClose={onClose}
      title={`Marcar como spam · ${orderNumber}`}
      width={520}
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
          label: submitting ? 'Procesando...' : 'Marcar como spam',
          variant: 'danger',
          onClick: handleSubmit,
          disabled: submitting,
          loading: submitting,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <p className="ecu-companies-form__hint">
          Esta acción cancela el pedido con motivo «Spam» y bloquea el correo y el teléfono del
          cliente para que no pueda generar nuevos pedidos en la tienda.
        </p>
        <ul className="ecu-companies-form__hint" style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>Se libera la reserva de stock del pedido.</li>
          <li>El bloqueo del contacto es inmediato en el checkout público.</li>
        </ul>
      </div>
    </Popup>
  )
}

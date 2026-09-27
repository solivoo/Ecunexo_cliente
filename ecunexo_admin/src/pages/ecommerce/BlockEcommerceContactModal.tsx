import { useState } from 'react'
import { OptionGroup, Popup, TextBox, useToast } from 'glubox'
import { readApiError } from '@/lib/readApiError'
import { createEcommerceBlockedContact } from '@/services/storefrontApi'
import type { EcommerceBlockedContactKind } from '@/types/storefrontApi'

interface Props {
  readonly open: boolean
  readonly onClose: () => void
  readonly onBlocked: () => void
  readonly tenantId: string
  readonly orderNumber: string
  readonly customerEmail: string
  readonly customerPhone: string | null
}

const KIND_OPTIONS: { value: EcommerceBlockedContactKind; label: string }[] = [
  { value: 'Email', label: 'Correo' },
  { value: 'Phone', label: 'Teléfono' },
]

export function BlockEcommerceContactModal({
  open,
  onClose,
  onBlocked,
  tenantId,
  orderNumber,
  customerEmail,
  customerPhone,
}: Props) {
  const toast = useToast()
  const [kind, setKind] = useState<EcommerceBlockedContactKind>('Email')
  const [value, setValue] = useState(customerEmail)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleClose = () => {
    setKind('Email')
    setValue(customerEmail)
    setReason('')
    onClose()
  }

  const handleKindChange = (next: string) => {
    const nextKind: EcommerceBlockedContactKind = next === 'Phone' ? 'Phone' : 'Email'
    setKind(nextKind)
    setValue(nextKind === 'Email' ? customerEmail : (customerPhone ?? ''))
  }

  const handleSubmit = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      toast.show({
        title: 'Validación',
        message: 'Ingresa el correo o teléfono a bloquear.',
        variant: 'warning',
      })
      return
    }

    setSubmitting(true)
    try {
      await createEcommerceBlockedContact(tenantId, {
        kind,
        value: trimmed,
        reason: reason.trim() || null,
      })
      toast.show({
        title: 'Contacto bloqueado',
        message: `El contacto quedó bloqueado para la tienda (pedido ${orderNumber}).`,
        variant: 'success',
      })
      onBlocked()
      handleClose()
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo bloquear el contacto.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popup
      open={open}
      onClose={handleClose}
      title={`Bloquear contacto · ${orderNumber}`}
      width={520}
      actions={[
        {
          id: 'cancel',
          label: 'Volver',
          variant: 'outline',
          onClick: handleClose,
          disabled: submitting,
        },
        {
          id: 'confirm',
          label: submitting ? 'Bloqueando...' : 'Bloquear contacto',
          variant: 'danger',
          onClick: handleSubmit,
          disabled: submitting,
          loading: submitting,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <p className="ecu-companies-form__hint">
          El contacto bloqueado no podrá generar pedidos desde la tienda pública. Los pedidos
          existentes no se modifican.
        </p>

        <OptionGroup
          id="block-contact-kind"
          label="Tipo de contacto"
          options={KIND_OPTIONS}
          value={kind}
          onChange={handleKindChange}
          layout="horizontal"
          variant="outline"
          disabled={submitting}
        />

        <TextBox
          id="block-contact-value"
          label={kind === 'Email' ? 'Correo electrónico' : 'Teléfono'}
          labelPosition="outlined"
          variant="outline"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === 'Email' ? 'cliente@correo.com' : '0987654321'}
          disabled={submitting}
          required
          fullWidth
        />

        <TextBox
          id="block-contact-reason"
          label="Motivo (opcional)"
          labelPosition="outlined"
          variant="outline"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. Pedidos falsos o intentos de fraude"
          disabled={submitting}
          fullWidth
        />
      </div>
    </Popup>
  )
}

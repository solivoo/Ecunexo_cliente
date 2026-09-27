import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, CheckButton, NumberBox, OptionGroup, TextArea, TextBox, useToast } from 'glubox'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import {
  createEcommerceBlockedContact,
  deleteEcommerceBlockedContact,
  getEcommerceStorefrontSettings,
  listEcommerceBlockedContacts,
  updateEcommerceStorefrontSettings,
} from '@/services/storefrontApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
  EcommerceBlockedContact,
  EcommerceBlockedContactKind,
  EcommerceShippingOption,
  EcommerceStorefrontSettings,
} from '@/types/storefrontApi'

const PAYMENT_METHOD_OPTIONS = [
  { code: 'CreditCard', label: 'Tarjeta de crédito/débito' },
  { code: 'BankTransfer', label: 'Transferencia bancaria' },
  { code: 'CashOnDelivery', label: 'Contra entrega' },
  { code: 'PaymentGateway', label: 'Pago en línea' },
  { code: 'Other', label: 'Otro' },
] as const

const SHIPPING_METHOD_OPTIONS = [
  { code: 'Courier', label: 'Envío a domicilio' },
  { code: 'StorePickup', label: 'Retiro en tienda' },
  { code: 'LocalDelivery', label: 'Entrega local' },
] as const

const MIN_PAYMENT_HOLD_HOURS = 1
const MAX_PAYMENT_HOLD_HOURS = 720
const DEFAULT_PAYMENT_HOLD_HOURS = 2
const MIN_MAX_PENDING_ORDERS = 1
const MAX_MAX_PENDING_ORDERS = 50
const DEFAULT_MAX_PENDING_ORDERS = 3
const MAX_INSTRUCTIONS_LENGTH = 2000
const MAX_WHATSAPP_LENGTH = 20
const MAX_NOTIFICATION_EMAIL_LENGTH = 254
const WHATSAPP_ALLOWED_PATTERN = /^[0-9+\s]*$/
const EMAIL_ALLOWED_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const BLOCKED_CONTACT_KIND_OPTIONS: { value: EcommerceBlockedContactKind; label: string }[] = [
  { value: 'Email', label: 'Correo' },
  { value: 'Phone', label: 'Teléfono' },
]

const BLOCKED_CONTACT_KIND_LABELS: Record<EcommerceBlockedContactKind, string> = {
  Email: 'Correo',
  Phone: 'Teléfono',
}

type ShippingDraft = {
  readonly code: string
  readonly label: string
  readonly enabled: boolean
  readonly cost: number
}

function buildShippingDrafts(settings: EcommerceStorefrontSettings): ShippingDraft[] {
  return SHIPPING_METHOD_OPTIONS.map((option) => {
    const existing = settings.shippingMethods.find((method) => method.code === option.code)
    return {
      code: option.code,
      label: option.label,
      enabled: existing !== undefined,
      cost: existing?.cost ?? 0,
    }
  })
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

export function StorefrontSettingsPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('ecommerce.storefront.manage')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payments, setPayments] = useState<Record<string, boolean>>({})
  const [shipping, setShipping] = useState<ShippingDraft[]>([])
  const [instructions, setInstructions] = useState('')
  const [holdHours, setHoldHours] = useState(DEFAULT_PAYMENT_HOLD_HOURS)
  const [reserveOnOrder, setReserveOnOrder] = useState(true)
  const [contactWhatsapp, setContactWhatsapp] = useState('')
  const [ordersNotificationEmail, setOrdersNotificationEmail] = useState('')
  const [maxPendingOrders, setMaxPendingOrders] = useState(DEFAULT_MAX_PENDING_ORDERS)

  const [blockedContacts, setBlockedContacts] = useState<EcommerceBlockedContact[]>([])
  const [blockedLoading, setBlockedLoading] = useState(true)
  const [blockedKind, setBlockedKind] = useState<EcommerceBlockedContactKind>('Email')
  const [blockedValue, setBlockedValue] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const [blockedSaving, setBlockedSaving] = useState(false)
  const [blockedRemovingId, setBlockedRemovingId] = useState<string | null>(null)

  useEffect(() => {
    if (!canManage || !tenantId) return
    let cancelled = false
    getEcommerceStorefrontSettings(tenantId)
      .then((settings) => {
        if (cancelled) return
        setPayments(
          Object.fromEntries(
            PAYMENT_METHOD_OPTIONS.map((option) => [
              option.code,
              settings.paymentMethods.includes(option.code),
            ])
          )
        )
        setShipping(buildShippingDrafts(settings))
        setInstructions(settings.bankTransferInstructions ?? '')
        setHoldHours(settings.paymentHoldHours)
        setReserveOnOrder(settings.reserveOnOrder ?? true)
        setContactWhatsapp(settings.contactWhatsapp ?? '')
        setOrdersNotificationEmail(settings.ordersNotificationEmail ?? '')
        setMaxPendingOrders(settings.maxPendingOrders ?? DEFAULT_MAX_PENDING_ORDERS)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = readApiError(err, 'No se pudo cargar la configuración de la tienda.')
        setError(message)
        toast.show({ title: 'Error', message, variant: 'error' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canManage, tenantId, toast])

  const loadBlockedContacts = useCallback(async () => {
    if (!tenantId) return
    setBlockedLoading(true)
    try {
      const contacts = await listEcommerceBlockedContacts(tenantId)
      setBlockedContacts(contacts)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo cargar la lista de contactos bloqueados.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setBlockedLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    if (!canManage || !tenantId) return
    let cancelled = false
    listEcommerceBlockedContacts(tenantId)
      .then((contacts) => {
        if (!cancelled) setBlockedContacts(contacts)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = readApiError(err, 'No se pudo cargar la lista de contactos bloqueados.')
        toast.show({ title: 'Error', message, variant: 'error' })
      })
      .finally(() => {
        if (!cancelled) setBlockedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canManage, tenantId, toast])

  const handleAddBlockedContact = useCallback(async () => {
    if (!tenantId) return
    const value = blockedValue.trim()
    if (!value) {
      toast.show({
        title: 'Validación',
        message: 'Ingresa el correo o teléfono a bloquear.',
        variant: 'warning',
      })
      return
    }

    if (blockedKind === 'Email' && !EMAIL_ALLOWED_PATTERN.test(value)) {
      toast.show({
        title: 'Correo inválido',
        message: 'Ingresa un correo electrónico válido.',
        variant: 'warning',
      })
      return
    }

    if (blockedKind === 'Phone' && value.replace(/\D/g, '').length === 0) {
      toast.show({
        title: 'Teléfono inválido',
        message: 'Ingresa un teléfono con al menos un dígito.',
        variant: 'warning',
      })
      return
    }

    setBlockedSaving(true)
    try {
      await createEcommerceBlockedContact(tenantId, {
        kind: blockedKind,
        value,
        reason: blockedReason.trim() || null,
      })
      toast.show({
        title: 'Contacto bloqueado',
        message: 'El contacto ya no podrá generar pedidos en la tienda.',
        variant: 'success',
      })
      setBlockedValue('')
      setBlockedReason('')
      await loadBlockedContacts()
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo bloquear el contacto.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setBlockedSaving(false)
    }
  }, [blockedKind, blockedReason, blockedValue, loadBlockedContacts, tenantId, toast])

  const handleRemoveBlockedContact = useCallback(
    async (contact: EcommerceBlockedContact) => {
      if (!tenantId) return
      setBlockedRemovingId(contact.id)
      try {
        await deleteEcommerceBlockedContact(tenantId, contact.id)
        toast.show({
          title: 'Bloqueo eliminado',
          message: 'El contacto puede volver a comprar en la tienda.',
          variant: 'success',
        })
        await loadBlockedContacts()
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo quitar el bloqueo.')
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setBlockedRemovingId(null)
      }
    },
    [loadBlockedContacts, tenantId, toast]
  )

  const togglePayment = useCallback((code: string, checked: boolean) => {
    setPayments((current) => ({ ...current, [code]: checked }))
  }, [])

  const toggleShipping = useCallback((code: string, checked: boolean) => {
    setShipping((current) =>
      current.map((draft) => (draft.code === code ? { ...draft, enabled: checked } : draft))
    )
  }, [])

  const updateShippingCost = useCallback((code: string, cost: number) => {
    setShipping((current) =>
      current.map((draft) => (draft.code === code ? { ...draft, cost } : draft))
    )
  }, [])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!tenantId) return

      const paymentMethods = PAYMENT_METHOD_OPTIONS.filter((option) => payments[option.code]).map(
        (option) => option.code
      )
      if (paymentMethods.length === 0) {
        toast.show({
          title: 'Falta un método de pago',
          message: 'Habilita al menos un método de pago para la tienda.',
          variant: 'error',
        })
        return
      }

      const enabledShipping = shipping.filter((draft) => draft.enabled)
      if (enabledShipping.length === 0) {
        toast.show({
          title: 'Falta un método de envío',
          message: 'Habilita al menos un método de envío para la tienda.',
          variant: 'error',
        })
        return
      }

      if (enabledShipping.some((draft) => !Number.isFinite(draft.cost) || draft.cost < 0)) {
        toast.show({
          title: 'Costo de envío inválido',
          message: 'Los costos de envío deben ser mayores o iguales a 0.',
          variant: 'error',
        })
        return
      }

      if (
        !Number.isInteger(holdHours) ||
        holdHours < MIN_PAYMENT_HOLD_HOURS ||
        holdHours > MAX_PAYMENT_HOLD_HOURS
      ) {
        toast.show({
          title: 'Horas de reserva inválidas',
          message: `Las horas de reserva deben estar entre ${MIN_PAYMENT_HOLD_HOURS} y ${MAX_PAYMENT_HOLD_HOURS}.`,
          variant: 'error',
        })
        return
      }

      if (
        !Number.isInteger(maxPendingOrders) ||
        maxPendingOrders < MIN_MAX_PENDING_ORDERS ||
        maxPendingOrders > MAX_MAX_PENDING_ORDERS
      ) {
        toast.show({
          title: 'Máximo de pendientes inválido',
          message: `El máximo de pedidos pendientes debe estar entre ${MIN_MAX_PENDING_ORDERS} y ${MAX_MAX_PENDING_ORDERS}.`,
          variant: 'error',
        })
        return
      }

      if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
        toast.show({
          title: 'Instrucciones demasiado largas',
          message: `Las instrucciones no pueden superar ${MAX_INSTRUCTIONS_LENGTH} caracteres.`,
          variant: 'error',
        })
        return
      }

      const whatsapp = contactWhatsapp.trim()
      if (
        whatsapp.length > MAX_WHATSAPP_LENGTH ||
        (whatsapp.length > 0 && !WHATSAPP_ALLOWED_PATTERN.test(whatsapp))
      ) {
        toast.show({
          title: 'WhatsApp inválido',
          message: `Solo dígitos, + y espacios, con máximo ${MAX_WHATSAPP_LENGTH} caracteres.`,
          variant: 'error',
        })
        return
      }

      const notificationEmail = ordersNotificationEmail.trim()
      if (
        notificationEmail.length > MAX_NOTIFICATION_EMAIL_LENGTH ||
        (notificationEmail.length > 0 && !EMAIL_ALLOWED_PATTERN.test(notificationEmail))
      ) {
        toast.show({
          title: 'Correo de avisos inválido',
          message: `Ingresa un correo válido de máximo ${MAX_NOTIFICATION_EMAIL_LENGTH} caracteres.`,
          variant: 'error',
        })
        return
      }

      const shippingMethods: EcommerceShippingOption[] = enabledShipping.map((draft) => ({
        code: draft.code,
        cost: roundCurrency(draft.cost),
      }))

      setSaving(true)
      try {
        await updateEcommerceStorefrontSettings(tenantId, {
          paymentMethods,
          shippingMethods,
          bankTransferInstructions: payments.BankTransfer ? instructions.trim() || null : null,
          paymentHoldHours: holdHours,
          reserveOnOrder,
          contactWhatsapp: whatsapp || null,
          ordersNotificationEmail: notificationEmail || null,
          maxPendingOrders,
        })
        setError(null)
        toast.show({
          title: 'Configuración guardada',
          message: 'Los métodos de pago, envíos, contacto, avisos y reservas ya están vigentes en la tienda.',
          variant: 'success',
        })
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo guardar la configuración de la tienda.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setSaving(false)
      }
    },
    [
      contactWhatsapp,
      holdHours,
      instructions,
      maxPendingOrders,
      ordersNotificationEmail,
      payments,
      reserveOnOrder,
      shipping,
      tenantId,
      toast,
    ]
  )

  if (!canManage) {
    return (
      <TenantSessionGate
        title="Configuración de tienda"
        lead="Métodos de pago, envíos y reservas de la tienda online."
      >
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso ecommerce.storefront.manage para configurar la tienda online."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  if (loading) {
    return (
      <TenantSessionGate
        title="Configuración de tienda"
        lead="Métodos de pago, envíos y reservas de la tienda online."
      >
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Configuración de tienda"
            subtitle="Define los métodos de pago, costos de envío y la retención de stock de la tienda online."
          />
          <SectionCard title="Cargando…">
            <p className="app-shell__muted">Obteniendo la configuración actual de la tienda…</p>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Configuración de tienda"
      lead="Métodos de pago, envíos y reservas de la tienda online."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Configuración de tienda"
          subtitle="Define los métodos de pago, costos de envío y la retención de stock de la tienda online."
        />

        <form className="ecu-companies-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          <SectionCard
            title="Métodos de pago"
            subtitle="Selecciona cómo pueden pagar los clientes en el checkout."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <div
                  key={option.code}
                  className="ecu-companies-form__field ecu-companies-form__field--check-align"
                >
                  <CheckButton
                    variant="ghost"
                    checked={payments[option.code] ?? false}
                    onChange={(checked) => togglePayment(option.code, checked)}
                    disabled={saving}
                  >
                    {option.label}
                  </CheckButton>
                </div>
              ))}
            </div>

            {payments.BankTransfer ? (
              <div className="ecu-companies-form__field" style={{ marginTop: '1rem' }}>
                <TextArea
                  id="storefront-bank-instructions"
                  label="Instrucciones / datos bancarios"
                  labelPosition="outlined"
                  variant="outline"
                  value={instructions}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setInstructions(e.target.value)
                  }
                  placeholder="Ej. Transfiere a la cuenta 22001234 del Banco Pichincha, RUC 179…"
                  rows={4}
                  resize="vertical"
                  maxLength={MAX_INSTRUCTIONS_LENGTH}
                  disabled={saving}
                  fullWidth
                />
                <p className="ecu-companies-form__hint" style={{ marginTop: '0.35rem' }}>
                  Se muestra al comprador que elige transferencia bancaria. Máximo{' '}
                  {MAX_INSTRUCTIONS_LENGTH} caracteres.
                </p>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Métodos de envío"
            subtitle="Habilita los despachos disponibles y define su costo fijo."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
              {shipping.map((draft) => (
                <div
                  key={draft.code}
                  className="ecu-companies-form__field"
                  style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}
                >
                  <div
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: '3.25rem',
                    }}
                  >
                    <CheckButton
                      variant="ghost"
                      checked={draft.enabled}
                      onChange={(checked) => toggleShipping(draft.code, checked)}
                      disabled={saving}
                    >
                      {draft.label}
                    </CheckButton>
                  </div>
                  <div style={{ flex: '0 0 8.5rem' }}>
                    <NumberBox
                      id={`storefront-shipping-${draft.code}`}
                      label="Costo"
                      labelPosition="outlined"
                      variant="outline"
                      min={0}
                      step={0.01}
                      showSpinButtons
                      value={draft.cost}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateShippingCost(draft.code, Number(e.target.value) || 0)
                      }
                      disabled={saving || !draft.enabled}
                      fullWidth
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Contacto y avisos"
            subtitle="Datos de contacto de la tienda y correo que recibe los avisos de pedidos."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--2">
              <div className="ecu-companies-form__field">
                <TextBox
                  id="storefront-contact-whatsapp"
                  label="WhatsApp de la tienda"
                  labelPosition="outlined"
                  variant="outline"
                  value={contactWhatsapp}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setContactWhatsapp(e.target.value)
                  }
                  placeholder="593999999999"
                  maxLength={MAX_WHATSAPP_LENGTH}
                  disabled={saving}
                  fullWidth
                />
                <p className="ecu-companies-form__hint" style={{ marginTop: '0.35rem' }}>
                  Incluye el prefijo internacional, solo dígitos, + y espacios. Máximo{' '}
                  {MAX_WHATSAPP_LENGTH} caracteres.
                </p>
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="storefront-orders-notification-email"
                  label="Correo para avisos de pedidos"
                  labelPosition="outlined"
                  variant="outline"
                  type="email"
                  value={ordersNotificationEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setOrdersNotificationEmail(e.target.value)
                  }
                  placeholder="pedidos@tienda.com"
                  maxLength={MAX_NOTIFICATION_EMAIL_LENGTH}
                  disabled={saving}
                  fullWidth
                />
                <p className="ecu-companies-form__hint" style={{ marginTop: '0.35rem' }}>
                  Recibe un aviso por cada pedido nuevo y cada comprobante de pago. Déjalo vacío
                  para no enviar avisos al equipo.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Contactos bloqueados"
            subtitle="Correos y teléfonos que no pueden generar pedidos en la tienda."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
              <div className="ecu-companies-form__field">
                <OptionGroup
                  id="storefront-blocked-kind"
                  label="Tipo de contacto"
                  options={BLOCKED_CONTACT_KIND_OPTIONS}
                  value={blockedKind}
                  onChange={(value) => setBlockedKind(value === 'Phone' ? 'Phone' : 'Email')}
                  layout="horizontal"
                  variant="outline"
                  disabled={blockedSaving}
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="storefront-blocked-value"
                  label={blockedKind === 'Email' ? 'Correo electrónico' : 'Teléfono'}
                  labelPosition="outlined"
                  variant="outline"
                  value={blockedValue}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBlockedValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleAddBlockedContact()
                    }
                  }}
                  placeholder={blockedKind === 'Email' ? 'cliente@correo.com' : '0987654321'}
                  disabled={blockedSaving}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="storefront-blocked-reason"
                  label="Motivo (opcional)"
                  labelPosition="outlined"
                  variant="outline"
                  value={blockedReason}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBlockedReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleAddBlockedContact()
                    }
                  }}
                  placeholder="Ej. Spam o pedidos falsos"
                  disabled={blockedSaving}
                  fullWidth
                />
              </div>
            </div>
            <div className="ecu-companies-form__actions" style={{ justifyContent: 'flex-start' }}>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleAddBlockedContact()}
                loading={blockedSaving}
                disabled={blockedSaving}
              >
                {blockedSaving ? 'Bloqueando…' : 'Bloquear contacto'}
              </Button>
            </div>

            {blockedLoading ? (
              <p className="app-shell__muted">Cargando contactos bloqueados…</p>
            ) : blockedContacts.length === 0 ? (
              <p className="app-shell__muted">No hay contactos bloqueados.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ecu-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Motivo</th>
                      <th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedContacts.map((contact) => (
                      <tr key={contact.id}>
                        <td>{BLOCKED_CONTACT_KIND_LABELS[contact.kind] ?? contact.kind}</td>
                        <td style={{ fontWeight: 600 }}>{contact.valueNormalized}</td>
                        <td>{contact.reason || '—'}</td>
                        <td>{formatDate(contact.createdAt)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleRemoveBlockedContact(contact)}
                            disabled={blockedRemovingId === contact.id}
                          >
                            {blockedRemovingId === contact.id ? 'Quitando…' : 'Quitar'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Reservas"
            subtitle="Reserva de stock y tiempo que se retiene un pedido sin pago confirmado."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="storefront-hold-hours"
                  label="Horas de reserva"
                  labelPosition="outlined"
                  variant="outline"
                  min={MIN_PAYMENT_HOLD_HOURS}
                  max={MAX_PAYMENT_HOLD_HOURS}
                  step={1}
                  showSpinButtons
                  value={holdHours}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setHoldHours(Number(e.target.value) || 0)
                  }
                  disabled={saving}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <p className="ecu-companies-form__hint" style={{ marginTop: '1.1rem' }}>
                  Horas que se reserva el stock sin pago confirmado. Rango permitido:{' '}
                  {MIN_PAYMENT_HOLD_HOURS} a {MAX_PAYMENT_HOLD_HOURS} horas (por defecto{' '}
                  {DEFAULT_PAYMENT_HOLD_HOURS}).
                </p>
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--check-align">
                <CheckButton
                  variant="ghost"
                  checked={reserveOnOrder}
                  onChange={setReserveOnOrder}
                  disabled={saving}
                >
                  Reservar stock al crear el pedido
                </CheckButton>
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <p className="ecu-companies-form__hint" style={{ marginTop: '0.75rem' }}>
                  Si está desactivado, el stock se reserva al confirmar el pago.
                </p>
              </div>
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="storefront-max-pending-orders"
                  label="Máximo de pedidos pendientes por contacto"
                  labelPosition="outlined"
                  variant="outline"
                  min={MIN_MAX_PENDING_ORDERS}
                  max={MAX_MAX_PENDING_ORDERS}
                  step={1}
                  showSpinButtons
                  value={maxPendingOrders}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setMaxPendingOrders(Number(e.target.value) || 0)
                  }
                  disabled={saving}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <p className="ecu-companies-form__hint" style={{ marginTop: '1.1rem' }}>
                  Pedidos impagos que puede acumular un mismo correo o teléfono. Rango permitido:{' '}
                  {MIN_MAX_PENDING_ORDERS} a {MAX_MAX_PENDING_ORDERS} (por defecto{' '}
                  {DEFAULT_MAX_PENDING_ORDERS}).
                </p>
              </div>
            </div>
          </SectionCard>

          <div className="ecu-companies-form__actions">
            <Button type="submit" variant="primary" loading={saving} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </TenantSessionGate>
  )
}

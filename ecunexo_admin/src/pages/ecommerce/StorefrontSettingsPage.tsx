import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Button, CheckButton, NumberBox, Select, TextArea, TextBox, useToast } from 'glubox'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import './storefrontSettingsLayout.css'
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
  EcommerceStorefrontSettings,
  StorefrontSocialLinks,
  UpdateEcommerceStorefrontSettingsInput,
} from '@/types/storefrontApi'

const PAYMENT_METHOD_OPTIONS = [
  { code: 'CreditCard', label: 'Tarjeta de crédito/débito' },
  { code: 'BankTransfer', label: 'Transferencia bancaria' },
  { code: 'CashOnDelivery', label: 'Contra entrega' },
  { code: 'PaymentGateway', label: 'Pago en línea' },
  { code: 'Other', label: 'Otro' },
] as const

const MIN_PAYMENT_HOLD_HOURS = 1
const MAX_PAYMENT_HOLD_HOURS = 720
const DEFAULT_PAYMENT_HOLD_HOURS = 2
const MIN_MAX_PENDING_ORDERS = 1
const MAX_MAX_PENDING_ORDERS = 50
const DEFAULT_MAX_PENDING_ORDERS = 3
const MIN_MIN_ORDER_AMOUNT = 0
const MAX_MIN_ORDER_AMOUNT = 10000
const DEFAULT_MIN_ORDER_AMOUNT = 0
const MAX_INSTRUCTIONS_LENGTH = 2000
const MAX_WHATSAPP_LENGTH = 20
const MAX_NOTIFICATION_EMAIL_LENGTH = 254
const MAINTENANCE_MESSAGE_MAX_LENGTH = 300
const MAX_SOCIAL_URL_LENGTH = 300
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

function normalizeSocialUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`
  if (withScheme.length > MAX_SOCIAL_URL_LENGTH) return null
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return withScheme
  } catch {
    return null
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_STATUS_LABEL: Record<Exclude<SaveStatus, 'idle'>, string> = {
  saving: 'Guardando…',
  saved: 'Guardado',
  error: 'Sin guardar',
}

function SaveStatusLabel({ status }: { readonly status: SaveStatus }) {
  if (status === 'idle') return null
  return (
    <span
      className={`ecu-storefront-settings__status ecu-storefront-settings__status--${status}`}
      role="status"
      aria-live="polite"
    >
      {SAVE_STATUS_LABEL[status]}
    </span>
  )
}

/** Arma el objeto completo que exige la API a partir de lo persistido, sobrescribiendo solo `patch`. */
function buildUpdateInput(
  base: EcommerceStorefrontSettings,
  patch: Partial<UpdateEcommerceStorefrontSettingsInput>
): UpdateEcommerceStorefrontSettingsInput {
  const paymentMethods = patch.paymentMethods ?? base.paymentMethods
  const instructions =
    patch.bankTransferInstructions !== undefined
      ? patch.bankTransferInstructions
      : base.bankTransferInstructions
  return {
    paymentMethods,
    shippingMethods: base.shippingMethods,
    bankTransferInstructions: paymentMethods.includes('BankTransfer')
      ? (instructions ?? '').trim() || null
      : null,
    paymentHoldHours: base.paymentHoldHours,
    reserveOnOrder: base.reserveOnOrder ?? true,
    contactWhatsapp: base.contactWhatsapp || null,
    ordersNotificationEmail: base.ordersNotificationEmail || null,
    maxPendingOrders: base.maxPendingOrders ?? DEFAULT_MAX_PENDING_ORDERS,
    maintenanceEnabled: base.maintenanceEnabled ?? false,
    maintenanceMessage: base.maintenanceMessage || null,
    minOrderAmount: base.minOrderAmount ?? DEFAULT_MIN_ORDER_AMOUNT,
    socialLinks: base.socialLinks,
    ...patch,
  }
}

/** Confirma el campo con Enter; el guardado ocurre en el blur. */
function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.currentTarget.blur()
}

export function StorefrontSettingsPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('ecommerce.storefront.manage')

  const [loading, setLoading] = useState(true)
  const savedRef = useRef<EcommerceStorefrontSettings | null>(null)
  const writeChain = useRef<Promise<unknown>>(Promise.resolve())
  const [cardStatus, setCardStatus] = useState<Record<string, SaveStatus>>({})
  const [error, setError] = useState<string | null>(null)
  const [payments, setPayments] = useState<Record<string, boolean>>({})
  const [instructions, setInstructions] = useState('')
  const [holdHours, setHoldHours] = useState(DEFAULT_PAYMENT_HOLD_HOURS)
  const [contactWhatsapp, setContactWhatsapp] = useState('')
  const [ordersNotificationEmail, setOrdersNotificationEmail] = useState('')
  const [maxPendingOrders, setMaxPendingOrders] = useState(DEFAULT_MAX_PENDING_ORDERS)
  const [minOrderAmount, setMinOrderAmount] = useState(DEFAULT_MIN_ORDER_AMOUNT)
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [instagram, setInstagram] = useState('')
  const [facebook, setFacebook] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

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
        savedRef.current = settings
        setPayments(
          Object.fromEntries(
            PAYMENT_METHOD_OPTIONS.map((option) => [
              option.code,
              settings.paymentMethods.includes(option.code),
            ])
          )
        )
        setInstructions(settings.bankTransferInstructions ?? '')
        setHoldHours(settings.paymentHoldHours)
        setContactWhatsapp(settings.contactWhatsapp ?? '')
        setOrdersNotificationEmail(settings.ordersNotificationEmail ?? '')
        setMaxPendingOrders(settings.maxPendingOrders ?? DEFAULT_MAX_PENDING_ORDERS)
        setMinOrderAmount(settings.minOrderAmount ?? DEFAULT_MIN_ORDER_AMOUNT)
        setMaintenanceEnabled(settings.maintenanceEnabled ?? false)
        setMaintenanceMessage(settings.maintenanceMessage ?? '')
        setInstagram(settings.socialLinks?.instagram ?? '')
        setFacebook(settings.socialLinks?.facebook ?? '')
        setTiktok(settings.socialLinks?.tiktok ?? '')
        setWhatsapp(settings.socialLinks?.whatsapp ?? '')
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

  /** Estado de una card: el peor de sus campos (error > guardando > guardado). */
  const statusOf = (card: string): SaveStatus => {
    const values = Object.entries(cardStatus)
      .filter(([key]) => key.startsWith(`${card}:`))
      .map(([, value]) => value)
    if (values.includes('error')) return 'error'
    if (values.includes('saving')) return 'saving'
    if (values.includes('saved')) return 'saved'
    return 'idle'
  }

  const showValidationError = useCallback(
    (key: string, title: string, message: string) => {
      setCardStatus((current) => ({ ...current, [key]: 'error' }))
      toast.show({ title, message, variant: 'error' })
    },
    [toast]
  )

  /**
   * Guarda solo el patch indicado. Las escrituras van en cola: cada una parte de lo que dejó
   * persistido la anterior, así dos campos que se confirman seguidos no se pisan.
   */
  const persist = useCallback(
    (key: string, patch: Partial<UpdateEcommerceStorefrontSettingsInput>) => {
      if (!tenantId) return Promise.resolve(null)
      const run = async (): Promise<EcommerceStorefrontSettings | null> => {
        const base = savedRef.current
        if (!base) return null
        setCardStatus((current) => ({ ...current, [key]: 'saving' }))
        try {
          const updated = await updateEcommerceStorefrontSettings(
            tenantId,
            buildUpdateInput(base, patch)
          )
          savedRef.current = updated
          setError(null)
          setCardStatus((current) => ({ ...current, [key]: 'saved' }))
          return updated
        } catch (err: unknown) {
          const message = readApiError(err, 'No se pudo guardar la configuración de la tienda.')
          setError(message)
          setCardStatus((current) => ({ ...current, [key]: 'error' }))
          toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
          return null
        }
      }
      const queued = writeChain.current.then(run)
      writeChain.current = queued
      return queued
    },
    [tenantId, toast]
  )

  const togglePayment = useCallback(
    async (code: string, checked: boolean) => {
      const previous = payments
      const next = { ...payments, [code]: checked }
      const paymentMethods = PAYMENT_METHOD_OPTIONS.filter((option) => next[option.code]).map(
        (option) => option.code
      )
      if (paymentMethods.length === 0) {
        showValidationError(
          'payments:methods',
          'Falta un método de pago',
          'Habilita al menos un método de pago para la tienda.'
        )
        return
      }
      setPayments(next)
      const updated = await persist('payments:methods', { paymentMethods })
      if (!updated) {
        setPayments(previous)
      } else if (code === 'BankTransfer') {
        setInstructions(updated.bankTransferInstructions ?? '')
      }
    },
    [payments, persist, showValidationError]
  )

  const saveBankInstructions = useCallback(
    async (raw: string) => {
      setCardStatus((current) => ({ ...current, ['payments:instructions']: 'idle' }))
      if (raw.length > MAX_INSTRUCTIONS_LENGTH) {
        showValidationError(
          'payments:instructions',
          'Instrucciones demasiado largas',
          `Las instrucciones no pueden superar ${MAX_INSTRUCTIONS_LENGTH} caracteres.`
        )
        return
      }
      const value = raw.trim() || null
      if (value === (savedRef.current?.bankTransferInstructions?.trim() || null)) return
      const updated = await persist('payments:instructions', { bankTransferInstructions: value })
      if (updated) setInstructions(updated.bankTransferInstructions ?? '')
    },
    [persist, showValidationError]
  )

  const saveMinOrder = useCallback(
    async (value: number) => {
      setCardStatus((current) => ({ ...current, ['minOrder:amount']: 'idle' }))
      if (!Number.isFinite(value) || value < MIN_MIN_ORDER_AMOUNT || value > MAX_MIN_ORDER_AMOUNT) {
        showValidationError(
          'minOrder:amount',
          'Pedido mínimo inválido',
          `El pedido mínimo debe estar entre ${MIN_MIN_ORDER_AMOUNT} y ${MAX_MIN_ORDER_AMOUNT} USD (0 = sin mínimo).`
        )
        return
      }
      const amount = roundCurrency(value)
      if (amount === roundCurrency(savedRef.current?.minOrderAmount ?? DEFAULT_MIN_ORDER_AMOUNT)) return
      const updated = await persist('minOrder:amount', { minOrderAmount: amount })
      if (updated) setMinOrderAmount(updated.minOrderAmount)
    },
    [persist, showValidationError]
  )

  const saveHoldHours = useCallback(
    async (value: number) => {
      setCardStatus((current) => ({ ...current, ['reservations:hold']: 'idle' }))
      if (
        !Number.isInteger(value) ||
        value < MIN_PAYMENT_HOLD_HOURS ||
        value > MAX_PAYMENT_HOLD_HOURS
      ) {
        showValidationError(
          'reservations:hold',
          'Horas de reserva inválidas',
          `Las horas de reserva deben estar entre ${MIN_PAYMENT_HOLD_HOURS} y ${MAX_PAYMENT_HOLD_HOURS}.`
        )
        return
      }
      if (value === savedRef.current?.paymentHoldHours) return
      const updated = await persist('reservations:hold', { paymentHoldHours: value })
      if (updated) setHoldHours(updated.paymentHoldHours)
    },
    [persist, showValidationError]
  )

  const saveMaxPendingOrders = useCallback(
    async (value: number) => {
      setCardStatus((current) => ({ ...current, ['reservations:pending']: 'idle' }))
      if (
        !Number.isInteger(value) ||
        value < MIN_MAX_PENDING_ORDERS ||
        value > MAX_MAX_PENDING_ORDERS
      ) {
        showValidationError(
          'reservations:pending',
          'Máximo de pendientes inválido',
          `El máximo de pedidos pendientes debe estar entre ${MIN_MAX_PENDING_ORDERS} y ${MAX_MAX_PENDING_ORDERS}.`
        )
        return
      }
      if (value === savedRef.current?.maxPendingOrders) return
      const updated = await persist('reservations:pending', { maxPendingOrders: value })
      if (updated) setMaxPendingOrders(updated.maxPendingOrders)
    },
    [persist, showValidationError]
  )

  const saveWhatsapp = useCallback(
    async (raw: string) => {
      setCardStatus((current) => ({ ...current, ['contact:whatsapp']: 'idle' }))
      const value = raw.trim()
      if (
        value.length > MAX_WHATSAPP_LENGTH ||
        (value.length > 0 && !WHATSAPP_ALLOWED_PATTERN.test(value))
      ) {
        showValidationError(
          'contact:whatsapp',
          'WhatsApp inválido',
          `Solo dígitos, + y espacios, con máximo ${MAX_WHATSAPP_LENGTH} caracteres.`
        )
        return
      }
      if ((savedRef.current?.contactWhatsapp ?? '') === value) return
      const updated = await persist('contact:whatsapp', { contactWhatsapp: value || null })
      if (updated) setContactWhatsapp(updated.contactWhatsapp ?? '')
    },
    [persist, showValidationError]
  )

  const saveNotificationEmail = useCallback(
    async (raw: string) => {
      setCardStatus((current) => ({ ...current, ['contact:email']: 'idle' }))
      const value = raw.trim()
      if (
        value.length > MAX_NOTIFICATION_EMAIL_LENGTH ||
        (value.length > 0 && !EMAIL_ALLOWED_PATTERN.test(value))
      ) {
        showValidationError(
          'contact:email',
          'Correo de avisos inválido',
          `Ingresa un correo válido de máximo ${MAX_NOTIFICATION_EMAIL_LENGTH} caracteres.`
        )
        return
      }
      if ((savedRef.current?.ordersNotificationEmail ?? '') === value) return
      const updated = await persist('contact:email', { ordersNotificationEmail: value || null })
      if (updated) setOrdersNotificationEmail(updated.ordersNotificationEmail ?? '')
    },
    [persist, showValidationError]
  )

  const saveSocialLink = useCallback(
    async (field: keyof StorefrontSocialLinks, raw: string) => {
      setCardStatus((current) => ({ ...current, [`social:${field}`]: 'idle' }))
      const normalized = normalizeSocialUrl(raw)
      if (normalized === null) {
        showValidationError(
          `social:${field}`,
          'Red social inválida',
          `Cada red debe ser un enlace https de máximo ${MAX_SOCIAL_URL_LENGTH} caracteres, o quedar vacía.`
        )
        return
      }
      const current: StorefrontSocialLinks = savedRef.current?.socialLinks ?? {
        instagram: '',
        facebook: '',
        tiktok: '',
        whatsapp: '',
      }
      if (current[field] === normalized) return
      const updated = await persist(`social:${field}`, {
        socialLinks: { ...current, [field]: normalized },
      })
      if (!updated) return
      const value = updated.socialLinks?.[field] ?? ''
      if (field === 'instagram') setInstagram(value)
      else if (field === 'facebook') setFacebook(value)
      else if (field === 'tiktok') setTiktok(value)
      else setWhatsapp(value)
    },
    [persist, showValidationError]
  )

  const toggleMaintenance = useCallback(
    async (checked: boolean) => {
      const previous = maintenanceEnabled
      setMaintenanceEnabled(checked)
      const updated = await persist('maintenance:toggle', { maintenanceEnabled: checked })
      if (!updated) setMaintenanceEnabled(previous)
    },
    [maintenanceEnabled, persist]
  )

  const saveMaintenanceMessage = useCallback(
    async (raw: string) => {
      setCardStatus((current) => ({ ...current, ['maintenance:message']: 'idle' }))
      const value = raw.trim()
      if ((savedRef.current?.maintenanceMessage ?? '') === value) return
      const updated = await persist('maintenance:message', { maintenanceMessage: value || null })
      if (updated) setMaintenanceMessage(updated.maintenanceMessage ?? '')
    },
    [persist]
  )

  if (!canManage) {
    return (
      <TenantSessionGate
        title="Configuración de tienda"
        lead="Pagos, reservas, contacto y mantenimiento de la tienda online."
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
        lead="Pagos, reservas, contacto y mantenimiento de la tienda online."
      >
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Configuración de tienda"
            info="Define los métodos de pago, la retención de stock y los datos de contacto de la tienda online."
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
      lead="Pagos, reservas, contacto y mantenimiento de la tienda online."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Configuración de tienda"
          info="Cada card se guarda sola: los campos al salir de ellos (o con Enter) y los checks al marcarlos."
        />

        <div className="ecu-companies-form">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          <div className="ecu-storefront-settings__grid">
            <SectionCard
              title="Métodos de pago"
              info="Cómo pueden pagar los clientes en el checkout. Al marcar o desmarcar se guarda al instante. Las instrucciones bancarias se muestran a quien elige transferencia (máximo 2000 caracteres)."
              action={<SaveStatusLabel status={statusOf('payments')} />}
            >
              <div className="ecu-storefront-settings__fields">
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <div
                    key={option.code}
                    className="ecu-companies-form__field ecu-companies-form__field--check-align"
                  >
                    <CheckButton
                      variant="ghost"
                      checked={payments[option.code] ?? false}
                      onChange={(checked) => void togglePayment(option.code, checked)}
                    >
                      {option.label}
                    </CheckButton>
                  </div>
                ))}
              </div>

              {payments.BankTransfer ? (
                <div className="ecu-storefront-settings__field--full">
                  <TextArea
                    id="storefront-bank-instructions"
                    label="Instrucciones / datos bancarios"
                    labelPosition="outlined"
                    variant="outline"
                    value={instructions}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setInstructions(e.target.value)
                    }
                    onBlur={(e) => void saveBankInstructions(e.currentTarget.value)}
                    placeholder="Ej. Cuenta 22001234 del Banco Pichincha, RUC 179…"
                    rows={3}
                    resize="vertical"
                    maxLength={MAX_INSTRUCTIONS_LENGTH}
                    fullWidth
                  />
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title="Compra mínima"
              info="Monto mínimo del pedido. Si el subtotal no lo alcanza, la tienda no permite finalizar la compra. Usa 0 para no exigir mínimo (máximo 10000 USD)."
              action={<SaveStatusLabel status={statusOf('minOrder')} />}
            >
              <div className="ecu-storefront-settings__fields">
                <NumberBox
                  id="storefront-min-order-amount"
                  label="Pedido mínimo (USD)"
                  labelPosition="outlined"
                  variant="outline"
                  min={MIN_MIN_ORDER_AMOUNT}
                  max={MAX_MIN_ORDER_AMOUNT}
                  step={0.01}
                  showSpinButtons
                  value={minOrderAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setMinOrderAmount(Number(e.target.value) || 0)
                  }
                  onBlur={(e) => void saveMinOrder(Number(e.currentTarget.value) || 0)}
                  onKeyDown={blurOnEnter}
                  fullWidth
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Reservas"
              info={`Horas de reserva: de ${MIN_PAYMENT_HOLD_HOURS} a ${MAX_PAYMENT_HOLD_HOURS} (por defecto ${DEFAULT_PAYMENT_HOLD_HOURS}). Pendientes por contacto: pedidos impagos que puede acumular un mismo correo o teléfono, de ${MIN_MAX_PENDING_ORDERS} a ${MAX_MAX_PENDING_ORDERS} (por defecto ${DEFAULT_MAX_PENDING_ORDERS}).`}
              action={<SaveStatusLabel status={statusOf('reservations')} />}
            >
              <div className="ecu-storefront-settings__fields">
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
                  onBlur={(e) => void saveHoldHours(Number(e.currentTarget.value) || 0)}
                  onKeyDown={blurOnEnter}
                  fullWidth
                />
                <NumberBox
                  id="storefront-max-pending-orders"
                  label="Pendientes por contacto"
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
                  onBlur={(e) => void saveMaxPendingOrders(Number(e.currentTarget.value) || 0)}
                  onKeyDown={blurOnEnter}
                  fullWidth
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Contacto y avisos"
              info={`WhatsApp con prefijo internacional (solo dígitos, + y espacios, máximo ${MAX_WHATSAPP_LENGTH}). El correo recibe un aviso por cada pedido nuevo y cada comprobante de pago; déjalo vacío para no enviar avisos al equipo.`}
              action={<SaveStatusLabel status={statusOf('contact')} />}
            >
              <div className="ecu-storefront-settings__fields">
                <TextBox
                  id="storefront-contact-whatsapp"
                  label="WhatsApp de la tienda"
                  labelPosition="outlined"
                  variant="outline"
                  value={contactWhatsapp}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setContactWhatsapp(e.target.value)
                  }
                  onBlur={(e) => void saveWhatsapp(e.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  placeholder="593999999999"
                  maxLength={MAX_WHATSAPP_LENGTH}
                  fullWidth
                />
                <TextBox
                  id="storefront-orders-notification-email"
                  label="Correo de avisos"
                  labelPosition="outlined"
                  variant="outline"
                  type="email"
                  value={ordersNotificationEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setOrdersNotificationEmail(e.target.value)
                  }
                  onBlur={(e) => void saveNotificationEmail(e.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  placeholder="pedidos@tienda.com"
                  maxLength={MAX_NOTIFICATION_EMAIL_LENGTH}
                  fullWidth
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Redes sociales"
              info="Se muestran en el pie de la vitrina pública. Déjalas vacías para no exhibirlas."
              action={<SaveStatusLabel status={statusOf('social')} />}
            >
              <div className="ecu-storefront-settings__fields">
                <TextBox
                  id="storefront-social-instagram"
                  label="Instagram"
                  labelPosition="outlined"
                  variant="outline"
                  value={instagram}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setInstagram(e.target.value)}
                  onBlur={(e) => void saveSocialLink('instagram', e.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  placeholder="https://instagram.com/tienda"
                  maxLength={MAX_SOCIAL_URL_LENGTH}
                  fullWidth
                />
                <TextBox
                  id="storefront-social-facebook"
                  label="Facebook"
                  labelPosition="outlined"
                  variant="outline"
                  value={facebook}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFacebook(e.target.value)}
                  onBlur={(e) => void saveSocialLink('facebook', e.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  placeholder="https://facebook.com/tienda"
                  maxLength={MAX_SOCIAL_URL_LENGTH}
                  fullWidth
                />
                <TextBox
                  id="storefront-social-tiktok"
                  label="TikTok"
                  labelPosition="outlined"
                  variant="outline"
                  value={tiktok}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTiktok(e.target.value)}
                  onBlur={(e) => void saveSocialLink('tiktok', e.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  placeholder="https://www.tiktok.com/@tienda"
                  maxLength={MAX_SOCIAL_URL_LENGTH}
                  fullWidth
                />
                <TextBox
                  id="storefront-social-whatsapp"
                  label="WhatsApp"
                  labelPosition="outlined"
                  variant="outline"
                  value={whatsapp}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setWhatsapp(e.target.value)}
                  onBlur={(e) => void saveSocialLink('whatsapp', e.currentTarget.value)}
                  onKeyDown={blurOnEnter}
                  placeholder="https://wa.me/593999999999"
                  maxLength={MAX_SOCIAL_URL_LENGTH}
                  fullWidth
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Mantenimiento"
              info={`Mientras esté activo, la tienda muestra una pantalla de mantenimiento y no acepta pedidos. El interruptor se aplica al instante; el mensaje (máximo ${MAINTENANCE_MESSAGE_MAX_LENGTH} caracteres) se guarda al salir del campo.`}
              action={<SaveStatusLabel status={statusOf('maintenance')} />}
            >
              <div className="ecu-storefront-settings__fields">
                <div className="ecu-companies-form__field ecu-companies-form__field--check-align">
                  <CheckButton
                    variant="ghost"
                    checked={maintenanceEnabled}
                    onChange={(checked) => void toggleMaintenance(checked)}
                  >
                    Tienda en mantenimiento
                  </CheckButton>
                </div>
                <div className="ecu-storefront-settings__field--full">
                  <TextArea
                    id="storefront-maintenance-message"
                    label="Mensaje al comprador"
                    labelPosition="outlined"
                    variant="outline"
                    rows={3}
                    maxLength={MAINTENANCE_MESSAGE_MAX_LENGTH}
                    value={maintenanceMessage}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setMaintenanceMessage(e.target.value)
                    }
                    onBlur={(e) => void saveMaintenanceMessage(e.currentTarget.value)}
                    placeholder="Ej. Volvemos en unas horas."
                    fullWidth
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Contactos bloqueados"
              info="Correos y teléfonos que no pueden generar pedidos en la tienda."
            >
              <div className="ecu-storefront-settings__fields">
                <div className="ecu-companies-form__field">
                  <Select
                    id="storefront-blocked-kind"
                    label="Tipo de contacto"
                    labelPosition="outlined"
                    variant="outline"
                    options={BLOCKED_CONTACT_KIND_OPTIONS}
                    value={blockedKind}
                    onChange={(value) => setBlockedKind(value === 'Phone' ? 'Phone' : 'Email')}
                    disabled={blockedSaving}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="storefront-blocked-value"
                    label={blockedKind === 'Email' ? 'Correo electrónico' : 'Teléfono'}
                    labelPosition="outlined"
                    variant="outline"
                    value={blockedValue}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setBlockedValue(e.target.value)
                    }
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
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setBlockedReason(e.target.value)
                    }
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
              <div className="ecu-companies-form__actions">
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

              <div className="ecu-storefront-settings__list-header">
                <span>Contactos bloqueados</span>
                <span className="ecu-storefront-settings__count">
                  {blockedLoading ? '…' : blockedContacts.length}
                </span>
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
          </div>
        </div>
      </div>
    </TenantSessionGate>
  )
}

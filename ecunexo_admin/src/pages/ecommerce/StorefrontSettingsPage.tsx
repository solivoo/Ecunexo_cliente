import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, CheckButton, NumberBox, TextArea, TextBox, useToast } from 'glubox'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import {
  getEcommerceStorefrontSettings,
  updateEcommerceStorefrontSettings,
} from '@/services/storefrontApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
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
const MAX_INSTRUCTIONS_LENGTH = 2000
const MAX_WHATSAPP_LENGTH = 20
const WHATSAPP_ALLOWED_PATTERN = /^[0-9+\s]*$/

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
        })
        setError(null)
        toast.show({
          title: 'Configuración guardada',
          message: 'Los métodos de pago, envíos, contacto y reservas ya están vigentes en la tienda.',
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
    [contactWhatsapp, holdHours, instructions, payments, reserveOnOrder, shipping, tenantId, toast]
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
            title="Contacto"
            subtitle="Número de WhatsApp mostrado al comprador para consultas sobre su pedido."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
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
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <p className="ecu-companies-form__hint" style={{ marginTop: '1.1rem' }}>
                  Incluye el prefijo internacional, solo dígitos, + y espacios. Máximo{' '}
                  {MAX_WHATSAPP_LENGTH} caracteres.
                </p>
              </div>
            </div>
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

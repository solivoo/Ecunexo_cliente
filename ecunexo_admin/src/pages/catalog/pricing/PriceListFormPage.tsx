import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, CheckButton, DateBox, NumberBox, Select, TextBox, useToast } from 'glubox'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { createPriceList, listPriceLists, updatePriceList } from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { todayIso } from '@/pages/catalog/pricing/pricingFormat'

const CURRENCIES = [
  { value: 'USD', label: 'USD — Dólar' },
]

export function PriceListFormPage() {
  const { priceListId } = useParams<{ priceListId: string }>()
  const isEdit = Boolean(priceListId)
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('catalog.pricing.create')
  const canUpdate = useHasPermission('catalog.pricing.update')
  const canManage = isEdit ? canUpdate : canCreate

  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [priority, setPriority] = useState(0)
  const [validFrom, setValidFrom] = useState(todayIso())
  const [validTo, setValidTo] = useState('')
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false)
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    if (!isEdit || !tenantId) return
    let cancelled = false
    setLoading(true)
    void listPriceLists(tenantId, false)
      .then((lists) => {
        if (cancelled) return
        const list = lists.find((l) => l.id === priceListId)
        if (!list) {
          setError('La lista de precios no existe.')
          return
        }
        setCode(list.code)
        setName(list.name)
        setDescription(list.description ?? '')
        setCurrency(list.currency)
        setPriority(list.priority)
        setValidFrom(list.validFrom)
        setValidTo(list.validTo ?? '')
        setPricesIncludeTax(list.pricesIncludeTax)
        setIsDefault(list.isDefault)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(readApiError(err, 'No se pudo cargar la lista de precios.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, priceListId, tenantId])

  const onSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre de la lista es obligatorio.')
        if (!isEdit && !code.trim()) throw new Error('El código de la lista es obligatorio.')

        const body = {
          name: name.trim(),
          description: description.trim() || null,
          currency,
          pricesIncludeTax,
          validFrom,
          validTo: validTo || null,
          priority,
          isDefault,
        }

        if (isEdit && priceListId) {
          await updatePriceList(tenantId, priceListId, body)
          toast.show({ title: 'Lista actualizada', message: `«${body.name}» guardada.`, variant: 'success' })
        } else {
          await createPriceList(tenantId, { code: code.trim(), ...body })
          toast.show({ title: 'Lista creada', message: `«${body.name}» ya está disponible.`, variant: 'success' })
        }

        void navigate('/catalogo/precios/listas', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar la lista de precios.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      code,
      currency,
      description,
      isDefault,
      isEdit,
      name,
      navigate,
      priceListId,
      pricesIncludeTax,
      priority,
      tenantId,
      toast,
      validFrom,
      validTo,
    ]
  )

  if (!canManage) {
    return (
      <TenantSessionGate title="Lista de precios" lead="Configuración de una lista comercial.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permiso de creación o edición de precios para gestionar listas."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Lista de precios" lead="Configuración de una lista comercial.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title={isEdit ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
          subtitle="Define código, moneda, vigencia y si los precios cargados incluyen impuesto."
          badge={<StatusBadge tone="primary">{isEdit ? 'Edición' : 'Nueva'}</StatusBadge>}
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard title="Datos de la lista">
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
              <div className="ecu-companies-form__field">
                <TextBox
                  id="pl-code"
                  label="Código"
                  labelPosition="outlined"
                  variant="outline"
                  value={code}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.toUpperCase())}
                  placeholder="PUBLICO"
                  disabled={busy || loading || isEdit}
                  required
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="pl-name"
                  label="Nombre"
                  labelPosition="outlined"
                  variant="outline"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder="Precio público"
                  disabled={busy || loading}
                  required
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="pl-description"
                  label="Descripción"
                  labelPosition="outlined"
                  variant="outline"
                  value={description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                  placeholder="Escriba aquí…"
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <Select
                  id="pl-currency"
                  aria-label="Moneda"
                  variant="outline"
                  options={CURRENCIES}
                  value={currency}
                  onChange={(value) => setCurrency(String(value))}
                  disabled={busy || loading}
                />
              </div>
              <div className="ecu-companies-form__field">
                <DateBox
                  id="pl-from"
                  label="Vigente desde"
                  labelPosition="outlined"
                  variant="outline"
                  value={validFrom}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setValidFrom(e.target.value)}
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <DateBox
                  id="pl-to"
                  label="Vigente hasta"
                  labelPosition="outlined"
                  variant="outline"
                  value={validTo}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setValidTo(e.target.value)}
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="pl-priority"
                  label="Prioridad"
                  labelPosition="outlined"
                  variant="outline"
                  value={priority}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPriority(Number(e.target.value) || 0)}
                  step={1}
                  showSpinButtons
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field sri-config-field--check-align">
                <CheckButton
                  variant="ghost"
                  checked={pricesIncludeTax}
                  onChange={setPricesIncludeTax}
                  disabled={busy || loading}
                >
                  Los precios incluyen IVA
                </CheckButton>
              </div>
              <div className="ecu-companies-form__field sri-config-field--check-align">
                <CheckButton
                  variant="ghost"
                  checked={isDefault}
                  onChange={setIsDefault}
                  disabled={busy || loading}
                >
                  Lista predeterminada de la empresa
                </CheckButton>
              </div>
            </div>

            <div className="ecu-companies-form__actions" style={{ marginTop: '1.5rem' }}>
              <Button type="submit" variant="primary" loading={busy} disabled={busy || loading}>
                {isEdit ? 'Guardar cambios' : 'Crear lista'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || loading}
                onClick={() => void navigate('/catalogo/precios/listas')}
              >
                Cancelar
              </Button>
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}

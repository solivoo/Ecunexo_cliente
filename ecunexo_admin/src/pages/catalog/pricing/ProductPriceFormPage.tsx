import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  CheckButton,
  DateBox,
  NumberBox,
  Select,
  TextBox,
  useToast,
} from 'glubox'
import { Trash2 } from 'lucide-react'
import {
  GridIconButton,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { CatalogItemPicker } from '@/pages/catalog/pricing/CatalogItemPicker'
import { todayIso } from '@/pages/catalog/pricing/pricingFormat'
import { listCatalogItems } from '@/services/catalogApi'
import {
  createProductPrice,
  getProductPrice,
  listPriceLists,
  updateProductPrice,
} from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { PriceListDto, PriceTierBody } from '@/types/pricingApi'

type TierDraft = {
  quantityFrom: string
  quantityTo: string
  unitPrice: string
}

const emptyTier = (): TierDraft => ({ quantityFrom: '', quantityTo: '', unitPrice: '' })

export function ProductPriceFormPage() {
  const { priceId } = useParams<{ priceId: string }>()
  const isEdit = Boolean(priceId)
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('catalog.pricing.create')
  const canUpdate = useHasPermission('catalog.pricing.update')
  const canManage = isEdit ? canUpdate : canCreate

  const [items, setItems] = useState<CatalogItemListItemDto[]>([])
  const [lists, setLists] = useState<PriceListDto[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [itemId, setItemId] = useState('')
  const [itemLabel, setItemLabel] = useState('')
  const [listId, setListId] = useState('')
  const [price, setPrice] = useState('0')
  const [validFrom, setValidFrom] = useState(todayIso())
  const [validTo, setValidTo] = useState('')
  const [reason, setReason] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [tiers, setTiers] = useState<TierDraft[]>([])

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    setLoading(true)
    const tasks: Promise<unknown>[] = [
      listCatalogItems(tenantId, { kind: CatalogItemKind.Physical }).then((data) => {
        if (!cancelled) setItems(data)
      }),
      listPriceLists(tenantId, true).then((data) => {
        if (!cancelled) {
          setLists(data)
          const preferred = data.find((l) => l.isDefault) ?? data[0]
          if (preferred) setListId((current) => current || preferred.id)
        }
      }),
    ]

    if (isEdit && priceId) {
      tasks.push(
        getProductPrice(tenantId, priceId).then((detail) => {
          if (cancelled) return
          setItemId(detail.catalogItemId)
          setItemLabel(detail.sku ? `${detail.itemName} · ${detail.sku}` : detail.itemName)
          setListId(detail.priceListId)
          setPrice(String(detail.price))
          setValidFrom(detail.validFrom)
          setValidTo(detail.validTo ?? '')
          setIsActive(detail.isActive)
          setTiers(
            detail.tiers
              .filter((tier) => tier.isActive !== false)
              .map((tier) => ({
                quantityFrom: String(tier.quantityFrom),
                quantityTo: tier.quantityTo === null ? '' : String(tier.quantityTo),
                unitPrice: String(tier.unitPrice),
              }))
          )
        })
      )
    }

    void Promise.all(tasks)
      .catch((err: unknown) => {
        if (!cancelled) setError(readApiError(err, 'No se pudo cargar la información del precio.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isEdit, priceId, tenantId])

  const buildTiers = useCallback((): PriceTierBody[] => {
    return tiers
      .filter((tier) => tier.quantityFrom.trim() !== '' && tier.unitPrice.trim() !== '')
      .map((tier) => ({
        quantityFrom: Number(tier.quantityFrom),
        quantityTo: tier.quantityTo.trim() === '' ? null : Number(tier.quantityTo),
        unitPrice: Number(tier.unitPrice),
      }))
  }, [tiers])

  const onSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!isEdit && !itemId) throw new Error('Selecciona el producto a cotizar.')
        if (!listId) throw new Error('Selecciona la lista de precios.')
        const numericPrice = Number(price)
        if (!Number.isFinite(numericPrice) || numericPrice < 0) {
          throw new Error('El precio debe ser un número mayor o igual a cero.')
        }

        const tierPayload = buildTiers()
        for (const tier of tierPayload) {
          if (!Number.isFinite(tier.quantityFrom) || tier.quantityFrom <= 0) {
            throw new Error('Cada escala debe tener una cantidad inicial mayor que cero.')
          }
          if (tier.quantityTo !== null && tier.quantityTo < tier.quantityFrom) {
            throw new Error('La cantidad final de una escala no puede ser menor que la inicial.')
          }
          if (!Number.isFinite(tier.unitPrice) || tier.unitPrice < 0) {
            throw new Error('El precio de una escala no puede ser negativo.')
          }
        }

        if (isEdit && priceId) {
          await updateProductPrice(tenantId, priceId, {
            price: numericPrice,
            validFrom,
            validTo: validTo || null,
            reason: reason.trim() || null,
            isActive,
            tiers: tierPayload,
          })
          toast.show({ title: 'Precio actualizado', message: 'La vigencia fue guardada.', variant: 'success' })
        } else {
          await createProductPrice(tenantId, {
            priceListId: listId,
            catalogItemId: itemId,
            price: numericPrice,
            validFrom,
            validTo: validTo || null,
            reason: reason.trim() || null,
            tiers: tierPayload,
          })
          toast.show({ title: 'Precio creado', message: 'La nueva vigencia está activa.', variant: 'success' })
        }

        void navigate('/catalogo/precios/productos', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar el precio.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      buildTiers,
      isActive,
      isEdit,
      itemId,
      listId,
      navigate,
      price,
      priceId,
      reason,
      tenantId,
      toast,
      validFrom,
      validTo,
    ]
  )

  const updateTier = useCallback((index: number, patch: Partial<TierDraft>) => {
    setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)))
  }, [])

  const removeTier = useCallback((index: number) => {
    setTiers((current) => current.filter((_, i) => i !== index))
  }, [])

  if (!canManage) {
    return (
      <TenantSessionGate title="Precio de producto" lead="Vigencia de precio por lista.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permiso de creación o edición de precios."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Precio de producto" lead="Vigencia de precio por lista.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title={isEdit ? 'Editar Precio' : 'Nuevo Precio'}
          subtitle="Una nueva vigencia cierra la anterior sin destruir el historial."
          badge={<StatusBadge tone="primary">{isEdit ? 'Edición' : 'Nueva vigencia'}</StatusBadge>}
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard title="Datos de la vigencia">
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            {isEdit ? (
              <p className="ecu-companies-form__hint" style={{ marginBottom: '0.75rem' }}>
                Producto: <strong>{itemLabel || '—'}</strong>
              </p>
            ) : (
              <CatalogItemPicker
                items={items}
                value={itemId}
                onChange={setItemId}
                disabled={busy || loading}
                searchId="pp-item-search"
                selectId="pp-item-select"
                placeholder="Buscar por nombre o SKU…"
              />
            )}

            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
              <div className="ecu-companies-form__field">
                <Select
                  id="pp-list"
                  aria-label="Lista de precios"
                  variant="outline"
                  options={lists.map((l) => ({
                    value: l.id,
                    label: l.isDefault ? `${l.code} · predeterminada` : l.code,
                  }))}
                  value={listId}
                  onChange={(value) => setListId(String(value))}
                  disabled={busy || loading || isEdit}
                />
              </div>
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="pp-price"
                  label="Precio"
                  labelPosition="outlined"
                  variant="outline"
                  value={Number(price) || 0}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                  step={0.01}
                  min={0}
                  showSpinButtons
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <DateBox
                  id="pp-from"
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
                  id="pp-to"
                  label="Vigente hasta"
                  labelPosition="outlined"
                  variant="outline"
                  value={validTo}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setValidTo(e.target.value)}
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                <TextBox
                  id="pp-reason"
                  label="Motivo del cambio"
                  labelPosition="outlined"
                  variant="outline"
                  value={reason}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
                  placeholder="Escriba aquí…"
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              {isEdit ? (
                <div className="ecu-companies-form__field sri-config-field--check-align">
                  <CheckButton
                    variant="ghost"
                    checked={isActive}
                    onChange={setIsActive}
                    disabled={busy || loading}
                  >
                    Precio activo
                  </CheckButton>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Escalas por cantidad"
            subtitle="Opcional. El motor usa la escala cuya cantidad inicial sea la mayor aplicable."
          >
            {tiers.length === 0 ? (
              <p className="app-shell__muted" style={{ marginBottom: '0.75rem' }}>
                Sin escalas: se aplicará el precio de lista para cualquier cantidad.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tiers.map((tier, index) => (
                  <div
                    key={`tier-${index}`}
                    className="ecu-companies-form__grid ecu-companies-form__grid--4"
                    style={{ alignItems: 'end' }}
                  >
                    <div className="ecu-companies-form__field">
                      <NumberBox
                        id={`tier-from-${index}`}
                        label="Cantidad desde"
                        labelPosition="outlined"
                        variant="outline"
                        value={Number(tier.quantityFrom) || 0}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateTier(index, { quantityFrom: e.target.value })
                        }
                        min={0}
                        step={1}
                        showSpinButtons
                        disabled={busy || loading}
                        fullWidth
                      />
                    </div>
                    <div className="ecu-companies-form__field">
                      <NumberBox
                        id={`tier-to-${index}`}
                        label="Cantidad hasta"
                        labelPosition="outlined"
                        variant="outline"
                        value={Number(tier.quantityTo) || 0}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateTier(index, { quantityTo: e.target.value })
                        }
                        min={0}
                        step={1}
                        showSpinButtons
                        disabled={busy || loading}
                        fullWidth
                      />
                    </div>
                    <div className="ecu-companies-form__field">
                      <NumberBox
                        id={`tier-price-${index}`}
                        label="Precio unitario"
                        labelPosition="outlined"
                        variant="outline"
                        value={Number(tier.unitPrice) || 0}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          updateTier(index, { unitPrice: e.target.value })
                        }
                        min={0}
                        step={0.01}
                        showSpinButtons
                        disabled={busy || loading}
                        fullWidth
                      />
                    </div>
                    <div className="ecu-companies-form__field" style={{ paddingBottom: '0.35rem' }}>
                      <GridIconButton
                        label="Quitar escala"
                        icon={Trash2}
                        danger
                        disabled={busy || loading}
                        onClick={() => removeTier(index)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '0.75rem' }}>
              <Button
                type="button"
                variant="outline"
                disabled={busy || loading}
                onClick={() => setTiers((current) => [...current, emptyTier()])}
              >
                + Añadir escala
              </Button>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="ecu-companies-form__actions">
              <Button type="submit" variant="primary" loading={busy} disabled={busy || loading}>
                {isEdit ? 'Guardar cambios' : 'Crear precio'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || loading}
                onClick={() => void navigate('/catalogo/precios/productos')}
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

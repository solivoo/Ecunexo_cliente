import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, DateBox, NumberBox, Select, useToast } from 'glubox'
import {
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { CatalogItemPicker } from '@/pages/catalog/pricing/CatalogItemPicker'
import { formatMoney, todayIso } from '@/pages/catalog/pricing/pricingFormat'
import { listCatalogItems } from '@/services/catalogApi'
import { listPriceLists, resolvePrice } from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { PriceListDto, PricingResultDto } from '@/types/pricingApi'

export function PriceSimulatorPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)
  const canRead = useHasPermission('catalog.pricing.read')

  const [items, setItems] = useState<CatalogItemListItemDto[]>([])
  const [lists, setLists] = useState<PriceListDto[]>([])
  const [itemId, setItemId] = useState('')
  const [listId, setListId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [date, setDate] = useState(todayIso())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PricingResultDto | null>(null)

  useEffect(() => {
    if (!tenantId || !canRead) return
    void listCatalogItems(tenantId, { kind: CatalogItemKind.Physical }).then(setItems).catch(() => setItems([]))
    void listPriceLists(tenantId, true).then(setLists).catch(() => setLists([]))
  }, [canRead, tenantId])

  const onSimulate = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!itemId) throw new Error('Selecciona el producto a simular.')
        const numericQuantity = Number(quantity)
        if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
          throw new Error('La cantidad debe ser mayor que cero.')
        }

        const data = await resolvePrice(tenantId, {
          catalogItemId: itemId,
          quantity: numericQuantity,
          date,
          priceListId: listId || undefined,
        })
        setResult(data)
      } catch (err: unknown) {
        setResult(null)
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo resolver el precio.')
        setError(message)
        toast.show({ title: 'No se pudo simular', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [date, itemId, listId, quantity, tenantId, toast]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Simulador de precios" lead="Resolución de precio con el motor de ventas.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres el permiso catalog.pricing.read para usar el simulador."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Simulador de precios" lead="Resolución de precio con el motor de ventas.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Simulador de Precios"
          subtitle="Usa el mismo motor que ventas, ecommerce y facturación: lista, escala, promoción, descuento, impuesto y precio final."
        />

        <form onSubmit={(e) => void onSimulate(e)} noValidate>
          <SectionCard title="Datos de la simulación">
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <CatalogItemPicker
              items={items}
              value={itemId}
              onChange={setItemId}
              disabled={busy}
              searchId="sim-item-search"
              selectId="sim-item-select"
            />

            <div className="ecu-companies-form__grid ecu-companies-form__grid--3" style={{ marginTop: '0.75rem' }}>
              <div className="ecu-companies-form__field">
                <Select
                  id="sim-list"
                  aria-label="Lista de precios"
                  variant="outline"
                  options={[
                    { value: '', label: 'Predeterminada' },
                    ...lists.map((l) => ({ value: l.id, label: l.code })),
                  ]}
                  value={listId}
                  onChange={(value) => setListId(String(value))}
                  disabled={busy}
                />
              </div>
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="sim-quantity"
                  label="Cantidad"
                  labelPosition="outlined"
                  variant="outline"
                  value={Number(quantity) || 0}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                  min={0}
                  step={1}
                  showSpinButtons
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <DateBox
                  id="sim-date"
                  label="Fecha"
                  labelPosition="outlined"
                  variant="outline"
                  value={date}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                  disabled={busy}
                  fullWidth
                />
              </div>
            </div>

            <div className="ecu-companies-form__actions" style={{ marginTop: '1.25rem' }}>
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                Simular
              </Button>
            </div>
          </SectionCard>
        </form>

        {result ? (
          <SectionCard
            title="Desglose del precio"
            subtitle={`Lista ${result.priceListCode} · ${result.currency}`}
          >
            <dl className="ecu-spec-list" style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt>Precio de lista</dt>
                <dd>{formatMoney(result.listPrice)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt>Precio unitario aplicado</dt>
                <dd>
                  {formatMoney(result.unitPrice)}
                  {result.tierLabel ? ` · escala ${result.tierLabel}` : ''}
                </dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt>Subtotal</dt>
                <dd>{formatMoney(result.subtotal)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt>Descuento</dt>
                <dd>{formatMoney(result.discountAmount)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt>Precio neto</dt>
                <dd>{formatMoney(result.netPrice)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <dt>Impuesto ({(result.taxRate * 100).toFixed(2)}%)</dt>
                <dd>{formatMoney(result.taxAmount)}</dd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <dt>Precio final</dt>
                <dd>{formatMoney(result.finalPrice)}</dd>
              </div>
            </dl>

            {result.appliedRules.length > 0 ? (
              <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {result.appliedRules.map((rule) => (
                  <span key={rule} className="ecu-chip">
                    {rule}
                  </span>
                ))}
              </div>
            ) : null}
          </SectionCard>
        ) : null}
      </div>
    </TenantSessionGate>
  )
}

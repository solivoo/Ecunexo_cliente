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
import type { CatalogItemListItemDto } from '@/types/catalogApi'
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
  const [batchLines, setBatchLines] = useState<
    Array<{
      itemId: string
      name: string
      sku: string | null
      quantity: number
      result: PricingResultDto | null
    }>
  >([])

  useEffect(() => {
    if (!tenantId || !canRead) return
    void listCatalogItems(tenantId)
      .then((data) => setItems(data.filter((item) => !item.isMatrixParent)))
      .catch(() => setItems([]))
    void listPriceLists(tenantId, true).then(setLists).catch(() => setLists([]))
  }, [canRead, tenantId])

  const handleAddToBatch = useCallback(() => {
    if (!itemId) {
      toast.show({
        title: 'Selecciona un producto',
        message: 'Elige un producto del selector para agregarlo a la tabla de simulación.',
        variant: 'warning',
      })
      return
    }
    const found = items.find((i) => i.id === itemId)
    if (!found) return
    const qty = Math.max(1, Number(quantity) || 1)
    setBatchLines((prev) => {
      const existing = prev.find((line) => line.itemId === itemId)
      if (existing) {
        return prev.map((line) =>
          line.itemId === itemId ? { ...line, quantity: qty, result: null } : line
        )
      }
      return [
        ...prev,
        {
          itemId: found.id,
          name: found.name,
          sku: found.sku ?? null,
          quantity: qty,
          result: null,
        },
      ]
    })
  }, [itemId, items, quantity, toast])

  const handleSimulateBatch = useCallback(async () => {
    if (!tenantId || batchLines.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const updated = await Promise.all(
        batchLines.map(async (line) => {
          const res = await resolvePrice(tenantId, {
            catalogItemId: line.itemId,
            quantity: Math.max(1, Number(line.quantity) || 1),
            date,
            priceListId: listId || undefined,
          })
          return { ...line, result: res }
        })
      )
      setBatchLines(updated)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : readApiError(err, 'No se pudo simular el lote.')
      setError(message)
      toast.show({ title: 'Error al simular tabla', message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }, [batchLines, date, listId, tenantId, toast])

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
                  label="Lista de precios"
                  labelPosition="outlined"
                  variant="outline"
                  options={[
                    { value: '', label: 'Predeterminada (de la empresa)' },
                    ...lists.map((l) => ({ value: l.id, label: `${l.code} · ${l.name}` })),
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

            <p className="ecu-companies-form__hint" style={{ marginTop: '0.9rem' }}>
              El simulador busca el precio vigente del producto en la lista elegida y luego aplica la
              escala por cantidad, las promociones y el IVA. Si eliges «Predeterminada», usa la lista
              predeterminada de la empresa.
            </p>

            <div className="ecu-companies-form__actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                Simular
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !itemId}
                onClick={handleAddToBatch}
              >
                + Agregar al grid comparativo
              </Button>
              {batchLines.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  loading={busy}
                  disabled={busy}
                  onClick={() => void handleSimulateBatch()}
                >
                  Simular grid ({batchLines.length})
                </Button>
              ) : null}
            </div>
          </SectionCard>
        </form>

        {batchLines.length > 0 ? (
          <SectionCard
            title="Simulación multi-producto (Grid comparativo)"
            subtitle={`Compara escalas, promociones, márgenes e impuestos de ${batchLines.length} producto(s) simultáneamente`}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="ecu-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Producto</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', width: '7rem' }}>Cant.</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>P. Lista</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>P. Unitario</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Descuento</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Neto</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>IVA</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total Final</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Reglas / Margen</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {batchLines.map((line) => (
                    <tr key={line.itemId} style={{ borderTop: '1px solid var(--shell-border, rgba(125,125,125,0.2))' }}>
                      <td style={{ padding: '0.5rem' }}>
                        <div style={{ fontWeight: 600 }}>{line.name}</div>
                        {line.sku ? (
                          <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>SKU: {line.sku}</div>
                        ) : null}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          disabled={busy}
                          onChange={(e) => {
                            const nextQty = Math.max(1, Number(e.target.value) || 1)
                            setBatchLines((prev) =>
                              prev.map((row) =>
                                row.itemId === line.itemId
                                  ? { ...row, quantity: nextQty, result: null }
                                  : row
                              )
                            )
                          }}
                          style={{ width: '5rem', textAlign: 'right', padding: '0.25rem 0.4rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        {line.result ? formatMoney(line.result.listPrice) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        {line.result ? (
                          <>
                            {formatMoney(line.result.unitPrice)}
                            {line.result.tierLabel ? (
                              <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>
                                Escala: {line.result.tierLabel}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        {line.result ? formatMoney(line.result.discountAmount) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        {line.result ? formatMoney(line.result.netPrice) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        {line.result ? formatMoney(line.result.taxAmount) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                        {line.result ? formatMoney(line.result.finalPrice) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {line.result ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {line.result.isBelowCost ? (
                              <StatusBadge tone="danger">Bajo costo</StatusBadge>
                            ) : line.result.marginPercent != null ? (
                              <StatusBadge tone="success">
                                Margen {line.result.marginPercent.toFixed(1)}%
                              </StatusBadge>
                            ) : null}
                            {line.result.appliedRules.map((rule) => (
                              <span key={rule} className="ecu-chip" style={{ fontSize: '0.7rem' }}>
                                {rule}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>Pendiente simular</span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            setBatchLines((prev) => prev.filter((row) => row.itemId !== line.itemId))
                          }
                        >
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {batchLines.some((l) => l.result != null) ? (
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--shell-border, rgba(125,125,125,0.3))', fontWeight: 700 }}>
                      <td style={{ padding: '0.6rem 0.5rem' }}>Totales simulados</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                        {batchLines.reduce((acc, l) => acc + l.quantity, 0)}
                      </td>
                      <td colSpan={2} />
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                        {formatMoney(
                          batchLines.reduce((acc, l) => acc + (l.result?.discountAmount ?? 0), 0)
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                        {formatMoney(
                          batchLines.reduce((acc, l) => acc + (l.result?.netPrice ?? 0), 0)
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                        {formatMoney(
                          batchLines.reduce((acc, l) => acc + (l.result?.taxAmount ?? 0), 0)
                        )}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                        {formatMoney(
                          batchLines.reduce((acc, l) => acc + (l.result?.finalPrice ?? 0), 0)
                        )}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </SectionCard>
        ) : null}

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

            {result.averageCost != null ? (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: result.isBelowCost
                    ? '1px solid var(--color-danger, #ef4444)'
                    : '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                  backgroundColor: result.isBelowCost
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.05))',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <dt>Costo promedio (inventario)</dt>
                  <dd>{formatMoney(result.averageCost)}</dd>
                </div>
                {result.marginPercent != null ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <dt>Margen estimado</dt>
                    <dd
                      style={{
                        fontWeight: 600,
                        color: result.isBelowCost
                          ? 'var(--color-danger, #ef4444)'
                          : 'var(--color-success, #16a34a)',
                      }}
                    >
                      {result.marginPercent.toFixed(2)}%
                    </dd>
                  </div>
                ) : null}
                {result.isBelowCost ? (
                  <p
                    role="alert"
                    style={{
                      margin: '0.5rem 0 0',
                      fontSize: '0.8125rem',
                      color: 'var(--color-danger, #ef4444)',
                      fontWeight: 600,
                    }}
                  >
                    ⚠ El precio neto está por debajo del costo promedio de inventario.
                  </p>
                ) : null}
              </div>
            ) : null}

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

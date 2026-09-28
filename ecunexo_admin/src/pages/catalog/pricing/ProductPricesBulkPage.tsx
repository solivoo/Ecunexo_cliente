import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, DateBox, NumberBox, Select, TextBox, useToast } from 'glubox'
import { Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { todayIso } from '@/pages/catalog/pricing/pricingFormat'
import { listCatalogItems } from '@/services/catalogApi'
import { bulkCreateProductPrices, listPriceLists, listProductPrices } from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { PriceListDto } from '@/types/pricingApi'

type SelectedProduct = {
  id: string
  name: string
  sku: string | null
  price: string
}

const MAX_VISIBLE_RESULTS = 40

function parsePrice(raw: string): number {
  return Number(raw.replace(',', '.'))
}

export function ProductPricesBulkPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('catalog.pricing.create')

  const [items, setItems] = useState<CatalogItemListItemDto[]>([])
  const [lists, setLists] = useState<PriceListDto[]>([])
  const [currentPrices, setCurrentPrices] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [listId, setListId] = useState(() => searchParams.get('priceListId') ?? '')
  const [validFrom, setValidFrom] = useState(todayIso())
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')
  const [bulkPrice, setBulkPrice] = useState('')
  const [selected, setSelected] = useState<SelectedProduct[]>([])

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void (async () => {
      try {
        setLoading(true)
        const [catalog, priceLists] = await Promise.all([
          listCatalogItems(tenantId, { kind: CatalogItemKind.Physical }),
          listPriceLists(tenantId, true),
        ])
        if (cancelled) return
        setItems(catalog.filter((i) => !i.isMatrixParent))
        setLists(priceLists)
        setListId((current) => {
          if (current) return current
          const preferred = priceLists.find((l) => l.isDefault) ?? priceLists[0]
          return preferred ? preferred.id : current
        })
      } catch (err: unknown) {
        if (!cancelled) setError(readApiError(err, 'No se pudo cargar el catálogo.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId || !listId) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await listProductPrices(tenantId, { priceListId: listId, onlyVigent: true })
        if (cancelled) return
        setCurrentPrices(new Map(rows.map((row) => [row.catalogItemId, row.price])))
      } catch {
        if (!cancelled) setCurrentPrices(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [listId, tenantId])

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected])

  const available = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items
      .filter((item) => !selectedIds.has(item.id))
      .filter((item) => {
        if (!term) return true
        const name = item.name.toLowerCase()
        const sku = (item.sku ?? '').toLowerCase()
        return name.includes(term) || sku.includes(term)
      })
      .slice(0, MAX_VISIBLE_RESULTS)
  }, [items, search, selectedIds])

  const addProduct = useCallback(
    (item: CatalogItemListItemDto) => {
      setSelected((prev) => {
        if (prev.some((s) => s.id === item.id)) return prev
        const current = currentPrices.get(item.id)
        return [
          ...prev,
          {
            id: item.id,
            name: item.name,
            sku: item.sku,
            price: current != null ? String(current) : '',
          },
        ]
      })
      setSearch('')
    },
    [currentPrices]
  )

  const removeProduct = useCallback((id: string) => {
    setSelected((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const setProductPrice = useCallback((id: string, price: string) => {
    setSelected((prev) => prev.map((s) => (s.id === id ? { ...s, price } : s)))
  }, [])

  const applyBulkPrice = useCallback(
    (onlyEmpty: boolean) => {
      if (!bulkPrice.trim()) return
      setSelected((prev) =>
        prev.map((s) => (onlyEmpty && s.price.trim() !== '' ? s : { ...s, price: bulkPrice }))
      )
    },
    [bulkPrice]
  )

  const onSubmit = useCallback(async () => {
    if (!tenantId) return
    setError(null)
    setBusy(true)
    try {
      if (!listId) throw new Error('Selecciona la lista de precios.')
      if (!validFrom) throw new Error('Indica la fecha de vigencia inicial.')
      if (!reason.trim()) throw new Error('Indica el motivo de la carga masiva.')
      if (selected.length === 0) throw new Error('Agrega al menos un producto.')

      const parsed = selected.map((s) => ({ catalogItemId: s.id, price: parsePrice(s.price) }))
      if (parsed.some((p) => !Number.isFinite(p.price) || p.price < 0)) {
        throw new Error('Todos los productos deben tener un precio válido (mayor o igual a cero).')
      }

      const result = await bulkCreateProductPrices(tenantId, {
        priceListId: listId,
        validFrom,
        validTo: null,
        reason: reason.trim(),
        items: parsed,
      })

      toast.show({
        title: 'Precios cargados',
        message: `Se cargaron ${result.createdCount} precios en la lista.`,
        variant: 'success',
      })
      void navigate('/catalogo/precios/productos', { replace: true })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar la carga masiva.')
      setError(message)
      toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }, [listId, navigate, reason, selected, tenantId, toast, validFrom])

  if (!canCreate) {
    return (
      <TenantSessionGate title="Carga masiva de precios" lead="Configura precios por lote.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permiso de creación de precios."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Carga masiva de precios" lead="Configura precios por lote.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Carga Masiva de Precios"
          subtitle="Define una vigencia y asigna precios a varios productos en un solo lote."
          badge={<StatusBadge tone="primary">Lote</StatusBadge>}
        />

        {error ? (
          <div className="ecu-form-error-banner" role="alert" style={{ marginBottom: '1rem' }}>
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        ) : null}

        <SectionCard
          title="Vigencia del lote"
          subtitle="Todos los productos comparten la misma vigencia y motivo."
        >
          <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
            <div className="ecu-companies-form__field">
              <Select
                id="bulk-list"
                label="Lista de precios"
                labelPosition="outlined"
                variant="outline"
                options={lists.map((l) => ({
                  value: l.id,
                  label: l.isDefault ? `${l.code} · predeterminada` : l.code,
                }))}
                value={listId}
                onChange={(value) => setListId(String(value))}
                disabled={busy || loading}
              />
            </div>
            <div className="ecu-companies-form__field">
              <DateBox
                id="bulk-from"
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
              <TextBox
                id="bulk-reason"
                label="Motivo (obligatorio)"
                labelPosition="outlined"
                variant="outline"
                value={reason}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
                placeholder="Ej. Lista de temporada"
                disabled={busy || loading}
                fullWidth
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Productos"
          subtitle={`${selected.length} producto(s) en el lote. El precio se precarga con la vigencia actual de la lista.`}
        >
          <div className="ecu-companies-form__grid ecu-companies-form__grid--2" style={{ gap: '0.75rem' }}>
            <div className="ecu-companies-form__field">
              <TextBox
                id="bulk-search"
                label="Buscar producto"
                labelPosition="outlined"
                variant="outline"
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Nombre o SKU…"
                disabled={busy || loading}
                fullWidth
              />
            </div>
            <div className="ecu-companies-form__field">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: '100%' }}>
                <NumberBox
                  id="bulk-price"
                  label="Precio para aplicar"
                  labelPosition="outlined"
                  variant="outline"
                  value={bulkPrice === '' ? '' : Number(bulkPrice)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setBulkPrice(e.target.value)}
                  step={0.01}
                  min={0}
                  disabled={busy || loading}
                  fullWidth
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !bulkPrice.trim()}
                  onClick={() => applyBulkPrice(false)}
                >
                  A todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || !bulkPrice.trim()}
                  onClick={() => applyBulkPrice(true)}
                >
                  Solo vacíos
                </Button>
              </div>
            </div>
          </div>

          {available.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                marginTop: '0.75rem',
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              {available.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => addProduct(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textAlign: 'left',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                    background: 'var(--glb-surface, #fff)',
                    cursor: 'pointer',
                  }}
                >
                  <Search size={14} aria-hidden />
                  <strong style={{ fontWeight: 600 }}>{item.name}</strong>
                  <code className="ecu-code">{item.sku ?? 'Sin SKU'}</code>
                  {currentPrices.get(item.id) != null ? (
                    <span className="ecu-chip" style={{ marginLeft: 'auto' }}>
                      Actual: ${currentPrices.get(item.id)!.toFixed(2)}
                    </span>
                  ) : null}
                  <Plus size={14} aria-hidden />
                </button>
              ))}
            </div>
          ) : (
            <p className="app-shell__muted" style={{ marginTop: '0.75rem' }}>
              {items.length === 0
                ? 'No hay productos físicos en el catálogo.'
                : 'Sin coincidencias pendientes por agregar.'}
            </p>
          )}

          {selected.length > 0 ? (
            <div className="ecu-doc-lines__wrap" style={{ marginTop: '1rem' }}>
              <table className="ecu-doc-lines">
                <thead>
                  <tr>
                    <th scope="col" className="ecu-doc-lines__n">
                      #
                    </th>
                    <th scope="col">Producto</th>
                    <th scope="col" className="ecu-doc-lines__sku">
                      SKU
                    </th>
                    <th scope="col" className="ecu-doc-lines__qty">
                      Precio nuevo
                    </th>
                    <th scope="col" className="ecu-doc-lines__qty">
                      Precio actual
                    </th>
                    <th scope="col" className="ecu-doc-lines__actions">
                      <span className="visually-hidden">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((row, index) => (
                    <tr key={row.id}>
                      <td className="ecu-doc-lines__n">{index + 1}</td>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td className="ecu-doc-lines__sku">
                        <code className="ecu-code">{row.sku ?? '—'}</code>
                      </td>
                      <td className="ecu-doc-lines__qty">
                        <NumberBox
                          id={`bulk-item-${index}`}
                          aria-label={`Precio de ${row.name}`}
                          variant="outline"
                          size="sm"
                          value={row.price === '' ? '' : Number(row.price)}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setProductPrice(row.id, e.target.value)
                          }
                          step={0.01}
                          min={0}
                          disabled={busy}
                          fullWidth
                        />
                      </td>
                      <td className="ecu-doc-lines__qty">
                        {currentPrices.get(row.id) != null
                          ? `$${currentPrices.get(row.id)!.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="ecu-doc-lines__actions">
                        <button
                          type="button"
                          className="ecu-doc-lines__icon-btn"
                          disabled={busy}
                          aria-label={`Quitar ${row.name}`}
                          onClick={() => removeProduct(row.id)}
                        >
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard>
          <div className="ecu-companies-form__actions">
            <Button
              type="button"
              variant="primary"
              loading={busy}
              disabled={busy || loading || selected.length === 0}
              onClick={() => void onSubmit()}
            >
              {selected.length > 1
                ? `Cargar ${selected.length} precios`
                : 'Cargar precio'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void navigate('/catalogo/precios/productos')}
            >
              Cancelar
            </Button>
          </div>
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

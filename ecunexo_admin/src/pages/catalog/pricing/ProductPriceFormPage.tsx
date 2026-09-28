import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Button,
  CheckButton,
  DataGrid,
  DateBox,
  NumberBox,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
} from 'glubox'
import { DollarSign, Trash2 } from 'lucide-react'
import {
  GridIconButton,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { todayIso } from '@/pages/catalog/pricing/pricingFormat'
import { listCatalogItems } from '@/services/catalogApi'
import { listStock } from '@/services/inventoryApi'
import {
  createProductPrice,
  getProductPrice,
  listPriceLists,
  listProductPrices,
  updateProductPrice,
} from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { PriceListDto, PriceTierBody } from '@/types/pricingApi'

type ProductPriceRow = CatalogItemListItemDto & { actions?: string }

type TierDraft = {
  quantityFrom: string
  quantityTo: string
  unitPrice: string
}

const emptyTier = (): TierDraft => ({ quantityFrom: '', quantityTo: '', unitPrice: '' })

export function ProductPriceFormPage() {
  const { priceId } = useParams<{ priceId: string }>()
  const [searchParams] = useSearchParams()
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

  const [itemId, setItemId] = useState(() => searchParams.get('catalogItemId') ?? '')
  const [itemLabel, setItemLabel] = useState('')
  const [listId, setListId] = useState(() => searchParams.get('priceListId') ?? '')
  const [price, setPrice] = useState('')
  const [pricesByItem, setPricesByItem] = useState<Map<string, { price: number; validFrom: string }>>(new Map())
  const [search, setSearch] = useState('')
  const [costInfo, setCostInfo] = useState<{ averageCost: number } | null>(null)
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
          setListId((current) => {
            if (current) return current
            const preferred = data.find((l) => l.isDefault) ?? data[0]
            return preferred ? preferred.id : current
          })
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

  // Precios vigentes de la lista: alimentan la grilla y el contexto del producto elegido.
  useEffect(() => {
    if (isEdit || !tenantId || !listId) return
    let cancelled = false
    listProductPrices(tenantId, { priceListId: listId, onlyVigent: true })
      .then((rows) => {
        if (cancelled) return
        const map = new Map(
          rows.map((row) => [row.catalogItemId, { price: row.price, validFrom: row.validFrom }])
        )
        setPricesByItem(map)
        setPrice((prev) => {
          if (prev.trim() || !itemId) return prev
          const entry = map.get(itemId)
          return entry ? String(entry.price) : prev
        })
      })
      .catch(() => {
        if (!cancelled) setPricesByItem(new Map())
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, itemId, listId, tenantId])

  // Costo promedio del stock para estimar margen.
  useEffect(() => {
    if (!tenantId || !itemId) return
    let cancelled = false
    listStock(tenantId, { catalogItemId: itemId })
      .then((rows) => {
        if (cancelled) return
        const totalQty = rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0)
        const totalValue = rows.reduce((sum, r) => sum + (r.stockValue ?? 0), 0)
        const averageCost = totalQty > 0 ? totalValue / totalQty : (rows[0]?.averageCost ?? 0)
        setCostInfo(averageCost > 0 ? { averageCost } : null)
      })
      .catch(() => {
        if (!cancelled) setCostInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [itemId, tenantId])

  const selectedItem = items.find((i) => i.id === itemId) ?? null
  const selectedList = lists.find((l) => l.id === listId) ?? null
  const currentVigent = itemId ? pricesByItem.get(itemId) ?? null : null
  const renewing = !isEdit && currentVigent != null
  const numericEnteredPrice = Number(price)
  const marginPercent =
    costInfo && costInfo.averageCost > 0 && Number.isFinite(numericEnteredPrice) && numericEnteredPrice > 0
      ? ((numericEnteredPrice - costInfo.averageCost) / numericEnteredPrice) * 100
      : null

  const selectItem = useCallback(
    (item: CatalogItemListItemDto) => {
      setItemId(item.id)
      setCostInfo(null)
      const entry = pricesByItem.get(item.id)
      setPrice(entry ? String(entry.price) : '')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [pricesByItem]
  )

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (item) =>
        (item.sku ?? '').toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term)
    )
  }, [items, search])

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const pageRows = useMemo(
    () =>
      filteredItems.slice(
        paging.pageIndex * paging.pageSize,
        (paging.pageIndex + 1) * paging.pageSize
      ),
    [filteredItems, paging.pageIndex, paging.pageSize]
  )
  const gridMessages = useMemo(() => createSpanishDataGridMessages('producto', 'productos'), [])
  const gridColumns = useMemo<ColumnDef<ProductPriceRow>[]>(
    () => [
      {
        key: 'sku',
        header: 'SKU',
        width: 140,
        renderCell: (_value, row) => <code className="ecu-code">{row.sku ?? '—'}</code>,
      },
      {
        key: 'description',
        header: 'Producto',
        renderCell: (_value, row) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '0.85rem' }}>{row.description?.trim() || row.name}</strong>
            {row.description?.trim() ? (
              <span className="app-shell__muted" style={{ fontSize: '0.75rem' }}>
                {row.name}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'basePrice',
        header: 'Precio (lista)',
        width: 140,
        renderCell: (_value, row) => {
          const entry = pricesByItem.get(row.id)
          return entry ? (
            <span style={{ fontWeight: 600 }}>${entry.price.toFixed(2)}</span>
          ) : (
            <span className="app-shell__muted">Sin precio</span>
          )
        },
      },
      {
        key: 'status',
        header: 'Estado',
        width: 110,
        renderCell: (_value, row) => (
          <StatusBadge
            tone={Number(row.status) === 0 ? 'success' : 'neutral'}
            withDot={Number(row.status) === 0}
          >
            {Number(row.status) === 0 ? 'Activo' : 'Inactivo'}
          </StatusBadge>
        ),
      },
      {
        key: 'actions',
        header: '',
        width: 110,
        sticky: 'right',
        renderCell: (_value, row) => (
          <GridIconButton
            label={itemId === row.id ? 'Producto seleccionado' : 'Asignar precio a este producto'}
            icon={DollarSign}
            onClick={() => selectItem(row)}
          />
        ),
      },
    ],
    [itemId, pricesByItem, selectItem]
  )

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
        if (!price.trim()) throw new Error('El precio es obligatorio.')
        const numericPrice = Number(price)
        if (!Number.isFinite(numericPrice) || numericPrice < 0) {
          throw new Error('El precio debe ser un número mayor o igual a cero.')
        }
        if (renewing && !reason.trim()) {
          throw new Error('Indica el motivo del cambio de precio.')
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
      renewing,
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
            ) : selectedItem ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span className="ecu-chip">{selectedItem.sku ?? 'Sin SKU'}</span>
                <strong style={{ fontSize: '0.9rem' }}>
                  {selectedItem.description?.trim() || selectedItem.name}
                </strong>
                {costInfo ? (
                  <span className="ecu-chip">Costo prom. ${costInfo.averageCost.toFixed(4)}</span>
                ) : null}
                {marginPercent != null ? (
                  <span
                    className="ecu-chip"
                    style={{
                      color:
                        marginPercent >= 0
                          ? 'var(--color-success, #16a34a)'
                          : 'var(--color-danger, #ef4444)',
                    }}
                  >
                    Margen {marginPercent.toFixed(1)}%
                  </span>
                ) : null}
                {currentVigent ? (
                  <span className="ecu-chip">
                    Actual: ${currentVigent.price.toFixed(2)} · desde {currentVigent.validFrom}
                  </span>
                ) : (
                  <span className="ecu-chip">Sin precio vigente</span>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || loading}
                  onClick={() => {
                    setItemId('')
                    setPrice('')
                    setCostInfo(null)
                  }}
                >
                  Cambiar producto
                </Button>
              </div>
            ) : (
              <p className="ecu-hint" style={{ margin: 0 }}>
                Selecciona un producto del listado de abajo para asignarle el precio.
              </p>
            )}

            <div className="ecu-companies-form__grid ecu-companies-form__grid--3" style={{ marginTop: '0.75rem' }}>
              <div className="ecu-companies-form__field">
                <Select
                  id="pp-list"
                  aria-label="Lista de precios"
                  label="Lista de precios"
                  labelPosition="outlined"
                  variant="outline"
                  options={lists.map((l) => ({
                    value: l.id,
                    label: l.isDefault ? `${l.code} · predeterminada` : l.code,
                  }))}
                  value={listId}
                  onChange={(value) => {
                    setListId(String(value))
                    setPrice('')
                  }}
                  disabled={busy || loading || isEdit}
                />
              </div>
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="pp-price"
                  label="Precio"
                  labelPosition="outlined"
                  variant="outline"
                  value={price === '' ? '' : Number(price)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                  step={0.01}
                  min={0}
                  showSpinButtons
                  disabled={busy || loading}
                  fullWidth
                />
                {renewing ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted, #64748b)' }}>
                    Cerrará la vigencia anterior e iniciará el {validFrom}.
                  </span>
                ) : null}
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
                  label={renewing ? 'Motivo del cambio (obligatorio)' : 'Motivo del cambio'}
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

            {selectedList ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                <span className="ecu-chip">{selectedList.currency}</span>
                {selectedList.pricesIncludeTax ? <span className="ecu-chip">IVA incluido</span> : null}
                <span className="ecu-chip">
                  Lista vigente {selectedList.validFrom}
                  {selectedList.validTo ? ` → ${selectedList.validTo}` : ''}
                </span>
              </div>
            ) : null}
          </SectionCard>

          {!isEdit ? (
            <SectionCard
              title="Productos"
              subtitle="Elige el producto a cotizar; cada fila muestra su precio vigente en la lista."
            >
              <div
                className="ecu-companies-form__grid ecu-companies-form__grid--4"
                style={{ marginBottom: '0.75rem' }}
              >
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="pp-grid-search"
                    label="Buscar producto"
                    labelPosition="outlined"
                    variant="outline"
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setSearch(e.target.value)
                      onPageChange(0)
                    }}
                    placeholder="SKU, descripción o nombre…"
                    disabled={busy || loading}
                    fullWidth
                  />
                </div>
              </div>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <DataGrid<ProductPriceRow>
                  dataSource={pageRows}
                  keyExpr="id"
                  columns={gridColumns}
                  paging={paging}
                  pageSizeOptions={pageSizeOptions}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                  messages={gridMessages}
                  loading={loading}
                />
              </div>
            </SectionCard>
          ) : null}

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
                        value={tier.quantityFrom === '' ? '' : Number(tier.quantityFrom)}
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
                        value={tier.quantityTo === '' ? '' : Number(tier.quantityTo)}
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
                        value={tier.unitPrice === '' ? '' : Number(tier.unitPrice)}
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
                {isEdit ? 'Guardar cambios' : renewing ? 'Renovar vigencia' : 'Crear precio'}
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

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import { Trash2 } from 'lucide-react'
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
import { formatVolumeTiersSummary, todayIso, volumeSchemeTypeLabel } from '@/pages/catalog/pricing/pricingFormat'
import { listCatalogItems } from '@/services/catalogApi'
import { listStock } from '@/services/inventoryApi'
import {
  bulkCreateProductPrices,
  createProductPrice,
  getProductPrice,
  listPriceLists,
  listProductPrices,
  listVolumeDiscountSchemes,
  updateProductPrice,
} from '@/services/pricingApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import { CatalogItemKind, type CatalogItemListItemDto } from '@/types/catalogApi'
import type { PriceListDto, PriceTierBody, VolumeDiscountSchemeDto } from '@/types/pricingApi'

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

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => {
    const fromUrl = searchParams.get('catalogItemId')
    return fromUrl ? [fromUrl] : []
  })
  const itemId = selectedItemIds[0] ?? ''
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
  const [schemes, setSchemes] = useState<VolumeDiscountSchemeDto[]>([])
  const [volumeDiscountSchemeId, setVolumeDiscountSchemeId] = useState<string>('')
  const [showCatalogPicker, setShowCatalogPicker] = useState<boolean>(() => !searchParams.get('catalogItemId'))

  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      listVolumeDiscountSchemes(tenantId, true).then((data) => {
        if (!cancelled) setSchemes(data)
      }),
    ]

    if (isEdit && priceId) {
      tasks.push(
        getProductPrice(tenantId, priceId).then((detail) => {
          if (cancelled) return
          setSelectedItemIds([detail.catalogItemId])
          setItemLabel(detail.sku ? `${detail.itemName} · ${detail.sku}` : detail.itemName)
          setListId(detail.priceListId)
          setPrice(String(detail.price))
          setValidFrom(detail.validFrom)
          setValidTo(detail.validTo ?? '')
          setIsActive(detail.isActive)
          setVolumeDiscountSchemeId(detail.volumeDiscountSchemeId ?? '')
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

  // Precarga del precio: vigente de la lista, o sugerido por margen sobre el costo promedio.
  useEffect(() => {
    if (isEdit || !itemId || !listId) return
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setPrice((prev) => {
        if (prev.trim()) return prev
        const vigent = pricesByItem.get(itemId)
        if (vigent) return String(vigent.price)
        const cost = costInfo?.averageCost ?? 0
        const margin = selectedList?.suggestedMarginPercent
        if (cost > 0 && margin && margin > 0) {
          return (cost * (1 + margin / 100)).toFixed(2)
        }
        return prev
      })
    })()
    return () => {
      cancelled = true
    }
  }, [costInfo, isEdit, itemId, listId, pricesByItem, selectedList])


  const handleSelectionChange = useCallback(
    (rows: ProductPriceRow[]) => {
      const ids = rows.map((row) => row.id)
      setSelectedItemIds(ids)
      setCostInfo(null)
      setPrice('')
      if (ids.length > 1) {
        toast.show({
          title: `${ids.length} productos seleccionados`,
          message: 'El precio y las escalas se aplicarán a todos.',
          variant: 'info',
        })
      }
    },
    [toast]
  )

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    const visible = items.filter((item) => !item.isMatrixParent)
    if (!term) return visible
    return visible.filter(
      (item) =>
        (item.sku ?? '').toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term)
    )
  }, [items, search])

  // Descripción del padre por id: si la variante hereda la descripción genérica del padre,
  // se prefiere su propio nombre (que incluye los atributos) como título visible.
  const descriptionsByItem = useMemo(
    () =>
      new Map(
        items
          .filter((item) => item.isMatrixParent)
          .map((item) => [item.id, (item.description ?? '').trim().toLowerCase()])
      ),
    [items]
  )

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
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
        renderCell: (_value, row) => {
          const ownDescription = (row.description ?? '').trim()
          const parentDescription = row.parentId
            ? descriptionsByItem.get(row.parentId)
            : undefined
          const inheritedDescription =
            Boolean(ownDescription) &&
            Boolean(parentDescription) &&
            parentDescription === ownDescription.toLowerCase()
          const title = ownDescription && !inheritedDescription ? ownDescription : row.name
          const subtitle =
            ownDescription && !inheritedDescription ? row.name : null

          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontSize: '0.85rem' }}>{title}</strong>
              {subtitle ? (
                <span className="app-shell__muted" style={{ fontSize: '0.75rem' }}>
                  {subtitle}
                </span>
              ) : null}
              {row.isMatrixParent ? (
                <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted)' }}>
                  Plantilla base · {row.variantCount ?? 0} variantes: asigna el precio a cada variante
                </span>
              ) : null}
            </div>
          )
        },
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
    ],
    [descriptionsByItem, pricesByItem]
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
        if (!isEdit && selectedItemIds.length === 0) throw new Error('Selecciona al menos un producto.')
        if (!listId) throw new Error('Selecciona la lista de precios.')
        if (!price.trim()) throw new Error('El precio es obligatorio.')
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
            volumeDiscountSchemeId: volumeDiscountSchemeId || null,
          })
          toast.show({ title: 'Precio actualizado', message: 'La vigencia fue guardada.', variant: 'success' })
        } else if (selectedItemIds.length === 1) {
          await createProductPrice(tenantId, {
            priceListId: listId,
            catalogItemId: selectedItemIds[0],
            price: numericPrice,
            validFrom,
            validTo: validTo || null,
            reason: reason.trim() || null,
            tiers: tierPayload,
            isActive,
            volumeDiscountSchemeId: volumeDiscountSchemeId || null,
          })
          toast.show({
            title: 'Precio creado',
            message: isActive ? 'La nueva vigencia está activa.' : 'La vigencia se guardó inactiva.',
            variant: 'success',
          })
        } else {
          const { createdCount } = await bulkCreateProductPrices(tenantId, {
            priceListId: listId,
            validFrom,
            validTo: validTo || null,
            reason: reason.trim() || null,
            items: selectedItemIds.map((catalogItemId) => ({
              catalogItemId,
              price: numericPrice,
              tiers: tierPayload,
            })),
          })
          toast.show({
            title: 'Precios creados',
            message:
              createdCount === 1
                ? 'Se creó 1 vigencia.'
                : `Se crearon ${createdCount} vigencias para los ${selectedItemIds.length} productos seleccionados.`,
            variant: 'success',
          })
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
      selectedItemIds,
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
      volumeDiscountSchemeId,
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
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                type="button"
                variant="outline"
                disabled={busy || loading}
                onClick={() => void navigate('/catalogo/precios/productos')}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={busy}
                disabled={busy || loading || (!isEdit && selectedItemIds.length === 0)}
                onClick={() => void onSubmit()}
              >
                {isEdit ? 'Guardar cambios' : renewing ? 'Renovar vigencia' : 'Crear precio'}
              </Button>
            </div>
          }
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          {error ? (
            <div className="ecu-form-error-banner" role="alert" style={{ marginBottom: '1rem' }}>
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {/* PASO 1: SELECCIÓN DEL PRODUCTO */}
          <SectionCard
            title="1. Producto a fijar precio"
            subtitle={
              isEdit
                ? 'Producto asociado a esta vigencia de precio.'
                : selectedItemIds.length > 0
                  ? 'Producto seleccionado. Puedes modificar la selección si deseas cotizar otro.'
                  : 'Busca y selecciona el producto al que deseas asignar o renovar el precio.'
            }
          >
            {isEdit ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <StatusBadge tone="neutral">Producto</StatusBadge>
                {selectedItem?.sku ? (
                  <span className="ecu-code" style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                    {selectedItem.sku}
                  </span>
                ) : null}
                <strong style={{ fontSize: '1rem', color: 'var(--glb-text, inherit)' }}>
                  {itemLabel || selectedItem?.name || '—'}
                </strong>
                {costInfo ? (
                  <span className="ecu-chip">Costo prom. ${costInfo.averageCost.toFixed(4)}</span>
                ) : null}
              </div>
            ) : selectedItemIds.length > 0 ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                    backgroundColor: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.05))',
                    marginBottom: showCatalogPicker ? '1rem' : 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <StatusBadge tone="success">
                        {selectedItemIds.length === 1
                          ? 'Producto seleccionado'
                          : `${selectedItemIds.length} productos seleccionados`}
                      </StatusBadge>
                      {selectedItem ? (
                        <>
                          <span
                            className="ecu-code"
                            style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                          >
                            {selectedItem.sku ?? 'Sin SKU'}
                          </span>
                          <strong style={{ fontSize: '1rem', color: 'var(--glb-text, inherit)' }}>
                            {selectedItem.description?.trim() || selectedItem.name}
                          </strong>
                        </>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy || loading}
                        onClick={() => setShowCatalogPicker((prev) => !prev)}
                      >
                        {showCatalogPicker ? 'Ocultar catálogo' : 'Cambiar / Ver catálogo'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || loading}
                        onClick={() => {
                          setSelectedItemIds([])
                          setPrice('')
                          setCostInfo(null)
                          setShowCatalogPicker(true)
                        }}
                      >
                        Limpiar selección
                      </Button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {costInfo ? (
                      <span className="ecu-chip">Costo promedio: ${costInfo.averageCost.toFixed(4)}</span>
                    ) : null}
                    {currentVigent ? (
                      <span className="ecu-chip">
                        Precio vigente en lista: <strong>${currentVigent.price.toFixed(2)}</strong> (desde {currentVigent.validFrom})
                      </span>
                    ) : (
                      <span className="ecu-chip">Sin precio vigente en esta lista</span>
                    )}
                    {marginPercent != null ? (
                      <span
                        className="ecu-chip"
                        style={{
                          color: marginPercent >= 0 ? 'var(--color-success, #16a34a)' : 'var(--color-danger, #ef4444)',
                          fontWeight: 600,
                        }}
                      >
                        Margen estimado: {marginPercent.toFixed(1)}%
                      </span>
                    ) : null}
                  </div>
                </div>

                {showCatalogPicker ? (
                  <div>
                    <div
                      className="ecu-companies-form__grid ecu-companies-form__grid--4"
                      style={{ marginBottom: '0.75rem' }}
                    >
                      <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                        <TextBox
                          id="pp-grid-search"
                          label="Buscar producto por SKU o descripción"
                          labelPosition="outlined"
                          variant="outline"
                          value={search}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            setSearch(e.target.value)
                            onPageChange(0)
                          }}
                          placeholder="Escribe para buscar en el catálogo…"
                          disabled={busy || loading}
                          fullWidth
                        />
                      </div>
                    </div>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <DataGrid<ProductPriceRow>
                        dataSource={filteredItems as ProductPriceRow[]}
                        keyExpr="id"
                        columns={gridColumns}
                        selectionMode="multiple"
                        selectedRowIds={selectedItemIds}
                        onSelectionChange={(rows) => handleSelectionChange(rows as ProductPriceRow[])}
                        showSearch={false}
                        paging={paging}
                        pageSizeOptions={pageSizeOptions}
                        onPageChange={onPageChange}
                        onPageSizeChange={onPageSizeChange}
                        messages={gridMessages}
                        loading={loading}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div>
                <div
                  className="ecu-companies-form__grid ecu-companies-form__grid--4"
                  style={{ marginBottom: '0.75rem' }}
                >
                  <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                    <TextBox
                      id="pp-grid-search"
                      label="Buscar producto por SKU o descripción"
                      labelPosition="outlined"
                      variant="outline"
                      value={search}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setSearch(e.target.value)
                        onPageChange(0)
                      }}
                      placeholder="Escribe para buscar en el catálogo…"
                      disabled={busy || loading}
                      fullWidth
                    />
                  </div>
                </div>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <DataGrid<ProductPriceRow>
                    dataSource={filteredItems as ProductPriceRow[]}
                    keyExpr="id"
                    columns={gridColumns}
                    selectionMode="multiple"
                    selectedRowIds={selectedItemIds}
                    onSelectionChange={(rows) => handleSelectionChange(rows as ProductPriceRow[])}
                    showSearch={false}
                    paging={paging}
                    pageSizeOptions={pageSizeOptions}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    messages={gridMessages}
                    loading={loading}
                  />
                </div>
              </div>
            )}
          </SectionCard>

          {/* PASO 2: PRECIO Y CONDICIONES */}
          <SectionCard
            title="2. Precio y Condiciones de Lista"
            subtitle="Define el precio base de venta, la lista aplicable y la vigencia temporal."
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
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
                  label="Precio base unitario"
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
                {selectedList?.suggestedMarginPercent ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted, #64748b)' }}>
                    Lista con margen sugerido del {selectedList.suggestedMarginPercent}% sobre costo promedio.
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
                  label="Vigente hasta (opcional)"
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
                  placeholder="Ej: Ajuste por inflación, promoción o nuevo costo…"
                  disabled={busy || loading}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field sri-config-field--check-align">
                <CheckButton
                  variant="ghost"
                  checked={isActive}
                  onChange={setIsActive}
                  disabled={busy || loading}
                >
                  Precio activo
                </CheckButton>
                {!isEdit ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted, #64748b)' }}>
                    Si lo desactivas, se guarda pero no se usará al cotizar o vender.
                  </span>
                ) : null}
              </div>
            </div>

            {selectedList ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
                <span className="ecu-chip">{selectedList.currency}</span>
                {selectedList.pricesIncludeTax ? <span className="ecu-chip">IVA incluido</span> : null}
                <span className="ecu-chip">
                  Lista vigente {selectedList.validFrom}
                  {selectedList.validTo ? ` → ${selectedList.validTo}` : ''}
                </span>
              </div>
            ) : null}
          </SectionCard>

          {/* PASO 3: ESCALAS DE DESCUENTO POR VOLUMEN */}
          <SectionCard
            title="3. Descuento por Volumen (Opcional)"
            subtitle="Asigna un esquema estandarizado (ej: Docena Calcetines) para aplicar descuentos escalonados sin reescribir tramos."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ maxWidth: 460 }}>
                <Select
                  id="pp-volume-scheme"
                  label="Esquema por volumen"
                  labelPosition="outlined"
                  variant="outline"
                  options={[
                    { value: '', label: '— Sin escala reutilizable (Precio estándar) —' },
                    ...schemes.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${volumeSchemeTypeLabel(s.type)})`,
                    })),
                  ]}
                  value={volumeDiscountSchemeId}
                  onChange={(val) => setVolumeDiscountSchemeId(String(val))}
                  disabled={busy || loading}
                  fullWidth
                />
              </div>

              {volumeDiscountSchemeId ? (
                (() => {
                  const selectedScheme = schemes.find((s) => s.id === volumeDiscountSchemeId)
                  if (!selectedScheme) return null
                  return (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.08))',
                        border: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>Tramos configurados en el esquema:</span>
                        <span>{formatVolumeTiersSummary(selectedScheme.type, selectedScheme.tiers)}</span>
                      </div>
                      <p className="app-shell__muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
                        Este esquema se aplicará automáticamente según la cantidad comprada en pedidos o facturas.
                      </p>
                    </div>
                  )
                })()
              ) : null}

              <div style={{ marginTop: '0.25rem' }}>
                <Link
                  to="/catalogo/precios/escalas-volumen"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--glb-primary, #2563eb)',
                    textDecoration: 'underline',
                  }}
                >
                  Administrar o crear esquemas de volumen reutilizables ↗
                </Link>
              </div>

              {/* Tramos específicos manuales (Avanzado / Colapsado para evitar información innecesaria) */}
              <details
                open={tiers.length > 0}
                style={{
                  marginTop: '0.75rem',
                  border: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                  borderRadius: '8px',
                  padding: '0.85rem 1.25rem',
                  backgroundColor: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.04))',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--glb-text, inherit)',
                    userSelect: 'none',
                  }}
                >
                  Configuración manual de tramos específicos para este precio{' '}
                  {tiers.length > 0 ? `(${tiers.length} configurada${tiers.length === 1 ? '' : 's'})` : '(Avanzado)'}
                </summary>

                <div style={{ marginTop: '0.75rem' }}>
                  <p className="ecu-companies-form__hint" style={{ marginBottom: '0.75rem' }}>
                    Opcional. Úsalo únicamente si este producto requiere escalas específicas que no aplican a ningún otro producto.
                    Ejemplo: «desde 1 hasta 11» → $3.50, y «desde 12» con «hasta» vacío → $3.00.
                  </p>

                  {tiers.length === 0 ? (
                    <p className="app-shell__muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                      Sin escalas manuales específicas. Si usas un esquema reutilizable arriba, no es necesario configurar nada aquí.
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
                              placeholder="Ej. 12"
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
                              placeholder="Sin límite"
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
                              placeholder="Ej. 3.00"
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
                      size="sm"
                      disabled={busy || loading}
                      onClick={() => setTiers((current) => [...current, emptyTier()])}
                    >
                      + Añadir tramo manual
                    </Button>
                  </div>
                </div>
              </details>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="ecu-companies-form__actions">
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                disabled={busy || loading || (!isEdit && selectedItemIds.length === 0)}
              >
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

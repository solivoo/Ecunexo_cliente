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
import { formatMoney, todayIso, volumeSchemeTypeLabel } from '@/pages/catalog/pricing/pricingFormat'
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
import {
  VolumeDiscountSchemeType,
  type PriceListDto,
  type PriceTierBody,
  type VolumeDiscountSchemeDto,
} from '@/types/pricingApi'

type ProductPriceRow = CatalogItemListItemDto & { actions?: string }
type ScaleMode = 'none' | 'scheme' | 'manual'
type SubmitNextAction = 'list' | 'another' | 'simulate'

const DEFAULT_TAX_RATE = 0.15

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
  const [priceTouched, setPriceTouched] = useState(false)
  const [pricesByItem, setPricesByItem] = useState<Map<string, { price: number; validFrom: string }>>(new Map())
  const [search, setSearch] = useState('')
  const [onlyWithoutPrice, setOnlyWithoutPrice] = useState(false)
  const [costInfo, setCostInfo] = useState<{ averageCost: number } | null>(null)
  const [validFrom, setValidFrom] = useState(todayIso())
  const [validTo, setValidTo] = useState('')
  const [reason, setReason] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [tiers, setTiers] = useState<TierDraft[]>([])
  const [schemes, setSchemes] = useState<VolumeDiscountSchemeDto[]>([])
  const [volumeDiscountSchemeId, setVolumeDiscountSchemeId] = useState<string>('')
  const [scaleMode, setScaleMode] = useState<ScaleMode>('none')
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
          const activeTiers = detail.tiers
            .filter((tier) => tier.isActive !== false)
            .map((tier) => ({
              quantityFrom: String(tier.quantityFrom),
              quantityTo: tier.quantityTo === null ? '' : String(tier.quantityTo),
              unitPrice: String(tier.unitPrice),
            }))
          setVolumeDiscountSchemeId(detail.volumeDiscountSchemeId ?? '')
          setTiers(activeTiers)
          setScaleMode(
            activeTiers.length > 0
              ? 'manual'
              : detail.volumeDiscountSchemeId
                ? 'scheme'
                : 'none'
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
  }, [isEdit, listId, tenantId])

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
  const effectiveCostInfo = useMemo(() => {
    if (costInfo && costInfo.averageCost > 0) return costInfo
    if (selectedItem?.costPrice != null && selectedItem.costPrice > 0) {
      return { averageCost: selectedItem.costPrice }
    }
    return null
  }, [costInfo, selectedItem])
  const selectedList = lists.find((l) => l.id === listId) ?? null
  const pricesIncludeTax = selectedList?.pricesIncludeTax ?? false
  const currentVigent = itemId ? pricesByItem.get(itemId) ?? null : null
  const renewingIds = useMemo(
    () => (!isEdit ? selectedItemIds.filter((id) => pricesByItem.has(id)) : []),
    [isEdit, pricesByItem, selectedItemIds]
  )
  const renewing = renewingIds.length > 0

  const computeNetAndMargin = useCallback(
    (enteredValue: number) => {
      if (!Number.isFinite(enteredValue) || enteredValue <= 0) {
        return { netPrice: null, taxAmount: null, finalPrice: null, marginPercent: null }
      }
      const netPrice = pricesIncludeTax ? enteredValue / (1 + DEFAULT_TAX_RATE) : enteredValue
      const taxAmount = pricesIncludeTax ? enteredValue - netPrice : enteredValue * DEFAULT_TAX_RATE
      const finalPrice = pricesIncludeTax ? enteredValue : enteredValue + taxAmount
      const cost = effectiveCostInfo?.averageCost ?? 0
      const marginPercent = cost > 0 && netPrice > 0 ? ((netPrice - cost) / netPrice) * 100 : null
      return { netPrice, taxAmount, finalPrice, marginPercent }
    },
    [effectiveCostInfo, pricesIncludeTax]
  )

  const numericEnteredPrice = Number(price)
  const priceBreakdown = computeNetAndMargin(numericEnteredPrice)
  const marginPercent = priceBreakdown.marginPercent

  const suggestedPrice = useMemo(() => {
    const cost = effectiveCostInfo?.averageCost ?? 0
    const margin = selectedList?.suggestedMarginPercent
    if (cost <= 0 || !margin || margin <= 0) return null
    const netSuggested = cost * (1 + margin / 100)
    const raw = pricesIncludeTax ? netSuggested * (1 + DEFAULT_TAX_RATE) : netSuggested
    return raw.toFixed(2)
  }, [effectiveCostInfo, pricesIncludeTax, selectedList])

  // Precarga del precio: vigente de la lista, o sugerido por margen sobre el costo neto.
  useEffect(() => {
    if (isEdit || !itemId || !listId || priceTouched) return
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setPrice((prev) => {
        if (prev.trim()) return prev
        const vigent = pricesByItem.get(itemId)
        if (vigent) return String(vigent.price)
        if (suggestedPrice) return suggestedPrice
        return prev
      })
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, itemId, listId, priceTouched, pricesByItem, suggestedPrice])

  const handleSelectionChange = useCallback(
    (rows: ProductPriceRow[]) => {
      const ids = rows.map((row) => row.id)
      setSelectedItemIds(ids)
      setCostInfo(null)
      if (!priceTouched) {
        setPrice('')
      }
      if (ids.length > 1) {
        toast.show({
          title: `${ids.length} productos seleccionados`,
          message: 'El precio y las escalas se aplicarán a todos.',
          variant: 'info',
        })
      }
    },
    [priceTouched, toast]
  )

  const handleRemoveSelectedItem = useCallback(
    (idToRemove: string) => {
      setSelectedItemIds((prev) => prev.filter((id) => id !== idToRemove))
      if (idToRemove === itemId) {
        setCostInfo(null)
        if (!priceTouched) setPrice('')
      }
    },
    [itemId, priceTouched]
  )

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    const visible = items.filter((item) => {
      if (item.isMatrixParent) return false
      if (!isEdit && onlyWithoutPrice && pricesByItem.has(item.id)) return false
      return true
    })
    if (!term) return visible
    return visible.filter(
      (item) =>
        (item.sku ?? '').toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term)
    )
  }, [isEdit, items, onlyWithoutPrice, pricesByItem, search])

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
    async (event?: FormEvent, nextAction: SubmitNextAction = 'list') => {
      event?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!isEdit && selectedItemIds.length === 0) throw new Error('Selecciona al menos un producto.')
        if (!listId) throw new Error('Selecciona la lista de precios.')
        if (!price.trim()) throw new Error('El precio es obligatorio.')
        if (validTo && validTo < validFrom) {
          throw new Error('La fecha «Vigente hasta» no puede ser anterior a «Vigente desde».')
        }
        if (renewing && !reason.trim()) {
          throw new Error('Indica el motivo del cambio para renovar la vigencia anterior.')
        }
        const numericPrice = Number(price)
        if (!Number.isFinite(numericPrice) || numericPrice < 0) {
          throw new Error('El precio debe ser un número mayor o igual a cero.')
        }
        const tierPayload = scaleMode === 'manual' ? buildTiers() : []
        if (scaleMode === 'manual') {
          if (tierPayload.length === 0) {
            throw new Error('Agrega al menos un tramo manual o cambia el modo de escala.')
          }
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
        }
        const schemePayload = scaleMode === 'scheme' && volumeDiscountSchemeId ? volumeDiscountSchemeId : null
        if (scaleMode === 'scheme' && !schemePayload) {
          throw new Error('Selecciona un esquema por volumen o cambia el modo de escala.')
        }

        if (isEdit && priceId) {
          await updateProductPrice(tenantId, priceId, {
            price: numericPrice,
            validFrom,
            validTo: validTo || null,
            reason: reason.trim() || null,
            isActive,
            tiers: tierPayload,
            volumeDiscountSchemeId: schemePayload,
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
            volumeDiscountSchemeId: schemePayload,
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
              volumeDiscountSchemeId: schemePayload,
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

        if (nextAction === 'simulate' && itemId && listId) {
          void navigate(
            `/catalogo/precios/simulador?catalogItemId=${encodeURIComponent(itemId)}&priceListId=${encodeURIComponent(listId)}`
          )
        } else if (nextAction === 'another' && !isEdit) {
          setPricesByItem((prev) => {
            const next = new Map(prev)
            for (const id of selectedItemIds) {
              next.set(id, { price: numericPrice, validFrom })
            }
            return next
          })
          setSelectedItemIds([])
          setPrice('')
          setPriceTouched(false)
          setCostInfo(null)
          setReason('')
          setTiers([])
          setVolumeDiscountSchemeId('')
          setScaleMode('none')
          setShowCatalogPicker(true)
        } else {
          void navigate('/catalogo/precios/productos', { replace: true })
        }
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
      selectedItemIds,
      listId,
      navigate,
      price,
      priceId,
      reason,
      renewing,
      scaleMode,
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

          {/* PASO 1: LISTA DE PRECIOS Y PRODUCTO */}
          <SectionCard
            title="1. Lista de precios y Producto"
            subtitle={
              isEdit
                ? 'Lista y producto asociados a esta vigencia de precio.'
                : 'Elige primero la lista (define moneda e IVA) y luego el o los productos a configurar.'
            }
          >
            <div
              className="ecu-companies-form__grid ecu-companies-form__grid--3"
              style={{ marginBottom: '1rem', alignItems: 'end' }}
            >
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
                    setPriceTouched(false)
                  }}
                  disabled={busy || loading || isEdit}
                />
              </div>
              {selectedList ? (
                <div
                  className="ecu-companies-form__field ecu-companies-form__field--span-2"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingBottom: '0.25rem' }}
                >
                  <StatusBadge tone={pricesIncludeTax ? 'primary' : 'neutral'}>
                    {pricesIncludeTax ? 'IVA incluido (PVP final)' : 'Neto + IVA'}
                  </StatusBadge>
                  <span className="ecu-chip">{selectedList.currency}</span>
                  {selectedList.suggestedMarginPercent ? (
                    <span className="ecu-chip">Margen sugerido +{selectedList.suggestedMarginPercent}%</span>
                  ) : null}
                  <span className="ecu-chip">
                    Lista vigente {selectedList.validFrom}
                    {selectedList.validTo ? ` → ${selectedList.validTo}` : ''}
                  </span>
                </div>
              ) : null}
            </div>

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
                {effectiveCostInfo ? (
                  <span className="ecu-chip">Costo ref. neto: ${effectiveCostInfo.averageCost.toFixed(4)}</span>
                ) : (
                  <span className="ecu-chip">Sin costo en Kárdex ni costo estimado</span>
                )}
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
                      {selectedItemIds.length === 1 && selectedItem ? (
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
                          setPriceTouched(false)
                          setCostInfo(null)
                          setShowCatalogPicker(true)
                        }}
                      >
                        Limpiar selección
                      </Button>
                    </div>
                  </div>

                  {selectedItemIds.length > 1 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {selectedItemIds.map((id) => {
                        const item = items.find((i) => i.id === id)
                        const vigent = pricesByItem.get(id)
                        return (
                          <span
                            key={id}
                            className="ecu-chip"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <code>{item?.sku ?? 'SKU'}</code>
                            <span>{item?.name ?? id.slice(0, 8)}</span>
                            {vigent ? (
                              <span style={{ opacity: 0.75 }}>({formatMoney(vigent.price)})</span>
                            ) : null}
                            <button
                              type="button"
                              aria-label={`Quitar ${item?.name ?? id}`}
                              onClick={() => handleRemoveSelectedItem(id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'inherit',
                                padding: 0,
                                fontWeight: 700,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedItemIds.length === 1 ? (
                      effectiveCostInfo ? (
                        <span className="ecu-chip">Costo ref. neto: ${effectiveCostInfo.averageCost.toFixed(4)}</span>
                      ) : (
                        <span className="ecu-chip">Sin costo en Kárdex ni costo estimado</span>
                      )
                    ) : null}
                    {selectedItemIds.length === 1 ? (
                      currentVigent ? (
                        <span className="ecu-chip">
                          Precio vigente en lista: <strong>${currentVigent.price.toFixed(2)}</strong> (desde {currentVigent.validFrom})
                        </span>
                      ) : (
                        <span className="ecu-chip">Sin precio vigente en esta lista</span>
                      )
                    ) : renewingIds.length > 0 ? (
                      <span className="ecu-chip">
                        {renewingIds.length} de {selectedItemIds.length} ya tienen precio vigente (se renovarán)
                      </span>
                    ) : (
                      <span className="ecu-chip">Ninguno tiene precio vigente en esta lista</span>
                    )}
                    {selectedItemIds.length === 1 && marginPercent != null ? (
                      <span
                        className="ecu-chip"
                        style={{
                          color:
                            marginPercent < 0
                              ? 'var(--color-danger, #ef4444)'
                              : marginPercent < 15
                                ? 'var(--color-warning, #d97706)'
                                : 'var(--color-success, #16a34a)',
                          fontWeight: 600,
                        }}
                      >
                        {marginPercent < 0
                          ? `Bajo costo (${marginPercent.toFixed(1)}%)`
                          : `Margen real sobre neto: ${marginPercent.toFixed(1)}%`}
                      </span>
                    ) : null}
                  </div>
                </div>

                {showCatalogPicker ? (
                  <div>
                    <div
                      className="ecu-companies-form__grid ecu-companies-form__grid--4"
                      style={{ marginBottom: '0.75rem', alignItems: 'center' }}
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
                      <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                        <CheckButton
                          variant="ghost"
                          checked={onlyWithoutPrice}
                          onChange={(checked) => {
                            setOnlyWithoutPrice(checked)
                            onPageChange(0)
                          }}
                          disabled={busy || loading}
                        >
                          Solo productos sin precio en esta lista
                        </CheckButton>
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
                  style={{ marginBottom: '0.75rem', alignItems: 'center' }}
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
                  <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                    <CheckButton
                      variant="ghost"
                      checked={onlyWithoutPrice}
                      onChange={(checked) => {
                        setOnlyWithoutPrice(checked)
                        onPageChange(0)
                      }}
                      disabled={busy || loading}
                    >
                      Solo productos sin precio en esta lista
                    </CheckButton>
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
            title="2. Precio y Vigencia"
            subtitle={
              pricesIncludeTax
                ? 'Esta lista incluye IVA: ingresa el PVP final al cliente.'
                : 'Esta lista es Neto + IVA: ingresa el valor antes de impuestos.'
            }
          >
            <div className="ecu-companies-form__grid ecu-companies-form__grid--3">
              <div className="ecu-companies-form__field">
                <NumberBox
                  id="pp-price"
                  label={pricesIncludeTax ? 'PVP unitario (IVA incl.)' : 'Precio unitario (Neto + IVA)'}
                  labelPosition="outlined"
                  variant="outline"
                  value={price === '' ? '' : Number(price)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setPriceTouched(true)
                    setPrice(e.target.value)
                  }}
                  step={0.01}
                  min={0}
                  showSpinButtons
                  disabled={busy || loading}
                  fullWidth
                />
                {renewing ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted, #64748b)' }}>
                    Cerrará la vigencia anterior de {renewingIds.length} producto(s) e iniciará el {validFrom}.
                  </span>
                ) : null}
                {suggestedPrice ? (
                  <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted, #64748b)' }}>
                      Sobre costo (+{selectedList?.suggestedMarginPercent}%): <strong>${suggestedPrice}</strong>
                    </span>
                    {price !== suggestedPrice ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy || loading}
                        onClick={() => {
                          setPriceTouched(true)
                          setPrice(suggestedPrice)
                        }}
                      >
                        Aplicar
                      </Button>
                    ) : null}
                  </div>
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
                  checked={selectedItemIds.length > 1 ? true : isActive}
                  onChange={setIsActive}
                  disabled={busy || loading || (!isEdit && selectedItemIds.length > 1)}
                >
                  Precio activo
                </CheckButton>
                {!isEdit ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--glb-muted, #64748b)' }}>
                    {selectedItemIds.length > 1
                      ? 'En selección múltiple las vigencias se crean activas.'
                      : 'Si lo desactivas, se guarda pero no se usará al cotizar o vender.'}
                  </span>
                ) : null}
              </div>
            </div>

            {priceBreakdown.netPrice !== null ? (
              <div
                style={{
                  marginTop: '0.9rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                  backgroundColor: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.05))',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <span className="app-shell__muted">Base neta: </span>
                  <strong>{formatMoney(priceBreakdown.netPrice)}</strong>
                </div>
                <div>
                  <span className="app-shell__muted">IVA ref. (15%): </span>
                  <strong>{formatMoney(priceBreakdown.taxAmount)}</strong>
                </div>
                <div>
                  <span className="app-shell__muted">PVP final ref.: </span>
                  <strong>{formatMoney(priceBreakdown.finalPrice)}</strong>
                </div>
                {selectedItemIds.length === 1 && effectiveCostInfo ? (
                  <div>
                    <span className="app-shell__muted">Margen bruto s/venta neta: </span>
                    <strong
                      style={{
                        color:
                          marginPercent != null && marginPercent < 0
                            ? 'var(--color-danger, #ef4444)'
                            : marginPercent != null && marginPercent < 15
                              ? 'var(--color-warning, #d97706)'
                              : 'var(--color-success, #16a34a)',
                      }}
                    >
                      {marginPercent != null ? `${marginPercent.toFixed(1)}%` : '—'}
                    </strong>
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          {/* PASO 3: ESCALAS DE DESCUENTO POR VOLUMEN */}
          <SectionCard
            title="3. Descuento por Volumen (Opcional)"
            subtitle="Elige un único mecanismo de escala: un esquema reutilizable para varios productos o tramos manuales exclusivos para este SKU."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }} role="group" aria-label="Modo de descuento por volumen">
                {(
                  [
                    { id: 'none', label: 'Sin escala por volumen' },
                    { id: 'scheme', label: 'Esquema reutilizable' },
                    { id: 'manual', label: 'Tramos manuales exclusivos' },
                  ] as const
                ).map((opt) => (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant={scaleMode === opt.id ? 'primary' : 'outline'}
                    disabled={busy || loading}
                    onClick={() => {
                      setScaleMode(opt.id)
                      if (opt.id === 'manual' && tiers.length === 0) {
                        setTiers([emptyTier()])
                      }
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              {scaleMode === 'scheme' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ maxWidth: 460 }}>
                    <Select
                      id="pp-volume-scheme"
                      label="Esquema por volumen"
                      labelPosition="outlined"
                      variant="outline"
                      options={[
                        { value: '', label: '— Selecciona un esquema —' },
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
                      const sortedTiers = [...selectedScheme.tiers].sort((a, b) => a.quantityFrom - b.quantityFrom)
                      const base = Number.isFinite(numericEnteredPrice) && numericEnteredPrice > 0 ? numericEnteredPrice : null
                      return (
                        <div
                          style={{
                            padding: '0.75rem 1rem',
                            backgroundColor: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.08))',
                            border: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.45rem',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Vista previa por tramo:</span>
                          {sortedTiers.length === 0 ? (
                            <span className="app-shell__muted">Sin tramos definidos en el esquema.</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              {sortedTiers.map((t, idx) => {
                                const range = t.quantityTo ? `${t.quantityFrom}–${t.quantityTo} un.` : `≥${t.quantityFrom} un.`
                                const ruleLabel =
                                  selectedScheme.type === VolumeDiscountSchemeType.FixedPrice
                                    ? `${formatMoney(t.value)} c/u`
                                    : selectedScheme.type === VolumeDiscountSchemeType.Percentage
                                      ? `-${t.value}%`
                                      : `-${formatMoney(t.value)} c/u`
                                let resultingUnit: number | null = null
                                if (base !== null) {
                                  if (selectedScheme.type === VolumeDiscountSchemeType.Percentage) {
                                    resultingUnit = base * (1 - t.value / 100)
                                  } else if (selectedScheme.type === VolumeDiscountSchemeType.FixedAmount) {
                                    resultingUnit = Math.max(0, base - t.value)
                                  } else {
                                    resultingUnit = t.value < base ? t.value : base
                                  }
                                }
                                const tierMargin = resultingUnit !== null ? computeNetAndMargin(resultingUnit).marginPercent : null
                                return (
                                  <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                                    <span className="ecu-chip">{range}</span>
                                    <span>{ruleLabel}</span>
                                    {resultingUnit !== null ? (
                                      <span>
                                        → <strong>{formatMoney(resultingUnit)}</strong> c/u
                                      </span>
                                    ) : null}
                                    {tierMargin !== null ? (
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          color:
                                            tierMargin < 0
                                              ? 'var(--color-danger, #ef4444)'
                                              : tierMargin < 15
                                                ? 'var(--color-warning, #d97706)'
                                                : 'var(--color-success, #16a34a)',
                                        }}
                                      >
                                        {tierMargin < 0 ? `Bajo costo (${tierMargin.toFixed(1)}%)` : `Mg ${tierMargin.toFixed(1)}%`}
                                      </span>
                                    ) : null}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })()
                  ) : null}

                  <div>
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
                </div>
              ) : null}

              {scaleMode === 'manual' ? (
                <div
                  style={{
                    border: '1px solid var(--shell-border, rgba(125, 125, 125, 0.2))',
                    borderRadius: '8px',
                    padding: '0.9rem 1.15rem',
                    backgroundColor: 'var(--shell-surface-subtle, rgba(125, 125, 125, 0.04))',
                  }}
                >
                  <p className="ecu-companies-form__hint" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                    Ingresa el precio unitario ({pricesIncludeTax ? 'con IVA incluido' : 'neto + IVA'}) por rango de cantidad.
                    Ejemplo: «desde 1 hasta 11» → $3.50, y «desde 12» con «hasta» vacío → $3.00.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {tiers.map((tier, index) => {
                      const tierNumPrice = Number(tier.unitPrice)
                      const tierMargin =
                        tier.unitPrice.trim() !== '' ? computeNetAndMargin(tierNumPrice).marginPercent : null
                      return (
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
                              label={pricesIncludeTax ? 'PVP unitario (IVA incl.)' : 'Precio unitario (Neto)'}
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
                            {tierMargin !== null ? (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color:
                                    tierMargin < 0
                                      ? 'var(--color-danger, #ef4444)'
                                      : tierMargin < 15
                                        ? 'var(--color-warning, #d97706)'
                                        : 'var(--color-success, #16a34a)',
                                }}
                              >
                                {tierMargin < 0 ? `Bajo costo (${tierMargin.toFixed(1)}%)` : `Margen neto: ${tierMargin.toFixed(1)}%`}
                              </span>
                            ) : null}
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
                      )
                    })}
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="Añadir tramo manual de escala"
                      disabled={busy || loading}
                      onClick={() => setTiers((current) => [...current, emptyTier()])}
                    >
                      + Tramo manual
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="ecu-companies-form__actions" style={{ flexWrap: 'wrap' }}>
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                disabled={busy || loading || (!isEdit && selectedItemIds.length === 0)}
              >
                {isEdit ? 'Guardar cambios' : renewing ? 'Renovar vigencia' : 'Crear precio'}
              </Button>
              {!isEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || loading || selectedItemIds.length === 0}
                  onClick={() => void onSubmit(undefined, 'another')}
                >
                  Guardar y crear otro
                </Button>
              ) : null}
              {isEdit || selectedItemIds.length === 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || loading || (!isEdit && selectedItemIds.length === 0)}
                  onClick={() => void onSubmit(undefined, 'simulate')}
                >
                  Guardar y simular
                </Button>
              ) : null}
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

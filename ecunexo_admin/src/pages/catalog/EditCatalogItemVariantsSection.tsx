import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import { Camera, Pencil, Plus, RefreshCw, Sparkles, X } from 'lucide-react'
import { SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { addCatalogItemVariant, updateCatalogItem, uploadCatalogItemImage } from '@/services/catalogApi'
import { listWarehouses } from '@/services/inventoryApi'
import type { WarehouseListItemDto } from '@/types/inventoryApi'
import type { CatalogItemDetailDto, CatalogItemVariantSummaryDto } from '@/types/catalogApi'

export type EditCatalogItemVariantsSectionProps = {
  readonly tenantId: string
  readonly parentItem: CatalogItemDetailDto
  readonly onRefreshRequired: () => Promise<void>
  readonly canEdit: boolean
}

type VariantDimensionDef = {
  name: string
  values: string[]
}

type VariantRow = CatalogItemVariantSummaryDto & {
  dimensions?: string
  actions?: string
}

export function EditCatalogItemVariantsSection({
  tenantId,
  parentItem,
  onRefreshRequired,
  canEdit,
}: EditCatalogItemVariantsSectionProps) {
  const toast = useToast()
  const navigate = useNavigate()

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Form states for adding a new variant
  const [variantTitle, setVariantTitle] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState(parentItem.basePrice != null ? String(parentItem.basePrice) : '')
  const [dimValues, setDimValues] = useState<Record<string, string>>({})
  const [initialStock, setInitialStock] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])
  const [variantImage, setVariantImage] = useState<File | null>(null)
  const [variantImagePreview, setVariantImagePreview] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (variantImagePreview) {
        URL.revokeObjectURL(variantImagePreview)
      }
    }
  }, [variantImagePreview])

  // Parse variant dimensions from parent
  const dimensions = useMemo<VariantDimensionDef[]>(() => {
    if (!parentItem.variantDimensionsJson) return []
    try {
      const parsed = JSON.parse(parentItem.variantDimensionsJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [parentItem.variantDimensionsJson])

  // Load warehouses when opening add modal
  useEffect(() => {
    if (!addModalOpen || !tenantId) return
    let active = true
    listWarehouses(tenantId)
      .then((whs) => {
        if (!active) return
        setWarehouses(whs)
        const def = whs.find((w) => w.isMain) ?? whs[0]
        if (def) setWarehouseId(def.id)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [addModalOpen, tenantId])

  // Open modal and pre-fill fields
  const handleOpenAddModal = useCallback(() => {
    if (variantImagePreview) {
      URL.revokeObjectURL(variantImagePreview)
    }
    setVariantImage(null)
    setVariantImagePreview(null)
    const defaultPrefix = parentItem.sku ? `${parentItem.sku}-` : ''
    setVariantTitle('')
    setSku(defaultPrefix)
    setPrice(parentItem.basePrice != null ? String(parentItem.basePrice) : '')
    setInitialStock('')
    const initialDims: Record<string, string> = {}
    for (const d of dimensions) {
      initialDims[d.name.toLowerCase()] = d.values[0] ?? ''
    }
    setDimValues(initialDims)
    setAddModalOpen(true)
  }, [dimensions, parentItem.basePrice, parentItem.sku, variantImagePreview])

  // Auto-suggest title and SKU when dimensions change in add modal
  const handleDimChange = useCallback(
    (dimName: string, val: string) => {
      const updated = { ...dimValues, [dimName.toLowerCase()]: val }
      setDimValues(updated)
      const valuesJoined = Object.values(updated).filter(Boolean).join(' - ')
      setVariantTitle(valuesJoined)
      const skuSuffix = Object.values(updated)
        .filter(Boolean)
        .map((v) => v.replace(/\s+/g, '').toUpperCase())
        .join('-')
      const prefix = parentItem.sku ? `${parentItem.sku}-` : ''
      setSku(`${prefix}${skuSuffix}`)
    },
    [dimValues, parentItem.sku]
  )

  // Submit adding new variant
  const handleAddVariantSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !parentItem.id) return
      if (!variantTitle.trim()) {
        toast.show({ title: 'Campo requerido', message: 'El título de la variante es obligatorio.', variant: 'error' })
        return
      }
      if (!sku.trim()) {
        toast.show({ title: 'Campo requerido', message: 'El SKU es obligatorio.', variant: 'error' })
        return
      }

      let parsedPrice: number | null = null
      if (price.trim()) {
        const p = Number(price.replace(',', '.'))
        if (Number.isNaN(p) || p < 0) {
          toast.show({ title: 'Precio inválido', message: 'El precio debe ser un número mayor o igual a 0.', variant: 'error' })
          return
        }
        parsedPrice = p
      }

      let parsedQty: number | null = null
      if (initialStock.trim()) {
        const q = Number(initialStock.replace(',', '.'))
        if (Number.isNaN(q) || q < 0) {
          toast.show({ title: 'Stock inválido', message: 'La cantidad inicial no es válida.', variant: 'error' })
          return
        }
        parsedQty = q
      }

      setBusy(true)
      try {
        const createdVariant = await addCatalogItemVariant(tenantId, parentItem.id, {
          variantTitle: variantTitle.trim(),
          sku: sku.trim().toUpperCase(),
          basePrice: parsedPrice,
          customAttributesJson: JSON.stringify(dimValues),
          initialStock: parsedQty,
          initialStockWarehouseId: parsedQty && warehouseId ? warehouseId : null,
        })

        if (variantImage && createdVariant.variantItemId) {
          try {
            await uploadCatalogItemImage(
              tenantId,
              createdVariant.variantItemId,
              variantImage,
              variantTitle.trim(),
              true
            )
          } catch (imgErr) {
            console.error('Error al subir foto de variante', imgErr)
          }
        }

        toast.show({
          title: 'Variante creada',
          message: `La variante «${variantTitle.trim()}» se agregó exitosamente.`,
          variant: 'success',
        })
        if (variantImagePreview) {
          URL.revokeObjectURL(variantImagePreview)
        }
        setVariantImage(null)
        setVariantImagePreview(null)
        setAddModalOpen(false)
        await onRefreshRequired()
      } catch (err) {
        toast.show({
          title: 'Error al crear variante',
          message: readApiError(err, 'No se pudo agregar la variante.'),
          variant: 'error',
        })
      } finally {
        setBusy(false)
      }
    },
    [
      dimValues,
      initialStock,
      onRefreshRequired,
      parentItem.id,
      price,
      sku,
      tenantId,
      toast,
      variantImage,
      variantImagePreview,
      variantTitle,
      warehouseId,
    ]
  )

  // Bulk sync price from parent to all variants
  const handleSyncPriceToAll = useCallback(async () => {
    if (!tenantId || !parentItem.variants || parentItem.variants.length === 0) return
    if (parentItem.basePrice == null) {
      toast.show({ title: 'Sin precio base', message: 'El producto matriz no tiene un precio base configurado.', variant: 'warning' })
      return
    }

    setSyncing(true)
    try {
      let updatedCount = 0
      for (const v of parentItem.variants) {
        await updateCatalogItem(tenantId, v.id, {
          name: v.name,
          sku: v.sku,
          basePrice: parentItem.basePrice,
          customAttributesJson: v.customAttributesJson,
          status: v.status,
          kind: parentItem.kind,
          categoryId: parentItem.categoryId,
        })
        updatedCount++
      }

      toast.show({
        title: 'Precios sincronizados',
        message: `Se actualizó el precio a $${Number(parentItem.basePrice).toFixed(2)} en ${updatedCount} variante(s).`,
        variant: 'success',
      })
      setSyncModalOpen(false)
      await onRefreshRequired()
    } catch (err) {
      toast.show({
        title: 'Error al sincronizar',
        message: readApiError(err, 'Ocurrió un error al actualizar los precios.'),
        variant: 'error',
      })
    } finally {
      setSyncing(false)
    }
  }, [onRefreshRequired, parentItem, tenantId, toast])

  // KPIs
  const variants = useMemo(() => parentItem.variants ?? [], [parentItem.variants])
  const activeCount = useMemo(() => variants.filter((v) => Number(v.status) === 0).length, [variants])
  const prices = useMemo(
    () => variants.map((v) => v.basePrice).filter((p): p is number => p != null),
    [variants]
  )
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null
  const priceRangeLabel = useMemo(() => {
    if (minPrice == null) return 'Sin precio'
    if (minPrice === maxPrice) return `$${minPrice.toFixed(2)}`
    return `$${minPrice.toFixed(2)} - $${maxPrice?.toFixed(2)}`
  }, [maxPrice, minPrice])

  const rows = useMemo<VariantRow[]>(
    () => variants.map((v) => ({ ...v })),
    [variants]
  )

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const dataGridMessages = useMemo(() => createSpanishDataGridMessages('variante', 'variantes'), [])

  // Parse variant attributes helper
  const parseAttributes = useCallback((jsonStr: string): Record<string, string> => {
    try {
      const parsed = JSON.parse(jsonStr)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, string>
      }
    } catch {
      // Ignorar error de parseo
    }
    return {}
  }, [])

  const columns = useMemo<ColumnDef<VariantRow>[]>(
    () => [
      {
        key: 'mainImageThumbUrl',
        header: 'Foto',
        width: 65,
        renderCell: (_value: unknown, row: VariantRow) => {
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {row.mainImageThumbUrl ? (
                <img
                  src={row.mainImageThumbUrl}
                  alt={row.name}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    objectFit: 'cover',
                    border: '1px solid var(--glb-border, #e2e8f0)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 6,
                    border: '1px dashed var(--glb-border, #cbd5e1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--glb-muted, #94a3b8)',
                    background: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
                  }}
                  title="Sin foto asignada"
                >
                  <Camera size={16} />
                </div>
              )}
            </div>
          )
        },
      },
      {
        key: 'dimensions',
        header: 'Tallas / Atributos',
        width: 180,
        renderCell: (_value: unknown, row: VariantRow) => {
          const attrs = parseAttributes(row.customAttributesJson)
          const entries = Object.entries(attrs)
          if (entries.length === 0) {
            return <span className="app-shell__muted" style={{ fontSize: '0.8rem' }}>General</span>
          }
          return (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {entries.map(([k, v]) => (
                <span
                  key={k}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: 'color-mix(in srgb, var(--shell-primary, #4f46e5) 10%, var(--glb-surface, #ffffff))',
                    color: 'var(--shell-primary, #4f46e5)',
                    border: '1px solid color-mix(in srgb, var(--shell-primary, #4f46e5) 20%, transparent)',
                  }}
                >
                  <span style={{ opacity: 0.7, textTransform: 'capitalize' }}>{k}:</span>
                  <span>{String(v)}</span>
                </span>
              ))}
            </div>
          )
        },
      },
      {
        key: 'name',
        header: 'Nombre de Variante',
        width: 240,
        renderCell: (_value: unknown, row: VariantRow) => (
          <span style={{ fontWeight: 600, color: 'var(--glb-text, #1e293b)' }}>
            {row.name}
          </span>
        ),
      },
      {
        key: 'sku',
        header: 'SKU Físico',
        width: 160,
        renderCell: (_value: unknown, row: VariantRow) => (
          <code className="ecu-code" style={{ fontSize: '0.8rem' }}>
            {row.sku || '—'}
          </code>
        ),
      },
      {
        key: 'basePrice',
        header: 'Precio Base',
        width: 130,
        renderCell: (_value: unknown, row: VariantRow) => (
          <span style={{ fontWeight: 700, color: 'var(--shell-primary, #4f46e5)' }}>
            {row.basePrice != null ? `$${Number(row.basePrice).toFixed(2)}` : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 120,
        renderCell: (_value: unknown, row: VariantRow) => (
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
        header: 'Acciones',
        width: 90,
        renderCell: (_value: unknown, row: VariantRow) => (
          <GridIconButton
            label="Editar variante"
            icon={Pencil}
            onClick={() => {
              navigate(`/catalogo/items/${row.id}`)
            }}
          />
        ),
      },
    ],
    [navigate, parseAttributes]
  )

  const warehouseOptions = useMemo(
    () => [
      { value: '', label: 'Seleccionar bodega…' },
      ...warehouses.map((w) => ({
        value: w.id,
        label: `${w.name} ${w.isMain ? '(Principal)' : ''}`,
      })),
    ],
    [warehouses]
  )

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Tira de KPIs de la matriz */}
      <div className="ecu-stat-grid" aria-label="Métricas de la matriz de variantes" style={{ marginBottom: '1rem' }}>
        <StatCard
          label="Total Variantes"
          value={String(variants.length)}
          icon="layers"
          toneColor="#4f46e5"
          footerText="Combinaciones registradas"
        />
        <StatCard
          label="Variantes Activas"
          value={String(activeCount)}
          icon="check_circle"
          toneColor="#10b981"
          footerText="Disponibles para venta"
        />
        <StatCard
          label="Rango de Precios"
          value={priceRangeLabel}
          icon="attach_money"
          toneColor="#8b5cf6"
          footerText="Precios por variante"
        />
        <StatCard
          label="Prefijo Modelo SKU"
          value={parentItem.sku || 'Sin código'}
          icon="qr_code_2"
          toneColor="#0ea5e9"
          footerText="Código agrupador"
        />
      </div>

      <SectionCard
        title={`Variantes Registradas (${variants.length})`}
        subtitle="Control independiente de SKU, precio, código de barras, fotos y existencias por variante"
        action={
          canEdit ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {variants.length > 0 && parentItem.basePrice != null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSyncModalOpen(true)}
                  title="Sincronizar el precio base a todas las variantes"
                >
                  <RefreshCw size={14} style={{ marginRight: '0.35rem' }} />
                  Sincronizar precio (${Number(parentItem.basePrice).toFixed(2)})
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleOpenAddModal}
              >
                <Plus size={15} style={{ marginRight: '0.35rem' }} />
                Añadir Variante
              </Button>
            </div>
          ) : undefined
        }
      >
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <DataGrid<VariantRow>
            dataSource={rows}
            keyExpr="id"
            columns={columns}
            paging={paging}
            pageSizeOptions={pageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            messages={dataGridMessages}
            loading={busy}
          />
        </div>
      </SectionCard>

      {/* Modal para añadir variante */}
      <Popup
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Añadir Variante"
        width="min(92vw, 36rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'outline',
            onClick: () => setAddModalOpen(false),
            disabled: busy,
          },
          {
            id: 'save',
            label: busy ? 'Guardando…' : 'Crear Variante',
            variant: 'primary',
            onClick: () => void handleAddVariantSubmit(),
            disabled: busy,
          },
        ]}
      >
        <form onSubmit={(e) => void handleAddVariantSubmit(e)} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <p className="app-shell__muted" style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>
              Ítem Principal: <strong>{parentItem.name}</strong>
            </p>

            {/* Dimensiones dinámicas */}
            {dimensions.length > 0 ? (
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
                  border: '1px solid var(--glb-border, #e2e8f0)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={15} color="var(--shell-primary, #4f46e5)" />
                  <span>Dimensiones de la matriz:</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: dimensions.length > 1 ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                  {dimensions.map((d) => {
                    const currentVal = dimValues[d.name.toLowerCase()] ?? ''
                    return (
                      <div key={d.name}>
                        {d.values.length > 0 ? (
                          <Select
                            id={`dim-${d.name}`}
                            label={d.name}
                            labelPosition="outlined"
                            variant="outline"
                            options={d.values.map((v) => ({ value: v, label: v }))}
                            value={currentVal}
                            onChange={(val) => handleDimChange(d.name, val)}
                            fullWidth
                          />
                        ) : (
                          <TextBox
                            id={`dim-${d.name}`}
                            label={d.name}
                            labelPosition="outlined"
                            variant="outline"
                            value={currentVal}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => handleDimChange(d.name, e.target.value)}
                            fullWidth
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <TextBox
                id="var-title"
                label="Título / Talla de variante"
                labelPosition="outlined"
                variant="outline"
                value={variantTitle}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setVariantTitle(e.target.value)}
                placeholder="Ej. 38 - Negro"
                required
                fullWidth
              />
              <TextBox
                id="var-sku"
                label="SKU físico de la variante"
                labelPosition="outlined"
                variant="outline"
                value={sku}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSku(e.target.value.toUpperCase())}
                required
                fullWidth
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <TextBox
                id="var-price"
                label="Precio base de la variante"
                labelPosition="outlined"
                variant="outline"
                value={price}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                placeholder="0.00"
                fullWidth
              />
              <TextBox
                id="var-stock"
                label="Stock inicial (opcional)"
                labelPosition="outlined"
                variant="outline"
                value={initialStock}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setInitialStock(e.target.value)}
                placeholder="0"
                fullWidth
              />
            </div>

            {initialStock.trim() && Number(initialStock) > 0 ? (
              <Select
                id="var-wh"
                label="Bodega para ingreso de stock inicial"
                labelPosition="outlined"
                variant="outline"
                options={warehouseOptions}
                value={warehouseId}
                onChange={setWarehouseId}
                fullWidth
              />
            ) : null}

            {/* Selector de fotografía específica de la variante */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--glb-muted, #64748b)' }}>
                Fotografía de la variante (opcional)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {variantImagePreview ? (
                  <div className="ecu-var-img-preview" style={{ width: 48, height: 48 }}>
                    <img src={variantImagePreview} alt="Preview variante" />
                    <button
                      type="button"
                      className="ecu-var-img-remove"
                      onClick={() => {
                        if (variantImagePreview) URL.revokeObjectURL(variantImagePreview)
                        setVariantImage(null)
                        setVariantImagePreview(null)
                      }}
                      disabled={busy}
                      title="Quitar foto"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <label className="ecu-var-img-btn" style={{ padding: '0.45rem 0.75rem' }}>
                    <Camera size={15} />
                    <span>Seleccionar foto para esta variante</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (variantImagePreview) URL.revokeObjectURL(variantImagePreview)
                          setVariantImage(file)
                          setVariantImagePreview(URL.createObjectURL(file))
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </form>
      </Popup>

      {/* Modal de confirmación para sincronizar precio base masivo */}
      <Popup
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        title="Sincronizar Precio Base a Todas las Variantes"
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'outline',
            onClick: () => setSyncModalOpen(false),
            disabled: syncing,
          },
          {
            id: 'confirm',
            label: syncing ? 'Actualizando…' : 'Confirmar y Actualizar',
            variant: 'primary',
            onClick: () => void handleSyncPriceToAll(),
            disabled: syncing,
          },
        ]}
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--glb-text, #1e293b)', lineHeight: 1.5 }}>
            Se actualizará el precio base de las <strong>{variants.length}</strong> variantes al valor del ítem principal:{' '}
            <strong style={{ color: 'var(--shell-primary, #4f46e5)' }}>
              ${Number(parentItem.basePrice ?? 0).toFixed(2)}
            </strong>.
          </p>
          <p className="app-shell__muted" style={{ fontSize: '0.825rem', margin: 0 }}>
            Esta acción modificará los precios individuales de todas las variantes hijas en el catálogo.
          </p>
        </div>
      </Popup>
    </div>
  )
}

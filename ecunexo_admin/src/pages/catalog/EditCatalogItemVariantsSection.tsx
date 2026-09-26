import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ColorPicker, DataGrid, DEFAULT_COLOR_PRESETS, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import { ArrowLeftRight, Camera, Palette, Pencil, Plus, RefreshCw, Sparkles, X } from 'lucide-react'
import { SectionCard, StatusBadge } from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  addCatalogItemVariant,
  listCatalogItems,
  reassignCatalogItemVariantParent,
  updateCatalogItem,
  uploadCatalogItemImage,
} from '@/services/catalogApi'
import {
  CatalogItemKind,
  type CatalogItemDetailDto,
  type CatalogItemListItemDto,
  type CatalogItemVariantSummaryDto,
} from '@/types/catalogApi'
import { buildVariantAdminSummary, formatVariantDisplayName, isHexColorToken } from '@/lib/catalogArchetype'
import { VariantAdminSummaryBlock } from '@/pages/catalog/VariantAdminSummaryBlock'
import type { CatalogMatrixAxisDto } from '@/types/catalogApi'

function resolveRowAxisValue(
  row: CatalogItemVariantSummaryDto,
  axisName: string,
  parseAttributes: (json: string) => Record<string, string>
): string {
  const fromMap = row.dimensionValues?.[axisName]
  if (fromMap?.trim()) return fromMap.trim()
  const attrs = parseAttributes(row.customAttributesJson || '{}')
  const target = axisName.trim().toLowerCase()
  for (const [key, value] of Object.entries(attrs)) {
    if (key.trim().toLowerCase() === target) {
      return String(value ?? '').trim()
    }
  }
  return ''
}

export type EditCatalogItemVariantsSectionProps = {
  readonly tenantId: string
  readonly parentItem: CatalogItemDetailDto
  readonly onRefreshRequired: () => Promise<void>
  readonly canEdit: boolean
  readonly remainingVariants?: number | null
  readonly maxVariants?: number | null
  /** Aviso breve cuando las fotos van por SKU (no en el padre). */
  readonly photoHint?: string | null
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
  remainingVariants = null,
  maxVariants = null,
  photoHint = null,
}: EditCatalogItemVariantsSectionProps) {
  const toast = useToast()
  const navigate = useNavigate()

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Reassign / Move variant state
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<VariantRow | null>(null)
  const [targetParentId, setTargetParentId] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [matrixParents, setMatrixParents] = useState<CatalogItemListItemDto[]>([])
  const [loadingMatrixParents, setLoadingMatrixParents] = useState(false)

  const handleOpenReassignModal = useCallback(
    async (variant: VariantRow) => {
      if (!tenantId) return
      setSelectedVariant(variant)
      setReassignReason('')
      setTargetParentId('')
      setReassignModalOpen(true)
      setLoadingMatrixParents(true)
      try {
        const items = await listCatalogItems(tenantId, { kind: CatalogItemKind.Physical })
        const parents = items.filter(
          (p) => p.isMatrixParent && p.id !== parentItem.id && p.id !== variant.id
        )
        setMatrixParents(parents)
      } catch (err) {
        toast.show({
          title: 'Error al listar matrices',
          message: readApiError(err, 'No se pudieron consultar los productos matriz.'),
          variant: 'error',
        })
      } finally {
        setLoadingMatrixParents(false)
      }
    },
    [parentItem.id, tenantId, toast]
  )

  const selectedVariantSummary = useMemo(() => {
    if (!selectedVariant) return null
    return buildVariantAdminSummary(
      selectedVariant,
      parentItem.name,
      parentItem.matrixDescriptor?.axes
    )
  }, [parentItem.matrixDescriptor?.axes, parentItem.name, selectedVariant])

  const handleReassignSubmit = useCallback(async () => {
    if (!tenantId || !selectedVariant) return
    if (!reassignReason.trim() || reassignReason.trim().length < 3) {
      toast.show({
        title: 'Motivo requerido',
        message: 'Debe ingresar un motivo de auditoría de al menos 3 caracteres.',
        variant: 'warning',
      })
      return
    }

    setReassigning(true)
    try {
      await reassignCatalogItemVariantParent(tenantId, selectedVariant.id, {
        targetParentItemId: targetParentId ? targetParentId : null,
        reason: reassignReason.trim(),
      })
      toast.show({
        title: 'Variante reasignada',
        message: `La variante ${selectedVariant.sku?.trim() || selectedVariant.name} se movió exitosamente.`,
        variant: 'success',
      })
      setReassignModalOpen(false)
      setSelectedVariant(null)
      await onRefreshRequired()
    } catch (err) {
      toast.show({
        title: 'Error al reasignar',
        message: readApiError(err, 'No se pudo mover la variante.'),
        variant: 'error',
      })
    } finally {
      setReassigning(false)
    }
  }, [onRefreshRequired, reassignReason, selectedVariant, targetParentId, tenantId, toast])

  const reassignTargetOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      {
        value: '',
        label: '— Convertir en producto individual (desenlazar matriz) —',
      },
    ]
    matrixParents.forEach((p) => {
      opts.push({
        value: p.id,
        label: `${p.name} ${p.sku ? `(${p.sku})` : ''}`,
      })
    })
    return opts
  }, [matrixParents])

  // Form states for adding a new variant
  const [variantTitle, setVariantTitle] = useState('')
  const [sku, setSku] = useState('')
  const [price, setPrice] = useState(parentItem.basePrice != null ? String(parentItem.basePrice) : '')
  const [dimValues, setDimValues] = useState<Record<string, string>>({})
  const [variantImage, setVariantImage] = useState<File | null>(null)
  const [variantImagePreview, setVariantImagePreview] = useState<string | null>(null)

  // Colors editor per variant
  const [colorsModalVariant, setColorsModalVariant] = useState<VariantRow | null>(null)
  const [colorDraft, setColorDraft] = useState<string[]>([])
  const [customColorHex, setCustomColorHex] = useState('#3b82f6')
  const [savingColors, setSavingColors] = useState(false)

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

  // Open modal and pre-fill fields
  const handleOpenAddModal = useCallback(() => {
    if (variantImagePreview) {
      URL.revokeObjectURL(variantImagePreview)
    }
    setVariantImage(null)
    setVariantImagePreview(null)
    setVariantTitle('')
    setSku('')
    setPrice(parentItem.basePrice != null ? String(parentItem.basePrice) : '')
    const initialDims: Record<string, string> = {}
    for (const d of dimensions) {
      initialDims[d.name.toLowerCase()] = d.values[0] ?? ''
    }
    setDimValues(initialDims)
    setAddModalOpen(true)
  }, [dimensions, parentItem.basePrice, variantImagePreview])

  // Auto-suggest variant title when dimensions change in add modal
  const handleDimChange = useCallback(
    (dimName: string, val: string) => {
      const updated = { ...dimValues, [dimName.toLowerCase()]: val }
      setDimValues(updated)
      const valuesJoined = Object.values(updated).filter(Boolean).join(' - ')
      setVariantTitle(valuesJoined)
    },
    [dimValues]
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

      setBusy(true)
      try {
        const createdVariant = await addCatalogItemVariant(tenantId, parentItem.id, {
          variantTitle: variantTitle.trim(),
          sku: sku.trim().toUpperCase(),
          basePrice: parsedPrice,
          customAttributesJson: JSON.stringify(dimValues),
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
      onRefreshRequired,
      parentItem.id,
      price,
      sku,
      tenantId,
      toast,
      variantImage,
      variantImagePreview,
      variantTitle,
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
          familyId: parentItem.familyId ?? null,
          hierarchyPathJson: parentItem.hierarchyPathJson ?? null,
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

  const toggleDraftColor = useCallback((hex: string) => {
    const normalized = hex.trim().toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return
    setColorDraft((prev) =>
      prev.includes(normalized) ? prev.filter((c) => c !== normalized) : [...prev, normalized]
    )
  }, [])

  const handleOpenColorsModal = useCallback((row: VariantRow) => {
    setColorsModalVariant(row)
    setColorDraft(Array.isArray(row.extraColors) ? [...row.extraColors] : [])
    setCustomColorHex('#3b82f6')
  }, [])

  const handleSaveVariantColors = useCallback(async () => {
    if (!tenantId || !colorsModalVariant) return
    setSavingColors(true)
    try {
      let attrs: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(colorsModalVariant.customAttributesJson || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          attrs = { ...(parsed as Record<string, unknown>) }
        }
      } catch {
        attrs = {}
      }

      if (colorDraft.length > 0) {
        attrs['colores_secundarios'] = colorDraft
      } else {
        delete attrs['colores_secundarios']
      }

      await updateCatalogItem(tenantId, colorsModalVariant.id, {
        kind: parentItem.kind,
        name: colorsModalVariant.name,
        sku: colorsModalVariant.sku,
        basePrice: colorsModalVariant.basePrice,
        customAttributesJson: JSON.stringify(attrs),
        familyId: parentItem.familyId ?? null,
        hierarchyPathJson: parentItem.hierarchyPathJson ?? null,
        status: colorsModalVariant.status,
      })

      toast.show({
        title: 'Colores actualizados',
        message:
          colorDraft.length > 0
            ? `La variante «${colorsModalVariant.name}» quedó con ${colorDraft.length} color(es).`
            : `Se quitaron los colores de «${colorsModalVariant.name}».`,
        variant: 'success',
      })
      setColorsModalVariant(null)
      await onRefreshRequired()
    } catch (err) {
      toast.show({
        title: 'Error al guardar colores',
        message: readApiError(err, 'No se pudieron actualizar los colores de la variante.'),
        variant: 'error',
      })
    } finally {
      setSavingColors(false)
    }
  }, [colorDraft, colorsModalVariant, onRefreshRequired, parentItem, tenantId, toast])

  const matrixAxes = useMemo<CatalogMatrixAxisDto[]>(
    () => parentItem.matrixDescriptor?.axes ?? [],
    [parentItem.matrixDescriptor?.axes]
  )

  const openVariantAdmin = useCallback(
    (variantId: string) => {
      navigate(`/catalogo/items/${variantId}`)
    },
    [navigate]
  )

  const columns = useMemo<ColumnDef<VariantRow>[]>(() => {
    const axisColumns = matrixAxes.map((axis) => ({
      key: `axis-${axis.name}`,
      header: axis.name,
      width: axis.type === 'color' ? 76 : 108,
      renderCell: (_value: unknown, row: VariantRow) => {
        const raw = resolveRowAxisValue(row, axis.name, parseAttributes)
        if (!raw) {
          return (
            <span className="app-shell__muted" style={{ fontSize: '0.8rem' }}>
              —
            </span>
          )
        }
        if (axis.type === 'color' || isHexColorToken(raw)) {
          const hex = raw.toLowerCase()
          return (
            <span
              title={hex}
              aria-label={`Color ${hex}`}
              style={{
                display: 'inline-block',
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '1px solid rgba(148, 163, 184, 0.55)',
                backgroundColor: hex,
              }}
            />
          )
        }
        return (
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }} title={raw}>
            {raw}
          </span>
        )
      },
    })) as unknown as ColumnDef<VariantRow>[]

    return [
      ...axisColumns,
      {
        key: 'sku',
        header: 'SKU',
        width: 168,
        renderCell: (_value: unknown, row: VariantRow) => (
          <button
            type="button"
            onClick={() => openVariantAdmin(row.id)}
            className="ecu-code"
            style={{
              fontSize: '0.8rem',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--shell-primary, #4f46e5)',
              fontWeight: 700,
              textAlign: 'left',
            }}
            title="Administrar esta variante (fotos, precio, datos)"
          >
            {row.sku || '—'}
          </button>
        ),
      },
      {
        key: 'basePrice',
        header: 'Precio',
        width: 110,
        renderCell: (_value: unknown, row: VariantRow) => (
          <span style={{ fontWeight: 700, color: 'var(--shell-primary, #4f46e5)' }}>
            {row.basePrice != null ? `$${Number(row.basePrice).toFixed(2)}` : '—'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 110,
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
        header: '',
        width: 112,
        sticky: 'right',
        renderCell: (_value: unknown, row: VariantRow) => (
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <GridIconButton
              label="Administrar variante"
              icon={Pencil}
              onClick={() => openVariantAdmin(row.id)}
            />
            {canEdit && (
              <GridIconButton
                label="Colores de la variante"
                icon={Palette}
                onClick={() => {
                  handleOpenColorsModal(row)
                }}
              />
            )}
            {canEdit && (
              <GridIconButton
                label="Reasignar / Mover a otro producto matriz"
                icon={ArrowLeftRight}
                onClick={() => {
                  void handleOpenReassignModal(row)
                }}
              />
            )}
          </div>
        ),
      },
    ]
  }, [
    canEdit,
    handleOpenColorsModal,
    handleOpenReassignModal,
    matrixAxes,
    openVariantAdmin,
    parseAttributes,
  ])

  const variantsSubtitle = useMemo(() => {
    const parts: string[] = []
    parts.push('Listado compacto; fotos y ficha completa en Administrar')
    if (photoHint?.trim()) parts.push(photoHint.trim())
    parts.push(
      `${variants.length} ${variants.length === 1 ? 'combinación' : 'combinaciones'} · ${activeCount} activas`
    )
    if (priceRangeLabel !== '—') parts.push(`Precios ${priceRangeLabel}`)
    return parts.join(' · ')
  }, [activeCount, photoHint, priceRangeLabel, variants.length])

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <SectionCard
        title="Variantes"
        subtitle={variantsSubtitle}
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
                disabled={remainingVariants === 0}
                title={
                  remainingVariants === 0
                    ? `Tu plan permite hasta ${maxVariants} variantes y ya alcanzaste el máximo.`
                    : undefined
                }
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

      {/* Modal para mover / reasignar variante a otro padre o independizar */}
      <Popup
        open={reassignModalOpen}
        onClose={() => {
          if (!reassigning) setReassignModalOpen(false)
        }}
        title="Mover variante a otra matriz"
        width="min(92vw, 32rem)"
        actions={[
          {
            id: 'cancel-reassign-var',
            label: 'Cancelar',
            variant: 'outline',
            onClick: () => setReassignModalOpen(false),
            disabled: reassigning,
          },
          {
            id: 'confirm-reassign-var',
            label: reassigning ? 'Reasignando…' : 'Confirmar Reasignación',
            variant: 'primary',
            onClick: () => void handleReassignSubmit(),
            disabled: reassigning || reassignReason.trim().length < 3,
          },
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              backgroundColor: 'color-mix(in srgb, var(--shell-primary, #4f46e5) 8%, var(--glb-surface, #fff))',
              border: '1px solid color-mix(in srgb, var(--shell-primary, #4f46e5) 20%, transparent)',
              fontSize: '0.85rem',
            }}
          >
            {selectedVariantSummary ? <VariantAdminSummaryBlock summary={selectedVariantSummary} /> : null}
            <div style={{ marginTop: '0.5rem', color: 'var(--glb-muted, #64748b)' }}>
              Matriz actual: <strong>«{parentItem.name}»</strong>. El SKU, historial de facturación y stock en bodega se conservan intactos.
            </div>
          </div>

          {loadingMatrixParents ? (
            <p className="app-shell__muted" style={{ fontSize: '0.85rem' }}>
              Cargando productos matriz disponibles…
            </p>
          ) : (
            <Select
              id="reassign-var-target"
              label="Producto Matriz Destino"
              labelPosition="outlined"
              variant="outline"
              options={reassignTargetOptions}
              value={targetParentId}
              onChange={setTargetParentId}
              disabled={reassigning}
              fullWidth
            />
          )}

          <TextBox
            id="reassign-var-reason"
            label="Motivo de la reasignación (Auditoría obligatorio)"
            labelPosition="outlined"
            variant="outline"
            placeholder="Ej. Error de asignación inicial / Se traslada a nueva línea deportiva"
            value={reassignReason}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setReassignReason(e.target.value)}
            disabled={reassigning}
            fullWidth
          />
        </div>
      </Popup>

      {/* Modal de colores de la variante */}
      <Popup
        open={colorsModalVariant != null}
        onClose={() => {
          if (!savingColors) setColorsModalVariant(null)
        }}
        title="Colores de la Variante"
        width="min(92vw, 30rem)"
        actions={[
          {
            id: 'cancel-colors',
            label: 'Cancelar',
            variant: 'outline',
            onClick: () => setColorsModalVariant(null),
            disabled: savingColors,
          },
          {
            id: 'save-colors',
            label: savingColors ? 'Guardando…' : 'Guardar',
            variant: 'primary',
            onClick: () => void handleSaveVariantColors(),
            disabled: savingColors,
          },
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
          <p className="app-shell__muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Variante:{' '}
            <strong>
              {formatVariantDisplayName(
                colorsModalVariant?.name ?? '',
                parentItem.name
              )}
            </strong>
            {colorsModalVariant?.sku ? ` (${colorsModalVariant.sku})` : ''}
          </p>

          <div>
            <span
              style={{
                display: 'block',
                marginBottom: '0.45rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--glb-muted, #64748b)',
              }}
            >
              Elige un color
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
              {DEFAULT_COLOR_PRESETS.map((preset) => {
                const selected = colorDraft.includes(preset)
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`Color ${preset}`}
                    aria-pressed={selected}
                    title={preset}
                    onClick={() => toggleDraftColor(preset)}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      padding: 0,
                      borderRadius: 8,
                      border: '1px solid var(--glb-border, rgba(0, 0, 0, 0.15))',
                      backgroundColor: preset,
                      cursor: 'pointer',
                      boxShadow: selected
                        ? '0 0 0 2px var(--glb-surface, #fff), 0 0 0 4px var(--shell-primary, #3b82f6)'
                        : undefined,
                    }}
                  />
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <ColorPicker
                label="Otro color (hexadecimal)"
                labelPosition="outlined"
                variant="outline"
                value={customColorHex}
                onChange={(hex: string) => setCustomColorHex(hex || '')}
                disabled={savingColors}
                fullWidth
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleDraftColor(customColorHex)}
              disabled={savingColors || !/^#[0-9a-fA-F]{6}$/.test(customColorHex.trim())}
            >
              <Plus size={13} /> Añadir
            </Button>
          </div>

          {colorDraft.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {colorDraft.map((hex) => (
                <span
                  key={hex}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '999px',
                    border: '1px solid var(--glb-border, #e2e8f0)',
                    backgroundColor: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.04))',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      border: '1px solid rgba(0, 0, 0, 0.2)',
                      backgroundColor: hex,
                      flexShrink: 0,
                    }}
                  />
                  <span>{hex}</span>
                  <button
                    type="button"
                    onClick={() => toggleDraftColor(hex)}
                    disabled={savingColors}
                    title={`Quitar ${hex}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      opacity: 0.7,
                    }}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Popup>
    </div>
  )
}


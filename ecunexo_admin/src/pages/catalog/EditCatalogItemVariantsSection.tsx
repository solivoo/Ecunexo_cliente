import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, Popup, Select, TextBox, useToast, type ColumnDef } from 'glubox'
import { ArrowDown, ArrowLeftRight, ArrowUp, Package, Pencil, Plus, SlidersHorizontal } from 'lucide-react'
import { SectionCard, StatusBadge } from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  listCatalogItems,
  reassignCatalogItemVariantParent,
  updateCatalogItem,
} from '@/services/catalogApi'
import { reorderCatalogItemVariants } from '@/services/catalogApi'
import { listPriceLists, listProductPrices } from '@/services/pricingApi'
import {
  CatalogItemKind,
  type CatalogItemDetailDto,
  type CatalogItemListItemDto,
  type CatalogItemVariantSummaryDto,
  type TenantMediaAssetDto,
} from '@/types/catalogApi'
import {
  buildVariantAdminSummary,
  isHexColorToken,
  type ArchetypeAttributeField,
  type DimensionLookup,
} from '@/lib/catalogArchetype'
import { paletteFromDimensionMap } from '@/lib/catalogNamedColors'
import { VariantPhysicalFields } from '@/pages/catalog/VariantPhysicalFields'
import { computeProfitAndMargin, parsePriceInput } from '@/pages/catalog/CatalogPricingMarginBar'
import type { CustomAttributeRow } from '@/pages/catalog/ItemCustomAttributesEditor'
import { VariantAdminSummaryBlock } from '@/pages/catalog/VariantAdminSummaryBlock'
import type { CatalogMatrixAxisDto } from '@/types/catalogApi'
import './variantMatrixBuilder.css'

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
  /** Oculta el selector de foto al crear variante cuando la plantilla no usa fotos. */
  readonly showPhotoField?: boolean
  /** Atributos que la plantilla captura por variante (Color, Actividad, Tag…). */
  readonly variantAttributeFields?: ArchetypeAttributeField[]
  readonly dimensionValuesMap?: Map<string, DimensionLookup>
  readonly onUploadMedia?: (file: File) => Promise<TenantMediaAssetDto>
  readonly onMediaError?: (message: string) => void
  readonly onPaletteUpdated?: () => void | Promise<void>
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
  variantAttributeFields = [],
  dimensionValuesMap,
  onUploadMedia,
  onMediaError,
  onPaletteUpdated,
}: EditCatalogItemVariantsSectionProps) {
  const toast = useToast()
  const navigate = useNavigate()

  const [reordering, setReordering] = useState(false)

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

  const [listPrices, setListPrices] = useState<Map<string, number>>(new Map())

  // Quick Edit modal per variant
  const [editModalVariant, setEditModalVariant] = useState<VariantRow | null>(null)
  const [editModalSku, setEditModalSku] = useState('')
  const [editModalBarcode, setEditModalBarcode] = useState('')
  const [editModalCostPrice, setEditModalCostPrice] = useState('')
  const [editModalTags, setEditModalTags] = useState<string[]>([])
  const [editModalDimValues, setEditModalDimValues] = useState<Record<string, string>>({})
  const [editModalAttributeValues, setEditModalAttributeValues] = useState<CustomAttributeRow[]>([])
  const [savingEditModal, setSavingEditModal] = useState(false)

  const colorPalette = useMemo(
    () => (dimensionValuesMap ? paletteFromDimensionMap(dimensionValuesMap) : []),
    [dimensionValuesMap]
  )

  // Precios vigentes por SKU desde la lista predeterminada (el precio vive en Gestión de precios).
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void (async () => {
      try {
        const lists = await listPriceLists(tenantId, true)
        const preferred = lists.find((l) => l.isDefault) ?? lists[0]
        if (!preferred) return
        const rows = await listProductPrices(tenantId, {
          priceListId: preferred.id,
          onlyVigent: true,
        })
        if (cancelled) return
        setListPrices(new Map(rows.map((row) => [row.catalogItemId, row.price])))
      } catch {
        if (!cancelled) setListPrices(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, parentItem.variants])

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

  // KPIs
  const variants = useMemo(() => parentItem.variants ?? [], [parentItem.variants])
  const activeCount = useMemo(() => variants.filter((v) => Number(v.status) === 0).length, [variants])

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

  const parseRawAttributes = useCallback((jsonStr: string): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(jsonStr)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) }
      }
    } catch {
      // Ignorar error de parseo
    }
    return {}
  }, [])

  const handleReorderVariant = useCallback(
    async (row: VariantRow, delta: -1 | 1) => {
      if (!canEdit || reordering) return
      const ordered = [...variants]
      const index = ordered.findIndex((variant) => variant.id === row.id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= ordered.length) return

      const [moved] = ordered.splice(index, 1)
      ordered.splice(target, 0, moved)

      setReordering(true)
      try {
        await reorderCatalogItemVariants(
          tenantId,
          parentItem.id,
          ordered.map((variant) => variant.id)
        )
        await onRefreshRequired()
      } catch (err: unknown) {
        toast.show({
          title: 'No se pudo reordenar',
          message: readApiError(err, 'Intenta nuevamente.'),
          variant: 'error',
        })
      } finally {
        setReordering(false)
      }
    },
    [canEdit, onRefreshRequired, parentItem.id, reordering, tenantId, toast, variants]
  )

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

  const handleOpenEditModal = useCallback(
    (row: VariantRow) => {
      setEditModalVariant(row)
      setEditModalSku(row.sku ?? '')
      setEditModalBarcode(row.barcode ?? '')
      setEditModalCostPrice(row.costPrice != null ? String(row.costPrice) : '')

      const rawAttrs = parseRawAttributes(row.customAttributesJson)
      const initialTags = Array.isArray(row.tags)
        ? row.tags
        : Array.isArray(rawAttrs.tags)
          ? rawAttrs.tags.map(String)
          : []
      setEditModalTags(initialTags.map((t) => String(t).trim().replace(/^#+/, '')).filter(Boolean))

      const dims: Record<string, string> = {}
      for (const d of dimensions) {
        const key = d.name.toLowerCase()
        dims[key] =
          row.dimensionValues?.[d.name] ||
          (typeof rawAttrs[key] === 'string' ? (rawAttrs[key] as string) : '') ||
          (typeof rawAttrs[d.name] === 'string' ? (rawAttrs[d.name] as string) : '') ||
          ''
      }
      setEditModalDimValues(dims)

      const customAttrRows: CustomAttributeRow[] = []
      const used = new Set<string>()
      for (const field of variantAttributeFields) {
        const lower = field.key.trim().toLowerCase()
        const clean = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (clean === 'tag' || clean === 'tags' || clean === 'etiqueta' || clean === 'etiquetas') {
          used.add(lower)
          continue
        }
        let value = ''
        for (const [k, v] of Object.entries(rawAttrs)) {
          if (k.trim().toLowerCase() === lower) {
            value = typeof v === 'string' ? v : String(v ?? '')
            break
          }
        }
        if (!value && (clean === 'nombre' || clean === 'name')) {
          value = row.name ?? ''
        }
        if (!value && (clean === 'descripcion' || clean === 'description')) {
          const descFromAttrs =
            typeof rawAttrs['descripcion'] === 'string'
              ? rawAttrs['descripcion']
              : typeof rawAttrs['descripción'] === 'string'
                ? rawAttrs['descripción']
                : ''
          value = descFromAttrs || parentItem.description || ''
        }
        customAttrRows.push({
          id: `attr-${field.key}-${Math.random().toString(36).slice(2, 6)}`,
          key: field.key,
          value,
        })
        used.add(lower)
      }
      setEditModalAttributeValues(customAttrRows)
    },
    [dimensions, parentItem.description, parseRawAttributes, variantAttributeFields]
  )

  const handleSaveEditModal = useCallback(async () => {
    if (!tenantId || !editModalVariant) return
    setSavingEditModal(true)
    try {
      const currentAttrs = parseRawAttributes(editModalVariant.customAttributesJson)
      const merged: Record<string, unknown> = { ...currentAttrs, ...editModalDimValues }
      let resolvedName = editModalVariant.name
      const prevDescAttr =
        typeof currentAttrs['descripcion'] === 'string'
          ? currentAttrs['descripcion']
          : typeof currentAttrs['descripción'] === 'string'
            ? currentAttrs['descripción']
            : null
      let resolvedDescription: string | null = prevDescAttr || parentItem.description || null

      for (const row of editModalAttributeValues) {
        const key = row.key.trim()
        if (!key) continue
        const lower = key.toLowerCase()
        const clean = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (clean === 'tag' || clean === 'tags') continue

        if (row.value.trim()) {
          merged[clean] = row.value.trim()
          if (lower !== clean) merged[lower] = row.value.trim()
        } else {
          delete merged[clean]
          delete merged[lower]
          delete merged[key]
        }

        if ((clean === 'nombre' || clean === 'name') && row.value.trim()) {
          resolvedName = row.value.trim()
          merged['nombre'] = row.value.trim()
        }
        if ((clean === 'descripcion' || clean === 'description') && row.value.trim()) {
          resolvedDescription = row.value.trim()
          merged['descripcion'] = row.value.trim()
        }

        const lookup = dimensionValuesMap?.get(lower)
        const isColorAttr =
          lookup?.isColor ||
          lookup?.dataType === 'color' ||
          lookup?.dataType === 'colorlist' ||
          lower === 'color' ||
          lower === 'colores'
        if (isColorAttr) {
          const names = row.value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
          const hexes = names
            .map((n) => colorPalette.find((p) => p.name.toLowerCase() === n.toLowerCase())?.hex)
            .filter((h): h is string => Boolean(h))
          if (hexes.length > 0) merged[`${clean}_hex`] = hexes.join(', ')
          else delete merged[`${clean}_hex`]
        }
      }

      const cleanTags = editModalTags.map((t) => t.trim().replace(/^#+/, '')).filter(Boolean)
      if (cleanTags.length > 0) merged['tags'] = cleanTags
      else delete merged['tags']

      const parsedCost = parsePriceInput(editModalCostPrice)

      await updateCatalogItem(tenantId, editModalVariant.id, {
        kind: parentItem.kind,
        name: resolvedName,
        description: resolvedDescription,
        sku: editModalSku.trim() || null,
        barcode: editModalBarcode.trim() || null,
        costPrice: parsedCost != null && parsedCost >= 0 ? parsedCost : null,
        basePrice: editModalVariant.basePrice ?? null,
        customAttributesJson: JSON.stringify(merged),
        familyId: parentItem.familyId ?? null,
        hierarchyPathJson: parentItem.hierarchyPathJson ?? null,
        minOrderQuantity: editModalVariant.minOrderQuantity ?? 1,
        categoryId: parentItem.categoryId ?? null,
        status: editModalVariant.status,
      })

      toast.show({
        title: 'Variante actualizada',
        message: `Se actualizaron las propiedades de «${resolvedName}».`,
        variant: 'success',
      })
      setEditModalVariant(null)
      await onRefreshRequired()
    } catch (err: unknown) {
      toast.show({
        title: 'Error al actualizar',
        message: readApiError(err, 'No se pudo guardar la variante.'),
        variant: 'error',
      })
    } finally {
      setSavingEditModal(false)
    }
  }, [
    colorPalette,
    dimensionValuesMap,
    editModalAttributeValues,
    editModalBarcode,
    editModalCostPrice,
    editModalDimValues,
    editModalSku,
    editModalTags,
    editModalVariant,
    onRefreshRequired,
    parentItem,
    parseRawAttributes,
    tenantId,
    toast,
  ])

  const editModalAttributeMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const row of editModalAttributeValues) map[row.key] = row.value
    return map
  }, [editModalAttributeValues])

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

    const hasColorAxis = matrixAxes.some(
      (axis) => axis.type === 'color' || axis.name.trim().toLowerCase().includes('color')
    )

    const photoCol: ColumnDef<VariantRow> = {
      key: 'mainImageThumbUrl',
      header: 'Foto',
      width: 60,
      align: 'center',
      renderCell: (_value: unknown, row: VariantRow) => {
        const src = row.mainImageThumbUrl
        if (!src) {
          return (
            <div
              className="catalog-item-thumb"
              style={{ width: 34, height: 34, minWidth: 34, minHeight: 34, margin: '0 auto' }}
              aria-hidden
            >
              <Package size={14} />
            </div>
          )
        }
        return (
          <img
            src={src}
            alt={row.name}
            className="catalog-item-thumb"
            loading="lazy"
            style={{ width: 34, height: 34, minWidth: 34, minHeight: 34, objectFit: 'cover', borderRadius: 6 }}
          />
        )
      },
    }

    const nameCol: ColumnDef<VariantRow> = {
      key: 'name',
      header: 'Variante',
      width: 210,
      renderCell: (_value: unknown, row: VariantRow) => {
        const attrs = parseAttributes(row.customAttributesJson)
        const desc = attrs['descripcion'] || attrs['descripción'] || ''
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button
              type="button"
              onClick={() => openVariantAdmin(row.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.84rem',
                color: 'var(--glb-text, inherit)',
              }}
              title="Abrir ficha completa de la variante"
            >
              {row.name || 'Variante'}
            </button>
            {desc ? (
              <span className="app-shell__muted" style={{ fontSize: '0.72rem' }}>
                {desc}
              </span>
            ) : null}
          </div>
        )
      },
    }

    const colorAttrCol: ColumnDef<VariantRow>[] = hasColorAxis
      ? []
      : [
          {
            key: 'customAttributesJson' as keyof VariantRow,
            header: 'Color',
            width: 150,
            renderCell: (_value: unknown, row: VariantRow) => {
              const attrs = parseAttributes(row.customAttributesJson)
              const rawColor =
                Object.entries(attrs).find(([k]) => {
                  const lower = k.trim().toLowerCase()
                  return lower === 'color' || lower === 'colores'
                })?.[1] ?? ''
              const names = String(rawColor)
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
              if (names.length === 0) {
                return <span className="app-shell__muted" style={{ fontSize: '0.8rem' }}>—</span>
              }
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
                  {names.map((name) => {
                    const hex =
                      colorPalette.find((p) => p.name.toLowerCase() === name.toLowerCase())?.hex ??
                      (isHexColorToken(name) ? name : '#94a3b8')
                    return (
                      <span
                        key={name}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.28rem',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            backgroundColor: hex,
                            border: '1px solid rgba(15, 23, 42, 0.2)',
                            flexShrink: 0,
                          }}
                        />
                        {name}
                      </span>
                    )
                  })}
                </div>
              )
            },
          },
        ]

    return [
      photoCol,
      nameCol,
      ...axisColumns,
      ...colorAttrCol,
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
        header: 'PVP / Margen',
        width: 175,
        renderCell: (_value: unknown, row: VariantRow) => {
          const listPrice = listPrices.get(row.id)
          const effectivePrice = listPrice ?? row.basePrice ?? null
          if (effectivePrice == null) {
            return (
              <button
                type="button"
                onClick={() =>
                  navigate(`/catalogo/precios/productos/nuevo?catalogItemId=${row.id}`)
                }
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  color: 'var(--glb-muted, #64748b)',
                  fontSize: '0.8rem',
                }}
                title="Asignar precio en Gestión de precios o editar PVP de la variante"
              >
                Sin precio
              </button>
            )
          }

          const { profit, marginPct } = computeProfitAndMargin(row.costPrice, effectivePrice)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span
                style={{
                  fontWeight: 700,
                  color: 'var(--shell-primary, #4f46e5)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${effectivePrice.toFixed(2)}
              </span>
              {row.costPrice != null && profit != null && marginPct != null ? (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color:
                      profit > 0
                        ? 'var(--glb-success-text, #15803d)'
                        : profit < 0
                          ? 'var(--glb-danger-text, #b91c1c)'
                          : 'var(--glb-text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title={`Costo: $${row.costPrice.toFixed(2)} · Ganancia: $${profit.toFixed(2)}`}
                >
                  Costo ${row.costPrice.toFixed(2)} · {marginPct.toFixed(1)}%
                </span>
              ) : null}
            </div>
          )
        },
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
        header: 'Acciones',
        width: 180,
        sticky: 'right',
        renderCell: (_value: unknown, row: VariantRow) => {
          const index = variants.findIndex((variant) => variant.id === row.id)
          return (
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {canEdit ? (
                <>
                  <GridIconButton
                    label="Mostrar primero (subir)"
                    icon={ArrowUp}
                    disabled={reordering || index <= 0}
                    onClick={() => void handleReorderVariant(row, -1)}
                  />
                  <GridIconButton
                    label="Mostrar después (bajar)"
                    icon={ArrowDown}
                    disabled={reordering || index < 0 || index >= variants.length - 1}
                    onClick={() => void handleReorderVariant(row, 1)}
                  />
                  <GridIconButton
                    label="Edición rápida de propiedades"
                    icon={SlidersHorizontal}
                    onClick={() => handleOpenEditModal(row)}
                  />
                </>
              ) : null}
              <GridIconButton
                label="Administrar variante (Ficha completa)"
                icon={Pencil}
                onClick={() => openVariantAdmin(row.id)}
              />
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
          )
        },
      },
    ]
  }, [
    canEdit,
    colorPalette,
    handleOpenEditModal,
    handleOpenReassignModal,
    handleReorderVariant,
    listPrices,
    matrixAxes,
    navigate,
    openVariantAdmin,
    parseAttributes,
    reordering,
    variants,
  ])

  const variantsSubtitle = useMemo(() => {
    const parts: string[] = []
    parts.push('Listado compacto; fotos y ficha completa en Administrar')
    if (photoHint?.trim()) parts.push(photoHint.trim())
    parts.push(
      `${variants.length} ${variants.length === 1 ? 'combinación' : 'combinaciones'} · ${activeCount} activas`
    )
    return parts.join(' · ')
  }, [activeCount, photoHint, variants.length])

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <SectionCard
        title="Variantes"
        subtitle={variantsSubtitle}
        action={
          canEdit ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => navigate(`/catalogo/items/${parentItem.id}/variantes/nueva`)}
                disabled={remainingVariants === 0}
                title={
                  remainingVariants === 0
                    ? `Tu plan permite hasta ${maxVariants} variantes y ya alcanzaste el máximo.`
                    : undefined
                }
              >
                <Plus size={15} />
                Añadir variante
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
            loading={reordering || reassigning}
          />
        </div>
      </SectionCard>




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

      {/* Modal para edición rápida de variante */}
      <Popup
        open={Boolean(editModalVariant)}
        onClose={() => !savingEditModal && setEditModalVariant(null)}
        title={
          editModalVariant
            ? `Editar Variante — ${editModalVariant.sku || editModalVariant.name}`
            : 'Editar Variante'
        }
        width="min(96vw, 56rem)"
        actions={[
          {
            id: 'open-full',
            label: 'Abrir ficha completa ↗',
            variant: 'outline',
            onClick: () => {
              if (editModalVariant) {
                openVariantAdmin(editModalVariant.id)
              }
            },
            disabled: savingEditModal,
          },
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'outline',
            onClick: () => setEditModalVariant(null),
            disabled: savingEditModal,
          },
          {
            id: 'save',
            label: savingEditModal ? 'Guardando…' : 'Guardar Cambios',
            variant: 'primary',
            onClick: () => void handleSaveEditModal(),
            disabled: savingEditModal,
          },
        ]}
      >
        {editModalVariant ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0' }}>
            <p className="app-shell__muted" style={{ margin: 0, fontSize: '0.875rem' }}>
              Matriz: <strong>{parentItem.name}</strong>
              {' · '}
              Mismos campos que al crear la matriz (plantilla).
            </p>
            <VariantPhysicalFields
              sku={editModalSku}
              onSkuChange={setEditModalSku}
              barcode={editModalBarcode}
              onBarcodeChange={setEditModalBarcode}
              costPrice={editModalCostPrice}
              onCostPriceChange={setEditModalCostPrice}
              dimensions={dimensions}
              dimensionValues={editModalDimValues}
              onDimensionChange={(dimName, value) =>
                setEditModalDimValues((prev) => ({ ...prev, [dimName.toLowerCase()]: value }))
              }
              variantAttributeFields={variantAttributeFields}
              attributeValues={editModalAttributeMap}
              onAttributeChange={(key, value) =>
                setEditModalAttributeValues((prev) => {
                  const index = prev.findIndex(
                    (row) => row.key.trim().toLowerCase() === key.trim().toLowerCase()
                  )
                  if (index >= 0) {
                    const next = [...prev]
                    next[index] = { ...next[index], value }
                    return next
                  }
                  return [
                    ...prev,
                    {
                      id: `attr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      key,
                      value,
                    },
                  ]
                })
              }
              dimensionValuesMap={dimensionValuesMap ?? new Map()}
              onUploadMedia={onUploadMedia}
              onMediaError={onMediaError}
              onPaletteUpdated={onPaletteUpdated}
              searchTags={editModalTags}
              onChangeSearchTags={setEditModalTags}
              disabled={savingEditModal}
              tenantId={tenantId}
            />
          </div>
        ) : null}
      </Popup>
    </div>
  )
}


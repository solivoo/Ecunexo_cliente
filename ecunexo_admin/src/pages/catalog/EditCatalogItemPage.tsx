import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Popup, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  EcuTagInput,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useCatalogLimits } from '@/hooks/useCatalogLimits'
import { parseAttributeSchema } from '@/lib/catalogAttributes'
import {
  buildDimensionValuesMap,
  buildHierarchyPathJson,
  getModelAttributeFields,
  readPhotoChoice,
  buildVariantAdminSummary,
  formatVariantDisplayName,
  isHexColorToken,
} from '@/lib/catalogArchetype'
import { VariantAdminSummaryBlock } from '@/pages/catalog/VariantAdminSummaryBlock'
import { ArchetypeModelFields } from '@/pages/catalog/ArchetypeModelFields'
import {
  ItemCustomAttributesEditor,
  deserializeCustomAttributes,
  extractReassignmentHistory,
  extractTagsFromCustomAttributes,
  serializeCustomAttributes,
  type CustomAttributeRow,
} from '@/pages/catalog/ItemCustomAttributesEditor'
import { CatalogItemImageGallery } from '@/pages/catalog/CatalogItemImageGallery'
import { EditCatalogItemVariantsSection } from '@/pages/catalog/EditCatalogItemVariantsSection'
import { ArrowLeftRight, Layers } from 'lucide-react'
import { readApiError } from '@/lib/readApiError'
import {
  getCatalogItem,
  listCatalogCategories,
  listCatalogItems,
  listProductTemplates,
  listVariantDimensionTemplates,
  reassignCatalogItemVariantParent,
  softDeleteCatalogItem,
  updateCatalogItem,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CatalogItemKind,
  CatalogItemStatus,
  type CatalogItemDetailDto,
  type CatalogItemListItemDto,
  type CategoryListItemDto,
  type HierarchyPathEntry,
  type ProductTemplateDto,
  type ProductTemplateLevel,
  type ReassignmentAuditRecord,
  type VariantDimensionTemplateDto,
} from '@/types/catalogApi'

function parseVariantDimensionNames(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((dim) => {
        if (dim && typeof dim === 'object' && typeof (dim as { name?: unknown }).name === 'string') {
          return (dim as { name: string }).name.trim()
        }
        return ''
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function EditCatalogItemPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { itemId } = useParams<{ itemId: string }>()
  const tenantId = useAppSelector(selectTenantId)
  const canEdit = useHasPermission('catalog.item.update')
  const canDelete = useHasPermission('catalog.item.delete')

  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [item, setItem] = useState<CatalogItemDetailDto | null>(null)
  const [categories, setCategories] = useState<CategoryListItemDto[]>([])
  const [productTemplates, setProductTemplates] = useState<ProductTemplateDto[]>([])
  const [dimensionTemplates, setDimensionTemplates] = useState<VariantDimensionTemplateDto[]>([])
  const [usedVariants, setUsedVariants] = useState(0)

  const { maxVariants } = useCatalogLimits()
  const remainingVariants =
    maxVariants != null ? Math.max(0, maxVariants - usedVariants) : null
  const [kind, setKind] = useState(String(CatalogItemKind.Service))
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState(String(CatalogItemStatus.Active))
  const [customAttributes, setCustomAttributes] = useState<CustomAttributeRow[]>([])
  const [tags, setTags] = useState<string[]>([])

  const categorySuggestions = useMemo<string[]>(() => {
    const category = categories.find((c) => c.id === categoryId)
    return parseAttributeSchema(category?.attributeSchemaJson).map((f) => f.label || f.key)
  }, [categories, categoryId])

  const hierarchyPath = useMemo<HierarchyPathEntry[]>(() => {
    if (!item?.hierarchyPathJson) return []
    try {
      const parsed = JSON.parse(item.hierarchyPathJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [item])

  const familyTemplate = useMemo(
    () => productTemplates.find((t) => t.id === item?.familyId),
    [productTemplates, item]
  )

  const familyLevels = useMemo<ProductTemplateLevel[]>(() => {
    if (!familyTemplate) return []
    try {
      const parsed = JSON.parse(familyTemplate.hierarchyTreeJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [familyTemplate])

  /** Alcance de fotos según la plantilla viva (o heurística del descriptor). */
  const photoChoice = useMemo(() => {
    if (familyLevels.length > 0) {
      return readPhotoChoice(familyLevels).choice
    }
    if (item?.matrixDescriptor?.axes?.some((axis) => axis.isPhotoGroup)) {
      return 'group' as const
    }
    if (item?.isMatrixParent) {
      // Matriz sin plantilla: no asumir galería del padre (evita UI engañosa tipo calcetines).
      return 'variant' as const
    }
    return 'model' as const
  }, [familyLevels, item?.isMatrixParent, item?.matrixDescriptor?.axes])

  const isVariantChild = Boolean(item?.parentId)

  const showParentImageGallery =
    !!item &&
    !isVariantChild &&
    (!item.isMatrixParent || photoChoice === 'model' || photoChoice === 'group')

  const showVariantImageGallery = isVariantChild

  const showVariantPhotosHint =
    !!item?.isMatrixParent && (photoChoice === 'variant' || photoChoice === 'none')

  const variantAxisEntries = useMemo(() => {
    if (!item?.parentId || !item.matrixDescriptor?.axes?.length) return []
    const attrMap = new Map(
      customAttributes.map((row) => [row.key.trim().toLowerCase(), row.value.trim()])
    )
    return item.matrixDescriptor.axes.map((axis) => {
      const key = axis.name.trim().toLowerCase()
      const value = attrMap.get(key) ?? ''
      return { name: axis.name, value, type: axis.type }
    })
  }, [customAttributes, item?.matrixDescriptor?.axes, item?.parentId])

  const dimensionValuesMap = useMemo(
    () => buildDimensionValuesMap(dimensionTemplates),
    [dimensionTemplates]
  )

  const modelAttributeFields = useMemo(
    () => getModelAttributeFields(familyLevels, dimensionValuesMap),
    [familyLevels, dimensionValuesMap]
  )

  const variantDimensionNames = useMemo<string[]>(
    () => parseVariantDimensionNames(item?.variantDimensionsJson),
    [item?.variantDimensionsJson]
  )

  const reservedAttributeKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...modelAttributeFields.map((field) => field.key.trim().toLowerCase()),
          ...variantDimensionNames.map((name) => name.toLowerCase()),
        ])
      ),
    [modelAttributeFields, variantDimensionNames]
  )

  const freeAttributeRows = useMemo(
    () =>
      customAttributes.filter(
        (row) => !reservedAttributeKeys.includes(row.key.trim().toLowerCase())
      ),
    [customAttributes, reservedAttributeKeys]
  )

  const freeAttributeIds = useMemo(
    () => new Set(freeAttributeRows.map((row) => row.id)),
    [freeAttributeRows]
  )

  const handleFreeAttributesChange = useCallback(
    (next: CustomAttributeRow[]) => {
      setCustomAttributes((prev) => {
        const nextById = new Map(next.map((row) => [row.id, row]))
        const merged: CustomAttributeRow[] = []
        for (const row of prev) {
          if (freeAttributeIds.has(row.id)) {
            const updated = nextById.get(row.id)
            if (updated) merged.push(updated)
            continue
          }
          merged.push(row)
        }
        const knownIds = new Set(prev.map((row) => row.id))
        next.forEach((row) => {
          if (!knownIds.has(row.id)) merged.push(row)
        })
        return merged
      })
    },
    [freeAttributeIds]
  )

  const setAttributeValue = useCallback((key: string, value: string) => {
    const lower = key.trim().toLowerCase()
    setCustomAttributes((prev) => {
      const exists = prev.some((r) => r.key.trim().toLowerCase() === lower)
      if (exists) {
        return prev.map((r) => (r.key.trim().toLowerCase() === lower ? { ...r, value } : r))
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
  }, [])

  const suggestedTags = useMemo<string[]>(() => {
    const list = new Set<string>()
    const cat = categories.find((c) => c.id === categoryId)
    if (cat?.name) list.add(cat.name.trim())
    customAttributes.forEach((attr) => {
      if (attr.value.trim() && attr.value.length < 25) {
        list.add(attr.value.trim())
      }
    })
    return Array.from(list)
  }, [categories, categoryId, customAttributes])

  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [reassignTargetParentId, setReassignTargetParentId] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [matrixParents, setMatrixParents] = useState<CatalogItemListItemDto[]>([])
  const [loadingMatrixParents, setLoadingMatrixParents] = useState(false)

  const loadItem = useCallback(async () => {
    if (!tenantId || !itemId) return
    setLoading(true)
    try {
      const [detail, cats, templates, dims, items] = await Promise.all([
        getCatalogItem(tenantId, itemId),
        listCatalogCategories(tenantId).catch(() => [] as CategoryListItemDto[]),
        listProductTemplates(tenantId).catch(() => [] as ProductTemplateDto[]),
        listVariantDimensionTemplates(tenantId).catch(() => [] as VariantDimensionTemplateDto[]),
        listCatalogItems(tenantId, { onlyRoots: true }).catch(() => []),
      ])
      setItem(detail)
      setCategories(cats)
      setProductTemplates(templates)
      setDimensionTemplates(dims)
      setUsedVariants(items.reduce((sum, i) => sum + (i.variantCount ?? 0), 0))
      setKind(String(detail.kind))
      setName(detail.name)
      setDescription(detail.description ?? '')
      setSku(detail.sku ?? '')
      setBasePrice(detail.basePrice == null ? '' : String(detail.basePrice))
      setCategoryId(detail.categoryId ?? '')
      setStatus(String(detail.status))
      setCustomAttributes(deserializeCustomAttributes(detail.customAttributesJson))
      setTags(extractTagsFromCustomAttributes(detail.customAttributesJson))
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo cargar el ítem.'))
    } finally {
      setLoading(false)
    }
  }, [itemId, tenantId])

  useEffect(() => {
    if (!canEdit) return
    void loadItem()
  }, [canEdit, loadItem])

  const handleOpenReassignModal = useCallback(async () => {
    if (!tenantId || !item) return
    setReassignReason('')
    setReassignTargetParentId('')
    setReassignModalOpen(true)
    setLoadingMatrixParents(true)
    try {
      const items = await listCatalogItems(tenantId, { kind: CatalogItemKind.Physical })
      const parents = items.filter(
        (p) => p.isMatrixParent && p.id !== itemId && p.id !== item.parentId
      )
      setMatrixParents(parents)
    } catch (err) {
      toast.show({
        title: 'Error al listar matrices',
        message: readApiError(err, 'No se pudieron cargar los productos matriz disponibles.'),
        variant: 'error',
      })
    } finally {
      setLoadingMatrixParents(false)
    }
  }, [item, itemId, tenantId, toast])

  const onReassignSubmit = useCallback(async () => {
    if (!tenantId || !itemId || !item) return
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
      await reassignCatalogItemVariantParent(tenantId, itemId, {
        targetParentItemId: reassignTargetParentId ? reassignTargetParentId : null,
        reason: reassignReason.trim(),
      })
      toast.show({
        title: 'Variante reasignada',
        message: 'El movimiento se registró exitosamente con respaldo de auditoría.',
        variant: 'success',
      })
      setReassignModalOpen(false)
      await loadItem()
    } catch (err) {
      toast.show({
        title: 'Error al reasignar',
        message: readApiError(err, 'No se pudo mover la variante.'),
        variant: 'error',
      })
    } finally {
      setReassigning(false)
    }
  }, [itemId, item, loadItem, reassignReason, reassignTargetParentId, tenantId, toast])

  const reassignTargetOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    if (item?.parentId) {
      opts.push({
        value: '',
        label: '— Convertir en producto individual (desenlazar matriz) —',
      })
    } else {
      opts.push({
        value: '',
        label: 'Seleccionar producto matriz destino…',
      })
    }
    matrixParents.forEach((p) => {
      opts.push({
        value: p.id,
        label: `${p.name} ${p.sku ? `(${p.sku})` : ''}`,
      })
    })
    return opts
  }, [item?.parentId, matrixParents])

  const reassignVariantSummary = useMemo(() => {
    if (!item?.parentId) return null
    return buildVariantAdminSummary(item, item.parentName, item.matrixDescriptor?.axes)
  }, [item])

  const reassignmentHistory = useMemo<ReassignmentAuditRecord[]>(() => {
    return extractReassignmentHistory(item?.customAttributesJson)
  }, [item?.customAttributesJson])

  const goToList = useCallback(() => {
    void navigate('/catalogo/items')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = [
      {
        id: 'list',
        label: 'Listado de ítems',
        icon: 'package',
        route: '/catalogo/items',
        disabled: false,
      },
      {
        id: 'attributes',
        label: 'Atributos',
        icon: 'tag',
        route: '/catalogo/atributos',
        disabled: false,
      },
      {
        id: 'templates',
        label: 'Plantillas',
        icon: 'layers',
        route: '/catalogo/plantillas',
        disabled: false,
      },
    ]

    if (item?.parentId) {
      items.push({
        id: 'view-parent',
        label: 'Ver Ítem Principal',
        icon: 'arrow-left',
        route: `/catalogo/items/${item.parentId}`,
        disabled: false,
      })
      if (canEdit) {
        items.push({
          id: 'reassign-variant',
          label: 'Mover / Reasignar Variante',
          icon: 'arrow-left-right',
          route: null,
          disabled: false,
        })
      }
    }

    return items
  }, [canEdit, item?.parentId])

  const handlePageActionSelect = useCallback(
    (action: PageActionItem) => {
      if (action.id === 'reassign-variant') {
        void handleOpenReassignModal()
      }
    },
    [handleOpenReassignModal]
  )

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Sin categoría' },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories]
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !itemId || !item) return
      setError(null)
      setBusy(true)
      try {
        if (!name.trim()) throw new Error('El nombre del ítem es obligatorio.')
        const kindNum = Number(kind) as CatalogItemKind
        if (kindNum === CatalogItemKind.Physical && !sku.trim()) {
          throw new Error('El SKU es obligatorio para ítems físicos.')
        }
        let price: number | null = null
        if (basePrice.trim()) {
          const parsed = Number(basePrice.replace(',', '.'))
          if (Number.isNaN(parsed) || parsed < 0) {
            throw new Error('El precio base no es válido.')
          }
          price = parsed
        }

        const hierarchyPathJson =
          buildHierarchyPathJson(familyLevels, customAttributes, dimensionValuesMap) ??
            item.hierarchyPathJson ??
            null

        await updateCatalogItem(tenantId, itemId, {
          kind: kindNum,
          name: name.trim(),
          description: description.trim() || null,
          sku: sku.trim() || null,
          basePrice: price,
          categoryId: categoryId || null,
          customAttributesJson: serializeCustomAttributes(customAttributes, tags),
          status: Number(status) as typeof CatalogItemStatus.Active,
          familyId: item.familyId ?? null,
          hierarchyPathJson,
        })

        toast.show({
          title: 'Ítem actualizado',
          message: `«${name.trim()}» se guardó correctamente.`,
          variant: 'success',
        })
        void navigate('/catalogo/items', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo guardar el ítem.')
        setError(message)
        toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [
      basePrice,
      categoryId,
      customAttributes,
      description,
      dimensionValuesMap,
      familyLevels,
      item,
      itemId,
      kind,
      name,
      navigate,
      sku,
      status,
      tags,
      tenantId,
      toast,
    ]
  )

  const onDelete = useCallback(async () => {
    if (!tenantId || !itemId || !item || !canDelete) return

    setDeleting(true)
    setError(null)
    try {
      await softDeleteCatalogItem(tenantId, itemId)
      toast.show({
        title: 'Ítem eliminado',
        message: `«${item.name}» quedó dado de baja.`,
        variant: 'success',
      })
      setConfirmDelete(false)
      void navigate('/catalogo/items', { replace: true })
    } catch (err: unknown) {
      const message = readApiError(
        err,
        'El ítem tiene registros asociados. Desactívalo (Inactivo) o modifícalo.'
      )
      setError(message)
      toast.show({ title: 'No se pudo eliminar', message, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }, [canDelete, item, itemId, navigate, tenantId, toast])

  if (!canEdit) {
    return (
      <TenantSessionGate title="Editar ítem" lead="Cambios en el maestro de catálogo.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres catalog.item.update para modificar ítems del catálogo."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No posees permisos de edición sobre los ítems de catálogo de esta empresa.
            </p>
            <Button type="button" variant="outline" onClick={goToList}>
              Volver al listado
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Editar ítem" lead="Cambios en el maestro de catálogo.">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title={
            item
              ? item.parentId
                ? item.sku || formatVariantDisplayName(item.name, item.parentName)
                : item.name
              : 'Editar Ítem'
          }
          subtitle={
            item
              ? item.parentId
                ? [
                    `Variante de «${item.parentName || 'matriz'}»`,
                    formatVariantDisplayName(item.name, item.parentName),
                  ].join(' · ')
                : [
                    item.kind === CatalogItemKind.Physical ? 'Físico' : 'Servicio',
                    item.categoryName ?? 'Sin categoría',
                    item.familyName ? `Plantilla: ${item.familyName}` : null,
                    item.sku ? `SKU ${item.sku}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
              : 'Cargando…'
          }
          badge={
            item ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {item.isMatrixParent && (
                  <StatusBadge tone="primary" withDot>
                    Variantes ({item.variants?.length ?? 0})
                  </StatusBadge>
                )}
                {item.parentId && <StatusBadge tone="neutral">Variante</StatusBadge>}
                <StatusBadge
                  tone={Number(status) === CatalogItemStatus.Active ? 'success' : 'neutral'}
                  withDot={Number(status) === CatalogItemStatus.Active}
                >
                  {Number(status) === CatalogItemStatus.Active ? 'Activo' : 'Inactivo'}
                </StatusBadge>
              </div>
            ) : undefined
          }
          actions={
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Acciones de ítem"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
              onActionSelect={handlePageActionSelect}
            />
          }
        />

        {loading && !item ? (
          <SectionCard title="Cargando…">
            <p className="app-shell__muted">Recuperando datos del ítem de catálogo…</p>
          </SectionCard>
        ) : (
          <>
            {/* Banner si es producto físico independiente para vincularlo como variante */}
            {!item?.parentId && !item?.isMatrixParent && Number(kind) === CatalogItemKind.Physical && canEdit && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  padding: '0.85rem 1.25rem',
                  marginBottom: '1.25rem',
                  borderRadius: '0.75rem',
                  border: '1px dashed var(--glb-border, #cbd5e1)',
                  backgroundColor: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Layers size={18} style={{ color: 'var(--glb-muted, #64748b)' }} />
                  <div style={{ fontSize: '0.85rem', color: 'var(--glb-muted, #64748b)' }}>
                    Producto suelto: puedes vincularlo a una matriz existente.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleOpenReassignModal()}
                >
                  <ArrowLeftRight size={14} style={{ marginRight: '0.375rem' }} />
                  Vincular a Producto Matriz
                </Button>
              </div>
            )}

            {isVariantChild && variantAxisEntries.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                  alignItems: 'center',
                }}
              >
                <span className="app-shell__muted" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  Combinación:
                </span>
                {variantAxisEntries.map((entry) => (
                  <StatusBadge key={entry.name} tone="neutral">
                    {entry.name}:{' '}
                    {entry.type === 'color' || isHexColorToken(entry.value) ? (
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          marginLeft: 4,
                          verticalAlign: 'middle',
                          backgroundColor: entry.value || '#ccc',
                          border: '1px solid rgba(0,0,0,0.15)',
                        }}
                      />
                    ) : (
                      entry.value || '—'
                    )}
                  </StatusBadge>
                ))}
              </div>
            )}

            {hierarchyPath.length > 0 && !isVariantChild && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  marginBottom: '1rem',
                }}
              >
                {hierarchyPath.map((entry, idx) => (
                  <StatusBadge key={`${entry.level}-${entry.name}-${idx}`} tone="neutral">
                    {entry.name}: {entry.value}
                  </StatusBadge>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void onSubmit(e)} noValidate>
            {modelAttributeFields.length > 0 && !isVariantChild && (
              <SectionCard
                title="Datos del modelo"
                subtitle={familyTemplate?.name}
                action={
                  familyTemplate ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/catalogo/plantillas/${familyTemplate.id}`)}
                    >
                      Editar plantilla
                    </Button>
                  ) : undefined
                }
              >
                <ArchetypeModelFields
                  fields={modelAttributeFields}
                  values={customAttributes}
                  dimensionValuesMap={dimensionValuesMap}
                  onChangeValue={setAttributeValue}
                  disabled={busy}
                />
              </SectionCard>
            )}
            <SectionCard title={isVariantChild ? 'Datos del código' : 'Ficha comercial'}>
              {error ? (
                <div className="ecu-form-error-banner" role="alert">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field">
                  <Select
                    id="ei-kind"
                    label="Tipo de ítem"
                    labelPosition="outlined"
                    variant="outline"
                    options={[
                      { value: String(CatalogItemKind.Service), label: 'Servicio (intangible)' },
                      { value: String(CatalogItemKind.Physical), label: 'Físico (con inventario)' },
                    ]}
                    value={kind}
                    onChange={setKind}
                    disabled={busy || isVariantChild}
                    fullWidth
                  />
                </div>
                {!isVariantChild && (
                  <div className="ecu-companies-form__field">
                    <Select
                      id="ei-cat"
                      label="Categoría"
                      labelPosition="outlined"
                      variant="outline"
                      options={categoryOptions}
                      value={categoryId}
                      onChange={setCategoryId}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                )}
                <div className="ecu-companies-form__field">
                  <Select
                    id="ei-status"
                    label="Estado"
                    labelPosition="outlined"
                    variant="outline"
                    options={[
                      { value: String(CatalogItemStatus.Active), label: 'Activo' },
                      { value: String(CatalogItemStatus.Inactive), label: 'Inactivo' },
                    ]}
                    value={status}
                    onChange={setStatus}
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="ei-name"
                    label="Nombre"
                    labelPosition="outlined"
                    variant="outline"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    required
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="ei-sku"
                    label={
                      item?.isMatrixParent
                        ? 'Código Modelo / Prefijo SKU (opcional)'
                        : Number(kind) === CatalogItemKind.Physical
                          ? 'Código SKU (obligatorio)'
                          : 'Código SKU (opcional)'
                    }
                    labelPosition="outlined"
                    variant="outline"
                    value={sku}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setSku(e.target.value.toUpperCase())
                    }
                    required={Number(kind) === CatalogItemKind.Physical && !item?.isMatrixParent}
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="ei-price"
                    label={item?.isMatrixParent ? 'Precio base de referencia' : 'Precio base'}
                    labelPosition="outlined"
                    variant="outline"
                    value={basePrice}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBasePrice(e.target.value)}
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="ei-desc"
                    label="Descripción comercial"
                    labelPosition="outlined"
                    variant="outline"
                    value={description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                    disabled={busy}
                    fullWidth
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
                }}
              >
                {!isVariantChild && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <EcuTagInput
                      tags={tags}
                      onChange={setTags}
                      label="Etiquetas"
                      placeholder="Deportivo, Premium, temporada…"
                      helperText="Búsqueda en POS y tienda; se heredan a las variantes."
                      suggestedTags={suggestedTags}
                      disabled={busy}
                    />
                  </div>
                )}

                {familyTemplate && freeAttributeRows.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.35rem',
                      flexWrap: 'wrap',
                      marginBottom: '1rem',
                    }}
                  >
                    {freeAttributeRows.map((row) => (
                      <StatusBadge key={row.id} tone="neutral">
                        {row.key}: {row.value || '—'}
                      </StatusBadge>
                    ))}
                  </div>
                )}

                {!familyTemplate && (
                  <>
                    <ItemCustomAttributesEditor
                      attributes={freeAttributeRows}
                      onChange={handleFreeAttributesChange}
                      categorySuggestions={categorySuggestions}
                      excludeKeys={reservedAttributeKeys}
                      disabled={busy}
                    />
                  </>
                )}
              </div>

              <div
                className="ecu-companies-form__actions"
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
                }}
              >
                <Button type="submit" variant="primary" loading={busy} disabled={busy || deleting}>
                  Guardar Cambios
                </Button>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="danger"
                    loading={deleting}
                    disabled={busy || deleting}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Eliminar
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || deleting}
                  onClick={goToList}
                >
                  Cancelar
                </Button>
              </div>
            </SectionCard>
          </form>

          {tenantId && item?.isMatrixParent && (
            <EditCatalogItemVariantsSection
              tenantId={tenantId}
              parentItem={item}
              canEdit={canEdit}
              remainingVariants={remainingVariants}
              maxVariants={maxVariants}
              photoHint={
                showVariantPhotosHint ? 'Fotos por SKU en Administrar (sm / lg / xl)' : null
              }
              onRefreshRequired={async () => {
                const fresh = await getCatalogItem(tenantId, item.id)
                setItem(fresh)
              }}
            />
          )}

          {tenantId && item && (showParentImageGallery || showVariantImageGallery) && (
            <div className="mt-6">
              <SectionCard
                title={showVariantImageGallery ? 'Fotos de este código' : 'Imágenes'}
                subtitle={
                  showVariantImageGallery
                    ? 'Galería del SKU · WebP sm / lg / xl · orden y portada'
                    : item.isMatrixParent && photoChoice === 'group'
                      ? 'Compartidas por grupo (ej. color)'
                      : 'Del producto · WebP sm / lg / xl'
                }
              >
                <CatalogItemImageGallery
                  tenantId={tenantId}
                  itemId={item.id}
                  images={item.images ?? []}
                  canEdit={canEdit}
                  compact
                  onImagesChanged={async () => {
                    const fresh = await getCatalogItem(tenantId, item.id)
                    setItem(fresh)
                  }}
                />
              </SectionCard>
            </div>
          )}

          {/* Historial inmutable de auditoría de reasignaciones */}
          {tenantId && item && reassignmentHistory.length > 0 && (
            <div className="mt-6">
              <SectionCard
                title="Historial de Reasignaciones (Auditoría)"
                subtitle="Trazabilidad inmutable de movimientos de la variante entre productos matriz"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {reassignmentHistory.map((entry, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        padding: '0.85rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
                        border: '1px solid var(--glb-border, rgba(0, 0, 0, 0.08))',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {entry.previous_parent_name ? (
                              <span>
                                «{entry.previous_parent_name}» {entry.previous_parent_sku ? `(${entry.previous_parent_sku})` : ''}
                              </span>
                            ) : (
                              <span className="app-shell__muted">Producto Individual</span>
                            )}
                          </span>
                          <ArrowLeftRight size={14} style={{ opacity: 0.6 }} />
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--shell-primary, #4f46e5)' }}>
                            {entry.target_parent_name ? (
                              <span>
                                «{entry.target_parent_name}» {entry.target_parent_sku ? `(${entry.target_parent_sku})` : ''}
                              </span>
                            ) : (
                              <span className="app-shell__muted">Producto Individual</span>
                            )}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--glb-muted, #64748b)' }}>Motivo: </span>
                        <span style={{ fontWeight: 500 }}>{entry.reason}</span>
                      </div>
                      {entry.moved_by && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
                          Usuario ID: <code className="ecu-code">{entry.moved_by}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
        </>
      )}
      </div>

      <Popup
        open={confirmDelete}
        title="Eliminar ítem"
        onClose={() => setConfirmDelete(false)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDelete(false),
            disabled: deleting,
          },
          {
            id: 'confirm',
            label: 'Sí, eliminar',
            variant: 'primary',
            onClick: () => {
              void onDelete()
            },
            disabled: deleting,
          },
        ]}
      >
        {item ? (
          <p className="app-shell__muted">
            ¿Dar de baja <strong>{item.name}</strong>
            {item.sku ? ` (${item.sku})` : ''}? Solo se permite si no tiene stock, movimientos ni
            documentos. Es una baja lógica.
          </p>
        ) : null}
      </Popup>

      <Popup
        open={reassignModalOpen}
        title="Mover variante a otra matriz"
        onClose={() => {
          if (!reassigning) setReassignModalOpen(false)
        }}
        width="min(92vw, 32rem)"
        actions={[
          {
            id: 'cancel-reassign',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setReassignModalOpen(false),
            disabled: reassigning,
          },
          {
            id: 'confirm-reassign',
            label: reassigning ? 'Reasignando…' : 'Confirmar Reasignación',
            variant: 'primary',
            onClick: () => {
              void onReassignSubmit()
            },
            disabled:
              reassigning ||
              reassignReason.trim().length < 3 ||
              (!reassignTargetParentId && !item?.parentId),
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
            {reassignVariantSummary ? (
              <VariantAdminSummaryBlock summary={reassignVariantSummary} label="Variante" />
            ) : null}
            <div style={{ marginTop: '0.5rem', color: 'var(--glb-muted, #64748b)' }}>
              {item?.parentName ? (
                <>
                  Matriz actual: <strong>«{item.parentName}»</strong>.{' '}
                </>
              ) : null}
              El SKU, código de barras, facturación histórica y stock en bodega se conservan intactos.
              El cambio quedará registrado en el historial inmutable de auditoría.
            </div>
          </div>

          {loadingMatrixParents ? (
            <p className="app-shell__muted" style={{ fontSize: '0.85rem' }}>
              Cargando productos matriz disponibles…
            </p>
          ) : (
            <Select
              id="reassign-target"
              label="Producto Matriz Destino"
              labelPosition="outlined"
              variant="outline"
              options={reassignTargetOptions}
              value={reassignTargetParentId}
              onChange={setReassignTargetParentId}
              disabled={reassigning}
              fullWidth
            />
          )}

          <TextBox
            id="reassign-reason"
            label="Motivo de la reasignación (Auditoría obligatorio)"
            labelPosition="outlined"
            variant="outline"
            placeholder="Ej. Reubicación por error de tipeo en catálogo / Cambio de modelo"
            value={reassignReason}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setReassignReason(e.target.value)}
            disabled={reassigning}
            fullWidth
          />
        </div>
      </Popup>
    </TenantSessionGate>
  )
}

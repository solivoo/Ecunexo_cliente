import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, NumberBox, Popup, Select, TextArea, TextBox, useToast, type PageActionItem } from 'glubox'
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
import {
  buildDimensionValuesMap,
  buildHierarchyPathJson,
  getModelAttributeFields,
  getVariantAttributeFields,
  readPhotoChoice,
  buildVariantAdminSummary,
  isHexColorToken,
} from '@/lib/catalogArchetype'
import {
  ensureSystemBaseAttributesLoaded,
  getUnitOfMeasureOptions,
  isCommercialBaseAttributeKey,
  mergeWithSystemBaseAttributes,
  readBrandFromCustomAttributes,
  readMinOrderQuantityFromCustomAttributes,
  readUnitOfMeasureFromCustomAttributes,
  upsertBaseCommercialAttributes,
} from '@/lib/catalogBaseAttributes'
import {
  paletteFromDimensionMap,
  readNamedColorsFromAttributes,
  upsertNamedColorAttributes,
} from '@/lib/catalogNamedColors'
import { ListOptionSelect } from '@/pages/catalog/ListOptionSelect'
import { NamedColorSelect } from '@/pages/catalog/NamedColorSelect'
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
import { CatalogPricingMarginBar, parsePriceInput } from '@/pages/catalog/CatalogPricingMarginBar'
import { ArrowLeftRight, ArrowUpRight, Layers, Plus } from 'lucide-react'
import { buildCategorySelectOptions } from '@/lib/catalogCategoryLabels'
import { readApiError } from '@/lib/readApiError'
import {
  createCategory,
  getCatalogItem,
  listCatalogItems,
  listCategories,
  listProductTemplates,
  listVariantDimensionTemplates,
  reassignCatalogItemVariantParent,
  softDeleteCatalogItem,
  updateCatalogItem,
  uploadCatalogMedia,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CatalogItemKind,
  CatalogItemStatus,
  type CatalogItemDetailDto,
  type CatalogItemListItemDto,
  type CategoryListItemDto,
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
  const canManageCategories = useHasPermission('catalog.category.manage')
  const hasCategoryRead = useHasPermission('catalog.category.read')
  const hasItemRead = useHasPermission('catalog.item.read')
  const canReadCategories = hasCategoryRead || hasItemRead || canManageCategories || canEdit

  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [item, setItem] = useState<CatalogItemDetailDto | null>(null)
  const [productTemplates, setProductTemplates] = useState<ProductTemplateDto[]>([])
  const [dimensionTemplates, setDimensionTemplates] = useState<VariantDimensionTemplateDto[]>([])
  const [systemBaseEpoch, setSystemBaseEpoch] = useState(0)
  const [categories, setCategories] = useState<CategoryListItemDto[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [quickCatOpen, setQuickCatOpen] = useState(false)
  const [quickCatName, setQuickCatName] = useState('')
  const [quickCatParentId, setQuickCatParentId] = useState('')
  const [quickCatSaving, setQuickCatSaving] = useState(false)
  const [usedVariants, setUsedVariants] = useState(0)

  const { maxVariants } = useCatalogLimits()
  const remainingVariants =
    maxVariants != null ? Math.max(0, maxVariants - usedVariants) : null
  const [kind, setKind] = useState(String(CatalogItemKind.Service))
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [minOrderQuantity, setMinOrderQuantity] = useState(1)
  const [brand, setBrand] = useState('')
  const [productColors, setProductColors] = useState<string[]>([])
  const [unitOfMeasure, setUnitOfMeasure] = useState('UND')
  const [status, setStatus] = useState(String(CatalogItemStatus.Active))
  const [customAttributes, setCustomAttributes] = useState<CustomAttributeRow[]>([])
  const [tags, setTags] = useState<string[]>([])

  const categorySelectOptions = useMemo(
    () => buildCategorySelectOptions(categories, { emptyLabel: 'Sin categoría' }),
    [categories]
  )

  const categoryParentOptions = useMemo(
    () => buildCategorySelectOptions(categories, { emptyLabel: 'Sin categoría padre' }),
    [categories]
  )

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
  const isMatrixParent = Boolean(item?.isMatrixParent)

  /** La plantilla decide si hay fotos: sin plantilla (alta manual) siempre se permite galería. */
  const templateAllowsPhotos = !familyTemplate || photoChoice !== 'none'

  const showParentImageGallery =
    !!item &&
    !isVariantChild &&
    templateAllowsPhotos &&
    (!item.isMatrixParent || photoChoice === 'model' || photoChoice === 'group')

  const showVariantImageGallery = isVariantChild && templateAllowsPhotos

  const showVariantPhotosHint = !!item?.isMatrixParent && photoChoice === 'variant'

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

  const allDimensionTemplates = useMemo(
    () => mergeWithSystemBaseAttributes(dimensionTemplates, tenantId ?? ''),
    [dimensionTemplates, tenantId, systemBaseEpoch]
  )

  const unitOfMeasureOptions = useMemo(
    () => [...getUnitOfMeasureOptions()],
    [systemBaseEpoch]
  )

  const dimensionValuesMap = useMemo(
    () => buildDimensionValuesMap(allDimensionTemplates),
    [allDimensionTemplates]
  )

  const systemColorPalette = useMemo(
    () => paletteFromDimensionMap(dimensionValuesMap),
    [dimensionValuesMap]
  )

  const modelAttributeFields = useMemo(
    () => getModelAttributeFields(familyLevels, dimensionValuesMap),
    [familyLevels, dimensionValuesMap]
  )

  const variantAttributeFields = useMemo(
    () => getVariantAttributeFields(familyLevels, dimensionValuesMap),
    [familyLevels, dimensionValuesMap]
  )

  const templateCapturesDescription = useMemo(
    () =>
      modelAttributeFields.some((field) => {
        const key = field.key.trim().toLowerCase()
        return key === 'descripcion' || key.startsWith('descripcion ') || key === 'detalle' || key === 'nota' || key === 'notas'
      }),
    [modelAttributeFields]
  )

  const templateCapturesName = useMemo(
    () =>
      modelAttributeFields.some((field) => {
        const key = field.key.trim().toLowerCase()
        return key === 'nombre' || key.startsWith('nombre ') || key === 'name' || key === 'producto'
      }),
    [modelAttributeFields]
  )

  // Matriz: identidad = UUID (sin nombre/SKU editables). Variante: nombre + SKU propios.
  const showDescriptionField =
    isMatrixParent || isVariantChild || (!isVariantChild && !templateCapturesDescription)
  const showNameField = !isMatrixParent && (isVariantChild || !templateCapturesName)
  const showSkuField = !isMatrixParent
  const showBarcodeField = !isMatrixParent

  const variantFieldsForArchetype = useMemo(
    () =>
      isVariantChild
        ? variantAttributeFields.filter((field) => {
            const n = field.key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            if (showNameField && (n === 'nombre' || n === 'name')) return false
            if (showDescriptionField && (n === 'descripcion' || n === 'description')) return false
            return true
          })
        : variantAttributeFields,
    [isVariantChild, showDescriptionField, showNameField, variantAttributeFields]
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
          ...variantAttributeFields.map((field) => field.key.trim().toLowerCase()),
          ...variantDimensionNames.map((name) => name.toLowerCase()),
        ])
      ),
    [modelAttributeFields, variantAttributeFields, variantDimensionNames]
  )

  const freeAttributeRows = useMemo(
    () =>
      customAttributes.filter(
        (row) =>
          !reservedAttributeKeys.includes(row.key.trim().toLowerCase()) &&
          (familyTemplate || !isCommercialBaseAttributeKey(row.key))
      ),
    [customAttributes, familyTemplate, reservedAttributeKeys]
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

  const handleUploadMedia = useCallback(
    async (file: File) => {
      if (!tenantId) throw new Error('Sesión sin empresa activa.')
      return uploadCatalogMedia(tenantId, file)
    },
    [tenantId]
  )

  const handleMediaError = useCallback(
    (message: string) => {
      toast.show({ title: 'No se pudo subir la foto', message, variant: 'error' })
    },
    [toast]
  )

  const suggestedTags = useMemo<string[]>(() => {
    const list = new Set<string>()
    customAttributes.forEach((attr) => {
      if (attr.value.trim() && attr.value.length < 25) {
        list.add(attr.value.trim())
      }
    })
    return Array.from(list)
  }, [customAttributes])

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
      const [, detail, templates, dims, items, cats] = await Promise.all([
        ensureSystemBaseAttributesLoaded(tenantId).catch(() => undefined),
        getCatalogItem(tenantId, itemId),
        listProductTemplates(tenantId).catch(() => [] as ProductTemplateDto[]),
        listVariantDimensionTemplates(tenantId).catch(() => [] as VariantDimensionTemplateDto[]),
        listCatalogItems(tenantId, { onlyRoots: true }).catch(() => []),
        canReadCategories ? listCategories(tenantId).catch(() => [] as CategoryListItemDto[]) : Promise.resolve([] as CategoryListItemDto[]),
      ])
      setSystemBaseEpoch((n) => n + 1)
      setItem(detail)
      setProductTemplates(templates)
      setDimensionTemplates(dims)
      setCategories(cats)
      setCategoryId(detail.categoryId ?? '')
      setUsedVariants(items.reduce((sum, i) => sum + (i.variantCount ?? 0), 0))
      setKind(String(detail.kind))
      setName(detail.name)
      setDescription(detail.description ?? '')
      setSku(detail.sku ?? '')
      setBarcode(detail.barcode ?? '')
      setCostPrice(detail.costPrice != null ? String(detail.costPrice) : '')
      setBasePrice(detail.basePrice != null ? String(detail.basePrice) : '')
      setMinOrderQuantity(detail.minOrderQuantity ?? 1)
      setStatus(String(detail.status))
      const parsedAttrs = deserializeCustomAttributes(detail.customAttributesJson)
      setBrand(readBrandFromCustomAttributes(parsedAttrs))
      setProductColors(readNamedColorsFromAttributes(parsedAttrs))
      setUnitOfMeasure(readUnitOfMeasureFromCustomAttributes(parsedAttrs, 'UND'))
      setCustomAttributes(parsedAttrs)
      setTags(extractTagsFromCustomAttributes(detail.customAttributesJson))
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo cargar el ítem.'))
    } finally {
      setLoading(false)
    }
  }, [canReadCategories, itemId, tenantId])

  const handleQuickCreateCategory = useCallback(async () => {
    if (!tenantId) return
    const trimmed = quickCatName.trim()
    if (!trimmed) {
      toast.show({
        title: 'Nombre requerido',
        message: 'Ingresa un nombre para la categoría.',
        variant: 'warning',
      })
      return
    }
    setQuickCatSaving(true)
    try {
      const created = await createCategory(tenantId, {
        name: trimmed,
        parentId: quickCatParentId || null,
      })
      const fresh = await listCategories(tenantId).catch(() => [] as CategoryListItemDto[])
      setCategories(fresh)
      setCategoryId(created.categoryId)
      setQuickCatOpen(false)
      setQuickCatName('')
      setQuickCatParentId('')
      toast.show({
        title: 'Categoría creada',
        message: `«${trimmed}» se agregó al catálogo.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo crear la categoría.'),
        variant: 'error',
      })
    } finally {
      setQuickCatSaving(false)
    }
  }, [quickCatName, quickCatParentId, tenantId, toast])

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
        label: `Matriz ${p.id.slice(0, 8)}… (${p.variantCount ?? 0} var.)`,
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
    ]

    if (item?.parentId && canEdit) {
      items.push({
        id: 'reassign-variant',
        label: 'Reasignar variante',
        icon: 'arrow-left-right',
        route: null,
        disabled: false,
      })
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

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !itemId || !item) return
      setError(null)
      setBusy(true)
      try {
        const templateNameValue = !isVariantChild && templateCapturesName
          ? modelAttributeFields
              .filter((field) =>
                /^nombre\b|^name$|^producto$/.test(field.key.trim().toLowerCase())
              )
              .map(
                (field) =>
                  customAttributes.find(
                    (row) => row.key.trim().toLowerCase() === field.key.trim().toLowerCase()
                  )?.value.trim() ?? ''
              )
              .find((value) => value) ?? ''
          : ''
        const payloadName =
          (isVariantChild
            ? name.trim()
            : isMatrixParent
              ? item.name?.trim() || item.familyName?.trim() || 'Matriz'
              : templateCapturesName
                ? templateNameValue || name.trim()
                : name.trim()) ||
          sku.trim() ||
          (isVariantChild ? 'Variante' : isMatrixParent ? 'Matriz' : 'Producto')
        const kindNum = Number(kind) as CatalogItemKind
        if (kindNum === CatalogItemKind.Physical && !isMatrixParent && !sku.trim()) {
          throw new Error('El SKU es obligatorio para ítems físicos.')
        }

        const isStandardSingleItem = !isMatrixParent && !isVariantChild && !familyTemplate
        const attrsWithBase = isStandardSingleItem
          ? (() => {
              const withBase = upsertBaseCommercialAttributes(
                customAttributes,
                brand,
                unitOfMeasure
              )
              return upsertNamedColorAttributes(withBase, productColors, systemColorPalette)
            })()
          : customAttributes
        const resolvedMinOrderQty = isStandardSingleItem
          ? minOrderQuantity
          : readMinOrderQuantityFromCustomAttributes(customAttributes, minOrderQuantity)

        const hierarchyPathJson =
          buildHierarchyPathJson(familyLevels, attrsWithBase, dimensionValuesMap) ??
            item.hierarchyPathJson ??
            null

        const rawCostPrice = parsePriceInput(costPrice)
        const parsedCostPrice = rawCostPrice != null && rawCostPrice >= 0 ? rawCostPrice : null
        const rawBasePrice = parsePriceInput(basePrice)
        const parsedBasePrice = rawBasePrice != null && rawBasePrice >= 0 ? rawBasePrice : null

        await updateCatalogItem(tenantId, itemId, {
          kind: kindNum,
          name: payloadName,
          description: isVariantChild
            ? description.trim() || item.description || null
            : description.trim() || null,
          sku: isMatrixParent ? null : sku.trim() || null,
          barcode: isMatrixParent ? null : barcode.trim() || null,
          costPrice: isMatrixParent
            ? null
            : isStandardSingleItem
              ? parsedCostPrice
              : item.costPrice ?? null,
          basePrice: isMatrixParent
            ? null
            : isStandardSingleItem
              ? parsedBasePrice
              : item.basePrice ?? null,
          customAttributesJson: serializeCustomAttributes(attrsWithBase, tags),
          status: Number(status) as typeof CatalogItemStatus.Active,
          familyId: item.familyId ?? null,
          hierarchyPathJson,
          minOrderQuantity: isMatrixParent ? null : resolvedMinOrderQty,
          categoryId: isStandardSingleItem ? categoryId || null : item.categoryId ?? null,
        })

        toast.show({
          title: 'Ítem actualizado',
          message: `«${payloadName}» se guardó correctamente.`,
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
      barcode,
      brand,
      productColors,
      systemColorPalette,
      categoryId,
      costPrice,
      basePrice,
      customAttributes,
      description,
      dimensionValuesMap,
      familyLevels,
      familyTemplate,
      item,
      isMatrixParent,
      isVariantChild,
      itemId,
      kind,
      modelAttributeFields,
      name,
      navigate,
      minOrderQuantity,
      sku,
      templateCapturesName,
      status,
      tags,
      tenantId,
      toast,
      unitOfMeasure,
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
        <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
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
      <div className="ecu-dashboard-layout ecu-section-page ecu-section-page">
        <PageHeader
          title={
            item
              ? isVariantChild
                ? item.name || item.sku || 'Variante'
                : isMatrixParent
                  ? `Matriz ${item.id.slice(0, 8)}…`
                  : item.name || 'Producto'
              : 'Editar Ítem'
          }
          subtitle={
            item
              ? isVariantChild
                ? [
                    item.parentId
                      ? `Variante de matriz ${item.parentId.slice(0, 8)}…`
                      : 'Variante física',
                    item.sku ? `SKU ${item.sku}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : isMatrixParent
                  ? [
                      `UUID ${item.id}`,
                      item.familyName ? `Plantilla: ${item.familyName}` : null,
                      `${item.variants?.length ?? 0} variante(s)`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : [
                      item.kind === CatalogItemKind.Physical ? 'Físico' : 'Servicio',
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
                    Matriz ({item.variants?.length ?? 0} variantes)
                  </StatusBadge>
                )}
                {item.parentId && <StatusBadge tone="neutral">Variante física</StatusBadge>}
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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {item?.parentId ? (
                <Button
                  type="button"
                  variant="outline"
                  iconLeft={<Layers size={16} />}
                  iconRight={<ArrowUpRight size={14} />}
                  onClick={() => navigate(`/catalogo/items/${item.parentId}`)}
                  style={{ minWidth: 'auto', width: 'auto' }}
                >
                  Ver modelo matriz
                </Button>
              ) : null}
              <Select
                id="ei-status"
                options={[
                  { value: String(CatalogItemStatus.Active), label: 'Activo' },
                  { value: String(CatalogItemStatus.Inactive), label: 'Inactivo' },
                ]}
                value={status}
                onChange={setStatus}
                size="sm"
                disabled={busy}
              />
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Más acciones"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handlePageActionSelect}
              />
            </div>
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
                  <ArrowLeftRight size={14} />
                  Vincular matriz
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


            <form id="edit-catalog-item" className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
              {error ? (
                <div className="ecu-form-error-banner" role="alert" style={{ marginBottom: '1rem' }}>
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              ) : null}

              <SectionCard
                title={
                  isMatrixParent
                    ? 'Matriz de producto'
                    : isVariantChild
                      ? 'Datos de la variante física'
                      : 'Datos del producto'
                }
                subtitle={
                  isMatrixParent
                    ? 'La matriz se identifica por UUID. Agrupa propiedades y variantes; cada variante tiene su propio SKU.'
                    : isVariantChild && item?.parentId
                      ? `Variante de matriz ${item.parentId.slice(0, 8)}…`
                      : undefined
                }
              >
                {/* Referencia a la matriz cuando editamos una variante física */}
                <div className="ecu-companies-form__grid ecu-companies-form__grid--dynamic">
                  {!isMatrixParent && !isVariantChild && !familyTemplate && (
                    <div className="ecu-companies-form__field">
                      <Select
                        id="ei-kind"
                        label="Tipo de ítem"
                        labelPosition="outlined"
                        variant="outline"
                        options={[
                          { value: String(CatalogItemKind.Physical), label: 'Físico' },
                          { value: String(CatalogItemKind.Service), label: 'Servicio' },
                        ]}
                        value={String(kind)}
                        onChange={(val) => setKind(val)}
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                  )}

                  {isVariantChild && showSkuField ? (
                    <div className="ecu-companies-form__field">
                      <TextBox
                        id="ei-sku"
                        label="SKU"
                        labelPosition="outlined"
                        variant="outline"
                        value={sku}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setSku(e.target.value.toUpperCase())
                        }
                        placeholder="Ej. CALC-001"
                        required={Number(kind) === CatalogItemKind.Physical}
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                  ) : null}

                  {isMatrixParent && item ? (
                    <div className="ecu-companies-form__field ecu-companies-form__field--wide">
                      <TextBox
                        id="ei-matrix-uuid"
                        label="UUID de la matriz"
                        labelPosition="outlined"
                        variant="outline"
                        value={item.id}
                        readOnly
                        disabled
                        fullWidth
                      />
                    </div>
                  ) : null}

                  {showNameField ? (
                    <div className="ecu-companies-form__field">
                      <TextBox
                        id="ei-name"
                        label={isVariantChild ? 'Nombre' : 'Nombre del producto'}
                        labelPosition="outlined"
                        variant="outline"
                        value={name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                        placeholder={
                          isVariantChild ? 'Nombre de la variante' : 'Ej. Calcetín Hello Kitty'
                        }
                        required
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                  ) : null}

                  {!isVariantChild && !isMatrixParent ? (
                    <div className="ecu-companies-form__field">
                      <TextBox
                        id="ei-sku"
                        label="SKU"
                        labelPosition="outlined"
                        variant="outline"
                        value={sku}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setSku(e.target.value.toUpperCase())
                        }
                        placeholder="Ej. CALC-001"
                        required={Number(kind) === CatalogItemKind.Physical}
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                  ) : null}

                  {showBarcodeField ? (
                    <div className="ecu-companies-form__field">
                      <TextBox
                        id="ei-barcode"
                        label="Código de barras (EAN/UPC)"
                        labelPosition="outlined"
                        variant="outline"
                        value={barcode}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setBarcode(e.target.value.toUpperCase())
                        }
                        placeholder="EAN / UPC / Code128"
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                  ) : null}

                  {!isMatrixParent && !isVariantChild && !familyTemplate ? (
                    <>
                      <div className="ecu-companies-form__field">
                        <NumberBox
                          id="ei-cost-price"
                          label="Precio base / Costo ($)"
                          labelPosition="outlined"
                          variant="outline"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={costPrice !== '' ? Number(costPrice) : undefined}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setCostPrice(e.target.value)
                          }
                          disabled={busy}
                          fullWidth
                        />
                        <p className="ecu-companies-form__hint" style={{ marginTop: '0.35rem' }}>
                          Costo por artículo para calcular tu ganancia (los clientes no verán esto).
                        </p>
                      </div>

                      <div className="ecu-companies-form__field">
                        <NumberBox
                          id="ei-base-price"
                          label="PVP / Precio de venta ($)"
                          labelPosition="outlined"
                          variant="outline"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={basePrice !== '' ? Number(basePrice) : undefined}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setBasePrice(e.target.value)
                          }
                          disabled={busy}
                          fullWidth
                        />
                        <p className="ecu-companies-form__hint" style={{ marginTop: '0.35rem' }}>
                          Precio unitario de venta al público para facturación y catálogo.
                        </p>
                      </div>

                      <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                        <CatalogPricingMarginBar costPrice={costPrice} basePrice={basePrice} />
                      </div>
                    </>
                  ) : null}

                  {!isMatrixParent && !familyTemplate ? (
                    <div className="ecu-companies-form__field">
                      <NumberBox
                        id="ei-min-order-qty"
                        label="Compra mínima (cantidad)"
                        labelPosition="outlined"
                        variant="outline"
                        min={1}
                        step={1}
                        showSpinButtons
                        value={minOrderQuantity}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setMinOrderQuantity(
                            Math.max(1, Math.floor(Number(e.target.value) || 1))
                          )
                        }
                        disabled={busy}
                        fullWidth
                      />
                      <p className="ecu-companies-form__hint" style={{ marginTop: '0.35rem' }}>
                        Cantidad mínima que debe comprar el cliente de este producto en la
                        tienda online.
                      </p>
                    </div>
                  ) : null}

                  {!isMatrixParent && !isVariantChild && !familyTemplate ? (
                    <>
                      <div className="ecu-companies-form__field">
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Select
                              id="ei-category"
                              label="Categoría"
                              labelPosition="outlined"
                              variant="outline"
                              placeholder="Seleccione..."
                              options={categorySelectOptions}
                              value={categoryId}
                              onChange={setCategoryId}
                              disabled={busy}
                              fullWidth
                            />
                          </div>
                          {canManageCategories && (
                            <Button
                              type="button"
                              variant="outline"
                              title="Nueva categoría"
                              aria-label="Nueva categoría"
                              onClick={() => {
                                setQuickCatName('')
                                setQuickCatParentId('')
                                setQuickCatOpen(true)
                              }}
                              disabled={busy}
                              style={{
                                width: 36,
                                height: 36,
                                minWidth: 36,
                                padding: 0,
                                borderRadius: '999px',
                                flexShrink: 0,
                                marginTop: '0.35rem',
                              }}
                            >
                              <Plus size={16} strokeWidth={2} aria-hidden />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="ecu-companies-form__field">
                        <TextBox
                          id="ei-brand"
                          label="Marca / Fabricante"
                          labelPosition="outlined"
                          variant="outline"
                          value={brand}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setBrand(e.target.value)}
                          placeholder="Escriba aquí..."
                          disabled={busy}
                          fullWidth
                        />
                      </div>

                      <div className="ecu-companies-form__field">
                        <Select
                          id="ei-unit"
                          label="Unidad de medida"
                          labelPosition="outlined"
                          variant="outline"
                          options={unitOfMeasureOptions}
                          value={unitOfMeasure}
                          onChange={(val) => setUnitOfMeasure(val)}
                          disabled={busy}
                          fullWidth
                        />
                      </div>
                    </>
                  ) : null}

                  {showDescriptionField ? (
                    <div className="ecu-companies-form__field ecu-companies-form__field--wide">
                      <TextArea
                        id="ei-desc"
                        label={
                          isMatrixParent
                            ? 'Descripción general de la matriz'
                            : 'Descripción'
                        }
                        labelPosition="outlined"
                        variant="outline"
                        value={description}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                          setDescription(e.target.value)
                        }
                        placeholder={
                          isMatrixParent
                            ? 'Ej. Calcetín deportivo de algodón con tecnología absorbente'
                            : isVariantChild
                              ? 'Descripción de la variante'
                              : 'Escriba aquí...'
                        }
                        rows={isVariantChild || isMatrixParent ? 3 : 2}
                        resize="vertical"
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                  ) : null}

                  {!isMatrixParent && !isVariantChild && !familyTemplate ? (
                    <div className="ecu-companies-form__field">
                      <NamedColorSelect
                        label="Color"
                        value=""
                    multiValues={productColors}
                    onMultiChange={setProductColors}
                        palette={systemColorPalette}
                        tenantId={tenantId}
                        onPaletteUpdated={async () => {
                          if (!tenantId) return
                          const fresh = await listVariantDimensionTemplates(tenantId)
                          setDimensionTemplates(fresh)
                          setSystemBaseEpoch((n) => n + 1)
                        }}
                        disabled={busy}
                        allowEmpty
                        emptyLabel="Ninguno"
                      />
                    </div>
                  ) : null}
                </div>

                <span className="ecu-hint">
                  {isMatrixParent
                    ? 'Los atributos base identifican al producto matriz y se heredan en sus variantes. Las existencias y SKUs se gestionan en las variantes abajo.'
                    : isVariantChild
                      ? 'El SKU identifica individualmente a esta combinación física en almacén, pedidos y facturación.'
                      : 'Estos atributos base pertenecen a todo ítem del catálogo; abajo se muestran los atributos adicionales de la plantilla.'}
                </span>
              </SectionCard>

              {isVariantChild && variantAxisEntries.length > 0 && (
                <SectionCard
                  title="Dimensiones de la variante"
                  subtitle={`Valores de la combinación física (${variantAxisEntries.map((e) => e.name).join(' × ')})`}
                >
                  <div className="ecu-companies-form__grid ecu-companies-form__grid--dynamic">
                    {variantAxisEntries.map((entry) => {
                      const lookup = dimensionValuesMap?.get(entry.name.trim().toLowerCase())
                      const axisFromDescriptor = item?.matrixDescriptor?.axes?.find(
                        (a) => a.name.trim().toLowerCase() === entry.name.trim().toLowerCase()
                      )
                      const isColor =
                        entry.type === 'color' ||
                        isHexColorToken(entry.value) ||
                        lookup?.isColor ||
                        axisFromDescriptor?.type === 'color'

                      const currentValue = entry.value
                      const availableOptions = Array.from(
                        new Set([
                          ...(axisFromDescriptor?.values ?? []),
                          ...(lookup?.values ?? []),
                        ])
                      )

                      const refreshTemplates = async () => {
                        if (!tenantId) return
                        const fresh = await listVariantDimensionTemplates(tenantId)
                        setDimensionTemplates(fresh)
                        setSystemBaseEpoch((n) => n + 1)
                      }

                      if (isColor) {
                        return (
                          <div key={entry.name} className="ecu-companies-form__field">
                            <NamedColorSelect
                              label={entry.name}
                              value={currentValue}
                              onChange={(name) => setAttributeValue(entry.name, name)}
                              dimensionValuesMap={dimensionValuesMap}
                              tenantId={tenantId}
                              onPaletteUpdated={refreshTemplates}
                              disabled={busy}
                              allowEmpty={false}
                            />
                          </div>
                        )
                      }

                      if (availableOptions.length > 0 || lookup) {
                        return (
                          <div key={entry.name} className="ecu-companies-form__field">
                            <ListOptionSelect
                              id={`axis-${entry.name}`}
                              label={entry.name}
                              value={currentValue}
                              options={availableOptions}
                              allowEmpty={false}
                              onChange={(val) => setAttributeValue(entry.name, val)}
                              attributeName={entry.name}
                              tenantId={tenantId}
                              onAdded={refreshTemplates}
                              disabled={busy}
                            />
                          </div>
                        )
                      }

                      return (
                        <div key={entry.name} className="ecu-companies-form__field">
                          <TextBox
                            id={`axis-${entry.name}`}
                            label={entry.name}
                            labelPosition="outlined"
                            variant="outline"
                            value={currentValue}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              setAttributeValue(entry.name, e.target.value)
                            }
                            disabled={busy}
                            fullWidth
                          />
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>
              )}

              {isVariantChild && variantFieldsForArchetype.length > 0 ? (
                <SectionCard
                  title="Datos de la plantilla"
                  subtitle={
                    familyTemplate
                      ? `Plantilla «${familyTemplate.name}»: mismos atributos que al crear la matriz.`
                      : undefined
                  }
                >
                  <ArchetypeModelFields
                    fields={variantFieldsForArchetype}
                    values={customAttributes}
                    dimensionValuesMap={dimensionValuesMap}
                    onChangeValue={setAttributeValue}
                    onUploadMedia={handleUploadMedia}
                    onMediaError={handleMediaError}
                    disabled={busy}
                    bare
                    tenantId={tenantId}
                    onColorPaletteUpdated={async () => {
                      if (!tenantId) return
                      const fresh = await listVariantDimensionTemplates(tenantId)
                      setDimensionTemplates(fresh)
                      setSystemBaseEpoch((n) => n + 1)
                    }}
                  />
                </SectionCard>
              ) : null}

              {!isVariantChild && modelAttributeFields.length > 0 ? (
                <SectionCard
                  title="Datos de la plantilla"
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
                    onUploadMedia={handleUploadMedia}
                    onMediaError={handleMediaError}
                    disabled={busy}
                    bare
                    tenantId={tenantId}
                    onColorPaletteUpdated={async () => {
                      if (!tenantId) return
                      const fresh = await listVariantDimensionTemplates(tenantId)
                      setDimensionTemplates(fresh)
                      setSystemBaseEpoch((n) => n + 1)
                    }}
                  />
                </SectionCard>
              ) : null}

              <SectionCard title="Avanzado">
                <details>
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--glb-muted, #64748b)',
                    }}
                  >
                    Etiquetas de búsqueda y atributos libres
                  </summary>
                  <div className="ecu-companies-form__grid ecu-companies-form__grid--dynamic" style={{ marginTop: '1rem' }}>
                    <div className="ecu-companies-form__field ecu-companies-form__field--wide" style={{ marginBottom: '0.25rem' }}>
                      <EcuTagInput
                        tags={tags}
                        onChange={setTags}
                        label="Etiquetas"
                        placeholder="Deportivo, Premium, temporada…"
                        helperText={
                          isVariantChild
                            ? 'Etiquetas de búsqueda específicas para esta variante en POS y tienda.'
                            : 'Búsqueda en POS y tienda; se heredan a las variantes. Recomendado: declararlas en la plantilla como «Tags».'
                        }
                        suggestedTags={suggestedTags}
                        disabled={busy}
                      />
                    </div>

                    {familyTemplate && freeAttributeRows.length > 0 ? (
                      <div
                        className="ecu-companies-form__field ecu-companies-form__field--wide"
                        style={{
                          display: 'flex',
                          gap: '0.35rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {freeAttributeRows.map((row) => (
                          <StatusBadge key={row.id} tone="neutral">
                            {row.key}: {row.value || '—'}
                          </StatusBadge>
                        ))}
                      </div>
                    ) : null}

                    {!familyTemplate ? (
                      <div className="ecu-companies-form__field ecu-companies-form__field--wide">
                        <ItemCustomAttributesEditor
                          attributes={freeAttributeRows}
                          onChange={handleFreeAttributesChange}
                          excludeKeys={reservedAttributeKeys}
                          disabled={busy}
                        />
                      </div>
                    ) : null}
                  </div>
                </details>
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
              showPhotoField={templateAllowsPhotos}
              variantAttributeFields={variantAttributeFields}
              dimensionValuesMap={dimensionValuesMap}
              onUploadMedia={handleUploadMedia}
              onMediaError={handleMediaError}
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

          <div
            className="ecu-companies-form__actions"
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <Button
              type="submit"
              form="edit-catalog-item"
              variant="primary"
              loading={busy}
              disabled={busy || deleting}
            >
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
              {item?.parentId ? (
                <>
                  Matriz actual:{' '}
                  <strong>
                    <code>{item.parentId}</code>
                  </strong>
                  .{' '}
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
              label="Matriz destino (UUID)"
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

      <Popup
        open={quickCatOpen}
        onClose={() => !quickCatSaving && setQuickCatOpen(false)}
        title="Nueva Categoría"
        width={440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
          <TextBox
            id="ei-quick-cat-name"
            label="Nombre"
            labelPosition="outlined"
            variant="outline"
            placeholder="Escriba aquí..."
            value={quickCatName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuickCatName(e.target.value)}
            disabled={quickCatSaving}
            required
            fullWidth
          />
          <Select
            id="ei-quick-cat-parent"
            label="Categoría padre"
            labelPosition="outlined"
            variant="outline"
            placeholder="Seleccione..."
            options={categoryParentOptions}
            value={quickCatParentId}
            onChange={setQuickCatParentId}
            disabled={quickCatSaving}
            fullWidth
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              marginTop: '0.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
            }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickCatOpen(false)}
              disabled={quickCatSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleQuickCreateCategory()}
              loading={quickCatSaving}
              disabled={quickCatSaving}
            >
              Registrar
            </Button>
          </div>
        </div>
      </Popup>
    </TenantSessionGate>
  )
}

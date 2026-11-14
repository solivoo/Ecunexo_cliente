import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, NumberBox, Popup, Select, TextArea, TextBox, useToast, type PageActionItem } from 'glubox'
import { Plus, Save } from 'lucide-react'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import {
  serializeCustomAttributes,
  type CustomAttributeRow,
} from '@/pages/catalog/ItemCustomAttributesEditor'
import { StagedCatalogItemImages, type StagedItemImage } from '@/pages/catalog/StagedCatalogItemImages'
import { buildCategorySelectOptions } from '@/lib/catalogCategoryLabels'
import { readApiError } from '@/lib/readApiError'
import {
  createCatalogItem,
  createCatalogItemMatrix,
  createCategory,
  listCatalogItems,
  listCategories,
  listProductTemplates,
  listVariantDimensionTemplates,
  uploadCatalogItemImage,
  uploadCatalogMedia,
} from '@/services/catalogApi'
import { useCatalogLimits } from '@/hooks/useCatalogLimits'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CatalogItemKind,
  type CategoryListItemDto,
  type ProductTemplateDto,
  type ProductTemplateLevel,
  type VariantDimensionTemplateDto,
} from '@/types/catalogApi'
import {
  VariantMatrixBuilder,
  type MatrixVariantPayloadWithImage,
  type VariantImageItem,
} from '@/pages/catalog/VariantMatrixBuilder'
import { CatalogPricingMarginBar, parsePriceInput } from '@/pages/catalog/CatalogPricingMarginBar'
import {
  buildDimensionValuesMap,
  buildHierarchyPathJson,
  getModelAttributeFields,
  getVariantAttributeFields,
  readPhotoChoice,
  resolveTemplateDimensions,
} from '@/lib/catalogArchetype'
import {
  ensureSystemBaseAttributesLoaded,
  getUnitOfMeasureOptions,
  mergeWithSystemBaseAttributes,
  readMinOrderQuantityFromCustomAttributes,
  upsertBaseCommercialAttributes,
} from '@/lib/catalogBaseAttributes'
import {
  paletteFromDimensionMap,
  upsertNamedColorAttributes,
} from '@/lib/catalogNamedColors'
import { ArchetypeModelFields } from '@/pages/catalog/ArchetypeModelFields'
import { NamedColorSelect } from '@/pages/catalog/NamedColorSelect'

const NAME_FIELD_KEYS = ['nombre', 'nombre del producto', 'nombre producto', 'name', 'producto', 'titulo', 'título']
const DESCRIPTION_FIELD_KEYS = ['descripcion', 'descripción', 'detalle', 'notas', 'nota']
const CODE_FIELD_KEYS = ['codigo', 'código', 'sku', 'referencia', 'codigo de producto', 'código de producto']

function matchesFieldKey(key: string, candidates: readonly string[]): boolean {
  const clean = key.trim().toLowerCase()
  return candidates.some(
    (candidate) =>
      clean === candidate ||
      clean.startsWith(`${candidate} `) ||
      clean.startsWith(`${candidate}/`) ||
      clean.startsWith(`${candidate} /`)
  )
}

/** Código legible autogenerado cuando la plantilla no captura uno (ej. CALCETIN-A3F9K2). */
function generateSkuFromName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 10)
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return base ? `${base}-${suffix}` : `PRD-${suffix}`
}

/** Lee un atributo de variante desde su JSON (clave case-insensitive). */
function readVariantAttribute(json: string | null | undefined, key: string): string {
  if (!json) return ''
  try {
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ''
    for (const [currentKey, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (currentKey.trim().toLowerCase() === key && typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  } catch {
    // JSON inválido: sin atributo
  }
  return ''
}

export function CreateCatalogItemPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('catalog.item.create')
  const canManageCategories = useHasPermission('catalog.category.manage')
  const hasCategoryRead = useHasPermission('catalog.category.read')
  const hasItemRead = useHasPermission('catalog.item.read')
  const canReadCategories = hasCategoryRead || hasItemRead || canManageCategories || canCreate

  const [busy, setBusy] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [productTemplates, setProductTemplates] = useState<ProductTemplateDto[]>([])
  const [dimensionTemplates, setDimensionTemplates] = useState<VariantDimensionTemplateDto[]>([])
  const [categories, setCategories] = useState<CategoryListItemDto[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [quickCatOpen, setQuickCatOpen] = useState(false)
  const [quickCatName, setQuickCatName] = useState('')
  const [quickCatParentId, setQuickCatParentId] = useState('')
  const [quickCatSaving, setQuickCatSaving] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [kind, setKind] = useState<CatalogItemKind>(CatalogItemKind.Physical)
  const [manualSku, setManualSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [brand, setBrand] = useState('')
  const [productColors, setProductColors] = useState<string[]>([])
  const [unitOfMeasure, setUnitOfMeasure] = useState('UND')
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set())
  const [minOrderQuantity, setMinOrderQuantity] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [matrixData, setMatrixData] = useState<{
    variants: MatrixVariantPayloadWithImage[]
    variantDimensionsJson: string
    dimensionNames: string[]
    isValid: boolean
    invalidReason: string | null
    groupImages: { groupValue: string; images: VariantImageItem[] }[]
  }>({
    variants: [],
    variantDimensionsJson: '',
    dimensionNames: [],
    isValid: false,
    invalidReason: null,
    groupImages: [],
  })
  const [customAttributes, setCustomAttributes] = useState<CustomAttributeRow[]>([])
  const [stagedImages, setStagedImages] = useState<StagedItemImage[]>([])
  const [usedVariants, setUsedVariants] = useState(0)
  const [systemBaseEpoch, setSystemBaseEpoch] = useState(0)

  const { maxVariants } = useCatalogLimits()
  const remainingVariants =
    maxVariants != null ? Math.max(0, maxVariants - usedVariants) : null

  const stagedImagesRef = useRef<StagedItemImage[]>([])
  stagedImagesRef.current = stagedImages

  useEffect(() => {
    return () => {
      stagedImagesRef.current.forEach((img) => {
        try {
          URL.revokeObjectURL(img.previewUrl)
        } catch {
          // ignorar
        }
      })
    }
  }, [])

  const allDimensionTemplates = useMemo(
    () => mergeWithSystemBaseAttributes(dimensionTemplates, tenantId ?? ''),
    [dimensionTemplates, tenantId, systemBaseEpoch]
  )

  const unitOfMeasureOptions = useMemo(
    () => [...getUnitOfMeasureOptions()],
    [systemBaseEpoch]
  )

  // Mapa de atributos del diccionario corporativo y atributos base del sistema: clave en minúscula -> { values, isColor }
  const dimensionValuesMap = useMemo(
    () => buildDimensionValuesMap(allDimensionTemplates),
    [allDimensionTemplates]
  )

  const systemColorPalette = useMemo(
    () => paletteFromDimensionMap(dimensionValuesMap),
    [dimensionValuesMap]
  )

  const appliedTemplate = useMemo(
    () => productTemplates.find((t) => t.id === selectedTemplateId),
    [productTemplates, selectedTemplateId]
  )

  const appliedTemplateLevels = useMemo<ProductTemplateLevel[]>(() => {
    if (!appliedTemplate) return []
    try {
      const parsed = JSON.parse(appliedTemplate.hierarchyTreeJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [appliedTemplate])

  const photoChoice = useMemo(
    () => readPhotoChoice(appliedTemplateLevels).choice,
    [appliedTemplateLevels]
  )

  const modelAttributeFields = useMemo(
    () => getModelAttributeFields(appliedTemplateLevels, dimensionValuesMap),
    [appliedTemplateLevels, dimensionValuesMap]
  )

  const variantAttributeFields = useMemo(
    () => getVariantAttributeFields(appliedTemplateLevels, dimensionValuesMap),
    [appliedTemplateLevels, dimensionValuesMap]
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

  // Ejes físicos por variante: terminal + escalas de talla/color, con agrupación de fotos resuelta
  const templateAllDimensions = useMemo(
    () => resolveTemplateDimensions(appliedTemplateLevels, dimensionValuesMap),
    [appliedTemplateLevels, dimensionValuesMap]
  )

  const isStandardProduct = selectedTemplateId === '__none__'

  const categorySelectOptions = useMemo(
    () => buildCategorySelectOptions(categories, { emptyLabel: 'Sin categoría' }),
    [categories]
  )

  const categoryParentOptions = useMemo(
    () => buildCategorySelectOptions(categories, { emptyLabel: 'Sin categoría padre' }),
    [categories]
  )

  const usesMatrix = Boolean(appliedTemplate) && (templateAllDimensions?.length ?? 0) > 0

  const showProductGallery =
    isStandardProduct ||
    (Boolean(appliedTemplate) &&
      (photoChoice === 'model' || (!usesMatrix && photoChoice !== 'none')))

  const matrixPhotoScope =
    photoChoice === 'group' ? 'group' : photoChoice === 'variant' ? 'variant' : 'model'

  const modelFieldGroups = useMemo(() => {
    const isColorField = (field: (typeof modelAttributeFields)[number]) => {
      const lower = field.key.trim().toLowerCase()
      const lookup = dimensionValuesMap.get(lower)
      const dt = (lookup?.dataType ?? '').toLowerCase()
      return (
        dt === 'color' ||
        dt === 'colorlist' ||
        lower === 'color' ||
        lower === 'colores' ||
        Boolean(lookup?.isColor)
      )
    }

    const colorFields: typeof modelAttributeFields = []
    const rest: typeof modelAttributeFields = []
    for (const field of modelAttributeFields) {
      if (isColorField(field)) colorFields.push(field)
      else rest.push(field)
    }

    // Por nivel; Color siempre al final (como producto estándar).
    const groups: { key: string; title: string; fields: typeof modelAttributeFields }[] = []
    for (const field of rest) {
      const key = String(field.levelIndex)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.fields.push(field)
      else groups.push({ key, title: field.levelName || `Nivel ${field.levelIndex}`, fields: [field] })
    }
    if (colorFields.length > 0) {
      groups.push({ key: 'color', title: 'Color', fields: colorFields })
    }
    return groups
  }, [dimensionValuesMap, modelAttributeFields])

  const hasTemplateNameField = useMemo(
    () => modelAttributeFields.some((field) => matchesFieldKey(field.key, NAME_FIELD_KEYS)),
    [modelAttributeFields]
  )

  // Matriz: sin nombre editable (solo UUID del ítem); el nombre BD se autogenera.
  const showManualName = !usesMatrix && (isStandardProduct || !hasTemplateNameField)

  const findTemplateAttributeValue = useCallback(
    (candidates: readonly string[]): string => {
      for (const field of modelAttributeFields) {
        if (!matchesFieldKey(field.key, candidates)) continue
        const row = customAttributes.find(
          (r) => r.key.trim().toLowerCase() === field.key.trim().toLowerCase()
        )
        if (row?.value.trim()) return row.value.trim()
      }
      return ''
    },
    [customAttributes, modelAttributeFields]
  )

  const derivedTemplateName = appliedTemplate ? findTemplateAttributeValue(NAME_FIELD_KEYS) : ''
  const derivedTemplateDescription = appliedTemplate
    ? findTemplateAttributeValue(DESCRIPTION_FIELD_KEYS)
    : ''
  const derivedTemplateSku = appliedTemplate ? findTemplateAttributeValue(CODE_FIELD_KEYS) : ''
  const hasTemplateDescriptionField = useMemo(
    () =>
      modelAttributeFields.some((f) => matchesFieldKey(f.key, DESCRIPTION_FIELD_KEYS)) ||
      variantAttributeFields.some((f) => matchesFieldKey(f.key, DESCRIPTION_FIELD_KEYS)),
    [modelAttributeFields, variantAttributeFields]
  )
  const showManualDescription = isStandardProduct || !hasTemplateDescriptionField

  const firstVariantName = useMemo(
    () =>
      matrixData.variants.length > 0
        ? readVariantAttribute(matrixData.variants[0].customAttributesJson, 'nombre')
        : '',
    [matrixData.variants]
  )

  const handleApplyTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId)
    setCustomAttributes([])
    setError(null)
  }, [])

  useEffect(() => {
    if (!tenantId || !canCreate) return
    let cancelled = false
    void (async () => {
      try {
        const [, tplList, dimList, items, allItems, catList] = await Promise.all([
          ensureSystemBaseAttributesLoaded(tenantId),
          listProductTemplates(tenantId),
          listVariantDimensionTemplates(tenantId),
          listCatalogItems(tenantId, { onlyRoots: true }).catch(() => []),
          listCatalogItems(tenantId, { onlyRoots: false, includeParents: true }).catch(() => []),
          canReadCategories ? listCategories(tenantId).catch(() => [] as CategoryListItemDto[]) : Promise.resolve([] as CategoryListItemDto[]),
        ])
        if (!cancelled) {
          setSystemBaseEpoch((n) => n + 1)
          setProductTemplates(tplList.filter((t) => t.isActive))
          setDimensionTemplates(dimList)
          setCategories(catList)
          setUsedVariants(items.reduce((sum, i) => sum + (i.variantCount ?? 0), 0))
          const skus = new Set(
            allItems
              .map((i) => i.sku?.trim().toUpperCase())
              .filter((s): s is string => Boolean(s))
          )
          setExistingSkus(skus)
        }
      } catch {
        if (!cancelled) {
          setProductTemplates([])
          setDimensionTemplates([])
          setCategories([])
          setUsedVariants(0)
          setExistingSkus(new Set())
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canCreate, canReadCategories, tenantId])

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

  const goToList = useCallback(() => {
    void navigate('/catalogo/items')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Listado de matrices y productos',
        icon: 'package',
        route: '/catalogo/items',
        disabled: false,
      },
      {
        id: 'attributes',
        label: 'Atributos y escalas',
        icon: 'tag',
        route: '/catalogo/atributos',
        disabled: false,
      },
      {
        id: 'templates',
        label: 'Plantillas de producto',
        icon: 'layers',
        route: '/catalogo/plantillas',
        disabled: false,
      },
    ],
    []
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        if (!selectedTemplateId || (!appliedTemplate && !isStandardProduct)) {
          throw new Error('Elige una plantilla o selecciona «Producto estándar (sin plantilla)».')
        }
        const nameSeed = usesMatrix
          ? firstVariantName || derivedTemplateName || 'Matriz'
          : showManualName
            ? name.trim()
            : derivedTemplateName
        let finalSku = manualSku.trim() || derivedTemplateSku
        let autoGeneratedSku = false
        if (!usesMatrix && !finalSku) {
          finalSku = generateSkuFromName(nameSeed || 'PRODUCTO')
          autoGeneratedSku = true
        }

        const finalName = nameSeed || finalSku || 'Producto'
        const finalDescription = usesMatrix
          ? description.trim() ||
          readVariantAttribute(matrixData.variants[0]?.customAttributesJson, 'descripcion') ||
          derivedTemplateDescription
          : showManualDescription
            ? description.trim()
            : derivedTemplateDescription

        const kindNum = isStandardProduct ? kind : CatalogItemKind.Physical

        const rawCostPrice = isStandardProduct ? parsePriceInput(costPrice) : null
        const parsedCostPrice = rawCostPrice != null && rawCostPrice >= 0 ? rawCostPrice : null
        const rawBasePrice = isStandardProduct ? parsePriceInput(basePrice) : null
        const parsedBasePrice = rawBasePrice != null && rawBasePrice >= 0 ? rawBasePrice : null

        const attrsToSerialize = isStandardProduct
          ? (() => {
              const withBase = upsertBaseCommercialAttributes(
                customAttributes,
                brand,
                unitOfMeasure
              )
              return upsertNamedColorAttributes(withBase, productColors, systemColorPalette)
            })()
          : [...customAttributes]
        const resolvedMinOrderQty = isStandardProduct
          ? minOrderQuantity
          : readMinOrderQuantityFromCustomAttributes(customAttributes, minOrderQuantity)

        let targetItemId: string
        const familyId = isStandardProduct ? null : selectedTemplateId || null
        const hierarchyPathJson = isStandardProduct
          ? null
          : buildHierarchyPathJson(
            appliedTemplateLevels,
            attrsToSerialize,
            dimensionValuesMap
          )

        if (usesMatrix && kindNum === CatalogItemKind.Physical) {
          if (!matrixData.isValid || matrixData.variants.length === 0) {
            throw new Error(matrixData.invalidReason ?? 'Debes configurar al menos una variante con SKU.')
          }
          if (remainingVariants != null && matrixData.variants.length > remainingVariants) {
            throw new Error(
              `Tu plan permite hasta ${maxVariants} variantes y solo quedan ${remainingVariants} disponibles. Ajusta las variantes o actualiza tu plan.`
            )
          }

          const createdMatrix = await createCatalogItemMatrix(tenantId, {
            kind: kindNum,
            name: finalName,
            description: finalDescription || null,
            modelCode: null,
            basePrice: null,
            costPrice: null,
            minOrderQuantity: resolvedMinOrderQty,
            variantDimensionsJson: matrixData.variantDimensionsJson,
            variants: matrixData.variants,
            customAttributesJson:
              attrsToSerialize.length > 0 ? serializeCustomAttributes(attrsToSerialize, []) : null,
            familyId,
            hierarchyPathJson,
          })

          targetItemId = createdMatrix.parentItemId

          // Subir fotos específicas por cada variante física si fueron seleccionadas
          if (createdMatrix.variantItemIds && createdMatrix.variantItemIds.length > 0) {
            let variantPhotosOk = 0
            let variantPhotosFail = 0
            for (let i = 0; i < matrixData.variants.length; i++) {
              const v = matrixData.variants[i]
              const variantItemId = createdMatrix.variantItemIds[i]
              if (!variantItemId) continue

              const imagesToUpload = v.stagedImages && v.stagedImages.length > 0
                ? v.stagedImages
                : v.stagedImage
                  ? [{ file: v.stagedImage, name: v.variantTitle }]
                  : []

              for (let imgIdx = 0; imgIdx < imagesToUpload.length; imgIdx++) {
                const img = imagesToUpload[imgIdx]
                setUploadStatus(`Subiendo foto ${imgIdx + 1} de ${imagesToUpload.length} para variante «${v.variantTitle}»...`)
                try {
                  await uploadCatalogItemImage(
                    tenantId,
                    variantItemId,
                    img.file,
                    `${v.variantTitle} - ${imgIdx + 1}`,
                    imgIdx === 0
                  )
                  variantPhotosOk++
                } catch (imgErr) {
                  variantPhotosFail++
                  console.error('Error al subir imagen de variante', imgErr)
                }
              }
            }
            if (variantPhotosFail > 0) {
              toast.show({
                title: 'Fotos de variantes incompletas',
                message: `Se subieron ${variantPhotosOk} y fallaron ${variantPhotosFail}. Revisa la conexión al almacenamiento de fotos (B2) o vuelve a subirlas en cada variante.`,
                variant: 'warning',
              })
            } else if (variantPhotosOk > 0) {
              toast.show({
                title: 'Fotos de variantes',
                message: `Se subieron ${variantPhotosOk} imágenes a los códigos.`,
                variant: 'success',
              })
            }
          }

          // Fotos compartidas por grupo: se suben una sola vez al producto matriz con su valor de grupo
          if (photoChoice === 'group' && matrixData.groupImages.length > 0) {
            for (const group of matrixData.groupImages) {
              for (let imgIdx = 0; imgIdx < group.images.length; imgIdx++) {
                const img = group.images[imgIdx]
                setUploadStatus(
                  `Subiendo foto ${imgIdx + 1} de ${group.images.length} para «${group.groupValue}»...`
                )
                try {
                  await uploadCatalogItemImage(
                    tenantId,
                    createdMatrix.parentItemId,
                    img.file,
                    group.groupValue,
                    imgIdx === 0,
                    group.groupValue
                  )
                } catch (imgErr) {
                  console.error('Error al subir imagen de grupo', imgErr)
                }
              }
            }
          }
        } else {
          const cleanSku = finalSku?.trim().toUpperCase()
          if (cleanSku && existingSkus.has(cleanSku)) {
            throw new Error(`El SKU «${cleanSku}» ya existe en el catálogo. Usa un SKU único.`)
          }

          const created = await createCatalogItem(tenantId, {
            kind: kindNum,
            name: finalName,
            description: finalDescription || null,
            sku: finalSku || null,
            barcode: barcode.trim() || null,
            costPrice: parsedCostPrice,
            basePrice: parsedBasePrice,
            customAttributesJson:
              attrsToSerialize.length > 0 ? serializeCustomAttributes(attrsToSerialize, []) : null,
            familyId,
            hierarchyPathJson,
            minOrderQuantity: resolvedMinOrderQty,
            categoryId: isStandardProduct ? categoryId || null : null,
          })

          targetItemId = created.itemId
        }

        if (stagedImages.length > 0) {
          let uploadedCount = 0
          for (let i = 0; i < stagedImages.length; i++) {
            const img = stagedImages[i]
            setUploadStatus(`Subiendo imagen ${i + 1} de ${stagedImages.length}...`)
            try {
              await uploadCatalogItemImage(
                tenantId,
                targetItemId,
                img.file,
                img.altText || undefined,
                img.isMain
              )
              uploadedCount++
            } catch (imgErr) {
              console.error('Error al subir imagen de ítem', imgErr)
            }
          }
          if (uploadedCount > 0) {
            toast.show({
              title: 'Imágenes vinculadas',
              message: `Se subieron ${uploadedCount} imágenes al ítem con éxito.`,
              variant: 'success',
            })
          }
        }

        toast.show({
          title: usesMatrix ? 'Matriz producto creada' : 'Producto creado',
          message: usesMatrix
            ? `Matriz ${targetItemId.slice(0, 8)}… con ${matrixData.variants.length} variantes (SKU por variante).`
            : autoGeneratedSku
              ? `«${finalName}» quedó registrado con el código «${finalSku}».`
              : `«${finalName}» quedó registrado en el catálogo.`,
          variant: 'success',
        })
        void navigate('/catalogo/items', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : readApiError(err, usesMatrix ? 'No se pudo crear la matriz producto.' : 'No se pudo crear el producto.')
        setError(message)
        toast.show({ title: 'No se pudo crear', message, variant: 'error' })
      } finally {
        setUploadStatus(null)
        setBusy(false)
      }
    },
    [
      appliedTemplate,
      appliedTemplateLevels,
      barcode,
      categoryId,
      costPrice,
      basePrice,
      brand,
      productColors,
      systemColorPalette,
      customAttributes,
      derivedTemplateDescription,
      derivedTemplateName,
      derivedTemplateSku,
      description,
      dimensionValuesMap,
      firstVariantName,
      isStandardProduct,
      kind,
      manualSku,
      existingSkus,
      minOrderQuantity,
      name,
      showManualDescription,
      showManualName,
      matrixData,
      maxVariants,
      navigate,
      photoChoice,
      usesMatrix,
      remainingVariants,
      selectedTemplateId,
      stagedImages,
      tenantId,
      toast,
      unitOfMeasure,
    ]
  )

  if (!canCreate) {
    return (
      <TenantSessionGate title="Nuevo producto" lead="Alta en el maestro de catálogo.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres catalog.item.create para dar de alta nuevos productos o servicios."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
          <SectionCard title="Permisos insuficientes">
            <p className="app-shell__muted" style={{ marginBottom: '1rem' }}>
              No posees las credenciales requeridas para registrar ítems en el catálogo de esta empresa.
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
    <TenantSessionGate title="Nuevo producto" lead="Alta en el maestro de catálogo (sin stock).">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title='Nuevo producto'
          subtitle={
            usesMatrix
              ? 'Configura el producto y genera sus variantes físicas según la plantilla.'
              : 'Elige plantilla o producto simple; el formulario muestra solo lo necesario.'
          }
          badge={
            <StatusBadge tone="primary" withDot>
              Alta
            </StatusBadge>
          }
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Más acciones"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
              />
            </div>
          }
        />

        <form id="create-catalog-item" className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard title="Modo de Creación">
            <div className="ecu-companies-form__grid ecu-companies-form__grid--dynamic">
              <div className="ecu-companies-form__field">
                <Select
                  id="ci-template"
                  label="Modo"
                  labelPosition="outlined"
                  variant="outline"
                  placeholder="Elige una opción…"
                  options={[
                    { value: '__none__', label: 'Producto estándar' },
                    ...productTemplates.map((t) => ({ value: t.id, label: `Plantilla: ${t.name}` })),
                  ]}
                  value={selectedTemplateId}
                  onChange={handleApplyTemplate}
                  disabled={busy}
                  fullWidth
                />
              </div>
            </div>
          </SectionCard>

          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {!usesMatrix && (appliedTemplate || isStandardProduct) ? (
            <SectionCard
              title={
                isStandardProduct ? 'Datos del producto estándar' : 'Datos del producto'
              }
              subtitle={
                isStandardProduct
                  ? 'Ficha comercial completa con los atributos base del sistema.'
                  : undefined
              }
            >
              <div className="ecu-companies-form__grid ecu-companies-form__grid--dynamic">
                {/* Identidad */}
                {isStandardProduct && (
                  <div className="ecu-companies-form__field">
                    <Select
                      id="ci-kind"
                      label="Tipo de ítem"
                      labelPosition="outlined"
                      variant="outline"
                      options={[
                        { value: String(CatalogItemKind.Physical), label: 'Físico' },
                        { value: String(CatalogItemKind.Service), label: 'Servicio' },
                      ]}
                      value={String(kind)}
                      onChange={(val) => setKind(Number(val) as CatalogItemKind)}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                )}

                {showManualName ? (
                  <div className="ecu-companies-form__field">
                    <TextBox
                      id="ci-name"
                      label="Nombre del producto"
                      labelPosition="outlined"
                      variant="outline"
                      value={name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                      placeholder="Escriba aquí..."
                      required
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                ) : null}

                {isStandardProduct ? (
                  <div className="ecu-companies-form__field">
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Select
                          id="ci-category"
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
                ) : null}

                {isStandardProduct ? (
                  <div className="ecu-companies-form__field">
                    <TextBox
                      id="ci-brand"
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
                ) : null}

                {/* Códigos */}
                {!usesMatrix ? (
                  <div className="ecu-companies-form__field">
                    <TextBox
                      id="ci-sku"
                      label="SKU"
                      labelPosition="outlined"
                      variant="outline"
                      value={manualSku}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setManualSku(e.target.value.toUpperCase())
                      }
                      placeholder="Escriba aquí..."
                      error={manualSku.trim() ? existingSkus.has(manualSku.trim().toUpperCase()) : false}
                      errorMessage={
                        manualSku.trim() && existingSkus.has(manualSku.trim().toUpperCase())
                          ? 'Este SKU ya existe en el catálogo'
                          : undefined
                      }
                      required={kind === CatalogItemKind.Physical}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                ) : null}

                {!usesMatrix && (
                  <div className="ecu-companies-form__field">
                    <TextBox
                      id="ci-barcode"
                      label="Código de barras (EAN/UPC)"
                      labelPosition="outlined"
                      variant="outline"
                      value={barcode}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setBarcode(e.target.value.toUpperCase())
                      }
                      placeholder="Escriba aquí..."
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                )}

                {isStandardProduct && (
                  <div className="ecu-companies-form__field">
                    <Select
                      id="ci-unit"
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
                )}

                {/* Comercial / precios */}
                {isStandardProduct && (
                  <div className="ecu-companies-form__field">
                    <NumberBox
                      id="ci-min-order-qty"
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
                  </div>
                )}

                {isStandardProduct && (
                  <div className="ecu-companies-form__field">
                    <NumberBox
                      id="ci-cost-price"
                      label="Precio costo"
                      labelPosition="outlined"
                      variant="outline"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={costPrice !== '' ? Number(costPrice) : undefined}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setCostPrice(e.target.value)}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                )}

                {isStandardProduct && (
                  <div className="ecu-companies-form__field">
                    <NumberBox
                      id="ci-base-price"
                      label="PVP"
                      labelPosition="outlined"
                      variant="outline"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={basePrice !== '' ? Number(basePrice) : undefined}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setBasePrice(e.target.value)}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                )}

                {isStandardProduct && (
                  <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                    <CatalogPricingMarginBar costPrice={costPrice} basePrice={basePrice} />
                  </div>
                )}

                {showManualDescription ? (
                  <div className="ecu-companies-form__field ecu-companies-form__field--wide">
                    <TextArea
                      id="ci-description"
                      label="Descripción"
                      labelPosition="outlined"
                      variant="outline"
                      value={description}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                      placeholder="Escriba aquí..."
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                ) : null}
                {/* Colores: fila propia al final */}
                {isStandardProduct ? (
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
            </SectionCard>
          ) : null}

          {appliedTemplate &&
            modelFieldGroups.map((group) => (
              <SectionCard
                key={group.key}
                title={group.title}
              >
                <ArchetypeModelFields
                  fields={group.fields}
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
            ))}

          {showProductGallery && (
            <SectionCard
              title="Fotografías"
              subtitle={
                photoChoice === 'model' && usesMatrix
                  ? 'Se comparten con todas las variaciones.'
                  : 'Hasta 8 imágenes de este producto.'
              }
            >
              <StagedCatalogItemImages
                stagedImages={stagedImages}
                onStagedImagesChange={setStagedImages}
                disabled={busy}
                uploading={busy && uploadStatus !== null}
                uploadStatus={uploadStatus}
                hideBanner={true}
              />
            </SectionCard>
          )}

          {usesMatrix && (
            <SectionCard
              title="Variaciones"
              subtitle={
                templateAllDimensions?.length
                  ? `Ejes: ${templateAllDimensions.map((d) => d.name).join(' × ')}`
                  : undefined
              }
            >
              <VariantMatrixBuilder
                key={selectedTemplateId}
                tenantId={tenantId}
                baseName={
                  appliedTemplate?.name?.trim() || derivedTemplateName || 'Matriz'
                }
                basePrice=""
                costPrice=""
                matrixCode=""
                existingSkus={existingSkus}
                disabled={busy}
                onChange={setMatrixData}
                availableImages={stagedImages}
                initialDimensions={templateAllDimensions}
                photoScope={matrixPhotoScope}
                variantAttributeFields={variantAttributeFields}
                dimensionValuesMap={dimensionValuesMap}
                onUploadMedia={handleUploadMedia}
                onMediaError={handleMediaError}
                onColorPaletteUpdated={async () => {
                  if (!tenantId) return
                  const fresh = await listVariantDimensionTemplates(tenantId)
                  setDimensionTemplates(fresh)
                  setSystemBaseEpoch((n) => n + 1)
                }}
                embedded
              />
            </SectionCard>
          )}

          <div
            className="ecu-companies-form__actions"
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}
          >
            <Button
              type="submit"
              width="auto"
              form="create-catalog-item"
              variant="primary"
              title="Guardar"
              loading={busy}
              disabled={busy || (!appliedTemplate && !isStandardProduct)}
            >
              <Save size={16} />
              <span>
                {uploadStatus || 'Guardar'}

              </span>
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
              Cancelar
            </Button>
          </div>
        </form>

        <Popup
          open={quickCatOpen}
          onClose={() => !quickCatSaving && setQuickCatOpen(false)}
          title="Nueva Categoría"
          width={440}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
            <TextBox
              id="quick-cat-name"
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
              id="quick-cat-parent"
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
      </div>
    </TenantSessionGate>
  )
}

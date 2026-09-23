import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import { Layers, Save } from 'lucide-react'
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
import { readApiError } from '@/lib/readApiError'
import {
  createCatalogItem,
  createCatalogItemMatrix,
  listCatalogCategories,
  listCatalogItems,
  listProductTemplates,
  listVariantDimensionTemplates,
  uploadCatalogItemImage,
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
import {
  buildDimensionValuesMap,
  buildHierarchyPathJson,
  describeTemplateLine,
  getModelAttributeFields,
  getVariantAttributeFields,
  readPhotoChoice,
  resolveTemplateDimensions,
} from '@/lib/catalogArchetype'
import { ArchetypeModelFields } from '@/pages/catalog/ArchetypeModelFields'

type EntryMode = 'template' | 'single' | 'service'

const ENTRY_OPTIONS: { id: EntryMode; title: string; text: string }[] = [
  {
    id: 'template',
    title: 'Usar una plantilla',
    text: 'El producto sigue los niveles, datos y variaciones que ya armaste.',
  },
  {
    id: 'single',
    title: 'Producto con un solo código',
    text: 'Una pieza, un código y sus fotos. Sin variaciones.',
  },
  {
    id: 'service',
    title: 'Servicio',
    text: 'Se vende sin stock ni variaciones.',
  },
]

export function CreateCatalogItemPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('catalog.item.create')

  const [busy, setBusy] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryListItemDto[]>([])
  const [productTemplates, setProductTemplates] = useState<ProductTemplateDto[]>([])
  const [dimensionTemplates, setDimensionTemplates] = useState<VariantDimensionTemplateDto[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [entryMode, setEntryMode] = useState<EntryMode>('template')
  const [kind, setKind] = useState(String(CatalogItemKind.Physical))
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
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [customAttributes, setCustomAttributes] = useState<CustomAttributeRow[]>([])
  const [stagedImages, setStagedImages] = useState<StagedItemImage[]>([])
  const [usedVariants, setUsedVariants] = useState(0)

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

  // Mapa de atributos del diccionario corporativo y escalas del sistema: clave en minúscula -> { values, isColor }
  const dimensionValuesMap = useMemo(
    () => buildDimensionValuesMap(dimensionTemplates),
    [dimensionTemplates]
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

  const templateSummary = useMemo(
    () => (appliedTemplate ? describeTemplateLine(appliedTemplateLevels, dimensionValuesMap) : ''),
    [appliedTemplate, appliedTemplateLevels, dimensionValuesMap]
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

  // Ejes físicos por variante: terminal + escalas de talla/color, con agrupación de fotos resuelta
  const templateAllDimensions = useMemo(
    () => resolveTemplateDimensions(appliedTemplateLevels, dimensionValuesMap),
    [appliedTemplateLevels, dimensionValuesMap]
  )

  const usesMatrix =
    entryMode === 'template' && Boolean(appliedTemplate) && (templateAllDimensions?.length ?? 0) > 0

  const showProductGallery =
    entryMode !== 'template' ||
    !appliedTemplate ||
    photoChoice === 'model' ||
    (!usesMatrix && photoChoice !== 'none')

  const matrixPhotoScope =
    photoChoice === 'group' ? 'group' : photoChoice === 'variant' ? 'variant' : 'model'

  const modelFieldGroups = useMemo(() => {
    const groups: { key: string; title: string; fields: typeof modelAttributeFields }[] = []
    for (const field of modelAttributeFields) {
      const key = String(field.levelIndex)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.fields.push(field)
      else groups.push({ key, title: field.levelName || `Nivel ${field.levelIndex}`, fields: [field] })
    }
    return groups
  }, [modelAttributeFields])

  const selectEntry = useCallback((mode: EntryMode) => {
    setEntryMode(mode)
    setError(null)
    if (mode === 'service') {
      setKind(String(CatalogItemKind.Service))
      setSelectedTemplateId('')
      return
    }
    setKind(String(CatalogItemKind.Physical))
    if (mode === 'single') setSelectedTemplateId('')
  }, [])

  const handleApplyTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId)
    setCustomAttributes([])
    setKind(String(CatalogItemKind.Physical))
  }, [])

  useEffect(() => {
    if (!tenantId || !canCreate) return
    let cancelled = false
    void (async () => {
      try {
        const [catList, tplList, dimList, items] = await Promise.all([
          listCatalogCategories(tenantId),
          listProductTemplates(tenantId),
          listVariantDimensionTemplates(tenantId),
          listCatalogItems(tenantId, { onlyRoots: true }).catch(() => []),
        ])
        if (!cancelled) {
          setCategories(catList)
          setProductTemplates(tplList.filter((t) => t.isActive))
          setDimensionTemplates(dimList)
          setUsedVariants(items.reduce((sum, i) => sum + (i.variantCount ?? 0), 0))
        }
      } catch {
        if (!cancelled) {
          setCategories([])
          setProductTemplates([])
          setDimensionTemplates([])
          setUsedVariants(0)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canCreate, tenantId])

  const goToList = useCallback(() => {
    void navigate('/catalogo/items')
  }, [navigate])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'list',
        label: 'Listado de ítems',
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
      if (!tenantId) return
      setError(null)
      setBusy(true)
      try {
        const finalName = name.trim()
        if (!finalName) throw new Error('El nombre del producto es obligatorio.')
        if (entryMode === 'template' && !selectedTemplateId) {
          throw new Error('Elige una plantilla o cambia la forma de registro.')
        }
        const kindNum = Number(kind) as CatalogItemKind
        if (kindNum === CatalogItemKind.Physical && !usesMatrix && !sku.trim()) {
          throw new Error('El código es obligatorio para un producto físico.')
        }
        let price: number | null = null
        if (basePrice.trim()) {
          const parsed = Number(basePrice.replace(',', '.'))
          if (Number.isNaN(parsed) || parsed < 0) {
            throw new Error('El precio base no es válido.')
          }
          price = parsed
        }

        let targetItemId: string
        const familyId = selectedTemplateId || null
        const hierarchyPathJson = buildHierarchyPathJson(
          appliedTemplateLevels,
          customAttributes,
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
            description: description.trim() || null,
            modelCode: null,
            basePrice: price,
            categoryId: categoryId || null,
            variantDimensionsJson: matrixData.variantDimensionsJson,
            variants: matrixData.variants,
            customAttributesJson:
              customAttributes.length > 0 ? serializeCustomAttributes(customAttributes, []) : null,
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
          const created = await createCatalogItem(tenantId, {
            kind: kindNum,
            name: name.trim(),
            description: description.trim() || null,
            sku: sku.trim() || null,
            basePrice: price,
            categoryId: categoryId || null,
            customAttributesJson:
              customAttributes.length > 0 ? serializeCustomAttributes(customAttributes, []) : null,
            familyId,
            hierarchyPathJson,
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
          title: usesMatrix ? 'Producto creado' : 'Producto creado',
          message: usesMatrix
            ? `«${finalName}» quedó registrado con ${matrixData.variants.length} códigos.`
            : `«${finalName}» quedó registrado en el catálogo.`,
          variant: 'success',
        })
        void navigate('/catalogo/items', { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : readApiError(err, 'No se pudo crear el ítem.')
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
      basePrice,
      categoryId,
      customAttributes,
      description,
      dimensionValuesMap,
      entryMode,
      kind,
      matrixData,
      maxVariants,
      name,
      navigate,
      photoChoice,
      usesMatrix,
      remainingVariants,
      selectedTemplateId,
      sku,
      stagedImages,
      tenantId,
      toast,
    ]
  )

  if (!canCreate) {
    return (
      <TenantSessionGate title="Nuevo ítem" lead="Alta en el maestro de catálogo.">
        <div className="ecu-dashboard-layout">
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
    <TenantSessionGate title="Nuevo ítem" lead="Alta en el maestro de catálogo (sin stock).">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Nuevo producto"
          subtitle="Elige plantilla o producto simple; el formulario muestra solo lo necesario."
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
              <Button type="submit" form="create-catalog-item" variant="primary" loading={busy} disabled={busy}>
                <Save size={16} />
                <span>{uploadStatus || 'Guardar producto'}</span>
              </Button>
            </div>
          }
        />

        <form id="create-catalog-item" onSubmit={(e) => void onSubmit(e)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SectionCard title="Cómo lo registras">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {ENTRY_OPTIONS.map((option) => {
                const active = entryMode === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy}
                    onClick={() => selectEntry(option.id)}
                    style={{
                      textAlign: 'left',
                      borderRadius: '12px',
                      padding: '0.9rem 1rem',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      border: active
                        ? '1px solid color-mix(in srgb, var(--shell-primary, #2563eb) 55%, transparent)'
                        : '1px solid var(--shell-border, rgba(0,0,0,0.1))',
                      background: active
                        ? 'color-mix(in srgb, var(--shell-primary, #2563eb) 10%, var(--glb-surface, #fff))'
                        : 'var(--glb-surface, #fff)',
                      color: 'var(--glb-text)',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{option.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>{option.text}</div>
                  </button>
                )
              })}
            </div>
            {entryMode === 'template' && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {productTemplates.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--glb-muted)' }}>
                    Todavía no hay plantillas. Puedes crear una desde Plantillas de producto, o registrar este producto con un solo código.
                  </p>
                ) : (
                  <Select
                    id="ci-template"
                    label="Plantilla"
                    labelPosition="outlined"
                    variant="outline"
                    options={[
                      { value: '', label: 'Elige una plantilla' },
                      ...productTemplates.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                    value={selectedTemplateId}
                    onChange={handleApplyTemplate}
                    disabled={busy}
                    fullWidth
                  />
                )}
                {appliedTemplate && templateSummary ? (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--glb-text)' }}>{templateSummary}</p>
                ) : null}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Datos del producto">
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                  <TextBox
                    id="ci-name"
                    label="Nombre"
                    labelPosition="outlined"
                    variant="outline"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder={
                      entryMode === 'service'
                        ? 'Ej. Asesoría contable mensual'
                        : 'Ej. Calcetín running, Filtro de aceite'
                    }
                    required
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field">
                  <Select
                    id="ci-cat"
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
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="ci-price"
                    label="Precio base"
                    labelPosition="outlined"
                    variant="outline"
                    value={basePrice}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBasePrice(e.target.value)}
                    placeholder="0.00"
                    disabled={busy}
                    fullWidth
                  />
                </div>
                {!usesMatrix && (
                  <div className="ecu-companies-form__field">
                    <TextBox
                      id="ci-sku"
                      label={entryMode === 'service' ? 'Código (opcional)' : 'Código'}
                      labelPosition="outlined"
                      variant="outline"
                      value={sku}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setSku(e.target.value.toUpperCase())
                      }
                      placeholder="PROD-001"
                      required={entryMode !== 'service'}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                )}
                <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
                  <TextBox
                    id="ci-desc"
                    label="Descripción"
                    labelPosition="outlined"
                    variant="outline"
                    value={description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                    placeholder="Lo que verá quien compra o factura este producto"
                    disabled={busy}
                    fullWidth
                  />
                </div>
              </div>
          </SectionCard>

          {entryMode === 'template' &&
            appliedTemplate &&
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
                  disabled={busy}
                  bare
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
                {remainingVariants != null && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.625rem 0.875rem',
                      marginBottom: '1rem',
                      borderRadius: '0.625rem',
                      border:
                        matrixData.variants.length > remainingVariants
                          ? '1px solid color-mix(in srgb, #ef4444 35%, transparent)'
                          : '1px solid var(--shell-border, rgba(148, 163, 184, 0.25))',
                      backgroundColor:
                        matrixData.variants.length > remainingVariants
                          ? 'color-mix(in srgb, #ef4444 8%, var(--glb-surface, transparent))'
                          : 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
                      fontSize: '0.82rem',
                    }}
                  >
                    <Layers size={16} style={{ flexShrink: 0, color: 'var(--glb-muted, #64748b)' }} />
                    <span>
                      Variantes de tu plan: <strong>{remainingVariants}</strong> disponibles de {maxVariants}.
                      {matrixData.variants.length > remainingVariants &&
                        ` Has configurado ${matrixData.variants.length} y supera lo disponible.`}
                    </span>
                  </div>
                )}
                <VariantMatrixBuilder
                  key={selectedTemplateId}
                  tenantId={tenantId}
                  baseName={name}
                  basePrice={basePrice}
                  disabled={busy}
                  onChange={setMatrixData}
                  availableImages={stagedImages}
                  initialDimensions={templateAllDimensions}
                  photoScope={matrixPhotoScope}
                  variantAttributeFields={variantAttributeFields}
                  dimensionValuesMap={dimensionValuesMap}
                  embedded
                />
              </SectionCard>
          )}

          <div
            className="ecu-companies-form__actions"
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}
          >
            <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </TenantSessionGate>
  )
}

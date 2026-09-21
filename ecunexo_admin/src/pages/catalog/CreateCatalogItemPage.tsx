import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import { Layers } from 'lucide-react'
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
} from '@/pages/catalog/VariantMatrixBuilder'
import {
  buildDimensionValuesMap,
  buildHierarchyPathJson,
  getModelAttributeFields,
  getVariantDimensionFields,
  isColorDimension,
} from '@/lib/catalogArchetype'
import { ArchetypeModelFields } from '@/pages/catalog/ArchetypeModelFields'

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
  const [kind, setKind] = useState(String(CatalogItemKind.Physical))
  const hasVariants = kind === String(CatalogItemKind.Physical)
  const [matrixData, setMatrixData] = useState<{
    variants: MatrixVariantPayloadWithImage[]
    variantDimensionsJson: string
    dimensionNames: string[]
    isValid: boolean
  }>({
    variants: [],
    variantDimensionsJson: '',
    dimensionNames: [],
    isValid: false,
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

  const modelAttributeFields = useMemo(
    () => getModelAttributeFields(appliedTemplateLevels),
    [appliedTemplateLevels]
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

  // Ejes físicos por variante: nivel terminal + atributos de color de niveles intermedios
  const templateAllDimensions = useMemo(() => {
    if (appliedTemplateLevels.length === 0) return undefined
    const dims: { name: string; values?: string[]; isColor?: boolean }[] = []
    const seen = new Set<string>()

    const push = (rawName: string) => {
      const clean = rawName.trim()
      const lower = clean.toLowerCase()
      if (
        !clean ||
        lower === 'tags' ||
        lower === 'tag' ||
        lower.includes('actividad') ||
        lower.includes('variante') ||
        lower.includes('física')
      ) {
        return
      }
      if (seen.has(lower)) return
      seen.add(lower)

      const found =
        dimensionValuesMap.get(lower) ||
        (lower.includes('talla') ? dimensionValuesMap.get('talla') : undefined) ||
        (lower.includes('color') ? dimensionValuesMap.get('color') : undefined)

      dims.push({
        name: clean,
        values: found?.values,
        isColor: found?.isColor || isColorDimension(clean),
      })
    }

    getVariantDimensionFields(appliedTemplateLevels).forEach((field) => push(field.key))

    if (appliedTemplateLevels.some((lvl) => lvl.hasColor) && !dims.some((d) => d.isColor)) {
      const colorFound = dimensionValuesMap.get('color') || dimensionValuesMap.get('colores')
      dims.push({
        name: 'Color',
        values: colorFound?.values || ['Negro', 'Blanco', 'Azul'],
        isColor: true,
      })
    }

    if (dims.length === 0) {
      const sizeFound = dimensionValuesMap.get('talla') || dimensionValuesMap.get('tallas')
      dims.push({
        name: 'Talla',
        values: sizeFound?.values || ['35-38', '39-41', '42-44'],
        isColor: false,
      })
    }

    return dims
  }, [appliedTemplateLevels, dimensionValuesMap])

  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId)
      if (!templateId) {
        return
      }
      const tpl = productTemplates.find((t) => t.id === templateId)
      if (!tpl) return

      setName(tpl.name)
      setDescription(tpl.description || '')
      setBasePrice('')
      setCategoryId('')

      let parsedLevels: ProductTemplateLevel[] = []
      try {
        parsedLevels = JSON.parse(tpl.hierarchyTreeJson)
      } catch {
        parsedLevels = []
      }

      setKind(String(CatalogItemKind.Physical))

      const upperAttrs: string[] = []
      parsedLevels.slice(0, parsedLevels.length - 1).forEach((l) => {
        if (l.attributes && l.attributes.length > 0) {
          l.attributes.forEach((attr) => {
            const lower = attr.trim().toLowerCase()
            if (lower !== 'talla' && lower !== 'tallas' && lower !== 'color' && lower !== 'colores') {
              if (!upperAttrs.includes(attr.trim())) upperAttrs.push(attr.trim())
            }
          })
        } else {
          const lower = l.name.trim().toLowerCase()
          if (lower !== 'talla' && lower !== 'tallas' && lower !== 'color' && lower !== 'colores') {
            if (!upperAttrs.includes(l.name.trim())) upperAttrs.push(l.name.trim())
          }
        }
      })

      if (upperAttrs.length > 0) {
        setCustomAttributes((prev) => {
          const existingKeys = new Set(prev.map((r) => r.key.toLowerCase()))
          const newRows: CustomAttributeRow[] = [...prev]
          upperAttrs.forEach((attr) => {
            if (!existingKeys.has(attr.toLowerCase())) {
              newRows.push({
                id: `attr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                key: attr,
                value: '',
              })
            }
          })
          return newRows
        })
      }

      toast.show({
        title: 'Plantilla aplicada',
        message: `Se ha cargado la jerarquía y estructura de «${tpl.name}».`,
        variant: 'success',
      })
    },
    [productTemplates, toast]
  )

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
        const finalName = name.trim() || appliedTemplate?.name || ''
        if (!finalName) throw new Error('El nombre del ítem es obligatorio.')
        const kindNum = Number(kind) as CatalogItemKind
        if (kindNum === CatalogItemKind.Physical && !hasVariants && !sku.trim()) {
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

        let targetItemId: string
        const familyId = selectedTemplateId || null
        const hierarchyPathJson = buildHierarchyPathJson(appliedTemplateLevels, customAttributes)

        if (hasVariants && kindNum === CatalogItemKind.Physical) {
          if (!matrixData.isValid || matrixData.variants.length === 0) {
            throw new Error('Debes configurar al menos una variante con SKU.')
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
                } catch (imgErr) {
                  console.error('Error al subir imagen de variante', imgErr)
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
          title: hasVariants ? 'Producto matriz creado' : 'Ítem creado',
          message: hasVariants
            ? `«${name.trim()}» con ${matrixData.variants.length} variantes físicas quedó registrado en el catálogo.`
            : `«${name.trim()}» quedó registrado en el catálogo.`,
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
      hasVariants,
      kind,
      matrixData,
      maxVariants,
      name,
      navigate,
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
          title="Nuevo Ítem"
          subtitle="Registra un producto físico o servicio intangible. Los productos físicos requieren código SKU para su control en inventario."
          badge={
            <StatusBadge tone="primary" withDot>
              Alta de Ítem
            </StatusBadge>
          }
          actions={
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Acciones de nuevo ítem"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          }
        />

        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <SectionCard
            title="Información Comercial del Ítem"
            subtitle="Configura la clasificación comercial, identificación técnica y atributos de molde de categoría"
          >
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            {/* Template Arquetipo Selector */}
            {productTemplates.length > 0 && (
              <div
                style={{
                  marginBottom: '1.25rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--shell-surface-subtle, rgba(255,255,255,0.03))',
                  border: '1px solid var(--shell-border, rgba(255,255,255,0.08))',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 320px' }}>
                  <Layers size={20} color="var(--shell-primary, #3b82f6)" />
                  <div style={{ flex: 1, maxWidth: '380px' }}>
                    <Select
                      id="ci-template"
                      label="Cargar estructura desde Plantilla"
                      labelPosition="outlined"
                      variant="outline"
                      options={[
                        { value: '', label: 'Sin plantilla (creación manual libre)' },
                        ...productTemplates.map((t) => ({ value: t.id, label: t.name })),
                      ]}
                      value={selectedTemplateId}
                      onChange={handleApplyTemplate}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                </div>

                {appliedTemplate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
                      Jerarquía activa:
                    </span>
                    {appliedTemplateLevels.map((lvl, idx) => (
                      <span
                        key={lvl.id || idx}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: 'var(--shell-primary, #60a5fa)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          fontWeight: 500,
                        }}
                      >
                        N{idx + 1}: {lvl.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {appliedTemplate ? (
              /* MODO CON PLANTILLA: atributos del modelo en el padre y ejes físicos en cada tarjeta de variante */
              <>
                <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'var(--glb-surface-variant, rgba(0,0,0,0.02))', borderRadius: '8px', border: '1px solid var(--glb-border, #e2e8f0)', fontSize: '0.85rem', color: 'var(--glb-muted)' }}>
                  Arquetipo: <strong style={{ color: 'var(--glb-text)' }}>{appliedTemplate.name}</strong>. Completa los atributos del modelo y selecciona las variaciones físicas ({templateAllDimensions?.map((d) => d.name).join(', ') || 'atributos'}) dentro de cada tarjeta de variante.
                </div>
                <ArchetypeModelFields
                  fields={modelAttributeFields}
                  values={customAttributes}
                  dimensionValuesMap={dimensionValuesMap}
                  onChangeValue={setAttributeValue}
                  disabled={busy}
                />
              </>
            ) : (
              /* MODO MANUAL LIBRE (SIN PLANTILLA) */
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field">
                  <Select
                    id="ci-kind"
                    label="Tipo de ítem"
                    labelPosition="outlined"
                    variant="outline"
                    options={[
                      { value: String(CatalogItemKind.Service), label: 'Servicio (intangible)' },
                      { value: String(CatalogItemKind.Physical), label: 'Físico (con inventario)' },
                    ]}
                    value={kind}
                    onChange={setKind}
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
                    id="ci-name"
                    label="Nombre del producto o servicio"
                    labelPosition="outlined"
                    variant="outline"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder={
                      kind === String(CatalogItemKind.Physical)
                        ? 'Ej. Camiseta Deportiva, Monitor 27", Zapatos de Seguridad'
                        : 'Ej. Consultoría, Soporte Técnico Mensual'
                    }
                    required
                    disabled={busy}
                    fullWidth
                  />
                </div>
                {!hasVariants && (
                  <div className="ecu-companies-form__field">
                    <TextBox
                      id="ci-sku"
                      label={
                        kind === String(CatalogItemKind.Physical)
                          ? 'Código SKU (obligatorio)'
                          : 'Código SKU (opcional)'
                      }
                      labelPosition="outlined"
                      variant="outline"
                      value={sku}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setSku(e.target.value.toUpperCase())
                      }
                      placeholder="PROD-001"
                      required={kind === String(CatalogItemKind.Physical)}
                      disabled={busy}
                      fullWidth
                    />
                  </div>
                )}
                <div className="ecu-companies-form__field">
                  <TextBox
                    id="ci-price"
                    label={hasVariants ? 'Precio base referencial' : 'Precio base de venta'}
                    labelPosition="outlined"
                    variant="outline"
                    value={basePrice}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBasePrice(e.target.value)}
                    placeholder="0.00"
                    disabled={busy}
                    fullWidth
                  />
                </div>
                <div className="ecu-companies-form__field ecu-companies-form__field--span-3">
                  <TextBox
                    id="ci-desc"
                    label="Descripción comercial o especificaciones"
                    labelPosition="outlined"
                    variant="outline"
                    value={description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                    placeholder="Detalles y características para facturación y reportes…"
                    disabled={busy}
                    fullWidth
                  />
                </div>
              </div>
            )}
          </SectionCard>

          {/* Fotografías del Producto (Únicamente cuando NO tiene variantes físicas) */}
          {!hasVariants && (
            <div style={{ marginTop: '1.25rem' }}>
              <SectionCard
                title="Fotografías del Producto"
                subtitle="Anexa hasta 8 imágenes para este producto."
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
            </div>
          )}

          {/* Variantes Físicas Dimensionales (Al final del formulario) */}
          {kind === String(CatalogItemKind.Physical) && (
            <div style={{ marginTop: '1.25rem' }}>
              <SectionCard
                title="Variantes Físicas de Inventario"
                subtitle="Configura las variantes físicas con sus tallas, colores, códigos SKU y fotografías independientes."
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
                  tenantId={tenantId}
                  baseName={name}
                  basePrice={basePrice}
                  disabled={busy}
                  onChange={setMatrixData}
                  availableImages={stagedImages}
                  initialDimensions={templateAllDimensions}
                />
              </SectionCard>
            </div>
          )}

          <SectionCard>
            <div
              className="ecu-companies-form__actions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                {uploadStatus || (hasVariants ? 'Guardar con Variantes' : 'Guardar Ítem')}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={goToList}>
                Cancelar
              </Button>
            </div>
          </SectionCard>
        </form>
      </div>
    </TenantSessionGate>
  )
}

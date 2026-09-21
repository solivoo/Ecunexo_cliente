import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import { Layers } from 'lucide-react'
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
import { parseAttributeSchema } from '@/lib/catalogAttributes'
import {
  ItemCustomAttributesEditor,
  serializeCustomAttributes,
  type CustomAttributeRow,
} from '@/pages/catalog/ItemCustomAttributesEditor'
import { StagedCatalogItemImages, type StagedItemImage } from '@/pages/catalog/StagedCatalogItemImages'
import { readApiError } from '@/lib/readApiError'
import {
  createCatalogItem,
  createCatalogItemMatrix,
  listCatalogCategories,
  listProductTemplates,
  listVariantDimensionTemplates,
  uploadCatalogItemImage,
} from '@/services/catalogApi'
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
  isColorDimension,
  type MatrixVariantPayloadWithImage,
} from '@/pages/catalog/VariantMatrixBuilder'

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
  const [hasVariants, setHasVariants] = useState(false)
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
  const [tags, setTags] = useState<string[]>([])
  const [stagedImages, setStagedImages] = useState<StagedItemImage[]>([])

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

  const categorySuggestions = useMemo<string[]>(() => {
    const category = categories.find((c) => c.id === categoryId)
    return parseAttributeSchema(category?.attributeSchemaJson).map((f) => f.label || f.key)
  }, [categories, categoryId])

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

  // Mapa de atributos del diccionario corporativo: clave en minúscula -> { values, isColor }
  const dimensionValuesMap = useMemo(() => {
    const map = new Map<string, { values: string[]; isColor: boolean }>()
    dimensionTemplates.forEach((t) => {
      try {
        const parsed = JSON.parse(t.predefinedValuesJson)
        if (Array.isArray(parsed)) {
          map.set(t.name.trim().toLowerCase(), {
            values: parsed.map(String),
            isColor: (t.dimensionType || '').toLowerCase() === 'color' || isColorDimension(t.name),
          })
        }
      } catch {
        // ignorar
      }
    })
    return map
  }, [dimensionTemplates])

  const getAttributeValue = useCallback(
    (key: string): string => {
      const row = customAttributes.find((r) => r.key.toLowerCase() === key.toLowerCase())
      return row?.value || ''
    },
    [customAttributes]
  )

  const setAttributeValue = useCallback((key: string, value: string) => {
    setCustomAttributes((prev) => {
      const exists = prev.some((r) => r.key.toLowerCase() === key.toLowerCase())
      if (exists) {
        return prev.map((r) => (r.key.toLowerCase() === key.toLowerCase() ? { ...r, value } : r))
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

  const templateTerminalDimensions = useMemo(() => {
    if (appliedTemplateLevels.length === 0) return undefined
    const terminalLevel = appliedTemplateLevels[appliedTemplateLevels.length - 1]
    if (!terminalLevel) return undefined

    const dims: { name: string; values?: string[]; isColor?: boolean }[] = []
    terminalLevel.attributes.forEach((attr) => {
      const found = dimensionValuesMap.get(attr.trim().toLowerCase())
      dims.push({
        name: attr,
        values: found?.values,
        isColor: found?.isColor || isColorDimension(attr),
      })
    })

    if (terminalLevel.hasColor && !dims.some((d) => d.isColor || isColorDimension(d.name))) {
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
        setHasVariants(false)
        return
      }
      const tpl = productTemplates.find((t) => t.id === templateId)
      if (!tpl) return

      let parsedLevels: ProductTemplateLevel[] = []
      try {
        parsedLevels = JSON.parse(tpl.hierarchyTreeJson)
      } catch {
        parsedLevels = []
      }

      setKind(String(CatalogItemKind.Physical))

      const terminalLevel = parsedLevels[parsedLevels.length - 1]
      const hasTerminalVariants =
        parsedLevels.length > 1 ||
        (terminalLevel && (terminalLevel.hasColor || terminalLevel.hasImages || terminalLevel.attributes.length > 0))

      setHasVariants(!!hasTerminalVariants)

      const upperAttrs: string[] = []
      parsedLevels.slice(0, parsedLevels.length - 1).forEach((l) => {
        l.attributes.forEach((attr) => {
          if (!upperAttrs.includes(attr)) upperAttrs.push(attr)
        })
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
        const [catList, tplList, dimList] = await Promise.all([
          listCatalogCategories(tenantId),
          listProductTemplates(tenantId),
          listVariantDimensionTemplates(tenantId),
        ])
        if (!cancelled) {
          setCategories(catList)
          setProductTemplates(tplList.filter((t) => t.isActive))
          setDimensionTemplates(dimList)
        }
      } catch {
        if (!cancelled) {
          setCategories([])
          setProductTemplates([])
          setDimensionTemplates([])
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
        if (!name.trim()) throw new Error('El nombre del ítem es obligatorio.')
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

        if (hasVariants && kindNum === CatalogItemKind.Physical) {
          if (!matrixData.isValid || matrixData.variants.length === 0) {
            throw new Error('Debes configurar al menos una variante con SKU.')
          }

          const createdMatrix = await createCatalogItemMatrix(tenantId, {
            kind: kindNum,
            name: name.trim(),
            description: description.trim() || null,
            modelCode: null,
            basePrice: price,
            categoryId: categoryId || null,
            variantDimensionsJson: matrixData.variantDimensionsJson,
            variants: matrixData.variants,
            customAttributesJson: serializeCustomAttributes(customAttributes, tags),
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
            customAttributesJson: serializeCustomAttributes(customAttributes, tags),
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
      basePrice,
      categoryId,
      customAttributes,
      description,
      hasVariants,
      kind,
      matrixData,
      name,
      navigate,
      sku,
      stagedImages,
      tags,
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
          </SectionCard>

          {/* Modo Jerárquico con Plantilla: Desglose Nivel por Nivel */}
          {appliedTemplateLevels.length > 0 ? (
            <>
              {/* Niveles Superiores del Producto (Familia, Modelo/Estilo) */}
              {appliedTemplateLevels.slice(0, appliedTemplateLevels.length - 1).map((lvl, idx) => (
                <div key={lvl.id || idx} style={{ marginTop: '1.25rem' }}>
                  <SectionCard
                    title={`Nivel ${idx + 1}: ${lvl.name}`}
                    subtitle={`Especificaciones y atributos correspondientes a este nivel en la jerarquía del producto`}
                  >
                    {lvl.attributes.length > 0 ? (
                      <div
                        className="ecu-companies-form__grid ecu-companies-form__grid--3"
                        style={{ marginBottom: lvl.hasImages ? '1.25rem' : '0' }}
                      >
                        {lvl.attributes.map((attr) => {
                          const found = dimensionValuesMap.get(attr.trim().toLowerCase())
                          const hasOptions = found && found.values.length > 0
                          return (
                            <div key={attr} className="ecu-companies-form__field">
                              {hasOptions ? (
                                <Select
                                  id={`attr-${lvl.id}-${attr}`}
                                  label={attr}
                                  labelPosition="outlined"
                                  variant="outline"
                                  options={[
                                    { value: '', label: `Seleccionar ${attr}...` },
                                    ...found.values.map((v) => ({ value: v, label: v })),
                                  ]}
                                  value={getAttributeValue(attr)}
                                  onChange={(val: string) => setAttributeValue(attr, val)}
                                  disabled={busy}
                                  fullWidth
                                />
                              ) : (
                                <TextBox
                                  id={`attr-${lvl.id}-${attr}`}
                                  label={attr}
                                  labelPosition="outlined"
                                  variant="outline"
                                  value={getAttributeValue(attr)}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    setAttributeValue(attr, e.target.value)
                                  }
                                  placeholder={`Ingresar ${attr.toLowerCase()}...`}
                                  disabled={busy}
                                  fullWidth
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}

                    {/* Fotografías específicas de este nivel si hasImages está habilitado */}
                    {lvl.hasImages && (
                      <div style={{ marginTop: lvl.attributes.length > 0 ? '1rem' : '0' }}>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'var(--glb-text)',
                            marginBottom: '0.5rem',
                          }}
                        >
                          Fotografías del {lvl.name} (Vitrina / Presentación):
                        </div>
                        <StagedCatalogItemImages
                          stagedImages={stagedImages}
                          onStagedImagesChange={setStagedImages}
                          disabled={busy}
                          uploading={busy && uploadStatus !== null}
                          uploadStatus={uploadStatus}
                          hideBanner={true}
                        />
                      </div>
                    )}
                  </SectionCard>
                </div>
              ))}

              {/* Etiquetas Jerárquicas del Producto */}
              <div style={{ marginTop: '1.25rem' }}>
                <SectionCard
                  title="Etiquetas Jerárquicas del Producto (Tags)"
                  subtitle="Indexación para Punto de Venta (POS) y tienda online. Se heredan automáticamente a todas las variantes."
                >
                  <EcuTagInput
                    tags={tags}
                    onChange={setTags}
                    label="Etiquetas del Ítem"
                    placeholder="Añadir etiqueta (ej. Deportivo, Algodón, Temporada 2026)..."
                    suggestedTags={suggestedTags}
                    disabled={busy}
                  />
                </SectionCard>
              </div>

              {/* Nivel Terminal: Variaciones Físicas (Al final del formulario) */}
              {hasVariants && (
                <div style={{ marginTop: '1.25rem' }}>
                  <SectionCard
                    title={`Nivel ${appliedTemplateLevels.length}: ${
                      appliedTemplateLevels[appliedTemplateLevels.length - 1]?.name || 'Variantes Físicas'
                    }`}
                    subtitle="Genera las combinaciones finales por cada variante física (SKU, código de barras, fotos por color y stock)"
                  >
                    <VariantMatrixBuilder
                      tenantId={tenantId}
                      baseName={name}
                      baseSku={sku}
                      basePrice={basePrice}
                      parentTags={tags}
                      disabled={busy}
                      onChange={setMatrixData}
                      availableImages={stagedImages}
                      initialDimensions={templateTerminalDimensions}
                    />
                  </SectionCard>
                </div>
              )}
            </>
          ) : (
            /* Modo Libre Sin Plantilla */
            <>
              {/* Especificaciones y Atributos Técnicos */}
              <div style={{ marginTop: '1.25rem' }}>
                <SectionCard
                  title="Especificaciones y Atributos Adicionales"
                  subtitle="Define propiedades técnicas, comerciales o informativas propias de este producto (ej. Material, Marca, Garantía, Procedencia, etc.)."
                >
                  <div style={{ marginBottom: '1.5rem' }}>
                    <EcuTagInput
                      tags={tags}
                      onChange={setTags}
                      label="Etiquetas Jerárquicas del Producto (Tags)"
                      placeholder="Añadir etiqueta (ej. Deportivo, Premium, Temporada 2026)..."
                      helperText="Estas etiquetas indexan el producto para búsquedas en Punto de Venta (POS), tienda online y se heredan automáticamente a todas las variantes físicas."
                      suggestedTags={suggestedTags}
                      disabled={busy}
                    />
                  </div>

                  <ItemCustomAttributesEditor
                    attributes={customAttributes}
                    onChange={setCustomAttributes}
                    categorySuggestions={categorySuggestions}
                    disabled={busy}
                  />
                </SectionCard>
              </div>

              {/* Fotografías del Producto */}
              <div style={{ marginTop: '1.25rem' }}>
                <SectionCard
                  title="Fotografías del Producto"
                  subtitle="Anexa hasta 8 imágenes para el catálogo y vitrina virtual."
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

              {/* Variantes Físicas Dimensionales (Al final del formulario) */}
              {kind === String(CatalogItemKind.Physical) && (
                <div style={{ marginTop: '1.25rem' }}>
                  <SectionCard
                    title="Variantes Físicas"
                    subtitle="Activa esta opción si el producto tiene variantes (tallas, colores, fotos individuales, etc.) con stock independiente"
                    action={
                      <label
                        htmlFor="ci-has-variants"
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--shell-primary, #4f46e5)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          background: 'rgba(79, 70, 229, 0.08)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          id="ci-has-variants"
                          type="checkbox"
                          checked={hasVariants}
                          onChange={(e) => setHasVariants(e.target.checked)}
                          disabled={busy}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                        <span>¿Tiene variantes (tallas, colores, etc.)?</span>
                      </label>
                    }
                  >
                    {hasVariants ? (
                      <VariantMatrixBuilder
                        tenantId={tenantId}
                        baseName={name}
                        baseSku={sku}
                        basePrice={basePrice}
                        parentTags={tags}
                        disabled={busy}
                        onChange={setMatrixData}
                        availableImages={stagedImages}
                      />
                    ) : (
                      <p className="app-shell__muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                        Producto simple estándar (un solo ítem con su propio SKU directo). Si este producto
                        tiene múltiples variantes (tallas, colores, fotos individuales),
                        marca la casilla superior <strong>«¿Tiene variantes (tallas, colores, etc.)?»</strong>.
                      </p>
                    )}
                  </SectionCard>
                </div>
              )}
            </>
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

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
  uploadCatalogItemImage,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CatalogItemKind,
  type CategoryListItemDto,
  type ProductTemplateDto,
  type ProductTemplateLevel,
} from '@/types/catalogApi'
import {
  VariantMatrixBuilder,
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
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [kind, setKind] = useState(String(CatalogItemKind.Service))
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

  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId)
      if (!templateId) return
      const tpl = productTemplates.find((t) => t.id === templateId)
      if (!tpl) return

      let parsedLevels: ProductTemplateLevel[] = []
      try {
        parsedLevels = JSON.parse(tpl.hierarchyTreeJson)
      } catch {
        parsedLevels = []
      }

      if (parsedLevels.some((l) => l.hasColor || l.hasImages || l.attributes.length > 0)) {
        setKind(String(CatalogItemKind.Physical))
      }

      const terminalLevel = parsedLevels[parsedLevels.length - 1]
      if (
        terminalLevel &&
        (terminalLevel.hasColor || terminalLevel.hasImages || terminalLevel.attributes.length > 0)
      ) {
        setHasVariants(true)
      }

      const macroAttributes: string[] = []
      parsedLevels.forEach((l) => {
        l.attributes.forEach((attr) => {
          if (!macroAttributes.includes(attr)) macroAttributes.push(attr)
        })
      })

      if (macroAttributes.length > 0) {
        setCustomAttributes((prev) => {
          const existingKeys = new Set(prev.map((r) => r.key.toLowerCase()))
          const newRows: CustomAttributeRow[] = [...prev]
          macroAttributes.forEach((attr) => {
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
        message: `Se ha cargado la jerarquía y atributos de «${tpl.name}».`,
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
        const [catList, tplList] = await Promise.all([
          listCatalogCategories(tenantId),
          listProductTemplates(tenantId),
        ])
        if (!cancelled) {
          setCategories(catList)
          setProductTemplates(tplList.filter((t) => t.isActive))
        }
      } catch {
        if (!cancelled) {
          setCategories([])
          setProductTemplates([])
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
        id: 'categories',
        label: 'Categorías',
        icon: 'folder-tree',
        route: '/catalogo/categorias',
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
            modelCode: sku.trim() || null,
            basePrice: price,
            categoryId: categoryId || null,
            variantDimensionsJson: matrixData.variantDimensionsJson,
            variants: matrixData.variants,
            customAttributesJson: serializeCustomAttributes(customAttributes),
          })

          targetItemId = createdMatrix.parentItemId

          // Subir fotos específicas por cada variante física si fueron seleccionadas
          if (createdMatrix.variantItemIds && createdMatrix.variantItemIds.length > 0) {
            for (let i = 0; i < matrixData.variants.length; i++) {
              const v = matrixData.variants[i]
              const variantItemId = createdMatrix.variantItemIds[i]
              if (v.stagedImage && variantItemId) {
                setUploadStatus(`Subiendo imagen de variante «${v.variantTitle}»...`)
                try {
                  await uploadCatalogItemImage(
                    tenantId,
                    variantItemId,
                    v.stagedImage,
                    v.variantTitle,
                    true
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
            customAttributesJson: serializeCustomAttributes(customAttributes),
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
                      ? 'Ej. Calcetines Antideslizantes, Camiseta Deportiva'
                      : 'Ej. Consultoría, Soporte Técnico Mensual'
                  }
                  required
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="ci-sku"
                  label={
                    hasVariants
                      ? 'Código Modelo / Prefijo SKU (ej. CALC-001)'
                      : kind === String(CatalogItemKind.Physical)
                        ? 'Código SKU (obligatorio)'
                        : 'Código SKU (opcional)'
                  }
                  labelPosition="outlined"
                  variant="outline"
                  value={sku}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setSku(e.target.value.toUpperCase())
                  }
                  placeholder={hasVariants ? 'Ej. AND-001 o CALC-DEP' : 'PROD-001'}
                  required={!hasVariants && kind === String(CatalogItemKind.Physical)}
                  disabled={busy}
                  fullWidth
                />
              </div>
              <div className="ecu-companies-form__field">
                <TextBox
                  id="ci-price"
                  label="Precio base de venta"
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

          <div style={{ marginTop: '1.25rem' }}>
            <SectionCard
              title="Especificaciones y Atributos Adicionales"
              subtitle="Define propiedades técnicas, comerciales o informativas propias de este producto (ej. Material, Marca, Garantía, Procedencia, etc.)."
            >
              <ItemCustomAttributesEditor
                attributes={customAttributes}
                onChange={setCustomAttributes}
                categorySuggestions={categorySuggestions}
                disabled={busy}
              />
            </SectionCard>
          </div>

          {kind === String(CatalogItemKind.Physical) && (
            <div style={{ marginTop: '1.25rem' }}>
              <SectionCard
                title="Variantes"
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
                    disabled={busy}
                    onChange={setMatrixData}
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

          <div style={{ marginTop: '1.25rem' }}>
            <SectionCard
              title="Fotografías del Ítem (Opcional)"
              subtitle="Anexa hasta 8 imágenes para catálogo y vitrina online. Se optimizarán a WebP automáticamente al guardar"
            >
              <StagedCatalogItemImages
                stagedImages={stagedImages}
                onStagedImagesChange={setStagedImages}
                disabled={busy}
                uploading={busy && uploadStatus !== null}
                uploadStatus={uploadStatus}
              />
            </SectionCard>
          </div>

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

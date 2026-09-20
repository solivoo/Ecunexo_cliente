import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast, type PageActionItem } from 'glubox'
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
  missingRequiredAttributeLabel,
  parseAttributeSchema,
  serializeAttributeValues,
} from '@/lib/catalogAttributes'
import { CatalogExtraAttributeFields } from '@/pages/catalog/CatalogExtraAttributeFields'
import { StagedCatalogItemImages, type StagedItemImage } from '@/pages/catalog/StagedCatalogItemImages'
import { readApiError } from '@/lib/readApiError'
import {
  createCatalogItem,
  createCatalogItemMatrix,
  listCatalogCategories,
  uploadCatalogItemImage,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  CatalogItemKind,
  type CatalogAttributeField,
  type CategoryListItemDto,
  type CreateVariantChildPayload,
} from '@/types/catalogApi'
import { VariantMatrixBuilder } from '@/pages/catalog/VariantMatrixBuilder'

export function CreateCatalogItemPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canCreate = useHasPermission('catalog.item.create')

  const [busy, setBusy] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryListItemDto[]>([])
  const [kind, setKind] = useState(String(CatalogItemKind.Service))
  const [hasVariants, setHasVariants] = useState(false)
  const [matrixData, setMatrixData] = useState<{
    variants: CreateVariantChildPayload[]
    variantDimensionsJson: string
    isValid: boolean
  }>({
    variants: [],
    variantDimensionsJson: '',
    isValid: false,
  })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sku, setSku] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [attrValues, setAttrValues] = useState<Record<string, string>>({})
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

  const schemaFields = useMemo<CatalogAttributeField[]>(() => {
    const category = categories.find((c) => c.id === categoryId)
    return parseAttributeSchema(category?.attributeSchemaJson)
  }, [categories, categoryId])

  useEffect(() => {
    if (!tenantId || !canCreate) return
    let cancelled = false
    void (async () => {
      try {
        const list = await listCatalogCategories(tenantId)
        if (!cancelled) setCategories(list)
      } catch {
        if (!cancelled) setCategories([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canCreate, tenantId])

  useEffect(() => {
    setAttrValues({})
  }, [categoryId])

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
        const missingAttr = missingRequiredAttributeLabel(schemaFields, attrValues)
        if (missingAttr) {
          throw new Error(`Completa el campo obligatorio «${missingAttr}».`)
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
            throw new Error('Debes configurar al menos una variante con SKU para el producto matriz.')
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
          })

          targetItemId = createdMatrix.parentItemId
        } else {
          const created = await createCatalogItem(tenantId, {
            kind: kindNum,
            name: name.trim(),
            description: description.trim() || null,
            sku: sku.trim() || null,
            basePrice: price,
            categoryId: categoryId || null,
            customAttributesJson: serializeAttributeValues(schemaFields, attrValues),
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
            } catch (uploadErr) {
              console.error('Error al subir imagen', uploadErr)
              toast.show({
                variant: 'warning',
                title: 'Aviso de imagen',
                message: `No se pudo anexar «${img.file.name}». Puedes subirla editando el ítem.`,
              })
            }
          }

          toast.show({
            title: hasVariants ? 'Producto Matriz creado con imágenes' : 'Ítem creado con imágenes',
            message: `«${name.trim()}» se registró con ${uploadedCount} ${
              uploadedCount === 1 ? 'fotografía' : 'fotografías'
            }${hasVariants ? ` y ${matrixData.variants.length} variantes.` : '.'}`,
            variant: 'success',
          })
        } else {
          toast.show({
            title: hasVariants ? 'Producto Matriz creado' : 'Ítem creado',
            message: hasVariants
              ? `«${name.trim()}» se registró con ${matrixData.variants.length} variantes físicas.`
              : `«${name.trim()}» ya está en el catálogo.`,
            variant: 'success',
          })
        }

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
      attrValues,
      basePrice,
      categoryId,
      description,
      hasVariants,
      kind,
      matrixData,
      name,
      navigate,
      schemaFields,
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
                  placeholder="Ej. Soporte Técnico Mensual"
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
                  placeholder={hasVariants ? 'CALC-DEP' : 'PROD-001'}
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
              <CatalogExtraAttributeFields
                idPrefix="ci"
                fields={schemaFields}
                values={attrValues}
                disabled={busy}
                onChange={(key, next) => setAttrValues((prev) => ({ ...prev, [key]: next }))}
              />
            </div>
          </SectionCard>

          {kind === String(CatalogItemKind.Physical) && (
            <div style={{ marginTop: '1.25rem' }}>
              <SectionCard
                title="Variantes y Tallas (Producto Matriz)"
                subtitle="Activa esta opción si el producto tiene tallas (ej. 35-38, M, 38), colores o combinaciones múltiples con stock independiente"
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
                    <span>¿Tiene tallas o colores?</span>
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
                    es una prenda, calzado, medias u otro artículo con múltiples tallas o colores,
                    marca la casilla superior <strong>«¿Tiene tallas o colores?»</strong>.
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
                {uploadStatus || (hasVariants ? 'Guardar Producto Matriz' : 'Guardar Ítem')}
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

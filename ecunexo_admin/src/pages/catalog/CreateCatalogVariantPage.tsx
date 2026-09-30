import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast, FileBox, type PageActionItem } from 'glubox'
import { ArrowLeft, Camera, Layers, Package, Save } from 'lucide-react'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { EcuPageActions, PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useCatalogLimits } from '@/hooks/useCatalogLimits'
import { readApiError } from '@/lib/readApiError'
import {
  addCatalogItemVariant,
  getCatalogItem,
  listCatalogItems,
  listProductTemplates,
  listVariantDimensionTemplates,
  uploadCatalogItemImage,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  type CatalogItemDetailDto,
  type ProductTemplateDto,
  type ProductTemplateLevel,
  type VariantDimensionTemplateDto,
} from '@/types/catalogApi'
import {
  buildDimensionValuesMap,
  getVariantAttributeFields,
  readPhotoChoice,
} from '@/lib/catalogArchetype'
import { VariantPhysicalFields } from '@/pages/catalog/VariantPhysicalFields'
import type { CustomAttributeRow } from '@/pages/catalog/ItemCustomAttributesEditor'
import '@/pages/catalog/variantMatrixBuilder.css'

type DimensionEntry = {
  name: string
  values: string[]
  type?: string
}

export function CreateCatalogVariantPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const tenantId = useAppSelector(selectTenantId)
  const navigate = useNavigate()
  const toast = useToast()

  const canEdit = useHasPermission('catalog.item.update')
  const { maxVariants } = useCatalogLimits()

  // Matrix parent state
  const [loadingParent, setLoadingParent] = useState(true)
  const [parentItem, setParentItem] = useState<CatalogItemDetailDto | null>(null)
  const [templates, setTemplates] = useState<ProductTemplateDto[]>([])
  const [dimensionTemplates, setDimensionTemplates] = useState<VariantDimensionTemplateDto[]>([])
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set())

  // Form state
  const [dimValues, setDimValues] = useState<Record<string, string>>({})
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [attributeValues, setAttributeValues] = useState<CustomAttributeRow[]>([])
  const [variantImage, setVariantImage] = useState<File | null>(null)
  const [variantImagePreview, setVariantImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (variantImagePreview) {
        URL.revokeObjectURL(variantImagePreview)
      }
    }
  }, [variantImagePreview])

  // Load parent item, templates and SKUs existentes (unicidad)
  useEffect(() => {
    if (!tenantId || !itemId) return
    let cancelled = false

    void (async () => {
      try {
        const [itemRes, tplRes, dimRes, allItems] = await Promise.all([
          getCatalogItem(tenantId, itemId),
          listProductTemplates(tenantId).catch(() => []),
          listVariantDimensionTemplates(tenantId).catch(() => []),
          listCatalogItems(tenantId, { onlyRoots: false, includeParents: true }).catch(() => []),
        ])

        if (cancelled) return

        setParentItem(itemRes)
        setTemplates(tplRes)
        setDimensionTemplates(dimRes)

        const skus = new Set(
          allItems
            .map((i) => i.sku?.trim().toUpperCase())
            .filter((s): s is string => Boolean(s))
        )
        // Incluir SKUs de variantes del padre por si el listado no las trae todas
        const parentSku = itemRes.sku?.trim().toUpperCase()
        if (parentSku) skus.add(parentSku)
        for (const v of itemRes.variants ?? []) {
          const vs = v.sku?.trim().toUpperCase()
          if (vs) skus.add(vs)
        }
        setExistingSkus(skus)

        // Parse dimensions from parent
        let parsedDims: DimensionEntry[] = []
        if (itemRes.variantDimensionsJson) {
          try {
            const parsed = JSON.parse(itemRes.variantDimensionsJson)
            if (Array.isArray(parsed)) parsedDims = parsed
          } catch {
            parsedDims = []
          }
        }

        const initialDims: Record<string, string> = {}
        for (const d of parsedDims) {
          initialDims[d.name.toLowerCase()] = d.values[0] ?? ''
        }
        setDimValues(initialDims)
      } catch (err) {
        if (!cancelled) {
          toast.show({
            title: 'Error al cargar producto matriz',
            message: readApiError(err, 'No se pudo cargar la información del producto matriz.'),
            variant: 'error',
          })
        }
      } finally {
        if (!cancelled) {
          setLoadingParent(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [itemId, tenantId, toast])

  // Template archetype mappings
  const familyTemplate = useMemo(() => {
    if (!parentItem || templates.length === 0) return null
    if (parentItem.familyId) {
      return templates.find((t) => t.id === parentItem.familyId) ?? null
    }
    return null
  }, [parentItem, templates])

  const familyLevels = useMemo<ProductTemplateLevel[]>(() => {
    if (!familyTemplate?.hierarchyTreeJson) return []
    try {
      const parsed = JSON.parse(familyTemplate.hierarchyTreeJson) as ProductTemplateLevel[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [familyTemplate])

  const photoChoice = useMemo(() => {
    if (familyLevels.length > 0) {
      return readPhotoChoice(familyLevels).choice
    }
    return 'variant' as const
  }, [familyLevels])

  const allowsVariantPhoto = photoChoice !== 'none'

  const dimensionValuesMap = useMemo(
    () => buildDimensionValuesMap(dimensionTemplates),
    [dimensionTemplates]
  )

  const variantAttributeFields = useMemo(
    () => getVariantAttributeFields(familyLevels, dimensionValuesMap),
    [familyLevels, dimensionValuesMap]
  )

  const dimensions = useMemo<DimensionEntry[]>(() => {
    if (!parentItem?.variantDimensionsJson) return []
    try {
      const parsed = JSON.parse(parentItem.variantDimensionsJson)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [parentItem])

  // Limits calculation
  const currentVariantCount = parentItem?.variants?.length ?? 0
  const remainingVariants = maxVariants !== null ? Math.max(0, maxVariants - currentVariantCount) : null

  const cleanSku = sku.trim().toUpperCase()
  const skuAlreadyExists = Boolean(cleanSku) && existingSkus.has(cleanSku)
  const skuErrorMessage = skuAlreadyExists
    ? 'Este SKU ya existe en el catálogo. Usa uno distinto.'
    : undefined

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'back-to-parent',
        label: parentItem?.name ? `Volver a «${parentItem.name}»` : 'Volver al producto matriz',
        icon: 'arrow-left',
        route: parentItem ? `/catalogo/items/${parentItem.id}` : '/catalogo/items',
        disabled: false,
      },
      {
        id: 'list',
        label: 'Listado de ítems',
        icon: 'package',
        route: '/catalogo/items',
        disabled: false,
      },
    ],
    [parentItem]
  )

  const handleAction = useCallback(
    (action: PageActionItem) => {
      if (action.route) {
        void navigate(action.route)
      }
    },
    [navigate]
  )

  // Dimension change handler
  const handleDimChange = useCallback((dimName: string, val: string) => {
    setDimValues((prev) => ({ ...prev, [dimName.toLowerCase()]: val }))
  }, [])

  // Attribute row change handler
  const handleAttributeChange = useCallback((key: string, value: string) => {
    setAttributeValues((prev) => {
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
  }, [])

  const attributeValueMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const row of attributeValues) map[row.key] = row.value
    return map
  }, [attributeValues])

  const resolveVariantTitle = useCallback(() => {
    for (const row of attributeValues) {
      const n = row.key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if ((n === 'nombre' || n === 'name') && row.value.trim()) return row.value.trim()
    }
    const fromDims = Object.values(dimValues).map((v) => v.trim()).filter(Boolean).join(' / ')
    return fromDims || 'Variante'
  }, [attributeValues, dimValues])

  // Submit variant creation
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!tenantId || !parentItem?.id) return

      if (!canEdit) {
        toast.show({
          title: 'Sin permisos',
          message: 'No tienes permisos para agregar variantes a este producto.',
          variant: 'error',
        })
        return
      }

      if (remainingVariants === 0) {
        toast.show({
          title: 'Límite alcanzado',
          message: `Tu plan permite hasta ${maxVariants} variantes y ya has alcanzado el máximo.`,
          variant: 'error',
        })
        return
      }

      if (!sku.trim()) {
        toast.show({
          title: 'Campo requerido',
          message: 'El SKU físico de la variante es obligatorio.',
          variant: 'error',
        })
        return
      }

      const skuClean = sku.trim().toUpperCase()
      if (existingSkus.has(skuClean)) {
        toast.show({
          title: 'SKU duplicado',
          message: `El SKU «${skuClean}» ya existe en el catálogo. Elige otro código.`,
          variant: 'error',
        })
        return
      }

      const missingDims = dimensions.filter(
        (d) => !(dimValues[d.name.toLowerCase()] ?? '').trim()
      )
      if (missingDims.length > 0) {
        toast.show({
          title: 'Dimensiones requeridas',
          message: `Completa las dimensiones: ${missingDims.map((d) => d.name).join(', ')}.`,
          variant: 'error',
        })
        return
      }

      const finalTitle = resolveVariantTitle()
      const attributes: Record<string, string> = { ...dimValues }
      for (const row of attributeValues) {
        const key = row.key.trim()
        if (!key || !row.value.trim()) continue
        const clean = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        attributes[key] = row.value.trim()
        if (clean === 'nombre' || clean === 'name') attributes['nombre'] = row.value.trim()
        if (clean === 'descripcion' || clean === 'description') {
          attributes['descripcion'] = row.value.trim()
        }
      }

      setSubmitting(true)
      try {
        const createdVariant = await addCatalogItemVariant(tenantId, parentItem.id, {
          variantTitle: finalTitle,
          sku: skuClean,
          barcode: barcode.trim() || null,
          basePrice: null,
          customAttributesJson: JSON.stringify(attributes),
        })

        if (variantImage && createdVariant.variantItemId) {
          try {
            await uploadCatalogItemImage(
              tenantId,
              createdVariant.variantItemId,
              variantImage,
              finalTitle,
              true
            )
          } catch (imgErr) {
            console.error('Error al subir foto de variante', imgErr)
          }
        }

        toast.show({
          title: 'Variante creada',
          message: `La variante «${finalTitle}» se agregó exitosamente.`,
          variant: 'success',
        })

        navigate(`/catalogo/items/${parentItem.id}`, { replace: true })
      } catch (err) {
        toast.show({
          title: 'Error al crear variante',
          message: readApiError(err, 'No se pudo agregar la variante.'),
          variant: 'error',
        })
      } finally {
        setSubmitting(false)
      }
    },
    [
      attributeValues,
      barcode,
      canEdit,
      dimValues,
      dimensions,
      existingSkus,
      maxVariants,
      navigate,
      parentItem,
      remainingVariants,
      resolveVariantTitle,
      sku,
      tenantId,
      toast,
      variantImage,
    ]
  )

  if (loadingParent) {
    return (
      <TenantSessionGate title="Añadir Variante" lead="Cargando producto matriz…">
        <div className="ecu-dashboard-layout ecu-section-page">
          <SectionCard title="Cargando…">
            <p className="app-shell__muted">Recuperando datos del producto matriz…</p>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  if (!parentItem) {
    return (
      <TenantSessionGate title="Añadir Variante" lead="Producto matriz no encontrado.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <SectionCard title="Producto no encontrado">
            <p style={{ color: 'var(--glb-text-muted, #64748b)', marginBottom: '1rem' }}>
              El producto matriz solicitado no existe o no se pudo cargar.
            </p>
            <Button variant="outline" onClick={() => navigate('/catalogo/items')}>
              <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} />
              Volver al catálogo
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  if (!parentItem.isMatrixParent) {
    return (
      <TenantSessionGate title="Añadir Variante" lead="Producto no admite variantes.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <SectionCard title="Producto no admite variantes">
            <p style={{ color: 'var(--glb-text-muted, #64748b)', marginBottom: '1rem' }}>
              El ítem «{parentItem.name}» es un producto simple o una variante física existente, no un producto matriz.
            </p>
            <Button variant="outline" onClick={() => navigate(`/catalogo/items/${parentItem.id}`)}>
              <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} />
              Ver ítem
            </Button>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Añadir Variante" lead="Crear nueva variante física para la matriz.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Añadir Variante"
          subtitle={`Crea una nueva variante física vinculada al producto matriz «${parentItem.name}».`}
          actions={
            <EcuPageActions
              items={actionItems}
              triggerLabel="Acciones"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
              onActionSelect={handleAction}
            />
          }
        />

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            marginTop: '1.25rem',
            paddingBottom: '3rem',
          }}
        >
          {/* Tarjeta de Referencia del Producto Matriz */}
          <SectionCard
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="var(--shell-primary, #4f46e5)" />
                <span>Producto Matriz (Referencia)</span>
              </div>
            }
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                backgroundColor: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--glb-border, #e2e8f0)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Nombre comercial matriz
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--glb-text, #0f172a)', marginTop: '0.2rem' }}>
                  {parentItem.name}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Plantilla / Categoría
                </div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--glb-text, #0f172a)', marginTop: '0.2rem' }}>
                  {parentItem.familyName || familyTemplate?.name || 'Estándar'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Variantes activas
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <StatusBadge tone="neutral">{currentVariantCount} existentes</StatusBadge>
                  {remainingVariants !== null && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--glb-text-muted, #64748b)' }}>
                      ({remainingVariants} disponibles)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {parentItem.description && (
              <div style={{ marginTop: '0.85rem', fontSize: '0.85rem', color: 'var(--glb-text-secondary, #475569)' }}>
                <strong>Descripción base:</strong> {parentItem.description}
              </div>
            )}
          </SectionCard>

          {/* Misma fila de campos que al crear la matriz (SKU → Nombre → dims → attrs) */}
          <SectionCard
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} color="var(--shell-primary, #4f46e5)" />
                <span>Variante física (según plantilla)</span>
              </div>
            }
            subtitle={
              familyTemplate
                ? `Plantilla «${familyTemplate.name}»: mismos campos que al generar la matriz.`
                : 'Completa SKU, dimensiones y datos de la plantilla.'
            }
          >
            <VariantPhysicalFields
              sku={sku}
              onSkuChange={setSku}
              barcode={barcode}
              onBarcodeChange={setBarcode}
              dimensions={dimensions}
              dimensionValues={dimValues}
              onDimensionChange={handleDimChange}
              variantAttributeFields={variantAttributeFields}
              attributeValues={attributeValueMap}
              onAttributeChange={handleAttributeChange}
              dimensionValuesMap={dimensionValuesMap}
              disabled={submitting}
              skuError={skuAlreadyExists}
              skuErrorMessage={skuErrorMessage}
            />
          </SectionCard>

          {/* Fotografía específica de la variante */}
          {allowsVariantPhoto && (
            <SectionCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Camera size={18} color="var(--shell-primary, #4f46e5)" />
                  <span>Fotografía de la variante</span>
                </div>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 480 }}>
                <FileBox
                  label="Foto de la variante"
                  labelPosition="outlined"
                  variant="outline"
                  size="sm"
                  reorderable
                  accept="image/jpeg,image/png,image/webp,image/*"
                  maxFiles={1}
                  maxSize={8 * 1024 * 1024}
                  value={variantImage ? [variantImage] : []}
                  disabled={submitting}
                  fullWidth
                  helperText="Una imagen que represente este color/presentación. JPG, PNG o WebP · máx. 8 MB."
                  onChange={(files: File[]) => {
                    const file = files[0] ?? null
                    if (variantImagePreview) URL.revokeObjectURL(variantImagePreview)
                    setVariantImage(file)
                    setVariantImagePreview(file ? URL.createObjectURL(file) : null)
                  }}
                  onReject={(rejected) => {
                    const first = rejected[0]
                    if (!first) return
                    toast.show({
                      variant: 'error',
                      message:
                        first.reason === 'size'
                          ? `«${first.file.name}» supera 8 MB.`
                          : `«${first.file.name}» no es una imagen válida.`,
                    })
                  }}
                />
              </div>
            </SectionCard>
          )}

          {/* Acciones del formulario (estáticas al final, sin flotar) */}
          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={submitting || remainingVariants === 0 || skuAlreadyExists}
            >
              <Save size={16} style={{ marginRight: '0.4rem' }} />
              {submitting ? 'Guardando variante…' : 'Guardar Variante'}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => navigate(`/catalogo/items/${parentItem.id}`)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </TenantSessionGate>
  )
}

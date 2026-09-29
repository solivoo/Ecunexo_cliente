import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, NumberBox, Select, TextBox, useToast, type PageActionItem } from 'glubox'
import { ArrowLeft, Camera, Layers, Package, Save, Sparkles, X } from 'lucide-react'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { EcuPageActions, PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useCatalogLimits } from '@/hooks/useCatalogLimits'
import { readApiError } from '@/lib/readApiError'
import {
  addCatalogItemVariant,
  getCatalogItem,
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
import { ArchetypeModelFields } from '@/pages/catalog/ArchetypeModelFields'
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

  const canEdit = useHasPermission('catalog.items.update')
  const { maxVariants } = useCatalogLimits()

  // Matrix parent state
  const [loadingParent, setLoadingParent] = useState(true)
  const [parentItem, setParentItem] = useState<CatalogItemDetailDto | null>(null)
  const [templates, setTemplates] = useState<ProductTemplateDto[]>([])
  const [dimensionTemplates, setDimensionTemplates] = useState<VariantDimensionTemplateDto[]>([])

  // Form state
  const [dimValues, setDimValues] = useState<Record<string, string>>({})
  const [extraDimValues, setExtraDimValues] = useState<Record<string, string[]>>({})
  const [variantTitle, setVariantTitle] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')
  const [basePrice, setBasePrice] = useState<number | null>(null)
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

  // Load parent item and templates
  useEffect(() => {
    if (!tenantId || !itemId) return
    let cancelled = false

    void (async () => {
      try {
        const [itemRes, tplRes, dimRes] = await Promise.all([
          getCatalogItem(tenantId, itemId),
          listProductTemplates(tenantId).catch(() => []),
          listVariantDimensionTemplates(tenantId).catch(() => []),
        ])

        if (cancelled) return

        setParentItem(itemRes)
        setTemplates(tplRes)
        setDimensionTemplates(dimRes)
        if (itemRes.basePrice !== null && itemRes.basePrice !== undefined) {
          setBasePrice(Number(itemRes.basePrice))
        }

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
        setVariantTitle(parsedDims.map((d) => d.values[0] ?? '').filter(Boolean).join(' - '))
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
  const handleDimChange = useCallback(
    (dimName: string, val: string) => {
      let chosen = val
      if (val === '__add_new__') {
        const created = window.prompt(`Nueva opción para «${dimName}»:`)
        if (!created || !created.trim()) return
        chosen = created.trim()
        setExtraDimValues((prev) => ({
          ...prev,
          [dimName.toLowerCase()]: [...(prev[dimName.toLowerCase()] ?? []), chosen],
        }))
      }
      const updated = { ...dimValues, [dimName.toLowerCase()]: chosen }
      setDimValues(updated)
      const valuesJoined = Object.values(updated).filter(Boolean).join(' - ')
      setVariantTitle(valuesJoined)
    },
    [dimValues]
  )

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

      if (!variantTitle.trim()) {
        toast.show({
          title: 'Campo requerido',
          message: 'El título de la variante es obligatorio (ej. Larga - 10-12).',
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

      const missingDims = dimensions.filter(
        (d) => !(dimValues[d.name.toLowerCase()] ?? '').trim()
      )
      if (missingDims.length > 0) {
        toast.show({
          title: 'Dimensiones requeridas',
          message: `Por favor completa las dimensiones de la variante: ${missingDims.map((d) => d.name).join(', ')}.`,
          variant: 'error',
        })
        return
      }

      const attributes: Record<string, string> = { ...dimValues }
      for (const row of attributeValues) {
        const key = row.key.trim()
        if (key && row.value.trim()) {
          attributes[key] = row.value.trim()
        }
      }

      setSubmitting(true)
      try {
        const createdVariant = await addCatalogItemVariant(tenantId, parentItem.id, {
          variantTitle: variantTitle.trim(),
          sku: sku.trim().toUpperCase(),
          barcode: barcode.trim() || null,
          basePrice: basePrice !== null && !isNaN(basePrice) ? basePrice : null,
          customAttributesJson: JSON.stringify(attributes),
        })

        if (variantImage && createdVariant.variantItemId) {
          try {
            await uploadCatalogItemImage(
              tenantId,
              createdVariant.variantItemId,
              variantImage,
              variantTitle.trim(),
              true
            )
          } catch (imgErr) {
            console.error('Error al subir foto de variante', imgErr)
          }
        }

        toast.show({
          title: 'Variante creada',
          message: `La variante «${variantTitle.trim()}» se agregó exitosamente.`,
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
      basePrice,
      canEdit,
      dimValues,
      dimensions,
      maxVariants,
      navigate,
      parentItem,
      remainingVariants,
      sku,
      tenantId,
      toast,
      variantImage,
      variantTitle,
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

          {/* Dimensiones e Identificación de la Variante */}
          <SectionCard
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={18} color="var(--shell-primary, #4f46e5)" />
                <span>Identificación y Dimensiones de la Variante</span>
              </div>
            }
          >
            {dimensions.length > 0 && (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--glb-surface-variant, rgba(0, 0, 0, 0.02))',
                  border: '1px solid var(--glb-border, #e2e8f0)',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={15} color="var(--shell-primary, #4f46e5)" />
                  <span>Dimensiones físicas de la matriz:</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: dimensions.length > 1 ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr',
                    gap: '0.85rem',
                  }}
                >
                  {dimensions.map((d) => {
                    const currentVal = dimValues[d.name.toLowerCase()] ?? ''
                    const lookup = dimensionValuesMap?.get(d.name.trim().toLowerCase())
                    const allDimValues = Array.from(
                      new Set([
                        ...d.values,
                        ...(lookup?.values ?? []),
                        ...(extraDimValues[d.name.toLowerCase()] ?? []),
                      ])
                    )

                    return (
                      <div key={d.name}>
                        {allDimValues.length > 0 ? (
                          <Select
                            id={`dim-${d.name}`}
                            label={d.name}
                            labelPosition="outlined"
                            variant="outline"
                            options={[
                              ...allDimValues.map((v) => ({ value: v, label: v })),
                              { value: '__add_new__', label: '+ Nueva…' },
                            ]}
                            value={currentVal}
                            onChange={(val) => handleDimChange(d.name, val)}
                            fullWidth
                          />
                        ) : (
                          <TextBox
                            id={`dim-${d.name}`}
                            label={d.name}
                            labelPosition="outlined"
                            variant="outline"
                            value={currentVal}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              handleDimChange(d.name, e.target.value)
                            }
                            fullWidth
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <TextBox
                id="var-title"
                label="Título / Talla de variante"
                labelPosition="outlined"
                variant="outline"
                value={variantTitle}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setVariantTitle(e.target.value)}
                placeholder="Ej. Larga - 10-12"
                required
                fullWidth
              />

              <TextBox
                id="var-sku"
                label="SKU físico de la variante"
                labelPosition="outlined"
                variant="outline"
                value={sku}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSku(e.target.value.toUpperCase())}
                placeholder="Ej. NIK-CALC-LAR-1012"
                required
                fullWidth
              />

              <TextBox
                id="var-barcode"
                label="Código de barras (opcional)"
                labelPosition="outlined"
                variant="outline"
                value={barcode}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setBarcode(e.target.value.toUpperCase())}
                placeholder="Ej. 7861234567890"
                fullWidth
              />

              <NumberBox
                id="var-price"
                label="Precio base (opcional)"
                labelPosition="outlined"
                variant="outline"
                value={basePrice ?? undefined}
                onChange={(val) => setBasePrice(val !== undefined && val !== null ? Number(val) : null)}
                placeholder={parentItem.basePrice !== null ? `$${parentItem.basePrice}` : '0.00'}
                min={0}
                step={0.01}
                fullWidth
              />
            </div>
          </SectionCard>

          {/* Atributos adicionales según plantilla (Color, Actividad, etc.) */}
          {variantAttributeFields.length > 0 && (
            <SectionCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} color="var(--shell-primary, #4f46e5)" />
                  <span>Datos de la variante (según plantilla)</span>
                </div>
              }
            >
              <ArchetypeModelFields
                fields={variantAttributeFields}
                values={attributeValues}
                dimensionValuesMap={dimensionValuesMap}
                onChangeValue={handleAttributeChange}
              />
            </SectionCard>
          )}

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                {variantImagePreview ? (
                  <div
                    style={{
                      position: 'relative',
                      width: 110,
                      height: 110,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid var(--glb-border, #cbd5e1)',
                      backgroundColor: '#fff',
                    }}
                  >
                    <img
                      src={variantImagePreview}
                      alt="Preview variante"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <button
                      type="button"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        if (variantImagePreview) URL.revokeObjectURL(variantImagePreview)
                        setVariantImage(null)
                        setVariantImagePreview(null)
                      }}
                      disabled={submitting}
                      title="Quitar foto"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label
                    className="ecu-var-img-btn"
                    style={{
                      padding: '0.65rem 1rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      border: '1px dashed var(--glb-border, #94a3b8)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--glb-surface, #fff)',
                    }}
                  >
                    <Camera size={18} color="var(--shell-primary, #4f46e5)" />
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                      Seleccionar foto para esta variante
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={submitting}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          if (variantImagePreview) URL.revokeObjectURL(variantImagePreview)
                          setVariantImage(file)
                          setVariantImagePreview(URL.createObjectURL(file))
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--glb-text-muted, #64748b)', maxWidth: 360 }}>
                  Sube una foto que represente esta variante física específica (ej. calcetín en este color o presentación).
                </div>
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
              disabled={submitting || remainingVariants === 0}
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

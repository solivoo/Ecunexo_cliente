import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Popup, useToast } from 'glubox'
import { Camera, Check, Copy, Layers, Plus, Trash2, Upload, X } from 'lucide-react'
import type { CreateVariantChildPayload } from '@/types/catalogApi'
import './variantMatrixBuilder.css'

export type DimensionState = {
  id: string
  name: string
  dimensionType: string
  values: string[]
  activeValues: string[]
}
export type VariantImageItem = {
  id: string
  file: File
  previewUrl: string
  name: string
}

export type VariantRowState = {
  id: string
  dimensionValues: Record<string, string>
  variationLabel: string
  variantTitle: string
  isManualTitle?: boolean
  sku: string
  isManualSku?: boolean
  barcode: string
  basePrice: string
  isManualPrice?: boolean
  initialStock: string
  warehouseId: string
  stagedImage?: File | null
  stagedImagePreview?: string | null
  stagedImages?: VariantImageItem[]
  variantTags?: string
}

export type MatrixVariantPayloadWithImage = CreateVariantChildPayload & {
  stagedImage?: File | null
  stagedImages?: VariantImageItem[]
}

export interface AvailableGalleryImage {
  id: string
  file: File
  previewUrl: string
  altText?: string
}

export type VariantMatrixBuilderProps = {
  tenantId: string | null
  baseName: string
  baseSku: string
  basePrice: string
  parentTags?: readonly string[]
  disabled?: boolean
  onChange: (data: {
    variants: MatrixVariantPayloadWithImage[]
    variantDimensionsJson: string
    dimensionNames: string[]
    isValid: boolean
  }) => void
  availableImages?: AvailableGalleryImage[]
  initialDimensions?: { name: string; values?: string[]; isColor?: boolean }[]
}


const DEFAULT_COLOR_MAP: Record<string, string> = {
  Negro: '#1e293b',
  Blanco: '#ffffff',
  Azul: '#2563eb',
  Rojo: '#dc2626',
  Gris: '#64748b',
  Verde: '#16a34a',
  Amarillo: '#eab308',
  Naranja: '#f97316',
  Morado: '#9333ea',
  Rosa: '#ec4899',
  Beige: '#d4b996',
  Café: '#78350f',
  Marrón: '#78350f',
}

function sanitizeSkuPart(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function getVariantSkuPrefix(baseSku?: string, baseName?: string): string {
  if (baseSku?.trim()) {
    return sanitizeSkuPart(baseSku)
  }
  if (baseName?.trim()) {
    const parts = baseName.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 1) return sanitizeSkuPart(parts[0].slice(0, 6))
    return parts.slice(0, 3).map((w) => sanitizeSkuPart(w.slice(0, 4))).join('-')
  }
  return 'PROD'
}


export function isColorDimension(name: string, type?: string, tplId?: string): boolean {
  const nameLower = (name || '').toLowerCase().trim()
  const typeLower = (type || '').toLowerCase().trim()
  return (
    nameLower.includes('color') ||
    typeLower.includes('color') ||
    tplId === 'system-colors'
  )
}

function combineHierarchyTags(
  parentTags: readonly string[],
  dimensionValues?: Record<string, string>,
  variantTags?: string
): string[] {
  const set = new Set<string>()
  parentTags.forEach((pt) => {
    const n = pt.trim().replace(/^#+/, '')
    if (n) set.add(n)
  })
  if (dimensionValues) {
    Object.values(dimensionValues).forEach((v) => {
      if (typeof v === 'string' && v.trim()) set.add(v.trim().replace(/^#+/, ''))
    })
  }
  if (variantTags?.trim()) {
    variantTags
      .split(/[,\s]+/)
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter(Boolean)
      .forEach((t) => set.add(t))
  }
  return Array.from(set)
}

export function VariantMatrixBuilder({
  tenantId: _tenantId,
  baseName,
  baseSku,
  basePrice,
  parentTags = [],
  disabled = false,
  onChange,
  availableImages = [],
  initialDimensions,
}: VariantMatrixBuilderProps) {
  const toast = useToast()

  // Image Assignment State for single rows
  const [singleRowImageTargetId, setSingleRowImageTargetId] = useState<string | null>(null)
  const singleFileInputRef = useRef<HTMLInputElement | null>(null)

  // Color Hex Map
  const [colorHexMap] = useState<Record<string, string>>(DEFAULT_COLOR_MAP)

  // Dimensions Array
  const [dimensions, setDimensions] = useState<DimensionState[]>([
    {
      id: 'dim-1',
      name: 'Talla',
      dimensionType: 'Talla',
      values: ['35-38', '39-41', '42-44'],
      activeValues: ['35-38', '39-41', '42-44'],
    },
  ])

  // Sync initialDimensions from template if provided
  useEffect(() => {
    if (!initialDimensions || initialDimensions.length === 0) return
    const newDims: DimensionState[] = initialDimensions.map((d, idx) => {
      const isColor = d.isColor || isColorDimension(d.name)
      const values = d.values && d.values.length > 0 ? d.values : isColor ? ['Negro', 'Blanco', 'Azul'] : ['35-38', '39-41', '42-44']
      return {
        id: `dim-tpl-${idx}`,
        name: d.name,
        dimensionType: isColor ? 'Color' : 'Talla',
        values,
        activeValues: values,
      }
    })
    setDimensions(newDims)
  }, [initialDimensions])

  // Generated Variant Rows
  const [rows, setRows] = useState<VariantRowState[]>([])



  // Add custom option to an existing dimension
  const handleAddCustomOptionToDimension = useCallback((dimId: string, newVal: string) => {
    setDimensions((prev) =>
      prev.map((d) => {
        if (d.id !== dimId) return d
        const nextValues = d.values.includes(newVal) ? d.values : [...d.values, newVal]
        const nextActive = d.activeValues.includes(newVal) ? d.activeValues : [...d.activeValues, newVal]
        return { ...d, values: nextValues, activeValues: nextActive }
      })
    )
  }, [])

  // Inicializar con 1 variante por defecto si la lista de filas está vacía
  const hasInitializedRows = useRef(false)
  useEffect(() => {
    if (hasInitializedRows.current) return
    const activeDims = dimensions.filter((d) => d.activeValues.length > 0 || d.values.length > 0)
    if (activeDims.length > 0 && rows.length === 0) {
      hasInitializedRows.current = true
      const prefix = getVariantSkuPrefix(baseSku, baseName)
      const defaultPrice = basePrice.trim() ? basePrice.trim() : ''

      const dimensionValues: Record<string, string> = {}
      activeDims.forEach((d) => {
        dimensionValues[d.name] = d.values[0] || d.activeValues[0] || ''
      })

      const variationLabel = Object.values(dimensionValues).filter(Boolean).join(' / ')
      const autoTitle = baseName.trim()
        ? (variationLabel ? `${baseName.trim()} - ${variationLabel}` : baseName.trim())
        : (variationLabel || 'Variante 1')

      const initialSku = prefix ? `${prefix}-0001` : 'VAR-0001'

      setRows([
        {
          id: `var-init-${Date.now()}`,
          dimensionValues,
          variationLabel,
          variantTitle: autoTitle,
          isManualTitle: false,
          sku: initialSku,
          isManualSku: false,
          barcode: '',
          basePrice: defaultPrice,
          isManualPrice: false,
          initialStock: '',
          warehouseId: '',
          stagedImage: null,
          stagedImagePreview: null,
          stagedImages: [],
          variantTags: '',
        },
      ])
    }
  }, [dimensions, baseSku, baseName, basePrice, rows.length])

  // Cambio de dimensión en una fila específica (selección por variante) - NO recrear el SKU
  const handleRowDimensionChange = useCallback(
    (rowId: string, dimName: string, newValue: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r
          const updatedDims = { ...r.dimensionValues, [dimName]: newValue }
          const variationLabel = Object.values(updatedDims).filter(Boolean).join(' / ')
          const autoTitle = baseName.trim() ? `${baseName.trim()} - ${variationLabel}` : variationLabel

          return {
            ...r,
            dimensionValues: updatedDims,
            variationLabel,
            variantTitle: r.isManualTitle ? r.variantTitle : autoTitle,
            sku: r.sku, // El SKU nunca se recrea automáticamente
          }
        })
      )
    },
    [baseName]
  )

  // Agregar una variante bajo demanda
  const handleAddVariantRow = useCallback(() => {
    const prefix = getVariantSkuPrefix(baseSku, baseName)
    const defaultPrice = basePrice.trim() ? basePrice.trim() : ''
    const newId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const nextIdx = rows.length + 1

    const dimensionValues: Record<string, string> = {}
    dimensions.forEach((d) => {
      const defaultVal = d.values[0] || d.activeValues[0] || ''
      if (defaultVal) {
        dimensionValues[d.name] = defaultVal
      }
    })

    const variationLabel = Object.values(dimensionValues).filter(Boolean).join(' / ')
    const autoTitle = baseName.trim()
      ? (variationLabel ? `${baseName.trim()} - ${variationLabel}` : `${baseName.trim()} - Variante ${nextIdx}`)
      : (variationLabel || `Variante ${nextIdx}`)

    const initialSku = prefix ? `${prefix}-${String(nextIdx).padStart(4, '0')}` : `VAR-${String(nextIdx).padStart(4, '0')}`

    const newRow: VariantRowState = {
      id: newId,
      dimensionValues,
      variationLabel,
      variantTitle: autoTitle,
      isManualTitle: false,
      sku: initialSku,
      isManualSku: false,
      barcode: '',
      basePrice: defaultPrice,
      isManualPrice: false,
      initialStock: '',
      warehouseId: '',
      stagedImage: null,
      stagedImagePreview: null,
      stagedImages: [],
      variantTags: '',
    }

    setRows((prev) => [...prev, newRow])
  }, [baseSku, baseName, basePrice, dimensions, rows.length])

  // Duplicar una fila de variante
  const handleDuplicateVariantRow = useCallback(
    (rowId: string) => {
      const source = rows.find((r) => r.id === rowId)
      if (!source) return

      const prefix = getVariantSkuPrefix(baseSku, baseName)
      const newId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const nextIdx = rows.length + 1
      const newSku = source.sku ? `${source.sku}-COPIA` : `${prefix}-${String(nextIdx).padStart(4, '0')}`

      const duplicated: VariantRowState = {
        ...source,
        id: newId,
        sku: newSku,
        isManualSku: true,
        variantTitle: `${source.variantTitle} (Copia)`,
        isManualTitle: false,
      }

      setRows((prev) => [...prev, duplicated])
      toast.show({
        variant: 'success',
        title: 'Variante duplicada',
        message: 'Se duplicó la fila.',
      })
    },
    [rows, baseSku, baseName, toast]
  )

  // Row field update
  const updateRow = useCallback((id: string, field: keyof VariantRowState, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        if (field === 'sku') {
          updated.isManualSku = true
        } else if (field === 'variantTitle') {
          updated.isManualTitle = true
        } else if (field === 'basePrice') {
          updated.isManualPrice = true
        }
        return updated
      })
    )
  }, [])

  // Delete row
  const deleteRow = useCallback((id: string) => {
    setRows((prev) => {
      const target = prev.find((r) => r.id === id)
      target?.stagedImages?.forEach((img) => {
        if (img.previewUrl.startsWith('blob:')) URL.revokeObjectURL(img.previewUrl)
      })
      if (target?.stagedImagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(target.stagedImagePreview)
      }
      return prev.filter((r) => r.id !== id)
    })
  }, [])

  // Multi-photo handlers for variant rows
  const handleAddImagesToRow = useCallback((id: string, files: File[]) => {
    const newItems: VariantImageItem[] = files.map((file) => ({
      id: `var-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
    }))

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updated = [...(r.stagedImages || []), ...newItems]
        return {
          ...r,
          stagedImages: updated,
          stagedImage: updated[0]?.file ?? null,
          stagedImagePreview: updated[0]?.previewUrl ?? null,
        }
      })
    )
  }, [])

  const handleToggleGalleryImageInRow = useCallback((id: string, img: AvailableGalleryImage) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const current = r.stagedImages || []
        const exists = current.some((item) => item.previewUrl === img.previewUrl)
        let updated: VariantImageItem[]
        if (exists) {
          updated = current.filter((item) => item.previewUrl !== img.previewUrl)
        } else {
          updated = [
            ...current,
            {
              id: `var-gal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              file: img.file,
              previewUrl: img.previewUrl,
              name: img.altText || img.file.name,
            },
          ]
        }
        return {
          ...r,
          stagedImages: updated,
          stagedImage: updated[0]?.file ?? null,
          stagedImagePreview: updated[0]?.previewUrl ?? null,
        }
      })
    )
  }, [])

  const handleRemoveImageFromRow = useCallback((rowId: string, imagePreviewUrl: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const current = r.stagedImages || []
        const updated = current.filter((img) => img.previewUrl !== imagePreviewUrl)
        if (imagePreviewUrl.startsWith('blob:')) {
          const isGallery = availableImages?.some((g) => g.previewUrl === imagePreviewUrl)
          if (!isGallery) {
            URL.revokeObjectURL(imagePreviewUrl)
          }
        }
        return {
          ...r,
          stagedImages: updated,
          stagedImage: updated[0]?.file ?? null,
          stagedImagePreview: updated[0]?.previewUrl ?? null,
        }
      })
    )
  }, [availableImages])

  const handleRemoveAllRowImages = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        r.stagedImages?.forEach((img) => {
          const isGallery = availableImages?.some((g) => g.previewUrl === img.previewUrl)
          if (!isGallery && img.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(img.previewUrl)
          }
        })
        return {
          ...r,
          stagedImages: [],
          stagedImage: null,
          stagedImagePreview: null,
        }
      })
    )
  }, [availableImages])

  const handleOpenImagePickerForRow = useCallback(
    (rowId: string) => {
      setSingleRowImageTargetId(rowId)
    },
    []
  )

  const activeDims = useMemo(() => {
    return dimensions
  }, [dimensions])

  const targetRowForSingle = useMemo(() => {
    if (!singleRowImageTargetId) return null
    return rows.find((r) => r.id === singleRowImageTargetId) || null
  }, [rows, singleRowImageTargetId])

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      rows.forEach((r) => {
        if (r.stagedImagePreview) {
          URL.revokeObjectURL(r.stagedImagePreview)
        }
      })
    }
  }, [rows])


  // Synchronize with parent
  useEffect(() => {
    const dimensionsConfig = dimensions.map((d) => ({
      name: d.name.trim() || 'Dimensión',
      values: d.activeValues,
    }))

    const variantDimensionsJson = JSON.stringify({ dimensions: dimensionsConfig })
    const dimensionNames = dimensions.map((d) => d.name.trim())

    const payloadVariants: MatrixVariantPayloadWithImage[] = rows.map((r) => {
      const parsedPrice = r.basePrice.trim() ? Number(r.basePrice.replace(',', '.')) : null
      const parsedStock = r.initialStock.trim() ? Number(r.initialStock) : null

      const customAttrs: Record<string, unknown> = {}
      if (r.dimensionValues) {
        Object.entries(r.dimensionValues).forEach(([dimName, val]) => {
          if (val && typeof val === 'string' && val.trim()) {
            customAttrs[dimName.toLowerCase()] = val.trim()
          }
        })
      }

      // Sintetizar tags: tags del padre + dimensiones de la variante + tags específicos de la variante
      const combinedTags = combineHierarchyTags(parentTags, r.dimensionValues, r.variantTags)
      if (combinedTags.length > 0) {
        customAttrs['tags'] = combinedTags
      }

      return {
        variantTitle: r.variantTitle.trim(),
        sku: r.sku.trim(),
        barcode: r.barcode.trim() || null,
        basePrice: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
        customAttributesJson: Object.keys(customAttrs).length > 0 ? JSON.stringify(customAttrs) : null,
        initialStock: parsedStock != null && !Number.isNaN(parsedStock) && parsedStock > 0 ? parsedStock : null,
        initialStockWarehouseId: null,
        stagedImage: r.stagedImages?.[0]?.file ?? r.stagedImage ?? null,
        stagedImages: r.stagedImages && r.stagedImages.length > 0
          ? r.stagedImages
          : r.stagedImage && r.stagedImagePreview
            ? [{ id: '1', file: r.stagedImage, previewUrl: r.stagedImagePreview, name: r.variantTitle }]
            : [],
      }
    })

    const isValid =
      payloadVariants.length > 0 &&
      payloadVariants.every((v) => v.variantTitle.length > 0 && v.sku.length > 0)

    onChange({
      variants: payloadVariants,
      variantDimensionsJson,
      dimensionNames,
      isValid,
    })
  }, [
    rows,
    dimensions,
    parentTags,
    onChange,
  ])

  return (
    <div className="ecu-matrix-builder">
      {/* Header Banner */}
      <div className="ecu-matrix-builder__header">
        <div className="ecu-matrix-builder__header-info">
          <div className="ecu-matrix-builder__header-icon">
            <Layers size={18} />
          </div>
          <div>
            <h4 className="ecu-matrix-builder__header-title">
              Variantes
            </h4>
            <p className="ecu-matrix-builder__header-desc">
              {baseName.trim()
                ? `Configura las variantes para «${baseName.trim()}» con sus tallas, caña/largo, colores y fotos independientes.`
                : 'Configura las variantes con sus tallas, caña/largo, colores y fotos independientes.'}
            </p>
          </div>
        </div>
      </div>


      {/* Actions Bar */}
      <div className="ecu-matrix-bulk-bar">
        <div className="ecu-matrix-bulk-bar__left">
          <span className="ecu-matrix-bulk-bar__count">
            {rows.length} {rows.length === 1 ? 'variante' : 'variantes'}
          </span>
        </div>

        <div className="ecu-matrix-bulk-bar__actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAddVariantRow}
            disabled={disabled}
            title="Crear una nueva variante física para este producto"
          >
            <Plus size={13} /> Agregar Variante
          </Button>
        </div>
      </div>

      {/* Hidden file input for single row image upload */}
      <input
        type="file"
        ref={singleFileInputRef}
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length > 0 && singleRowImageTargetId) {
            handleAddImagesToRow(singleRowImageTargetId, files)
          }
          e.target.value = ''
        }}
      />

      {/* Variants Table */}
      <div className="ecu-matrix-table-wrap">
        {rows.length === 0 ? (
          <div className="ecu-matrix-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2.5rem 1rem' }}>
            <div>No hay variantes físicas agregadas aún.</div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleAddVariantRow}
              disabled={disabled}
            >
              <Plus size={14} /> Agregar Variante
            </Button>
          </div>
        ) : (
          <table className="ecu-matrix-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ width: 85, textAlign: 'center' }} title="Fotografías asociadas a esta variante física (SKU)">
                  Fotos
                </th>
                {activeDims.length > 0 ? (
                  activeDims.map((dim) => (
                    <th key={dim.id} style={{ minWidth: 110, whiteSpace: 'nowrap' }}>
                      {dim.name || 'Dimensión'}
                    </th>
                  ))
                ) : (
                  <th style={{ width: 140 }}>Variación</th>
                )}
                <th style={{ width: 170 }}>Título Variante</th>
                <th style={{ width: 160 }}>SKU (Obligatorio)</th>
                <th style={{ width: 180 }}>Tags / Actividad</th>
                <th style={{ width: 120 }}>Cód. Barras</th>
                <th style={{ width: 120 }}>Precio Base ($)</th>
                <th style={{ width: 95 }}>Stock Inicial</th>
                <th style={{ width: 70, textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const rowImages = row.stagedImages || []
                const hasImages = rowImages.length > 0 || !!row.stagedImagePreview
                const firstPreview = rowImages[0]?.previewUrl || row.stagedImagePreview
                return (
                <tr key={row.id}>
                  <td style={{ color: 'var(--glb-muted)' }}>{idx + 1}</td>
                  <td style={{ textAlign: 'center' }}>
                    {hasImages && firstPreview ? (
                      <div
                        className="ecu-var-img-slot ecu-var-img-slot--filled"
                        title={`«${row.variantTitle}» (${rowImages.length || 1} fotos). Clic para gestionar`}
                        style={{ position: 'relative' }}
                      >
                        <img src={firstPreview} alt={row.variantTitle} />
                        {rowImages.length > 1 && (
                          <span className="ecu-var-img-count-badge" title={`${rowImages.length} fotos asignadas`}>
                            +{rowImages.length - 1}
                          </span>
                        )}
                        <div className="ecu-var-img-overlay">
                          <button
                            type="button"
                            className="ecu-var-img-action-btn"
                            onClick={() => handleOpenImagePickerForRow(row.id)}
                            disabled={disabled}
                            title="Gestionar fotografías"
                          >
                            <Camera size={12} />
                          </button>
                          <button
                            type="button"
                            className="ecu-var-img-action-btn ecu-var-img-action-btn--danger"
                            onClick={() => handleRemoveAllRowImages(row.id)}
                            disabled={disabled}
                            title="Quitar fotografías"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="ecu-var-img-slot ecu-var-img-slot--empty"
                        onClick={() => handleOpenImagePickerForRow(row.id)}
                        disabled={disabled}
                        title="Asignar o subir fotografías a esta variante"
                      >
                        <Camera size={15} />
                        <span className="ecu-var-img-slot-text">+ Fotos</span>
                      </button>
                    )}
                  </td>
                  {activeDims.length > 0 ? (
                    activeDims.map((dim) => {
                      const currentVal = row.dimensionValues[dim.name] || ''
                      const isColor = isColorDimension(dim.name)
                      const availableVals = dim.values.length > 0 ? dim.values : dim.activeValues
                      const hex = colorHexMap[currentVal]
                      return (
                        <td key={dim.id} style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                            {(isColor || hex) && (
                              <span
                                className="ecu-color-swatch-dot"
                                style={{ backgroundColor: hex || '#94a3b8' }}
                                title={currentVal}
                              />
                            )}
                            <select
                              className="ecu-matrix-dim-select"
                              value={currentVal}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === '__add_new__') {
                                  const newVal = window.prompt(`Añadir nueva opción para «${dim.name}»:`)
                                  if (newVal && newVal.trim()) {
                                    handleAddCustomOptionToDimension(dim.id, newVal.trim())
                                    handleRowDimensionChange(row.id, dim.name, newVal.trim())
                                  }
                                } else {
                                  handleRowDimensionChange(row.id, dim.name, val)
                                }
                              }}
                              disabled={disabled}
                              style={{
                                padding: '0.35rem 0.5rem',
                                borderRadius: '6px',
                                border: '1px solid var(--shell-border, rgba(0,0,0,0.15))',
                                background: 'var(--glb-surface, #fff)',
                                color: 'var(--glb-text, #1e293b)',
                                fontSize: '0.825rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                width: '100%',
                                minWidth: '95px',
                              }}
                            >
                              {availableVals.map((val) => (
                                <option key={val} value={val}>
                                  {val}
                                </option>
                              ))}
                              {currentVal && !availableVals.includes(currentVal) && (
                                <option value={currentVal}>{currentVal}</option>
                              )}
                              <option value="__add_new__">+ Nueva opción...</option>
                            </select>
                          </div>
                        </td>
                      )
                    })
                  ) : (
                    <td>
                      <span style={{ color: 'var(--glb-muted)' }}>—</span>
                    </td>
                  )}
                  <td>
                    <input
                      type="text"
                      value={row.variantTitle}
                      onChange={(e) => updateRow(row.id, 'variantTitle', e.target.value)}
                      placeholder="Título de la variante"
                      disabled={disabled}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.sku}
                      onChange={(e) => updateRow(row.id, 'sku', e.target.value)}
                      placeholder="SKU-VAR"
                      disabled={disabled}
                      style={{ fontWeight: 600, fontFamily: 'monospace' }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <input
                        type="text"
                        value={row.variantTags || ''}
                        onChange={(e) => updateRow(row.id, 'variantTags', e.target.value)}
                        placeholder="Ej. Running, Crossfit..."
                        disabled={disabled}
                        title="Tags o actividad específica para esta variante física"
                      />
                      {combineHierarchyTags(parentTags, row.dimensionValues, row.variantTags).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', alignItems: 'center' }}>
                          {combineHierarchyTags(parentTags, row.dimensionValues, row.variantTags).map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: '0.675rem',
                                fontWeight: 500,
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: 'var(--shell-primary, #60a5fa)',
                                padding: '0.05rem 0.35rem',
                                borderRadius: '4px',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.barcode}
                      onChange={(e) => updateRow(row.id, 'barcode', e.target.value)}
                      placeholder="EAN / UPC (opc.)"
                      disabled={disabled}
                    />
                  </td>
                  <td>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.basePrice}
                        onChange={(e) => updateRow(row.id, 'basePrice', e.target.value)}
                        placeholder="0.00"
                        disabled={disabled}
                      />
                      {!row.isManualPrice && basePrice.trim() && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.65rem',
                            color: '#10b981',
                            fontWeight: 500,
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                          }}
                          title="Este precio proviene del precio base del producto padre"
                        >
                          Heredado (${basePrice.trim()})
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={row.initialStock}
                      onChange={(e) => updateRow(row.id, 'initialStock', e.target.value)}
                      placeholder="0"
                      disabled={disabled}
                    />
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button
                        type="button"
                        className="ecu-matrix-pill__remove"
                        style={{ width: 26, height: 26 }}
                        onClick={() => handleDuplicateVariantRow(row.id)}
                        disabled={disabled}
                        title="Duplicar esta variante"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        className="ecu-matrix-pill__remove"
                        style={{ width: 26, height: 26, color: 'var(--glb-danger, #ef4444)' }}
                        onClick={() => deleteRow(row.id)}
                        disabled={disabled}
                        title="Eliminar esta fila de variante"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
              })}
            </tbody>
          </table>
        )}
        {rows.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 0.25rem 0.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleAddVariantRow}
                disabled={disabled}
              >
                <Plus size={14} /> Agregar Variante
              </Button>

            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
              {rows.length} {rows.length === 1 ? 'variante física configurada' : 'variantes físicas configuradas'}
            </span>
          </div>
        )}
      </div>

      {/* Modal para Asignar Foto a Variante Individual */}
      {singleRowImageTargetId && targetRowForSingle && (() => {
        const assigned = targetRowForSingle.stagedImages || []
        return (
          <Popup
            open={true}
            onClose={() => setSingleRowImageTargetId(null)}
            title="Fotografías de la Variante"
            width="540px"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'color-mix(in srgb, var(--shell-primary, #3b82f6) 6%, var(--glb-surface, #ffffff))',
                  border: '1px solid color-mix(in srgb, var(--shell-primary, #3b82f6) 20%, var(--shell-border, rgba(0,0,0,0.1)))',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', fontWeight: 600 }}>Variante física:</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--glb-text)', marginTop: '0.2rem' }}>
                  {targetRowForSingle.variantTitle}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--shell-primary, #2563eb)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                  SKU: {targetRowForSingle.sku}
                </div>
              </div>

              {/* Zona de subida directa de fotos desde el equipo */}
              <div
                onClick={() => singleFileInputRef.current?.click()}
                style={{
                  padding: '1.25rem 1rem',
                  borderRadius: '8px',
                  border: '2px dashed var(--shell-primary, #3b82f6)',
                  background: 'color-mix(in srgb, var(--shell-primary, #3b82f6) 4%, var(--glb-surface, #ffffff))',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  userSelect: 'none',
                }}
              >
                <Upload size={22} color="var(--shell-primary, #3b82f6)" />
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--glb-text)' }}>
                  Subir fotografías para esta variante
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                  Haz clic para seleccionar imágenes desde tu equipo (PNG, JPG o WebP)
                </div>
              </div>

              {/* Fotos actualmente asignadas */}
              {assigned.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--glb-text)', marginBottom: '0.4rem' }}>
                    Fotos de esta variante ({assigned.length}):
                  </div>
                  <div className="ecu-var-assigned-grid">
                    {assigned.map((img, idx) => (
                      <div key={img.id || idx} className="ecu-var-assigned-card">
                        <img src={img.previewUrl} alt={img.name || ''} />
                        {idx === 0 && <span className="ecu-var-assigned-card__badge">Foto 1</span>}
                        <button
                          type="button"
                          className="ecu-var-assigned-card__remove"
                          onClick={() => handleRemoveImageFromRow(targetRowForSingle.id, img.previewUrl)}
                          disabled={disabled}
                          title="Quitar esta foto de la variante"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Otras fotos disponibles */}
              {availableImages.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--glb-text)', marginBottom: '0.35rem' }}>
                    Otras fotos disponibles ({availableImages.length}):
                  </div>
                  <div className="ecu-var-gallery-grid">
                    {availableImages.map((img) => {
                      const isSelected = assigned.some((item) => item.previewUrl === img.previewUrl)
                      return (
                        <button
                          key={img.id}
                          type="button"
                          className={`ecu-var-gallery-item ${isSelected ? 'ecu-var-gallery-item--selected' : ''}`}
                          onClick={() => handleToggleGalleryImageInRow(targetRowForSingle.id, img)}
                          title={img.altText || img.file.name}
                        >
                          <img src={img.previewUrl} alt={img.altText || img.file.name} />
                          {isSelected && (
                            <div className="ecu-var-gallery-badge">
                              <Check size={11} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid var(--shell-border, rgba(0,0,0,0.08))' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {assigned.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAllRowImages(targetRowForSingle.id)}
                      disabled={disabled}
                      style={{ color: 'var(--glb-danger, #ef4444)' }}
                    >
                      <Trash2 size={14} /> Quitar todas
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setSingleRowImageTargetId(null)}
                >
                  Listo ({assigned.length})
                </Button>
              </div>
            </div>
          </Popup>
        )
      })()}

    </div>
  )
}

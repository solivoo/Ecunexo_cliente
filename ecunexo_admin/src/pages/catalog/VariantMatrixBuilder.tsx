import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ColorPicker, Select, TextBox, useToast } from 'glubox'
import { Camera, Copy, Layers, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import {
  createVariantDimensionTemplate,
  deleteVariantDimensionTemplate,
  listVariantDimensionTemplates,
  updateVariantDimensionTemplate,
} from '@/services/catalogApi'
import { listWarehouses } from '@/services/inventoryApi'
import type {
  CreateVariantChildPayload,
  VariantDimensionTemplateDto,
} from '@/types/catalogApi'
import type { WarehouseListItemDto } from '@/types/inventoryApi'
import './variantMatrixBuilder.css'

export type DimensionState = {
  id: string
  name: string
  dimensionType: string
  selectedTemplateId: string
  values: string[]
  activeValues: string[]
  newValInput: string
  newColorHex: string
}

export type VariantRowState = {
  id: string
  dimensionValues: Record<string, string>
  variationLabel: string
  variantTitle: string
  sku: string
  isManualSku?: boolean
  barcode: string
  basePrice: string
  isManualPrice?: boolean
  initialStock: string
  warehouseId: string
  stagedImage?: File | null
  stagedImagePreview?: string | null
  secondaryAttributeValue?: string
}

export type MatrixVariantPayloadWithImage = CreateVariantChildPayload & {
  stagedImage?: File | null
}

export type VariantMatrixBuilderProps = {
  tenantId: string | null
  baseName: string
  baseSku: string
  basePrice: string
  disabled?: boolean
  onChange: (data: {
    variants: MatrixVariantPayloadWithImage[]
    variantDimensionsJson: string
    dimensionNames: string[]
    isValid: boolean
  }) => void
}

const DEFAULT_FALLBACK_TEMPLATES: VariantDimensionTemplateDto[] = [
  {
    id: 'system-socks',
    tenantId: 'system',
    name: 'Medias / Calcetines (Tallas)',
    dimensionType: 'Talla',
    predefinedValuesJson: '["35-38","39-41","42-44"]',
    isSystemDefault: true,
  },
  {
    id: 'system-sock-height',
    tenantId: 'system',
    name: 'Tipo de Caña / Altura (Calcetines)',
    dimensionType: 'Caña / Altura',
    predefinedValuesJson: '["Invisible / Talonera","Tobillero / Corto","Media Caña / Crew","Caña Alta / Largo"]',
    isSystemDefault: true,
  },
  {
    id: 'system-clothing',
    tenantId: 'system',
    name: 'Ropa Adulto (Tallas)',
    dimensionType: 'Talla',
    predefinedValuesJson: '["XS","S","M","L","XL","XXL"]',
    isSystemDefault: true,
  },
  {
    id: 'system-sleeve',
    tenantId: 'system',
    name: 'Largo de Manga (Camisas)',
    dimensionType: 'Manga',
    predefinedValuesJson: '["Manga Corta","Manga Larga","Tres Cuartos (3/4)","Sin Mangas"]',
    isSystemDefault: true,
  },
  {
    id: 'system-shoes',
    tenantId: 'system',
    name: 'Calzado Adulto (Ecuador)',
    dimensionType: 'Talla',
    predefinedValuesJson: '["36","37","38","39","40","41","42","43","44"]',
    isSystemDefault: true,
  },
  {
    id: 'system-pants',
    tenantId: 'system',
    name: 'Pantalones / Jeans (Cintura)',
    dimensionType: 'Talla',
    predefinedValuesJson: '["28","30","32","34","36","38"]',
    isSystemDefault: true,
  },
  {
    id: 'system-colors',
    tenantId: 'system',
    name: 'Colores Básicos',
    dimensionType: 'Color',
    predefinedValuesJson: '["Negro","Blanco","Azul","Rojo","Gris","Verde"]',
    isSystemDefault: true,
  },
]

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

function cartesianProduct(arrays: string[][]): string[][] {
  if (arrays.length === 0) return []
  return arrays.reduce<string[][]>(
    (acc, curr) => {
      const res: string[][] = []
      acc.forEach((a) => {
        curr.forEach((b) => {
          res.push([...a, b])
        })
      })
      return res
    },
    [[]]
  )
}

function isColorDimension(name: string, type?: string, tplId?: string): boolean {
  const nameLower = (name || '').toLowerCase().trim()
  const typeLower = (type || '').toLowerCase().trim()
  return (
    nameLower.includes('color') ||
    typeLower.includes('color') ||
    tplId === 'system-colors'
  )
}

export function VariantMatrixBuilder({
  tenantId,
  baseName,
  baseSku,
  basePrice,
  disabled = false,
  onChange,
}: VariantMatrixBuilderProps) {
  const toast = useToast()

  // Catalogs
  const [templates, setTemplates] = useState<VariantDimensionTemplateDto[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseListItemDto[]>([])

  // Color Hex Map
  const [colorHexMap, setColorHexMap] = useState<Record<string, string>>(DEFAULT_COLOR_MAP)

  // Dynamic Dimensions Array (N dimensions)
  const [dimensions, setDimensions] = useState<DimensionState[]>([
    {
      id: 'dim-1',
      name: 'Talla',
      dimensionType: 'Talla',
      selectedTemplateId: 'system-socks',
      values: ['35-38', '39-41', '42-44'],
      activeValues: ['35-38', '39-41', '42-44'],
      newValInput: '',
      newColorHex: '#2563eb',
    },
  ])

  // Custom template creation state
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false)

  // Generated Variant Rows
  const [rows, setRows] = useState<VariantRowState[]>([])

  // Global warehouse selection for bulk
  const [bulkWarehouseId, setBulkWarehouseId] = useState<string>('')

  // SKU Generation Format: hierarchical sequential (e.g. NIK-001-0001) vs attribute slug (e.g. NIK-001-CANA-CORTA)
  const [skuFormat, setSkuFormat] = useState<'hierarchical' | 'name'>('hierarchical')

  // Fetch templates and warehouses on mount
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    void (async () => {
      try {
        const [tpls, whs] = await Promise.all([
          listVariantDimensionTemplates(tenantId).catch(() => []),
          listWarehouses(tenantId).catch(() => []),
        ])
        if (!cancelled) {
          setTemplates(tpls.length > 0 ? tpls : DEFAULT_FALLBACK_TEMPLATES)
          setWarehouses(whs)
          if (whs.length > 0) {
            setBulkWarehouseId(whs[0].id)
          }
        }
      } catch {
        if (!cancelled) {
          setTemplates(DEFAULT_FALLBACK_TEMPLATES)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId])

  // Helper para mostrar el tipo de escala en español legible
  const formatDimTypeLabel = (type?: string) => {
    const lower = (type || '').toLowerCase().trim()
    if (lower === 'size' || lower === 'talla') return 'Tallas'
    if (lower === 'color') return 'Colores'
    if (lower.includes('caña') || lower.includes('altura')) return 'Caña / Altura'
    if (lower.includes('manga')) return 'Manga'
    return type || 'Personalizada'
  }

  // Template options for selects
  const templateOptions = useMemo(() => {
    return [
      ...templates.map((t) => ({
        value: t.id,
        label: `${t.name} (${formatDimTypeLabel(t.dimensionType)})`,
      })),
      { value: 'custom', label: 'Personalizada (definir valores manualmente)' },
    ]
  }, [templates])

  // Add new dimension (up to 4)
  const handleAddDimension = useCallback(() => {
    if (dimensions.length >= 4) {
      toast.show({
        variant: 'warning',
        title: 'Límite de dimensiones',
        message: 'Se permiten hasta 4 dimensiones simultáneas para evitar una saturación combinatoria de inventario.',
      })
      return
    }

    const hasColor = dimensions.some((d) => isColorDimension(d.name, d.dimensionType, d.selectedTemplateId))
    const hasHeight = dimensions.some((d) => d.name.toLowerCase().includes('caña') || d.name.toLowerCase().includes('altura'))

    let nextTplId = 'custom'
    let nextName = `Dimensión ${dimensions.length + 1}`
    let nextType = 'Personalizada'
    let nextValues: string[] = []

    if (!hasHeight && dimensions[0]?.name.toLowerCase().includes('talla')) {
      const heightTpl = templates.find((t) => t.id === 'system-sock-height')
      if (heightTpl) {
        nextTplId = heightTpl.id
        nextName = 'Caña / Altura'
        nextType = 'Caña / Altura'
        try {
          nextValues = JSON.parse(heightTpl.predefinedValuesJson) as string[]
        } catch {
          nextValues = ['Invisible', 'Tobillero', 'Media Caña', 'Caña Alta']
        }
      }
    } else if (!hasColor) {
      const colorTpl = templates.find((t) => t.id === 'system-colors')
      if (colorTpl) {
        nextTplId = colorTpl.id
        nextName = 'Color'
        nextType = 'Color'
        try {
          nextValues = JSON.parse(colorTpl.predefinedValuesJson) as string[]
        } catch {
          nextValues = ['Negro', 'Blanco', 'Azul']
        }
      }
    }

    const newDim: DimensionState = {
      id: `dim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: nextName,
      dimensionType: nextType,
      selectedTemplateId: nextTplId,
      values: nextValues,
      activeValues: nextValues,
      newValInput: '',
      newColorHex: '#2563eb',
    }

    setDimensions((prev) => [...prev, newDim])
  }, [dimensions, templates, toast])

  // Remove a dimension
  const handleRemoveDimension = useCallback((dimId: string) => {
    setDimensions((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((d) => d.id !== dimId)
    })
  }, [])

  // Template change in a dimension
  const handleTemplateChange = useCallback(
    (dimId: string, templateId: string) => {
      setDimensions((prev) =>
        prev.map((d) => {
          if (d.id !== dimId) return d
          if (templateId === 'custom') {
            return { ...d, selectedTemplateId: 'custom' }
          }
          const tpl = templates.find((t) => t.id === templateId)
          if (!tpl) return { ...d, selectedTemplateId: templateId }
          try {
            const parsed = JSON.parse(tpl.predefinedValuesJson) as string[]
            if (Array.isArray(parsed)) {
              const rawType = (tpl.dimensionType || '').toLowerCase()
              const dimLabel =
                rawType === 'size'
                  ? 'Talla'
                  : rawType === 'color'
                  ? 'Color'
                  : (tpl.dimensionType || d.name)
              return {
                ...d,
                selectedTemplateId: templateId,
                name: dimLabel,
                dimensionType: tpl.dimensionType || 'Personalizada',
                values: parsed,
                activeValues: parsed,
              }
            }
          } catch {
            // ignore
          }
          return { ...d, selectedTemplateId: templateId }
        })
      )
    },
    [templates]
  )

  // Update dimension name
  const handleUpdateDimensionName = useCallback((dimId: string, newName: string) => {
    setDimensions((prev) =>
      prev.map((d) => (d.id === dimId ? { ...d, name: newName } : d))
    )
  }, [])

  // Toggle active value in dimension
  const handleToggleValue = useCallback((dimId: string, val: string) => {
    setDimensions((prev) =>
      prev.map((d) => {
        if (d.id !== dimId) return d
        const nextActive = d.activeValues.includes(val)
          ? d.activeValues.filter((v) => v !== val)
          : [...d.activeValues, val]
        return { ...d, activeValues: nextActive }
      })
    )
  }, [])

  // Add custom value to dimension
  const handleAddValue = useCallback(
    (dimId: string) => {
      setDimensions((prev) =>
        prev.map((d) => {
          if (d.id !== dimId) return d
          const trimmed = d.newValInput.trim()
          if (!trimmed) return d

          const isColor = isColorDimension(d.name, d.dimensionType, d.selectedTemplateId)
          if (isColor && d.newColorHex) {
            setColorHexMap((cPrev) => ({ ...cPrev, [trimmed]: d.newColorHex }))
          }

          const nextValues = d.values.includes(trimmed) ? d.values : [...d.values, trimmed]
          const nextActive = d.activeValues.includes(trimmed) ? d.activeValues : [...d.activeValues, trimmed]

          return {
            ...d,
            values: nextValues,
            activeValues: nextActive,
            newValInput: '',
          }
        })
      )
    },
    []
  )

  // Remove value from dimension
  const handleRemoveValue = useCallback((dimId: string, val: string) => {
    setDimensions((prev) =>
      prev.map((d) => {
        if (d.id !== dimId) return d
        return {
          ...d,
          values: d.values.filter((v) => v !== val),
          activeValues: d.activeValues.filter((v) => v !== val),
        }
      })
    )
  }, [])

  // Update input text in dimension
  const handleNewValInputChange = useCallback((dimId: string, text: string) => {
    setDimensions((prev) =>
      prev.map((d) => (d.id === dimId ? { ...d, newValInput: text } : d))
    )
  }, [])

  // Update color hex in dimension
  const handleColorHexChange = useCallback((dimId: string, hex: string) => {
    setDimensions((prev) =>
      prev.map((d) => (d.id === dimId ? { ...d, newColorHex: hex } : d))
    )
  }, [])

  // Generate Cartesian combinations when active dimensions change
  useEffect(() => {
    const prefix = sanitizeSkuPart(baseSku) || 'ITEM'
    const defaultPrice = basePrice.trim() ? basePrice.trim() : ''

    const activeDims = dimensions.filter((d) => d.activeValues.length > 0)
    if (activeDims.length === 0) {
      setRows([])
      return
    }

    const arraysToMultiply = activeDims.map((d) => d.activeValues)
    const combinations = cartesianProduct(arraysToMultiply)

    setRows((prev) => {
      return combinations.map((comb, combIdx) => {
        const id = comb.map(sanitizeSkuPart).join('_')
        const existing = prev.find((r) => r.id === id)

        const variationLabel = comb.join(' / ')
        const autoTitle = baseName.trim() ? `${baseName.trim()} - ${variationLabel}` : variationLabel

        const identifier = String(combIdx + 1).padStart(4, '0')
        const generatedSku = skuFormat === 'hierarchical'
          ? `${prefix}-${identifier}`
          : `${prefix}-${comb.map(sanitizeSkuPart).join('-')}`

        const dimensionValues: Record<string, string> = {}
        activeDims.forEach((dim, idx) => {
          dimensionValues[dim.name] = comb[idx]
        })

        if (existing) {
          const finalSku = existing.isManualSku ? existing.sku : generatedSku
          const finalPrice = existing.isManualPrice ? existing.basePrice : (defaultPrice || existing.basePrice)

          return {
            ...existing,
            dimensionValues,
            variationLabel,
            variantTitle: existing.variantTitle || autoTitle,
            sku: finalSku,
            basePrice: finalPrice,
          }
        }

        return {
          id,
          dimensionValues,
          variationLabel,
          variantTitle: autoTitle,
          sku: generatedSku,
          isManualSku: false,
          barcode: '',
          basePrice: defaultPrice,
          isManualPrice: false,
          initialStock: '',
          warehouseId: bulkWarehouseId,
          stagedImage: null,
          stagedImagePreview: null,
          secondaryAttributeValue: '',
        }
      })
    })
  }, [dimensions, baseSku, basePrice, baseName, bulkWarehouseId, skuFormat])

  // Bulk actions
  const handleCopyBasePrice = useCallback(() => {
    if (!basePrice.trim()) {
      toast.show({
        variant: 'warning',
        title: 'Sin precio base',
        message: 'Ingresa primero un precio base de venta en la información general.',
      })
      return
    }
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        basePrice: basePrice.trim(),
        isManualPrice: false,
      }))
    )
    toast.show({
      variant: 'success',
      title: 'Precios sincronizados',
      message: `Se aplicó y heredó el precio de $${basePrice.trim()} a todas las variantes.`,
    })
  }, [basePrice, toast])

  const handleRegenerateSkus = useCallback((format?: 'hierarchical' | 'name') => {
    const targetFormat = format ?? skuFormat
    const prefix = sanitizeSkuPart(baseSku) || 'ITEM'
    setRows((prev) =>
      prev.map((r, idx) => {
        const activeVals = Object.values(r.dimensionValues || {})
        const sku = targetFormat === 'hierarchical'
          ? `${prefix}-${String(idx + 1).padStart(4, '0')}`
          : activeVals.length > 0
            ? `${prefix}-${activeVals.map(sanitizeSkuPart).join('-')}`
            : `${prefix}-${sanitizeSkuPart(r.variantTitle)}`
        return { ...r, sku, isManualSku: false }
      })
    )
    toast.show({
      variant: 'success',
      title: 'SKUs regenerados',
      message: targetFormat === 'hierarchical'
        ? `Se generaron los códigos jerárquicos secuenciales «${prefix}-0001», etc.`
        : `Los códigos SKU se sincronizaron con los nombres de dimensión.`,
    })
  }, [baseSku, skuFormat, toast])

  // Row field update
  const updateRow = useCallback((id: string, field: keyof VariantRowState, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        if (field === 'sku') {
          updated.isManualSku = true
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
      if (target?.stagedImagePreview) {
        URL.revokeObjectURL(target.stagedImagePreview)
      }
      return prev.filter((r) => r.id !== id)
    })
  }, [])

  // Row image handlers
  const handleRowImageSelect = useCallback((id: string, file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        if (r.stagedImagePreview) {
          URL.revokeObjectURL(r.stagedImagePreview)
        }
        return {
          ...r,
          stagedImage: file,
          stagedImagePreview: previewUrl,
        }
      })
    )
  }, [])

  const handleRemoveRowImage = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        if (r.stagedImagePreview) {
          URL.revokeObjectURL(r.stagedImagePreview)
        }
        return {
          ...r,
          stagedImage: null,
          stagedImagePreview: null,
        }
      })
    )
  }, [])

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

  // Save dimension as custom template
  const handleSaveDimensionAsTemplate = useCallback(
    async (dim: DimensionState) => {
      if (!tenantId || dim.values.length === 0) return
      setSavingTemplate(true)
      try {
        const templateName = `${dim.name} (${dim.values.slice(0, 3).join(', ')}...)`
        const res = await createVariantDimensionTemplate(tenantId, {
          name: templateName,
          dimensionType: dim.name.trim() || 'Personalizada',
          predefinedValuesJson: JSON.stringify(dim.values),
        })
        toast.show({
          variant: 'success',
          title: 'Plantilla guardada',
          message: `Escala «${templateName}» guardada como plantilla reutilizable.`,
        })
        const refreshed = await listVariantDimensionTemplates(tenantId).catch(() => [])
        setTemplates(refreshed.length > 0 ? refreshed : DEFAULT_FALLBACK_TEMPLATES)
        setDimensions((prev) =>
          prev.map((d) => (d.id === dim.id ? { ...d, selectedTemplateId: res.id } : d))
        )
      } catch {
        toast.show({
          variant: 'error',
          title: 'Error',
          message: 'No se pudo guardar la plantilla de escala.',
        })
      } finally {
        setSavingTemplate(false)
      }
    },
    [tenantId, toast]
  )

  // Update existing custom template
  const handleUpdateTemplate = useCallback(
    async (dim: DimensionState) => {
      const curTpl = templates.find((t) => t.id === dim.selectedTemplateId)
      if (!tenantId || !curTpl || curTpl.isSystemDefault) return
      setSavingTemplate(true)
      try {
        await updateVariantDimensionTemplate(tenantId, curTpl.id, {
          name: curTpl.name,
          dimensionType: dim.name.trim() || curTpl.dimensionType,
          predefinedValuesJson: JSON.stringify(dim.values),
        })
        toast.show({
          variant: 'success',
          title: 'Plantilla actualizada',
          message: `Los cambios en «${curTpl.name}» se guardaron.`,
        })
        const refreshed = await listVariantDimensionTemplates(tenantId).catch(() => [])
        setTemplates(refreshed.length > 0 ? refreshed : DEFAULT_FALLBACK_TEMPLATES)
      } catch {
        toast.show({
          variant: 'error',
          title: 'Error',
          message: 'No se pudo actualizar la plantilla.',
        })
      } finally {
        setSavingTemplate(false)
      }
    },
    [templates, tenantId, toast]
  )

  // Delete existing custom template
  const handleDeleteTemplate = useCallback(
    async (dim: DimensionState) => {
      const curTpl = templates.find((t) => t.id === dim.selectedTemplateId)
      if (!tenantId || !curTpl || curTpl.isSystemDefault) return
      if (!window.confirm(`¿Estás seguro de eliminar la escala personalizada «${curTpl.name}»?`)) return
      setSavingTemplate(true)
      try {
        await deleteVariantDimensionTemplate(tenantId, curTpl.id)
        toast.show({
          variant: 'success',
          title: 'Plantilla eliminada',
          message: `La escala «${curTpl.name}» fue eliminada.`,
        })
        const refreshed = await listVariantDimensionTemplates(tenantId).catch(() => [])
        setTemplates(refreshed.length > 0 ? refreshed : DEFAULT_FALLBACK_TEMPLATES)
        setDimensions((prev) =>
          prev.map((d) => (d.id === dim.id ? { ...d, selectedTemplateId: 'custom' } : d))
        )
      } catch {
        toast.show({
          variant: 'error',
          title: 'Error',
          message: 'No se pudo eliminar la plantilla.',
        })
      } finally {
        setSavingTemplate(false)
      }
    },
    [templates, tenantId, toast]
  )

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

      const customAttrs: Record<string, string> = {}
      if (r.secondaryAttributeValue?.trim()) {
        customAttrs['actividad'] = r.secondaryAttributeValue.trim()
      }

      return {
        variantTitle: r.variantTitle.trim(),
        sku: r.sku.trim(),
        barcode: r.barcode.trim() || null,
        basePrice: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
        customAttributesJson: Object.keys(customAttrs).length > 0 ? JSON.stringify(customAttrs) : null,
        initialStock: parsedStock != null && !Number.isNaN(parsedStock) && parsedStock > 0 ? parsedStock : null,
        initialStockWarehouseId: r.warehouseId || (bulkWarehouseId || null),
        stagedImage: r.stagedImage,
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
    bulkWarehouseId,
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddDimension}
            disabled={disabled || dimensions.length >= 4}
            title={dimensions.length >= 4 ? 'Máximo 4 dimensiones alcanzado' : 'Añadir un nuevo eje de variación (ej. Caña, Color, Grosor)'}
          >
            <Plus size={14} style={{ marginRight: '0.35rem' }} />
            Añadir Dimensión ({dimensions.length}/4)
          </Button>
        </div>
      </div>

      {/* Dynamic Dimensions Configuration Cards */}
      <div
        className={`ecu-matrix-builder__dimensions ${
          dimensions.length > 1 ? 'ecu-matrix-builder__dimensions--grid' : ''
        }`}
      >
        {dimensions.map((dim, idx) => {
          const isColor = isColorDimension(dim.name, dim.dimensionType, dim.selectedTemplateId)
          const curTpl = templates.find((t) => t.id === dim.selectedTemplateId)

          return (
            <div key={dim.id} className="ecu-matrix-dim-card">
              <div className="ecu-matrix-dim-card__top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    className="ecu-matrix-dim-card__badge"
                    style={{
                      color: idx === 0 ? 'var(--shell-primary, #4f46e5)' : idx === 1 ? '#0284c7' : '#10b981',
                      background: idx === 0 ? 'rgba(79, 70, 229, 0.08)' : idx === 1 ? 'rgba(2, 132, 199, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    }}
                  >
                    Dimensión {idx + 1}: {dim.name || 'Personalizada'}
                  </span>
                  {curTpl && (
                    <span
                      style={{
                        fontSize: '0.725rem',
                        color: curTpl.isSystemDefault ? 'var(--glb-muted)' : '#10b981',
                        fontWeight: curTpl.isSystemDefault ? 400 : 600,
                      }}
                    >
                      {curTpl.isSystemDefault ? 'Base del sistema' : 'Personalizada'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {dim.selectedTemplateId === 'custom' && dim.values.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={savingTemplate}
                      onClick={() => void handleSaveDimensionAsTemplate(dim)}
                      disabled={disabled || savingTemplate}
                      title="Guardar como plantilla reutilizable para la empresa"
                    >
                      Guardar escala
                    </Button>
                  )}
                  {curTpl && !curTpl.isSystemDefault && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={savingTemplate}
                        onClick={() => void handleUpdateTemplate(dim)}
                        disabled={disabled || savingTemplate}
                        title="Actualizar valores en esta plantilla"
                      >
                        Guardar cambios
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={savingTemplate}
                        onClick={() => void handleDeleteTemplate(dim)}
                        disabled={disabled || savingTemplate}
                        title="Eliminar esta plantilla personalizada"
                      >
                        <Trash2 size={13} style={{ color: '#ef4444' }} />
                      </Button>
                    </>
                  )}
                  {dimensions.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveDimension(dim.id)}
                      disabled={disabled}
                      title="Quitar esta dimensión"
                    >
                      ✕ Quitar
                    </Button>
                  )}
                </div>
              </div>

              <div className="ecu-matrix-dim-card__fields">
                <Select
                  id={`mat-tpl-${dim.id}`}
                  label="Plantilla de Escala"
                  labelPosition="outlined"
                  variant="outline"
                  options={templateOptions}
                  value={dim.selectedTemplateId}
                  onChange={(tplId) => handleTemplateChange(dim.id, tplId)}
                  disabled={disabled}
                  fullWidth
                />
                <TextBox
                  id={`mat-dim-name-${dim.id}`}
                  label="Nombre / Tipo de Atributo"
                  labelPosition="outlined"
                  variant="outline"
                  value={dim.name}
                  onChange={(e) => handleUpdateDimensionName(dim.id, e.target.value)}
                  placeholder="Ej. Talla, Caña / Altura, Color, Grosor"
                  disabled={disabled}
                  fullWidth
                />
              </div>

              <div className="ecu-matrix-pills-wrap">
                <span className="ecu-matrix-pills-label">
                  Valores activos (haz clic para activar o excluir):
                </span>
                <div className="ecu-matrix-pills-list">
                  {dim.values.map((val) => {
                    const isActive = dim.activeValues.includes(val)
                    const colorHex = colorHexMap[val]
                    return (
                      <span
                        key={val}
                        className={`ecu-matrix-pill ${isActive ? 'ecu-matrix-pill--active' : ''}`}
                        onClick={() => handleToggleValue(dim.id, val)}
                      >
                        {(isColor || colorHex) && (
                          <span
                            className="ecu-color-swatch-dot"
                            style={{ backgroundColor: colorHex || '#94a3b8' }}
                          />
                        )}
                        <span>{val}</span>
                        <span
                          className="ecu-matrix-pill__remove"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveValue(dim.id, val)
                          }}
                          title="Eliminar valor"
                        >
                          <X size={12} />
                        </span>
                      </span>
                    )
                  })}
                </div>

                {isColor ? (
                  <div className="ecu-matrix-color-add-row">
                    <div style={{ width: 140 }}>
                      <ColorPicker
                        id={`mat-color-picker-${dim.id}`}
                        label="Color"
                        labelPosition="outlined"
                        variant="outline"
                        size="sm"
                        value={dim.newColorHex}
                        onChange={(hex) => handleColorHexChange(dim.id, hex)}
                        disabled={disabled}
                        fullWidth
                      />
                    </div>
                    <TextBox
                      id={`mat-add-val-${dim.id}`}
                      placeholder="Nombre del color (ej. Azul Marino, Rojo)…"
                      variant="outline"
                      value={dim.newValInput}
                      onChange={(e) => handleNewValInputChange(dim.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddValue(dim.id)
                        }
                      }}
                      disabled={disabled}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddValue(dim.id)}
                      disabled={disabled || !dim.newValInput.trim()}
                    >
                      <Plus size={14} /> Añadir Color
                    </Button>
                  </div>
                ) : (
                  <div className="ecu-matrix-add-val">
                    <TextBox
                      id={`mat-add-val-${dim.id}`}
                      placeholder={`Añadir valor a ${dim.name} (ej. Corto, Largo, 3XL)…`}
                      variant="outline"
                      value={dim.newValInput}
                      onChange={(e) => handleNewValInputChange(dim.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddValue(dim.id)
                        }
                      }}
                      disabled={disabled}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddValue(dim.id)}
                      disabled={disabled || !dim.newValInput.trim()}
                    >
                      <Plus size={14} /> Añadir
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bulk Actions & Count Bar */}
      <div className="ecu-matrix-bulk-bar">
        <div className="ecu-matrix-bulk-bar__left">
          <span className="ecu-matrix-bulk-bar__count">
            {rows.length} {rows.length === 1 ? 'variante generada' : 'variantes generadas'}
          </span>
          {warehouses.length > 0 && (
            <div style={{ minWidth: 200 }}>
              <Select
                id="mat-bulk-wh"
                label="Bodega para stock inicial"
                labelPosition="outlined"
                variant="outline"
                size="sm"
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                value={bulkWarehouseId}
                onChange={setBulkWarehouseId}
                disabled={disabled}
                fullWidth
              />
            </div>
          )}
        </div>

        <div className="ecu-matrix-bulk-bar__actions">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--shell-surface-subtle, rgba(255,255,255,0.04))', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid var(--shell-border, rgba(255,255,255,0.08))' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Formato SKU:</span>
            <button
              type="button"
              onClick={() => {
                setSkuFormat('hierarchical')
                handleRegenerateSkus('hierarchical')
              }}
              style={{
                background: skuFormat === 'hierarchical' ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: skuFormat === 'hierarchical' ? 'var(--shell-primary, #60a5fa)' : 'var(--glb-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.4rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: skuFormat === 'hierarchical' ? 600 : 400,
              }}
              title="Formato jerárquico secuencial: PADRE-0001, PADRE-0002"
            >
              Jerárquico (0001)
            </button>
            <button
              type="button"
              onClick={() => {
                setSkuFormat('name')
                handleRegenerateSkus('name')
              }}
              style={{
                background: skuFormat === 'name' ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: skuFormat === 'name' ? 'var(--shell-primary, #60a5fa)' : 'var(--glb-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.4rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: skuFormat === 'name' ? 600 : 400,
              }}
              title="Formato por nombres de atributos: PADRE-CORTA-BLA"
            >
              Por Atributos
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyBasePrice}
            disabled={disabled || !basePrice.trim() || rows.length === 0}
            title="Aplica y hereda el precio base a todas las variantes"
          >
            <Copy size={13} /> Heredar precio base ({basePrice.trim() ? `$${basePrice.trim()}` : '$0.00'})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleRegenerateSkus()}
            disabled={disabled || rows.length === 0}
            title="Regenera SKUs con el formato seleccionado"
          >
            <RefreshCw size={13} /> Regenerar SKUs
          </Button>
        </div>
      </div>

      {/* Variants Table */}
      <div className="ecu-matrix-table-wrap">
        {rows.length === 0 ? (
          <div className="ecu-matrix-empty">
            No hay variantes activas. Selecciona al menos un valor en cada dimensión para generar combinaciones.
          </div>
        ) : (
          <table className="ecu-matrix-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ width: 70, textAlign: 'center' }}>Foto</th>
                <th style={{ width: 160 }}>Variación</th>
                <th style={{ width: 160 }}>Título Variante</th>
                <th style={{ width: 160 }}>SKU (Obligatorio)</th>
                <th style={{ width: 140 }}>Actividad / Uso</th>
                <th style={{ width: 120 }}>Cód. Barras</th>
                <th style={{ width: 120 }}>Precio Base ($)</th>
                <th style={{ width: 95 }}>Stock Inicial</th>
                <th style={{ width: 44, textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id}>
                  <td style={{ color: 'var(--glb-muted)' }}>{idx + 1}</td>
                  <td style={{ textAlign: 'center' }}>
                    {row.stagedImagePreview ? (
                      <div className="ecu-var-img-preview" title="Foto de la variante">
                        <img src={row.stagedImagePreview} alt={row.variantTitle} />
                        <button
                          type="button"
                          className="ecu-var-img-remove"
                          onClick={() => handleRemoveRowImage(row.id)}
                          disabled={disabled}
                          title="Quitar foto"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label className="ecu-var-img-upload-btn" title="Subir foto de esta variante (.jpg/.png)">
                        <Camera size={15} />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={disabled}
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleRowImageSelect(row.id, file)
                            }
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {Object.entries(row.dimensionValues || {}).map(([dimName, val], i, arr) => {
                        const isColor = isColorDimension(dimName)
                        const hex = colorHexMap[val]
                        return (
                          <span key={dimName} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {(isColor || hex) && (
                              <span
                                className="ecu-color-swatch-dot"
                                style={{ backgroundColor: hex || '#94a3b8' }}
                                title={val}
                              />
                            )}
                            <strong>{val}</strong>
                            {i < arr.length - 1 && <span style={{ color: 'var(--glb-muted)' }}>/</span>}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.variantTitle}
                      onChange={(e) => updateRow(row.id, 'variantTitle', e.target.value)}
                      placeholder="Título variante"
                      disabled={disabled}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="ecu-table-sku"
                      value={row.sku}
                      onChange={(e) => updateRow(row.id, 'sku', e.target.value.toUpperCase())}
                      placeholder="SKU-VAR"
                      disabled={disabled}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.secondaryAttributeValue ?? ''}
                      onChange={(e) => updateRow(row.id, 'secondaryAttributeValue', e.target.value)}
                      placeholder="Ej. Running, Skater..."
                      disabled={disabled}
                      style={{ fontSize: '0.82rem' }}
                      title="Especificación o actividad para esta variante"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.barcode}
                      onChange={(e) => updateRow(row.id, 'barcode', e.target.value)}
                      placeholder="786..."
                      disabled={disabled}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.basePrice}
                        onChange={(e) => {
                          updateRow(row.id, 'basePrice', e.target.value)
                        }}
                        placeholder={basePrice.trim() ? `${basePrice.trim()}` : '0.00'}
                        disabled={disabled}
                      />
                      {!row.isManualPrice && basePrice.trim() && (
                        <span style={{ fontSize: '0.68rem', color: '#10b981', fontStyle: 'italic' }}>
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
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="ecu-matrix-pill__remove"
                      style={{ width: 24, height: 24 }}
                      onClick={() => deleteRow(row.id)}
                      disabled={disabled}
                      title="Eliminar esta fila de variante"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

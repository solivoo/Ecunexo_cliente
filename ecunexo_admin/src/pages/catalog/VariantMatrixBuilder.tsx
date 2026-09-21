import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, ColorPicker, Popup, Select, TextBox, useToast } from 'glubox'
import { Camera, Check, Copy, Image as ImageIcon, Layers, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react'
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
  tenantId,
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

  // Image Assignment State
  const [singleRowImageTargetId, setSingleRowImageTargetId] = useState<string | null>(null)
  const [isBulkImageModalOpen, setIsBulkImageModalOpen] = useState<boolean>(false)
  const [bulkDimName, setBulkDimName] = useState<string>('')
  const [bulkDimVal, setBulkDimVal] = useState<string>('')
  const [bulkSelectedImage, setBulkSelectedImage] = useState<{ file: File; previewUrl: string; name?: string } | null>(null)

  const singleFileInputRef = useRef<HTMLInputElement | null>(null)
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null)

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
      activeValues: ['35-38'],
      newValInput: '',
      newColorHex: '#2563eb',
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
        selectedTemplateId: 'custom',
        values,
        activeValues: [values[0]],
        newValInput: '',
        newColorHex: '#2563eb',
      }
    })
    setDimensions(newDims)
  }, [initialDimensions])

  // Custom template creation state
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false)

  // Generated Variant Rows
  const [rows, setRows] = useState<VariantRowState[]>([])

  // Global warehouse selection for bulk
  const [bulkWarehouseId, setBulkWarehouseId] = useState<string>('')

  // SKU Generation Format: hierarchical sequential (e.g. NIK-001-0001) vs attribute slug (e.g. NIK-001-CANA-CORTA)
  const [skuFormat, setSkuFormat] = useState<'hierarchical' | 'name'>('name')

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
        dimensionValues[d.name] = d.activeValues[0] || d.values[0] || ''
      })

      const variationLabel = Object.values(dimensionValues).filter(Boolean).join(' / ')
      const autoTitle = baseName.trim()
        ? (variationLabel ? `${baseName.trim()} - ${variationLabel}` : baseName.trim())
        : (variationLabel || 'Variante 1')

      const dimValues = Object.values(dimensionValues).filter(Boolean)
      const generatedSku = skuFormat === 'hierarchical'
        ? `${prefix}-0001`
        : dimValues.length > 0
          ? `${prefix}-${dimValues.map(sanitizeSkuPart).join('-')}`
          : `${prefix}-VAR1`

      setRows([
        {
          id: `var-init-${Date.now()}`,
          dimensionValues,
          variationLabel,
          variantTitle: autoTitle,
          isManualTitle: false,
          sku: generatedSku,
          isManualSku: false,
          barcode: '',
          basePrice: defaultPrice,
          isManualPrice: false,
          initialStock: '',
          warehouseId: bulkWarehouseId,
          stagedImage: null,
          stagedImagePreview: null,
          stagedImages: [],
          variantTags: '',
        },
      ])
    }
  }, [dimensions, baseSku, baseName, basePrice, skuFormat, bulkWarehouseId, rows.length])

  // Sincronizar título y SKU base cuando cambian baseName o baseSku (si no fueron editados manualmente)
  useEffect(() => {
    const prefix = getVariantSkuPrefix(baseSku, baseName)
    setRows((prev) =>
      prev.map((r, idx) => {
        let title = r.variantTitle
        if (!r.isManualTitle && baseName.trim()) {
          const varLabel = Object.values(r.dimensionValues || {}).filter(Boolean).join(' / ')
          title = varLabel ? `${baseName.trim()} - ${varLabel}` : baseName.trim()
        }
        let sku = r.sku
        if (!r.isManualSku) {
          const dimVals = Object.values(r.dimensionValues || {}).filter(Boolean)
          sku = skuFormat === 'hierarchical'
            ? `${prefix}-${String(idx + 1).padStart(4, '0')}`
            : dimVals.length > 0
              ? `${prefix}-${dimVals.map(sanitizeSkuPart).join('-')}`
              : `${prefix}-${sanitizeSkuPart(title)}`
        }
        return { ...r, variantTitle: title, sku }
      })
    )
  }, [baseSku, baseName, skuFormat])

  // Cambio de dimensión en una fila específica (selección por variante)
  const handleRowDimensionChange = useCallback(
    (rowId: string, dimName: string, newValue: string) => {
      setRows((prev) =>
        prev.map((r, idx) => {
          if (r.id !== rowId) return r
          const updatedDims = { ...r.dimensionValues, [dimName]: newValue }
          const variationLabel = Object.values(updatedDims).filter(Boolean).join(' / ')
          const autoTitle = baseName.trim() ? `${baseName.trim()} - ${variationLabel}` : variationLabel

          const prefix = getVariantSkuPrefix(baseSku, baseName)
          const dimValues = Object.values(updatedDims).filter(Boolean)
          const autoSku = skuFormat === 'hierarchical'
            ? `${prefix}-${String(idx + 1).padStart(4, '0')}`
            : dimValues.length > 0
              ? `${prefix}-${dimValues.map(sanitizeSkuPart).join('-')}`
              : `${prefix}-${sanitizeSkuPart(autoTitle)}`

          return {
            ...r,
            dimensionValues: updatedDims,
            variationLabel,
            variantTitle: r.isManualTitle ? r.variantTitle : autoTitle,
            sku: r.isManualSku ? r.sku : autoSku,
          }
        })
      )
    },
    [baseSku, baseName, skuFormat]
  )

  // Agregar una variante bajo demanda
  const handleAddVariantRow = useCallback(() => {
    const prefix = getVariantSkuPrefix(baseSku, baseName)
    const defaultPrice = basePrice.trim() ? basePrice.trim() : ''
    const newId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const nextIdx = rows.length + 1

    const dimensionValues: Record<string, string> = {}
    dimensions.forEach((d) => {
      const defaultVal = d.activeValues[0] || d.values[0] || ''
      if (defaultVal) {
        dimensionValues[d.name] = defaultVal
      }
    })

    const variationLabel = Object.values(dimensionValues).filter(Boolean).join(' / ')
    const autoTitle = baseName.trim()
      ? (variationLabel ? `${baseName.trim()} - ${variationLabel}` : `${baseName.trim()} - Variante ${nextIdx}`)
      : (variationLabel || `Variante ${nextIdx}`)

    const dimValues = Object.values(dimensionValues).filter(Boolean)
    const autoSku = skuFormat === 'hierarchical'
      ? `${prefix}-${String(nextIdx).padStart(4, '0')}`
      : dimValues.length > 0
        ? `${prefix}-${dimValues.map(sanitizeSkuPart).join('-')}`
        : `${prefix}-VAR-${nextIdx}`

    const newRow: VariantRowState = {
      id: newId,
      dimensionValues,
      variationLabel,
      variantTitle: autoTitle,
      isManualTitle: false,
      sku: autoSku,
      isManualSku: false,
      barcode: '',
      basePrice: defaultPrice,
      isManualPrice: false,
      initialStock: '',
      warehouseId: bulkWarehouseId,
      stagedImage: null,
      stagedImagePreview: null,
      stagedImages: [],
      variantTags: '',
    }

    setRows((prev) => [...prev, newRow])
  }, [baseSku, baseName, basePrice, bulkWarehouseId, dimensions, rows.length, skuFormat])

  // Duplicar una fila de variante
  const handleDuplicateVariantRow = useCallback(
    (rowId: string) => {
      const source = rows.find((r) => r.id === rowId)
      if (!source) return

      const prefix = getVariantSkuPrefix(baseSku, baseName)
      const newId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const nextIdx = rows.length + 1

      const newSku = skuFormat === 'hierarchical'
        ? `${prefix}-${String(nextIdx).padStart(4, '0')}`
        : `${source.sku}-COPIA`

      const duplicated: VariantRowState = {
        ...source,
        id: newId,
        sku: newSku,
        isManualSku: false,
        variantTitle: `${source.variantTitle} (Copia)`,
        isManualTitle: false,
      }

      setRows((prev) => [...prev, duplicated])
      toast.show({
        variant: 'success',
        title: 'Variante duplicada',
        message: `Se duplicó la fila. Puedes seleccionar otra talla, color o tags.`,
      })
    },
    [rows, baseSku, baseName, skuFormat, toast]
  )

  // Generar todas las combinaciones bajo demanda (opcional, no automático)
  const handleGenerateAllCombinations = useCallback(() => {
    const activeDims = dimensions.filter((d) => d.activeValues.length > 0 || d.values.length > 0)
    if (activeDims.length === 0) {
      toast.show({
        variant: 'warning',
        title: 'Sin opciones',
        message: 'Configura al menos una opción en las dimensiones para generar combinaciones.',
      })
      return
    }

    const prefix = getVariantSkuPrefix(baseSku, baseName)
    const defaultPrice = basePrice.trim() ? basePrice.trim() : ''

    const arraysToMultiply = activeDims.map((d) => (d.activeValues.length > 0 ? d.activeValues : d.values))
    const combinations = cartesianProduct(arraysToMultiply)

    if (combinations.length > 60) {
      toast.show({
        variant: 'warning',
        title: 'Atención',
        message: `Se están generando ${combinations.length} variantes.`,
      })
    }

    const newRows: VariantRowState[] = combinations.map((comb, combIdx) => {
      const id = comb.map(sanitizeSkuPart).join('_')
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

      const existing = rows.find((r) =>
        activeDims.every((dim) => r.dimensionValues[dim.name] === dimensionValues[dim.name])
      )

      if (existing) {
        return existing
      }

      return {
        id: `var-${id}-${Date.now()}-${combIdx}`,
        dimensionValues,
        variationLabel,
        variantTitle: autoTitle,
        isManualTitle: false,
        sku: generatedSku,
        isManualSku: false,
        barcode: '',
        basePrice: defaultPrice,
        isManualPrice: false,
        initialStock: '',
        warehouseId: bulkWarehouseId,
        stagedImage: null,
        stagedImagePreview: null,
        stagedImages: [],
        variantTags: '',
      }
    })

    setRows(newRows)
    toast.show({
      variant: 'success',
      title: 'Combinaciones generadas',
      message: `Se crearon ${newRows.length} variantes combinando todas las opciones.`,
    })
  }, [dimensions, baseSku, baseName, basePrice, bulkWarehouseId, rows, skuFormat, toast])

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
    const prefix = getVariantSkuPrefix(baseSku, baseName)
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
  }, [baseSku, baseName, skuFormat, toast])

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

  const handleApplyBulkImage = useCallback(() => {
    if (!bulkDimName || !bulkDimVal) {
      toast.show({
        variant: 'warning',
        title: 'Selección requerida',
        message: 'Selecciona la característica y el valor a asociar.',
      })
      return
    }
    if (!bulkSelectedImage) {
      toast.show({
        variant: 'warning',
        title: 'Fotografía requerida',
        message: 'Selecciona una fotografía de la galería o sube una imagen.',
      })
      return
    }

    let affectedCount = 0
    setRows((prev) =>
      prev.map((r) => {
        if (r.dimensionValues[bulkDimName] === bulkDimVal) {
          affectedCount++
          const newImageItem: VariantImageItem = {
            id: `var-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file: bulkSelectedImage.file,
            previewUrl: bulkSelectedImage.previewUrl,
            name: bulkSelectedImage.name || 'Foto lote',
          }
          const current = r.stagedImages || []
          const exists = current.some((img) => img.previewUrl === bulkSelectedImage.previewUrl)
          const updated = exists ? current : [newImageItem, ...current]
          return {
            ...r,
            stagedImages: updated,
            stagedImage: updated[0]?.file ?? null,
            stagedImagePreview: updated[0]?.previewUrl ?? null,
          }
        }
        return r
      })
    )

    setIsBulkImageModalOpen(false)
    setBulkSelectedImage(null)
    toast.show({
      variant: 'success',
      title: 'Fotos asignadas en lote',
      message: `Se vinculó la foto a ${affectedCount} variantes con ${bulkDimName}: «${bulkDimVal}».`,
    })
  }, [bulkDimName, bulkDimVal, bulkSelectedImage, toast])

  const activeDims = useMemo(() => {
    return dimensions.filter((d) => d.activeValues.length > 0)
  }, [dimensions])

  const bulkDimValuesOptions = useMemo(() => {
    const selectedDim = dimensions.find((d) => d.name === bulkDimName)
    if (!selectedDim) return []
    return selectedDim.activeValues.map((v) => ({ value: v, label: v }))
  }, [dimensions, bulkDimName])

  const matchingBulkCount = useMemo(() => {
    if (!bulkDimName || !bulkDimVal) return 0
    return rows.filter((r) => r.dimensionValues[bulkDimName] === bulkDimVal).length
  }, [rows, bulkDimName, bulkDimVal])

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
        initialStockWarehouseId: r.warehouseId || (bulkWarehouseId || null),
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
    bulkWarehouseId,
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
                  placeholder="Ej. Talla, Color, Material, Capacidad"
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
                      placeholder={`Añadir valor a ${dim.name} (ej. S, M, L o Estándar)…`}
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
            variant="primary"
            size="sm"
            onClick={handleAddVariantRow}
            disabled={disabled}
            title="Crear una nueva variante física para este producto"
          >
            <Plus size={13} /> Agregar Variante
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateAllCombinations}
            disabled={disabled || activeDims.length === 0}
            title="Crea variantes combinando todas las opciones de las dimensiones configuradas"
          >
            <Layers size={13} /> Combinar Opciones
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const firstDimWithVals = dimensions.find((d) => d.activeValues.length > 0)
              if (firstDimWithVals) {
                setBulkDimName(firstDimWithVals.name)
                setBulkDimVal(firstDimWithVals.activeValues[0] || '')
              }
              setBulkSelectedImage(null)
              setIsBulkImageModalOpen(true)
            }}
            disabled={disabled || rows.length === 0}
            title="Asigna una fotografía en lote a todas las variantes que compartan una opción (ej. Caña Corta o Color Blanco)"
          >
            <ImageIcon size={13} /> Asignar foto por opción...
          </Button>
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

      {/* Hidden file inputs for image upload */}
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
      <input
        type="file"
        ref={bulkFileInputRef}
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            const previewUrl = URL.createObjectURL(file)
            setBulkSelectedImage({ file, previewUrl, name: file.name })
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
                              onChange={(e) => handleRowDimensionChange(row.id, dim.name, e.target.value)}
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
                                minWidth: '85px',
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateAllCombinations}
                disabled={disabled || activeDims.length === 0}
              >
                <Layers size={14} /> Combinar Opciones
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

      {/* Modal para Asignar Foto en Lote */}
      {isBulkImageModalOpen && (
        <Popup
          open={true}
          onClose={() => setIsBulkImageModalOpen(false)}
          title="Asignar Fotografía en Lote por Característica"
          width="520px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--glb-muted)' }}>
              Aplica la misma imagen a todas las variantes que compartan una característica (por ejemplo: asociar la misma foto a todas las tallas con <strong>Caña: Caña Corta</strong>).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--glb-text)', marginBottom: '0.25rem' }}>
                  1. Característica / Dimensión:
                </label>
                <Select
                  options={activeDims.map((d) => ({ value: d.name, label: d.name }))}
                  value={bulkDimName}
                  onChange={(val: string) => {
                    setBulkDimName(val)
                    const targetDim = dimensions.find((d) => d.name === val)
                    setBulkDimVal(targetDim?.activeValues[0] || '')
                  }}
                  fullWidth
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--glb-text)', marginBottom: '0.25rem' }}>
                  2. Valor de la opción:
                </label>
                <Select
                  options={bulkDimValuesOptions}
                  value={bulkDimVal}
                  onChange={setBulkDimVal}
                  fullWidth
                />
              </div>
            </div>

            <div
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                background: 'color-mix(in srgb, var(--shell-primary, #3b82f6) 6%, var(--glb-surface, #ffffff))',
                fontSize: '0.8rem',
                color: 'var(--shell-primary, #2563eb)',
                fontWeight: 500,
              }}
            >
              Se aplicará a <strong>{matchingBulkCount}</strong> variantes correspondientes.
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--glb-text)', marginBottom: '0.35rem' }}>
                3. Selecciona o sube la fotografía:
              </div>
              {availableImages.length > 0 && (
                <div className="ecu-var-gallery-grid" style={{ marginBottom: '0.75rem' }}>
                  {availableImages.map((img) => {
                    const isSelected = bulkSelectedImage?.previewUrl === img.previewUrl
                    return (
                      <button
                        key={img.id}
                        type="button"
                        className={`ecu-var-gallery-item ${isSelected ? 'ecu-var-gallery-item--selected' : ''}`}
                        onClick={() =>
                          setBulkSelectedImage({ file: img.file, previewUrl: img.previewUrl, name: img.file.name })
                        }
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
              )}
              <div
                onClick={() => bulkFileInputRef.current?.click()}
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '2px dashed var(--shell-primary, #3b82f6)',
                  background: 'color-mix(in srgb, var(--shell-primary, #3b82f6) 4%, var(--glb-surface, #ffffff))',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.35rem',
                  userSelect: 'none',
                }}
              >
                <Upload size={20} color="var(--shell-primary, #3b82f6)" />
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--glb-text)' }}>
                  Subir fotografía desde tu equipo
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--glb-muted)' }}>
                  Formatos PNG, JPG o WebP
                </div>
              </div>
              {bulkSelectedImage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem' }}>
                  <div className="ecu-var-img-slot ecu-var-img-slot--filled" style={{ width: 44, height: 44 }}>
                    <img src={bulkSelectedImage.previewUrl} alt="Seleccionada" />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--glb-text)', fontWeight: 500 }}>
                    Foto lista para aplicar a las variantes
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--shell-border, rgba(0,0,0,0.08))' }}>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsBulkImageModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleApplyBulkImage}
                disabled={!bulkSelectedImage || matchingBulkCount === 0}
              >
                Aplicar a {matchingBulkCount} Variantes
              </Button>
            </div>
          </div>
        </Popup>
      )}
    </div>
  )
}

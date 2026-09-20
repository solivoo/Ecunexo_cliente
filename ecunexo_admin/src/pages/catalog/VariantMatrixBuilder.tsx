import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Select, TextBox, useToast } from 'glubox'
import { Copy, Layers, Plus, RefreshCw, Trash2, X } from 'lucide-react'
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

export type VariantRowState = {
  id: string
  dim1Value: string
  dim2Value?: string
  variantTitle: string
  sku: string
  barcode: string
  basePrice: string
  initialStock: string
  warehouseId: string
}

export type VariantMatrixBuilderProps = {
  tenantId: string | null
  baseName: string
  baseSku: string
  basePrice: string
  disabled?: boolean
  onChange: (data: {
    variants: CreateVariantChildPayload[]
    variantDimensionsJson: string
    isValid: boolean
  }) => void
}

const DEFAULT_FALLBACK_TEMPLATES: VariantDimensionTemplateDto[] = [
  {
    id: 'system-socks',
    tenantId: 'system',
    name: 'Medias / Calcetines',
    dimensionType: 'Talla',
    predefinedValuesJson: '["35-38","39-41","42-44"]',
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
    name: 'Pantalones / Jeans',
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

function sanitizeSkuPart(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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

  // Dimension 1 State
  const [selectedTemplateId1, setSelectedTemplateId1] = useState<string>('system-socks')
  const [dim1Name, setDim1Name] = useState<string>('Talla')
  const [dim1Values, setDim1Values] = useState<string[]>(['35-38', '39-41', '42-44'])
  const [activeDim1Values, setActiveDim1Values] = useState<string[]>(['35-38', '39-41', '42-44'])
  const [newValInput1, setNewValInput1] = useState<string>('')

  // Dimension 2 State (Optional)
  const [enableDim2, setEnableDim2] = useState<boolean>(false)
  const [selectedTemplateId2, setSelectedTemplateId2] = useState<string>('system-colors')
  const [dim2Name, setDim2Name] = useState<string>('Color')
  const [dim2Values, setDim2Values] = useState<string[]>(['Negro', 'Blanco', 'Azul'])
  const [activeDim2Values, setActiveDim2Values] = useState<string[]>(['Negro', 'Blanco', 'Azul'])
  const [newValInput2, setNewValInput2] = useState<string>('')

  // Custom template creation state
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false)

  // Generated Variant Rows
  const [rows, setRows] = useState<VariantRowState[]>([])

  // Global warehouse selection for bulk
  const [bulkWarehouseId, setBulkWarehouseId] = useState<string>('')

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

  // Template options for selects
  const templateOptions1 = useMemo(() => {
    return [
      ...templates.map((t) => ({ value: t.id, label: `${t.name} (${t.dimensionType})` })),
      { value: 'custom', label: 'Personalizada (definir valores manualmente)' },
    ]
  }, [templates])

  const templateOptions2 = useMemo(() => {
    return [
      ...templates.map((t) => ({ value: t.id, label: `${t.name} (${t.dimensionType})` })),
      { value: 'custom', label: 'Personalizada (definir valores manualmente)' },
    ]
  }, [templates])

  // When template 1 changes
  const handleTemplateChange1 = useCallback(
    (templateId: string) => {
      setSelectedTemplateId1(templateId)
      if (templateId === 'custom') return
      const tpl = templates.find((t) => t.id === templateId)
      if (tpl) {
        try {
          const parsed = JSON.parse(tpl.predefinedValuesJson) as string[]
          if (Array.isArray(parsed)) {
            setDim1Name(tpl.dimensionType || 'Talla')
            setDim1Values(parsed)
            setActiveDim1Values(parsed)
          }
        } catch {
          // ignore
        }
      }
    },
    [templates]
  )

  // When template 2 changes
  const handleTemplateChange2 = useCallback(
    (templateId: string) => {
      setSelectedTemplateId2(templateId)
      if (templateId === 'custom') return
      const tpl = templates.find((t) => t.id === templateId)
      if (tpl) {
        try {
          const parsed = JSON.parse(tpl.predefinedValuesJson) as string[]
          if (Array.isArray(parsed)) {
            setDim2Name(tpl.dimensionType || 'Color')
            setDim2Values(parsed)
            setActiveDim2Values(parsed)
          }
        } catch {
          // ignore
        }
      }
    },
    [templates]
  )

  // Toggle value in Dimension 1
  const toggleDim1Value = useCallback((val: string) => {
    setActiveDim1Values((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    )
  }, [])

  // Add custom value to Dimension 1
  const addVal1 = useCallback(() => {
    const trimmed = newValInput1.trim()
    if (!trimmed) return
    if (!dim1Values.includes(trimmed)) {
      setDim1Values((prev) => [...prev, trimmed])
      setActiveDim1Values((prev) => [...prev, trimmed])
    }
    setNewValInput1('')
  }, [dim1Values, newValInput1])

  // Remove value from Dimension 1
  const removeVal1 = useCallback((val: string) => {
    setDim1Values((prev) => prev.filter((v) => v !== val))
    setActiveDim1Values((prev) => prev.filter((v) => v !== val))
  }, [])

  // Toggle value in Dimension 2
  const toggleDim2Value = useCallback((val: string) => {
    setActiveDim2Values((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    )
  }, [])

  // Add custom value to Dimension 2
  const addVal2 = useCallback(() => {
    const trimmed = newValInput2.trim()
    if (!trimmed) return
    if (!dim2Values.includes(trimmed)) {
      setDim2Values((prev) => [...prev, trimmed])
      setActiveDim2Values((prev) => [...prev, trimmed])
    }
    setNewValInput2('')
  }, [dim2Values, newValInput2])

  // Remove value from Dimension 2
  const removeVal2 = useCallback((val: string) => {
    setDim2Values((prev) => prev.filter((v) => v !== val))
    setActiveDim2Values((prev) => prev.filter((v) => v !== val))
  }, [])

  // Generate Cartesian combinations when active dimensions change
  useEffect(() => {
    const prefix = sanitizeSkuPart(baseSku) || 'ITEM'
    const defaultPrice = basePrice.trim() ? basePrice.trim() : ''

    const combinations: Array<{ dim1: string; dim2?: string }> = []

    if (!enableDim2 || activeDim2Values.length === 0) {
      activeDim1Values.forEach((d1) => {
        combinations.push({ dim1: d1 })
      })
    } else {
      activeDim1Values.forEach((d1) => {
        activeDim2Values.forEach((d2) => {
          combinations.push({ dim1: d1, dim2: d2 })
        })
      })
    }

    setRows((prev) => {
      return combinations.map((comb) => {
        const id = comb.dim2 ? `${comb.dim1}_${comb.dim2}` : comb.dim1
        const existing = prev.find((r) => r.id === id)

        const title = comb.dim2 ? `${comb.dim1} / ${comb.dim2}` : comb.dim1
        const generatedSku = comb.dim2
          ? `${prefix}-${sanitizeSkuPart(comb.dim1)}-${sanitizeSkuPart(comb.dim2)}`
          : `${prefix}-${sanitizeSkuPart(comb.dim1)}`

        if (existing) {
          return {
            ...existing,
            dim1Value: comb.dim1,
            dim2Value: comb.dim2,
            variantTitle: existing.variantTitle || title,
            sku: existing.sku || generatedSku,
          }
        }

        return {
          id,
          dim1Value: comb.dim1,
          dim2Value: comb.dim2,
          variantTitle: title,
          sku: generatedSku,
          barcode: '',
          basePrice: defaultPrice,
          initialStock: '',
          warehouseId: bulkWarehouseId,
        }
      })
    })
  }, [activeDim1Values, activeDim2Values, enableDim2, baseSku, basePrice, bulkWarehouseId])

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
      }))
    )
    toast.show({
      variant: 'success',
      title: 'Precios actualizados',
      message: `Se aplicó $${basePrice.trim()} a todas las variantes.`,
    })
  }, [basePrice, toast])

  const handleRegenerateSkus = useCallback(() => {
    const prefix = sanitizeSkuPart(baseSku) || 'ITEM'
    setRows((prev) =>
      prev.map((r) => {
        const sku = r.dim2Value
          ? `${prefix}-${sanitizeSkuPart(r.dim1Value)}-${sanitizeSkuPart(r.dim2Value)}`
          : `${prefix}-${sanitizeSkuPart(r.dim1Value)}`
        return { ...r, sku }
      })
    )
    toast.show({
      variant: 'success',
      title: 'SKUs regenerados',
      message: 'Los códigos SKU se actualizaron según el código base del producto.',
    })
  }, [baseSku, toast])

  // Row field update
  const updateRow = useCallback((id: string, field: keyof VariantRowState, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }, [])

  // Delete row
  const deleteRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // Save current dimension as custom template
  const handleSaveAsTemplate = useCallback(async () => {
    if (!tenantId || dim1Values.length === 0) return
    setSavingTemplate(true)
    try {
      const templateName = `${dim1Name} (${dim1Values.slice(0, 3).join(', ')}...)`
      const res = await createVariantDimensionTemplate(tenantId, {
        name: templateName,
        dimensionType: dim1Name.trim() || 'Talla',
        predefinedValuesJson: JSON.stringify(dim1Values),
      })
      toast.show({
        variant: 'success',
        title: 'Plantilla guardada',
        message: `Escala «${templateName}» guardada como plantilla reutilizable.`,
      })
      const refreshed = await listVariantDimensionTemplates(tenantId).catch(() => [])
      setTemplates(refreshed.length > 0 ? refreshed : DEFAULT_FALLBACK_TEMPLATES)
      setSelectedTemplateId1(res.id)
    } catch {
      toast.show({
        variant: 'error',
        title: 'Error',
        message: 'No se pudo guardar la plantilla de escala.',
      })
    } finally {
      setSavingTemplate(false)
    }
  }, [dim1Name, dim1Values, tenantId, toast])

  const currentTemplate1 = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId1),
    [templates, selectedTemplateId1]
  )

  const handleUpdateTemplate1 = useCallback(async () => {
    if (!tenantId || !currentTemplate1 || currentTemplate1.isSystemDefault) return
    setSavingTemplate(true)
    try {
      await updateVariantDimensionTemplate(tenantId, currentTemplate1.id, {
        name: currentTemplate1.name,
        dimensionType: dim1Name.trim() || 'Talla',
        predefinedValuesJson: JSON.stringify(dim1Values),
      })
      toast.show({
        variant: 'success',
        title: 'Plantilla actualizada',
        message: `Los cambios en «${currentTemplate1.name}» se guardaron.`,
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
  }, [currentTemplate1, dim1Name, dim1Values, tenantId, toast])

  const handleDeleteTemplate1 = useCallback(async () => {
    if (!tenantId || !currentTemplate1 || currentTemplate1.isSystemDefault) return
    if (!window.confirm(`¿Estás seguro de eliminar la escala personalizada «${currentTemplate1.name}»?`)) return
    setSavingTemplate(true)
    try {
      await deleteVariantDimensionTemplate(tenantId, currentTemplate1.id)
      toast.show({
        variant: 'success',
        title: 'Plantilla eliminada',
        message: `La escala «${currentTemplate1.name}» fue eliminada.`,
      })
      const refreshed = await listVariantDimensionTemplates(tenantId).catch(() => [])
      setTemplates(refreshed.length > 0 ? refreshed : DEFAULT_FALLBACK_TEMPLATES)
      setSelectedTemplateId1('system-socks')
    } catch {
      toast.show({
        variant: 'error',
        title: 'Error',
        message: 'No se pudo eliminar la plantilla.',
      })
    } finally {
      setSavingTemplate(false)
    }
  }, [currentTemplate1, tenantId, toast])

  // Synchronize with parent
  useEffect(() => {
    const dimensionsConfig: Array<{ name: string; values: string[] }> = [
      { name: dim1Name.trim() || 'Talla', values: activeDim1Values },
    ]
    if (enableDim2 && activeDim2Values.length > 0) {
      dimensionsConfig.push({ name: dim2Name.trim() || 'Color', values: activeDim2Values })
    }

    const variantDimensionsJson = JSON.stringify({ dimensions: dimensionsConfig })

    const payloadVariants: CreateVariantChildPayload[] = rows.map((r) => {
      const parsedPrice = r.basePrice.trim() ? Number(r.basePrice.replace(',', '.')) : null
      const parsedStock = r.initialStock.trim() ? Number(r.initialStock) : null

      return {
        variantTitle: r.variantTitle.trim(),
        sku: r.sku.trim(),
        barcode: r.barcode.trim() || null,
        basePrice: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : null,
        initialStock: parsedStock != null && !Number.isNaN(parsedStock) && parsedStock > 0 ? parsedStock : null,
        initialStockWarehouseId: r.warehouseId || (bulkWarehouseId || null),
      }
    })

    const isValid =
      payloadVariants.length > 0 &&
      payloadVariants.every((v) => v.variantTitle.length > 0 && v.sku.length > 0)

    onChange({
      variants: payloadVariants,
      variantDimensionsJson,
      isValid,
    })
  }, [
    rows,
    dim1Name,
    activeDim1Values,
    enableDim2,
    dim2Name,
    activeDim2Values,
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
              Configurador de Variantes (Producto Matriz)
            </h4>
            <p className="ecu-matrix-builder__header-desc">
              {baseName.trim()
                ? `Configura las variantes físicas para «${baseName.trim()}» con sus tallas y códigos SKU hijos.`
                : 'Selecciona una escala de tallas o dimensiones para generar los SKUs físicos hijos automáticamente.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEnableDim2((prev) => !prev)}
            disabled={disabled}
          >
            {enableDim2 ? 'Quitar 2da Dimensión' : '+ 2da Dimensión (ej. Color)'}
          </Button>
        </div>
      </div>

      {/* Dimensions Configuration */}
      <div
        className={`ecu-matrix-builder__dimensions ${
          enableDim2 ? 'ecu-matrix-builder__dimensions--dual' : ''
        }`}
      >
        {/* Dimension 1 Card */}
        <div className="ecu-matrix-dim-card">
          <div className="ecu-matrix-dim-card__top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="ecu-matrix-dim-card__badge">Dimensión 1 (Principal)</span>
              {currentTemplate1 && (
                <span
                  style={{
                    fontSize: '0.725rem',
                    color: currentTemplate1.isSystemDefault ? 'var(--glb-muted)' : '#10b981',
                    fontWeight: currentTemplate1.isSystemDefault ? 400 : 600,
                  }}
                >
                  {currentTemplate1.isSystemDefault
                    ? 'Molde del sistema (base)'
                    : 'Plantilla personalizada (editable)'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedTemplateId1 === 'custom' && dim1Values.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={savingTemplate}
                  onClick={() => void handleSaveAsTemplate()}
                  disabled={disabled || savingTemplate}
                  title="Guardar como plantilla reutilizable"
                >
                  Guardar como escala
                </Button>
              )}
              {currentTemplate1 && !currentTemplate1.isSystemDefault && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={savingTemplate}
                    onClick={() => void handleUpdateTemplate1()}
                    disabled={disabled || savingTemplate}
                    title="Actualizar valores modificados en esta plantilla"
                  >
                    Guardar cambios
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={savingTemplate}
                    onClick={() => void handleDeleteTemplate1()}
                    disabled={disabled || savingTemplate}
                    title="Eliminar esta plantilla personalizada"
                  >
                    <Trash2 size={13} style={{ color: '#ef4444' }} />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="ecu-matrix-dim-card__fields">
            <Select
              id="mat-tpl-1"
              label="Escala o Molde"
              labelPosition="outlined"
              variant="outline"
              options={templateOptions1}
              value={selectedTemplateId1}
              onChange={handleTemplateChange1}
              disabled={disabled}
              fullWidth
            />
            <TextBox
              id="mat-dim-name-1"
              label="Nombre de la dimensión"
              labelPosition="outlined"
              variant="outline"
              value={dim1Name}
              onChange={(e) => setDim1Name(e.target.value)}
              placeholder="Ej. Talla, Medida"
              disabled={disabled}
              fullWidth
            />
          </div>

          <div className="ecu-matrix-pills-wrap">
            <span className="ecu-matrix-pills-label">
              Valores activos (haz clic para activar/desactivar):
            </span>
            <div className="ecu-matrix-pills-list">
              {dim1Values.map((val) => {
                const isActive = activeDim1Values.includes(val)
                return (
                  <span
                    key={val}
                    className={`ecu-matrix-pill ${isActive ? 'ecu-matrix-pill--active' : ''}`}
                    onClick={() => toggleDim1Value(val)}
                  >
                    <span>{val}</span>
                    <span
                      className="ecu-matrix-pill__remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeVal1(val)
                      }}
                      title="Eliminar valor"
                    >
                      <X size={12} />
                    </span>
                  </span>
                )
              })}
            </div>
            <div className="ecu-matrix-add-val">
              <TextBox
                id="mat-add-val-1"
                placeholder="Añadir valor (ej. 45-47 o 3XL)…"
                variant="outline"
                value={newValInput1}
                onChange={(e) => setNewValInput1(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addVal1()
                  }
                }}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVal1}
                disabled={disabled || !newValInput1.trim()}
              >
                <Plus size={14} /> Añadir
              </Button>
            </div>
          </div>
        </div>

        {/* Dimension 2 Card (Optional) */}
        {enableDim2 && (
          <div className="ecu-matrix-dim-card">
            <div className="ecu-matrix-dim-card__top">
              <span className="ecu-matrix-dim-card__badge" style={{ color: '#0284c7', background: 'rgba(2,132,199,0.08)' }}>
                Dimensión 2 (Combinación)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEnableDim2(false)}
                disabled={disabled}
              >
                Cerrar
              </Button>
            </div>

            <div className="ecu-matrix-dim-card__fields">
              <Select
                id="mat-tpl-2"
                label="Escala 2"
                labelPosition="outlined"
                variant="outline"
                options={templateOptions2}
                value={selectedTemplateId2}
                onChange={handleTemplateChange2}
                disabled={disabled}
                fullWidth
              />
              <TextBox
                id="mat-dim-name-2"
                label="Nombre dimensión 2"
                labelPosition="outlined"
                variant="outline"
                value={dim2Name}
                onChange={(e) => setDim2Name(e.target.value)}
                placeholder="Ej. Color, Acabado"
                disabled={disabled}
                fullWidth
              />
            </div>

            <div className="ecu-matrix-pills-wrap">
              <span className="ecu-matrix-pills-label">
                Valores activos dimensión 2:
              </span>
              <div className="ecu-matrix-pills-list">
                {dim2Values.map((val) => {
                  const isActive = activeDim2Values.includes(val)
                  return (
                    <span
                      key={val}
                      className={`ecu-matrix-pill ${isActive ? 'ecu-matrix-pill--active' : ''}`}
                      onClick={() => toggleDim2Value(val)}
                    >
                      <span>{val}</span>
                      <span
                        className="ecu-matrix-pill__remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeVal2(val)
                        }}
                        title="Eliminar valor"
                      >
                        <X size={12} />
                      </span>
                    </span>
                  )
                })}
              </div>
              <div className="ecu-matrix-add-val">
                <TextBox
                  id="mat-add-val-2"
                  placeholder="Añadir valor (ej. Azul Marino)…"
                  variant="outline"
                  value={newValInput2}
                  onChange={(e) => setNewValInput2(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addVal2()
                    }
                  }}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVal2}
                  disabled={disabled || !newValInput2.trim()}
                >
                  <Plus size={14} /> Añadir
                </Button>
              </div>
            </div>
          </div>
        )}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyBasePrice}
            disabled={disabled || !basePrice.trim() || rows.length === 0}
            title="Aplica el precio base a todas las variantes"
          >
            <Copy size={13} /> Copiar precio base (${basePrice || '0.00'})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerateSkus}
            disabled={disabled || rows.length === 0}
            title="Regenera SKUs con el formato [BASE]-[TALLA]"
          >
            <RefreshCw size={13} /> Regenerar SKUs
          </Button>
        </div>
      </div>

      {/* Variants Table */}
      <div className="ecu-matrix-table-wrap">
        {rows.length === 0 ? (
          <div className="ecu-matrix-empty">
            No hay variantes activas. Selecciona al menos un valor de la escala para generar filas.
          </div>
        ) : (
          <table className="ecu-matrix-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 140 }}>Variación</th>
                <th style={{ width: 180 }}>Título Variante</th>
                <th style={{ width: 170 }}>SKU (Obligatorio)</th>
                <th style={{ width: 140 }}>Cód. Barras (EAN)</th>
                <th style={{ width: 110 }}>Precio Base ($)</th>
                <th style={{ width: 100 }}>Stock Inicial</th>
                <th style={{ width: 48, textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id}>
                  <td style={{ color: 'var(--glb-muted)' }}>{idx + 1}</td>
                  <td>
                    <strong>{row.dim1Value}</strong>
                    {row.dim2Value && <span style={{ color: 'var(--glb-muted)' }}> / {row.dim2Value}</span>}
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
                      value={row.barcode}
                      onChange={(e) => updateRow(row.id, 'barcode', e.target.value)}
                      placeholder="786..."
                      disabled={disabled}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.basePrice}
                      onChange={(e) => updateRow(row.id, 'basePrice', e.target.value)}
                      placeholder="0.00"
                      disabled={disabled}
                    />
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

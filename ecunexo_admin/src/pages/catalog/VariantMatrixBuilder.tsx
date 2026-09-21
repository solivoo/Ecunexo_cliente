import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Button, ColorPicker, NumberBox, Popup, Select, TextBox, useToast } from 'glubox'
import { Camera, Check, Copy, Layers, Palette, Plus, Trash2, Upload, X } from 'lucide-react'
import { isColorDimension } from '@/lib/catalogArchetype'
import type { CreateVariantChildPayload } from '@/types/catalogApi'
import './variantMatrixBuilder.css'

export type DimensionState = {
  id: string
  name: string
  dimensionType: string
  values: string[]
  activeValues: string[]
  isColor?: boolean
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
  barcode: string
  basePrice: string
  isManualPrice?: boolean
  initialStock: string
  warehouseId: string
  stagedImage?: File | null
  stagedImagePreview?: string | null
  stagedImages?: VariantImageItem[]
  variantTags?: string
  secondaryColors?: string[]
  actions?: string
  [key: string]: unknown
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
  basePrice: string
  parentTags?: readonly string[]
  disabled?: boolean
  onChange: (data: {
    variants: MatrixVariantPayloadWithImage[]
    variantDimensionsJson: string
    dimensionNames: string[]
    isValid: boolean
    groupImages: { groupValue: string; images: VariantImageItem[] }[]
  }) => void
  availableImages?: AvailableGalleryImage[]
  initialDimensions?: { name: string; values?: string[]; isColor?: boolean }[]
  photoScope?: 'variant' | 'group' | 'model'
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
  basePrice,
  parentTags = [],
  disabled = false,
  onChange,
  availableImages = [],
  initialDimensions,
  photoScope,
}: VariantMatrixBuilderProps) {
  const toast = useToast()

  // Group Photo Modal State
  const [groupPhotoModalTarget, setGroupPhotoModalTarget] = useState<string | null>(null)
  const groupFileInputRef = useRef<HTMLInputElement | null>(null)
  const [groupTargetForUpload, setGroupTargetForUpload] = useState<string | null>(null)
  const rowFileInputRef = useRef<HTMLInputElement | null>(null)
  const [rowTargetForUpload, setRowTargetForUpload] = useState<string | null>(null)
  const [groupStagedImages, setGroupStagedImages] = useState<Record<string, VariantImageItem[]>>({})

  // Color Hex Map
  const [colorHexMap, setColorHexMap] = useState<Record<string, string>>(DEFAULT_COLOR_MAP)
  const [colorModal, setColorModal] = useState<{
    mode: 'edit' | 'new' | 'duplicate'
    value: string
    name: string
    hex: string
  } | null>(null)

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
        isColor,
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
      const defaultPrice = basePrice.trim() ? basePrice.trim() : ''

      const dimensionValues: Record<string, string> = {}
      activeDims.forEach((d) => {
        dimensionValues[d.name] = d.values[0] || d.activeValues[0] || ''
      })

      const variationLabel = Object.values(dimensionValues).filter(Boolean).join(' / ')
      const autoTitle = baseName.trim()
        ? (variationLabel ? `${baseName.trim()} - ${variationLabel}` : baseName.trim())
        : (variationLabel || 'Variante 1')

      setRows([
        {
          id: `var-init-${Date.now()}`,
          dimensionValues,
          variationLabel,
          variantTitle: autoTitle,
          isManualTitle: false,
          sku: '',
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
  }, [dimensions, baseName, basePrice, rows.length])

  // Duplicar una fila de variante
  const handleDuplicateVariantRow = useCallback(
    (rowId: string) => {
      const source = rows.find((r) => r.id === rowId)
      if (!source) return

      const newId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      const duplicated: VariantRowState = {
        ...source,
        id: newId,
        sku: '',
        variantTitle: `${source.variantTitle} (Copia)`,
        isManualTitle: false,
      }

      setRows((prev) => [...prev, duplicated])
      toast.show({
        variant: 'success',
        title: 'Variante duplicada',
        message: 'Completa el SKU de la nueva variante.',
      })
    },
    [rows, toast]
  )

  // Row field update
  const updateRow = useCallback((id: string, field: keyof VariantRowState, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        if (field === 'variantTitle') {
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

  // Identify primary dimension for grouping (e.g. Color if present, else first dimension if multiple)
  const primaryDim = useMemo(() => {
    const act = dimensions.filter((d) => d.activeValues.length > 0 || d.values.length > 0)
    if (act.length === 0) return null
    const isColor = (d: DimensionState) => Boolean(d.isColor) || isColorDimension(d.name)
    if (act.length === 1) {
      return isColor(act[0]) ? act[0] : null
    }
    return act.find((d) => isColor(d)) || act[0]
  }, [dimensions])

  const childDims = useMemo(() => {
    const act = dimensions.filter((d) => d.activeValues.length > 0 || d.values.length > 0)
    if (!primaryDim) return act
    return act.filter((d) => d.id !== primaryDim.id)
  }, [dimensions, primaryDim])

  const isPrimaryColor = useMemo(
    () => (primaryDim ? Boolean(primaryDim.isColor) || isColorDimension(primaryDim.name) : false),
    [primaryDim]
  )

  // Cambio de dimensión en una fila específica (selección por variante) - NO recrear el SKU
  const buildRowLabel = useCallback(
    (dimensionValues: Record<string, string>, secondaryColors: readonly string[] = []) => {
      const parts: string[] = []
      if (primaryDim) {
        const main = dimensionValues[primaryDim.name]
        if (main) parts.push(main)
      }
      secondaryColors.forEach((color) => {
        if (color && !parts.includes(color)) parts.push(color)
      })
      Object.entries(dimensionValues).forEach(([key, value]) => {
        if (!value) return
        if (primaryDim && key === primaryDim.name) return
        parts.push(value)
      })
      return parts.join(' / ')
    },
    [primaryDim]
  )

  const handleRowDimensionChange = useCallback(
    (rowId: string, dimName: string, newValue: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r
          const updatedDims = { ...r.dimensionValues, [dimName]: newValue }
          const variationLabel = buildRowLabel(updatedDims, r.secondaryColors)
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
    [baseName, buildRowLabel]
  )

  const handleSecondaryColorsChange = useCallback(
    (rowId: string, colors: string[]) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r
          const variationLabel = buildRowLabel(r.dimensionValues, colors)
          const autoTitle = baseName.trim() ? `${baseName.trim()} - ${variationLabel}` : variationLabel

          return {
            ...r,
            secondaryColors: colors,
            variationLabel,
            variantTitle: r.isManualTitle ? r.variantTitle : autoTitle,
          }
        })
      )
    },
    [baseName, buildRowLabel]
  )

  // Group Image Toggle from general gallery
  const handleToggleGalleryImageInGroup = useCallback(
    (groupVal: string, img: AvailableGalleryImage) => {
      if (photoScope === 'group') {
        setGroupStagedImages((prev) => {
          const current = prev[groupVal] ?? []
          const exists = current.some((item) => item.previewUrl === img.previewUrl)
          const updated = exists
            ? current.filter((item) => item.previewUrl !== img.previewUrl)
            : [
                ...current,
                {
                  id: `var-gal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  file: img.file,
                  previewUrl: img.previewUrl,
                  name: img.altText || img.file.name,
                },
              ]
          return { ...prev, [groupVal]: updated }
        })
        return
      }

      setRows((prev) =>
        prev.map((r) => {
          if (primaryDim && r.dimensionValues[primaryDim.name] !== groupVal) return r
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
    },
    [photoScope, primaryDim]
  )

  const handleRemoveAllGroupImages = useCallback(
    (groupVal: string) => {
      if (photoScope === 'group') {
        setGroupStagedImages((prev) => ({ ...prev, [groupVal]: [] }))
        return
      }

      setRows((prev) =>
        prev.map((r) => {
          if (primaryDim && r.dimensionValues[primaryDim.name] !== groupVal) return r
          return {
            ...r,
            stagedImages: [],
            stagedImage: null,
            stagedImagePreview: null,
          }
        })
      )
    },
    [photoScope, primaryDim]
  )

  const handleTriggerUploadForGroup = useCallback((groupVal: string) => {
    setGroupTargetForUpload(groupVal)
    groupFileInputRef.current?.click()
  }, [])

  const handleAddImagesToGroup = useCallback(
    (groupVal: string, files: File[]) => {
      const newItems: VariantImageItem[] = files.map((file) => ({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
      }))

      if (photoScope === 'group') {
        setGroupStagedImages((prev) => ({
          ...prev,
          [groupVal]: [...(prev[groupVal] ?? []), ...newItems],
        }))
        return
      }

      setRows((prev) =>
        prev.map((r) => {
          if (primaryDim && r.dimensionValues[primaryDim.name] !== groupVal) return r
          const currentImages = r.stagedImages || []
          const combined = [...currentImages, ...newItems]
          return {
            ...r,
            stagedImages: combined,
            stagedImagePreview: combined[0]?.previewUrl || null,
          }
        })
      )
    },
    [photoScope, primaryDim]
  )

  const handleRemovePhotoFromGroup = useCallback(
    (groupVal: string, imgId: string) => {
      if (photoScope === 'group') {
        setGroupStagedImages((prev) => ({
          ...prev,
          [groupVal]: (prev[groupVal] ?? []).filter((i) => i.id !== imgId),
        }))
        return
      }

      setRows((prev) =>
        prev.map((r) => {
          if (primaryDim && r.dimensionValues[primaryDim.name] !== groupVal) return r
          const filtered = (r.stagedImages || []).filter((i) => i.id !== imgId)
          return {
            ...r,
            stagedImages: filtered,
            stagedImagePreview: filtered[0]?.previewUrl || null,
          }
        })
      )
    },
    [photoScope, primaryDim]
  )

  const handleTriggerUploadForRow = useCallback((rowId: string) => {
    setRowTargetForUpload(rowId)
    rowFileInputRef.current?.click()
  }, [])

  const handleAddImagesToRow = useCallback((rowId: string, files: File[]) => {
    const newItems: VariantImageItem[] = files.map((file) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
    }))

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const combined = [...(r.stagedImages || []), ...newItems]
        return {
          ...r,
          stagedImages: combined,
          stagedImage: combined[0]?.file ?? null,
          stagedImagePreview: combined[0]?.previewUrl ?? null,
        }
      })
    )
  }, [])

  const handleRemovePhotoFromRow = useCallback((rowId: string, imgId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const filtered = (r.stagedImages || []).filter((i) => i.id !== imgId)
        return {
          ...r,
          stagedImages: filtered,
          stagedImage: filtered[0]?.file ?? null,
          stagedImagePreview: filtered[0]?.previewUrl ?? null,
        }
      })
    )
  }, [])

  // Project rows into groups
  const groups = useMemo(() => {
    if (!primaryDim) {
      const generalImages =
        photoScope === 'group'
          ? groupStagedImages['General'] ?? []
          : rows.find((r) => r.stagedImages && r.stagedImages.length > 0)?.stagedImages || []
      return [
        {
          groupValue: 'General',
          rows,
          images: generalImages,
        },
      ]
    }

    const map = new Map<string, { groupValue: string; rows: VariantRowState[]; images: VariantImageItem[] }>()

    rows.forEach((r) => {
      const gVal = (r.dimensionValues[primaryDim.name] || '').trim() || 'Sin definir'
      if (!map.has(gVal)) {
        map.set(gVal, {
          groupValue: gVal,
          rows: [],
          images: [],
        })
      }
      const g = map.get(gVal)!
      g.rows.push(r)
      if (photoScope !== 'group' && g.images.length === 0 && r.stagedImages && r.stagedImages.length > 0) {
        g.images = r.stagedImages
      }
    })

    return Array.from(map.values()).map((g) => ({
      ...g,
      images: photoScope === 'group' ? groupStagedImages[g.groupValue] ?? [] : g.images,
    }))
  }, [groupStagedImages, photoScope, primaryDim, rows])

  // Add sub-variant (talla) to a specific group
  const handleAddSubVariantToGroup = useCallback(
    (groupVal: string) => {
      const defaultPrice = basePrice.trim() ? basePrice.trim() : ''

      const firstChildDim = childDims[0]
      const existingChildVals = new Set(
        rows
          .filter((r) => (primaryDim ? r.dimensionValues[primaryDim.name] === groupVal : true))
          .map((r) => (firstChildDim ? r.dimensionValues[firstChildDim.name] : ''))
          .filter(Boolean)
      )
      const availableVal =
        firstChildDim?.values.find((v) => !existingChildVals.has(v)) || firstChildDim?.values[0] || 'Unica'

      const dimensionValues: Record<string, string> = {}
      if (primaryDim && groupVal !== 'General') {
        dimensionValues[primaryDim.name] = groupVal
      }
      if (firstChildDim) {
        dimensionValues[firstChildDim.name] = availableVal
      }
      childDims.slice(1).forEach((cd) => {
        dimensionValues[cd.name] = cd.values[0] || ''
      })

      const groupRows = rows.filter((r) => (primaryDim ? r.dimensionValues[primaryDim.name] === groupVal : true))
      const groupImages =
        photoScope === 'group'
          ? []
          : groupRows.find((r) => r.stagedImages && r.stagedImages.length > 0)?.stagedImages || []

      const rowId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      const newRow: VariantRowState = {
        id: rowId,
        dimensionValues,
        variationLabel: `${groupVal} / ${availableVal}`,
        variantTitle: `${baseName.trim() || 'Producto'} - ${groupVal} / ${availableVal}`,
        isManualTitle: false,
        sku: '',
        barcode: '',
        basePrice: defaultPrice,
        isManualPrice: false,
        initialStock: '0',
        warehouseId: '',
        stagedImages: groupImages,
        stagedImagePreview: groupImages[0]?.previewUrl || null,
        variantTags: '',
      }

      setRows((prev) => [...prev, newRow])
    },
    [baseName, basePrice, childDims, photoScope, primaryDim, rows]
  )

  // Add new group (e.g. Color)
  const handleAddNewGroup = useCallback(() => {
    if (!primaryDim) {
      handleAddSubVariantToGroup('General')
      return
    }

    const existingGroupVals = new Set(rows.map((r) => r.dimensionValues[primaryDim.name]).filter(Boolean))
    const nextVal = primaryDim.values.find((v) => !existingGroupVals.has(v))
    let groupValToUse = nextVal

    if (!groupValToUse) {
      const prompted = window.prompt(`Ingresa el nombre del nuevo ${primaryDim.name}:`)
      if (!prompted || !prompted.trim()) return
      groupValToUse = prompted.trim()
      handleAddCustomOptionToDimension(primaryDim.id, groupValToUse)
    }

    handleAddSubVariantToGroup(groupValToUse)
  }, [handleAddCustomOptionToDimension, handleAddSubVariantToGroup, primaryDim, rows])

  // Duplicate group (e.g. copy all sizes from Negro to Blanco)
  const handleDuplicateGroupTo = useCallback(
    (sourceGroupVal: string, targetVal: string) => {
      if (!primaryDim) return

      const sourceRows = rows.filter((r) => r.dimensionValues[primaryDim.name] === sourceGroupVal)
      const clonedRows: VariantRowState[] = sourceRows.map((r) => {
        const newId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const updatedDims = { ...r.dimensionValues, [primaryDim.name]: targetVal }
        const subVal = childDims.map((cd) => updatedDims[cd.name]).filter(Boolean).join(' / ')
        const label = `${targetVal}${subVal ? ` / ${subVal}` : ''}`

        return {
          ...r,
          id: newId,
          dimensionValues: updatedDims,
          variationLabel: label,
          variantTitle: `${baseName.trim() || 'Producto'} - ${label}`,
          isManualTitle: false,
          sku: '',
          stagedImages: [],
          stagedImagePreview: null,
        }
      })

      setRows((prev) => [...prev, ...clonedRows])
      toast.show({
        title: `${primaryDim.name} duplicado`,
        message: `Se crearon ${clonedRows.length} tallas en «${targetVal}». Ahora puedes subir las fotos de este color.`,
        variant: 'success',
      })
    },
    [baseName, childDims, primaryDim, rows, toast]
  )

  const handleDuplicateGroup = useCallback(
    (sourceGroupVal: string) => {
      if (!primaryDim) return
      const existingGroupVals = new Set(rows.map((r) => r.dimensionValues[primaryDim.name]).filter(Boolean))
      const nextVal = primaryDim.values.find((v) => !existingGroupVals.has(v))

      if (nextVal) {
        handleDuplicateGroupTo(sourceGroupVal, nextVal)
        return
      }

      if (isPrimaryColor) {
        setColorModal({ mode: 'duplicate', value: sourceGroupVal, name: '', hex: '#3b82f6' })
        return
      }

      const prompted = window.prompt(`Duplicar tallas a un nuevo ${primaryDim.name}:`)
      if (!prompted || !prompted.trim()) return
      const targetVal = prompted.trim()
      handleAddCustomOptionToDimension(primaryDim.id, targetVal)
      handleDuplicateGroupTo(sourceGroupVal, targetVal)
    },
    [handleAddCustomOptionToDimension, handleDuplicateGroupTo, isPrimaryColor, primaryDim, rows]
  )

  // Delete group
  const handleDeleteGroup = useCallback(
    (groupVal: string) => {
      if (!primaryDim) {
        setRows([])
        return
      }
      setRows((prev) => prev.filter((r) => r.dimensionValues[primaryDim.name] !== groupVal))
    },
    [primaryDim]
  )

  // Rename group value
  const handleRenameGroupValue = useCallback(
    (oldVal: string, newVal: string) => {
      if (!primaryDim) return
      let targetVal = newVal
      if (newVal === '__add_new__') {
        if (isPrimaryColor) {
          setColorModal({ mode: 'new', value: oldVal, name: '', hex: '#3b82f6' })
          return
        }
        const prompted = window.prompt(`Ingresa el nombre del nuevo ${primaryDim.name}:`)
        if (!prompted || !prompted.trim()) return
        targetVal = prompted.trim()
        handleAddCustomOptionToDimension(primaryDim.id, targetVal)
      }

      setRows((prev) =>
        prev.map((r) => {
          if (r.dimensionValues[primaryDim.name] !== oldVal) return r
          const updatedDims = { ...r.dimensionValues, [primaryDim.name]: targetVal }
          const subVal = childDims.map((cd) => updatedDims[cd.name]).filter(Boolean).join(' / ')
          const label = `${targetVal}${subVal ? ` / ${subVal}` : ''}`
          return {
            ...r,
            dimensionValues: updatedDims,
            variationLabel: label,
            variantTitle: r.isManualTitle ? r.variantTitle : `${baseName.trim() || 'Producto'} - ${label}`,
          }
        })
      )
    },
    [baseName, childDims, handleAddCustomOptionToDimension, isPrimaryColor, primaryDim]
  )

  const handleConfirmColorModal = useCallback(() => {
    if (!colorModal || !primaryDim) return

    const targetVal = colorModal.mode === 'edit' ? colorModal.value : colorModal.name.trim()
    if (!targetVal) return

    if (colorModal.mode !== 'edit') {
      handleAddCustomOptionToDimension(primaryDim.id, targetVal)
    }

    if (colorModal.mode === 'new') {
      handleRenameGroupValue(colorModal.value, targetVal)
    } else if (colorModal.mode === 'duplicate') {
      handleDuplicateGroupTo(colorModal.value, targetVal)
    }

    setColorHexMap((prev) => {
      const next = { ...prev }
      if (colorModal.mode !== 'edit') {
        delete next[colorModal.value]
      }
      next[targetVal] = colorModal.hex
      return next
    })
    setColorModal(null)
  }, [
    colorModal,
    handleAddCustomOptionToDimension,
    handleDuplicateGroupTo,
    handleRenameGroupValue,
    primaryDim,
  ])

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

    const variantDimensionsJson = JSON.stringify(dimensionsConfig)
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
      if (r.secondaryColors && r.secondaryColors.length > 0) {
        customAttrs['colores_secundarios'] = r.secondaryColors
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
      groupImages:
        photoScope === 'group'
          ? Object.entries(groupStagedImages).map(([groupValue, images]) => ({ groupValue, images }))
          : [],
    })
  }, [
    rows,
    dimensions,
    parentTags,
    photoScope,
    groupStagedImages,
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
            {rows.length} {rows.length === 1 ? 'variante física' : 'variantes físicas'}
            {groups.length > 0 && primaryDim ? ` en ${groups.length} ${primaryDim.name.toLowerCase()}${groups.length === 1 ? '' : 'es'}` : ''}
          </span>
        </div>

        <div className="ecu-matrix-bulk-bar__actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAddNewGroup}
            disabled={disabled}
            title={primaryDim ? `Añadir nuevo grupo de ${primaryDim.name}` : 'Crear una nueva variante física'}
          >
            <Plus size={13} /> {primaryDim ? `Añadir ${primaryDim.name}` : 'Agregar Variante'}
          </Button>
        </div>
      </div>

      {/* Hidden file input for group image upload */}
      <input
        type="file"
        ref={groupFileInputRef}
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length > 0 && groupTargetForUpload) {
            handleAddImagesToGroup(groupTargetForUpload, files)
          }
          e.target.value = ''
        }}
      />

      {/* Hidden file input for row (variant/SKU) image upload */}
      <input
        type="file"
        ref={rowFileInputRef}
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length > 0 && rowTargetForUpload) {
            handleAddImagesToRow(rowTargetForUpload, files)
          }
          e.target.value = ''
        }}
      />

      {/* Variant Groups List (Enfoque A) */}
      {rows.length === 0 ? (
        <div className="ecu-matrix-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2.5rem 1rem' }}>
          <div>No hay variantes físicas configuradas aún. Haz clic en «{primaryDim ? `Añadir ${primaryDim.name}` : 'Añadir Variante'}» para comenzar.</div>
        </div>
      ) : (
        <div className="ecu-variant-groups-list">
          {groups.map((group) => {
            const isColor = primaryDim ? isPrimaryColor : false
            const hex = isColor ? colorHexMap[group.groupValue] : null
            const availableGroupVals = primaryDim ? (primaryDim.values.length > 0 ? primaryDim.values : primaryDim.activeValues) : []

            return (
              <div key={group.groupValue} className="ecu-variant-group-card">
                {/* Header */}
                <div className="ecu-variant-group-card__header">
                  <div className="ecu-variant-group-card__header-left">
                    {(isColor || hex) &&
                      (isColor ? (
                        <button
                          type="button"
                          className="ecu-color-swatch-dot--lg"
                          style={{
                            backgroundColor: hex || '#94a3b8',
                            border: hex
                              ? '1px solid var(--shell-border, rgba(0,0,0,0.15))'
                              : '1px dashed var(--shell-primary, #3b82f6)',
                            padding: 0,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={
                            hex
                              ? `Editar el color de «${group.groupValue}»`
                              : `Elegir un color para «${group.groupValue}»`
                          }
                          onClick={() =>
                            setColorModal({
                              mode: 'edit',
                              value: group.groupValue,
                              name: group.groupValue,
                              hex: hex || '#3b82f6',
                            })
                          }
                          disabled={disabled}
                        >
                          {!hex && <Palette size={10} style={{ color: '#ffffff' }} />}
                        </button>
                      ) : (
                        <span
                          className="ecu-color-swatch-dot--lg"
                          style={{ backgroundColor: hex || '#94a3b8' }}
                          title={group.groupValue}
                        />
                      ))}
                    <div className="ecu-variant-group-card__title-wrap">
                      <span className="ecu-variant-group-card__dim-label">
                        {primaryDim ? primaryDim.name : 'Grupo'}:
                      </span>
                      {primaryDim && primaryDim.id ? (
                        <div style={{ minWidth: 170, maxWidth: 240 }}>
                          <Select
                            size="sm"
                            variant="outline"
                            value={group.groupValue}
                            onChange={(val: string) => handleRenameGroupValue(group.groupValue, val)}
                            disabled={disabled}
                            options={[
                              ...availableGroupVals.map((val) => ({ value: val, label: val })),
                              ...(group.groupValue && !availableGroupVals.includes(group.groupValue)
                                ? [{ value: group.groupValue, label: group.groupValue }]
                                : []),
                              { value: '__add_new__', label: `+ Nuevo ${primaryDim.name}...` },
                            ]}
                            fullWidth
                          />
                        </div>
                      ) : (
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--glb-text)' }}>
                          {group.groupValue}
                        </span>
                      )}
                    </div>
                    <span className="ecu-variant-group-card__count-badge">
                      {group.rows.length} {group.rows.length === 1 ? 'talla / ítem' : 'tallas / ítems'}
                    </span>
                  </div>

                  <div className="ecu-variant-group-card__header-actions">
                    {primaryDim && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateGroup(group.groupValue)}
                        disabled={disabled}
                        title={`Duplicar todas las tallas de «${group.groupValue}» a un nuevo ${primaryDim.name}`}
                      >
                        <Copy size={13} /> Duplicar {primaryDim.name}
                      </Button>
                    )}
                    <button
                      type="button"
                      className="ecu-variant-card__icon-btn ecu-variant-card__icon-btn--danger"
                      onClick={() => handleDeleteGroup(group.groupValue)}
                      disabled={disabled}
                      title={`Eliminar ${primaryDim ? primaryDim.name : 'grupo'} «${group.groupValue}» y sus variantes`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Shared Photos Bar (solo cuando la captura es por grupo o el arquetipo no lo define) */}
                {primaryDim && photoScope !== 'variant' && (
                  <div className="ecu-variant-group-card__photos-bar">
                    <span className="ecu-variant-group-card__photos-label">
                      Fotos {primaryDim ? `de «${group.groupValue}»` : ''} ({group.images.length}):
                    </span>
                    <div className="ecu-variant-group-card__photos-list">
                      {group.images.map((img) => (
                        <div key={img.id} className="ecu-variant-group-photo-thumb">
                          <img src={img.previewUrl} alt={img.name} />
                          <button
                            type="button"
                            className="ecu-variant-group-photo-remove"
                            onClick={() => handleRemovePhotoFromGroup(group.groupValue, img.id)}
                            disabled={disabled}
                            title="Quitar foto de este grupo"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="ecu-variant-group-photo-add"
                        onClick={() => setGroupPhotoModalTarget(group.groupValue)}
                        disabled={disabled}
                        title={`Gestionar fotografías para ${group.groupValue}`}
                      >
                        <Camera size={13} /> {group.images.length === 0 ? '+ Subir Fotos' : '+ Gestionar Fotos'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-items (Tallas / Variantes físicas) */}
                <div className="ecu-variant-group-card__items-table">
                  {group.rows.map((row, rowIdx) => (
                    <div key={row.id} className="ecu-variant-sub-item-row">
                      <span className="ecu-variant-sub-item-num">#{rowIdx + 1}</span>

                      {/* Dimensiones Hijas (Talla, Largo, etc.) */}
                      {childDims.map((dim) => {
                        const currentVal = row.dimensionValues[dim.name] || ''
                        const availableVals = dim.values.length > 0 ? dim.values : dim.activeValues

                        return (
                          <div key={dim.id} className="ecu-variant-sub-item-field" style={{ minWidth: '140px', flex: '1 1 140px', maxWidth: '190px' }}>
                            <label className="ecu-variant-sub-item-label">{dim.name}</label>
                            <Select
                              size="sm"
                              variant="outline"
                              value={currentVal}
                              onChange={(val: string) => {
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
                              options={[
                                ...(currentVal && !availableVals.includes(currentVal)
                                  ? [{ value: currentVal, label: currentVal }]
                                  : []),
                                ...availableVals.map((val) => ({ value: val, label: val })),
                                { value: '__add_new__', label: '+ Nueva...' },
                              ]}
                              fullWidth
                            />
                          </div>
                        )
                      })}

                      {/* Foto exclusiva de la variante (SKU) */}
                      {photoScope !== 'group' && photoScope !== 'model' && (
                        <div className="ecu-variant-sub-item-field" style={{ minWidth: '96px', maxWidth: '120px' }}>
                          <label className="ecu-variant-sub-item-label">Foto</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {row.stagedImages && row.stagedImages.length > 0 ? (
                              <>
                                <div className="ecu-variant-group-photo-thumb" style={{ width: 32, height: 32 }}>
                                  <img src={row.stagedImages[0].previewUrl} alt={row.variantTitle} />
                                  {row.stagedImages.length > 1 && (
                                    <span className="ecu-variant-sub-item-photo-count">
                                      +{row.stagedImages.length - 1}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    className="ecu-variant-group-photo-remove"
                                    onClick={() => handleRemovePhotoFromRow(row.id, row.stagedImages![0].id)}
                                    disabled={disabled}
                                    title="Quitar la foto principal de esta variante"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="ecu-variant-card__icon-btn"
                                  onClick={() => handleTriggerUploadForRow(row.id)}
                                  disabled={disabled}
                                  title="Añadir otra foto a esta variante"
                                >
                                  <Upload size={12} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="ecu-variant-sub-item-photo-add"
                                onClick={() => handleTriggerUploadForRow(row.id)}
                                disabled={disabled}
                                title="Subir foto exclusiva para esta variante"
                              >
                                <Camera size={12} /> Foto
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* SKU (Obligatorio) */}
                      <div className="ecu-variant-sub-item-field" style={{ minWidth: '190px', flex: '1.4 1 190px', maxWidth: '260px' }}>
                        <label className="ecu-variant-sub-item-label">SKU *</label>
                        <TextBox
                          size="sm"
                          variant="outline"
                          value={row.sku}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, 'sku', e.target.value.toUpperCase())
                          }
                          placeholder="Ej. NIK-001-0001"
                          disabled={disabled}
                          fullWidth
                        />
                      </div>

                      {/* Salto de línea para legibilidad de la ficha de variante */}
                      <div className="ecu-variant-sub-item-break" aria-hidden />

                      {/* Colores combinados (SKU bicolor) */}
                      {isPrimaryColor && primaryDim && (
                        <div
                          className="ecu-variant-sub-item-field"
                          style={{ minWidth: '230px', flex: '1.4 1 230px' }}
                        >
                          <label className="ecu-variant-sub-item-label">Colores combinados</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {(row.secondaryColors ?? []).map((color) => (
                              <span key={color} className="ecu-secondary-color-chip" title={`Color secundario: ${color}`}>
                                <span
                                  className="ecu-secondary-color-dot"
                                  style={{ backgroundColor: colorHexMap[color] || '#94a3b8' }}
                                />
                                <span>{color}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSecondaryColorsChange(
                                      row.id,
                                      (row.secondaryColors ?? []).filter((c) => c !== color)
                                    )
                                  }
                                  disabled={disabled}
                                  title={`Quitar ${color}`}
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                            <div style={{ minWidth: 130, maxWidth: 170 }}>
                              <Select
                                size="sm"
                                variant="outline"
                                value=""
                                placeholder={
                                  row.secondaryColors && row.secondaryColors.length > 0
                                    ? '+ Agregar color'
                                    : '+ Combinar color'
                                }
                                options={(primaryDim.values.length > 0
                                  ? primaryDim.values
                                  : primaryDim.activeValues
                                )
                                  .filter(
                                    (val) =>
                                      val !== row.dimensionValues[primaryDim.name] &&
                                      !(row.secondaryColors ?? []).includes(val)
                                  )
                                  .map((val) => ({ value: val, label: val }))}
                                onChange={(val: string) => {
                                  if (!val) return
                                  handleSecondaryColorsChange(row.id, [
                                    ...(row.secondaryColors ?? []),
                                    val,
                                  ])
                                }}
                                disabled={disabled}
                                fullWidth
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tags / Actividad */}
                      <div className="ecu-variant-sub-item-field" style={{ minWidth: '160px', flex: '1 1 160px' }}>
                        <label className="ecu-variant-sub-item-label">Tags / Actividad</label>
                        <TextBox
                          size="sm"
                          variant="outline"
                          value={row.variantTags || ''}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, 'variantTags', e.target.value)
                          }
                          placeholder="Ej. Running..."
                          disabled={disabled}
                          title="Tags o actividad específica para esta variante"
                          fullWidth
                        />
                      </div>

                      {/* Precio Base */}
                      <div className="ecu-variant-sub-item-field" style={{ minWidth: '130px', flex: '0 1 150px' }}>
                        <label className="ecu-variant-sub-item-label">Precio ($)</label>
                        <NumberBox
                          size="sm"
                          variant="outline"
                          value={row.basePrice}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, 'basePrice', e.target.value)
                          }
                          step={0.01}
                          min={0}
                          placeholder="0.00"
                          disabled={disabled}
                          fullWidth
                        />
                        {!row.isManualPrice && basePrice.trim() && (
                          <span className="ecu-variant-sub-item-hint">Heredado (${basePrice.trim()})</span>
                        )}
                      </div>

                      {/* Stock Inicial */}
                      <div className="ecu-variant-sub-item-field" style={{ minWidth: '110px', flex: '0 1 130px' }}>
                        <label className="ecu-variant-sub-item-label">Stock</label>
                        <NumberBox
                          size="sm"
                          variant="outline"
                          value={row.initialStock}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, 'initialStock', e.target.value)
                          }
                          step={1}
                          min={0}
                          placeholder="0"
                          disabled={disabled}
                          fullWidth
                        />
                      </div>

                      {/* Cód. Barras */}
                      <div className="ecu-variant-sub-item-field" style={{ minWidth: '150px', flex: '1 1 150px' }}>
                        <label className="ecu-variant-sub-item-label">Cód. Barras</label>
                        <TextBox
                          size="sm"
                          variant="outline"
                          value={row.barcode}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(row.id, 'barcode', e.target.value)
                          }
                          placeholder="EAN / UPC (opc.)"
                          disabled={disabled}
                          fullWidth
                        />
                      </div>

                      {/* Acciones de la fila */}
                      <div className="ecu-variant-sub-item-actions">
                        <button
                          type="button"
                          className="ecu-variant-card__icon-btn"
                          onClick={() => handleDuplicateVariantRow(row.id)}
                          disabled={disabled}
                          title="Duplicar esta talla"
                          style={{ marginRight: '0.25rem' }}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          className="ecu-variant-card__icon-btn ecu-variant-card__icon-btn--danger"
                          onClick={() => deleteRow(row.id)}
                          disabled={disabled}
                          title="Eliminar esta talla"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer: Añadir Talla */}
                <div className="ecu-variant-group-card__footer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSubVariantToGroup(group.groupValue)}
                    disabled={disabled}
                  >
                    <Plus size={13} /> {childDims.length > 0 ? `Añadir ${childDims[0].name} en «${group.groupValue}»` : `Añadir variante`}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal para Gestión de Fotos de Grupo / Color */}
      {groupPhotoModalTarget && (() => {
        const targetGroup = groups.find((g) => g.groupValue === groupPhotoModalTarget)
        const assigned = targetGroup?.images || []
        const titleText = primaryDim
          ? `Fotografías para «${groupPhotoModalTarget}»`
          : 'Fotografías de las Variantes'

        return (
          <Popup
            open={true}
            onClose={() => setGroupPhotoModalTarget(null)}
            title={titleText}
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
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', fontWeight: 600 }}>Grupo / Color:</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--glb-text)', marginTop: '0.2rem' }}>
                  {groupPhotoModalTarget}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--glb-muted)', marginTop: '0.15rem' }}>
                  {targetGroup?.rows.length || 0} {(targetGroup?.rows.length === 1 ? 'talla física compartirá' : 'tallas físicas compartirán')} estas fotografías en catálogo y POS.
                </div>
              </div>

              {/* Zona de subida directa desde el equipo */}
              <div
                onClick={() => handleTriggerUploadForGroup(groupPhotoModalTarget)}
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
                  Subir fotografías para «{groupPhotoModalTarget}»
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                  Haz clic para seleccionar imágenes desde tu equipo (PNG, JPG o WebP)
                </div>
              </div>

              {/* Fotos actualmente asignadas al grupo */}
              {assigned.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--glb-text)', marginBottom: '0.4rem' }}>
                    Fotos asignadas ({assigned.length}):
                  </div>
                  <div className="ecu-var-assigned-grid">
                    {assigned.map((img, idx) => (
                      <div key={img.id || idx} className="ecu-var-assigned-card">
                        <img src={img.previewUrl} alt={img.name || ''} />
                        {idx === 0 && <span className="ecu-var-assigned-card__badge">Principal</span>}
                        <button
                          type="button"
                          className="ecu-var-assigned-card__remove"
                          onClick={() => handleRemovePhotoFromGroup(groupPhotoModalTarget, img.id)}
                          disabled={disabled}
                          title="Quitar foto"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Otras fotos de la galería general */}
              {availableImages && availableImages.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--glb-text)', marginBottom: '0.35rem' }}>
                    Fotos de la galería principal ({availableImages.length}):
                  </div>
                  <div className="ecu-var-gallery-grid">
                    {availableImages.map((img) => {
                      const isSelected = assigned.some((item) => item.previewUrl === img.previewUrl)
                      return (
                        <button
                          key={img.id}
                          type="button"
                          className={`ecu-var-gallery-item ${isSelected ? 'ecu-var-gallery-item--selected' : ''}`}
                          onClick={() => handleToggleGalleryImageInGroup(groupPhotoModalTarget, img)}
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
                <div>
                  {assigned.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAllGroupImages(groupPhotoModalTarget)}
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
                  onClick={() => setGroupPhotoModalTarget(null)}
                >
                  Listo ({assigned.length})
                </Button>
              </div>
            </div>
          </Popup>
        )
      })()}

      {colorModal && primaryDim && (
        <Popup
          open={true}
          onClose={() => setColorModal(null)}
          title={
            colorModal.mode === 'edit'
              ? `Color de «${colorModal.value}»`
              : colorModal.mode === 'duplicate'
                ? `Duplicar ${primaryDim.name} a un color nuevo`
                : `Nuevo ${primaryDim.name}`
          }
          width="420px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            {colorModal.mode !== 'edit' && (
              <TextBox
                label={`Nombre del ${primaryDim.name.toLowerCase()}`}
                labelPosition="outlined"
                variant="outline"
                value={colorModal.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setColorModal((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }
                placeholder="Ej. Azul Marino"
                fullWidth
              />
            )}
            <ColorPicker
              label="Muestra de color"
              labelPosition="outlined"
              variant="outline"
              value={colorModal.hex}
              onChange={(hex: string) =>
                setColorModal((prev) => (prev ? { ...prev, hex: hex || '#94a3b8' } : prev))
              }
              fullWidth
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
              }}
            >
              <Button type="button" variant="outline" size="sm" onClick={() => setColorModal(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmColorModal}
                disabled={colorModal.mode !== 'edit' && !colorModal.name.trim()}
              >
                <Check size={14} /> Guardar color
              </Button>
            </div>
          </div>
        </Popup>
      )}

    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Button, ColorPicker, DEFAULT_COLOR_PRESETS, NumberBox, Popup, Select, TextBox, useToast } from 'glubox'
import { ArrowLeft, ArrowRight, Camera, Check, Copy, Layers, Plus, Trash2, Upload, X } from 'lucide-react'
import { EcuTagInput } from '@/components/ui'
import {
  findDuplicateSkuValues,
  isColorDimension,
  type ArchetypeAttributeField,
  type DimensionLookup,
} from '@/lib/catalogArchetype'
import type { CreateVariantChildPayload } from '@/types/catalogApi'
import './variantMatrixBuilder.css'

export type DimensionState = {
  id: string
  name: string
  dimensionType: string
  values: string[]
  activeValues: string[]
  isColor?: boolean
  photoGroup?: boolean
  axisType?: 'color' | 'size' | 'custom'
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
  stagedImage?: File | null
  stagedImagePreview?: string | null
  stagedImages?: VariantImageItem[]
  variantTags?: string[]
  variantAttributes?: Record<string, string>
  extraColors?: string[]
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
    invalidReason: string | null
    groupImages: { groupValue: string; images: VariantImageItem[] }[]
  }) => void
  availableImages?: AvailableGalleryImage[]
  initialDimensions?: {
    name: string
    values?: string[]
    isColor?: boolean
    photoGroup?: boolean
    type?: 'color' | 'size' | 'custom'
  }[]
  photoScope?: 'variant' | 'group' | 'model'
  variantAttributeFields?: ArchetypeAttributeField[]
  dimensionValuesMap?: Map<string, DimensionLookup>
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

const NO_PARENT_TAGS: readonly string[] = []

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

function normalizeHexColor(value: string): string {
  const clean = value.trim()
  if (!HEX_COLOR_PATTERN.test(clean)) return ''
  return clean.toLowerCase()
}

/** Una dimensión de color siempre está activa: se asigna por hexadecimal aunque no tenga presets. */
function isDimensionActive(dim: DimensionState): boolean {
  return (
    Boolean(dim.isColor) ||
    isColorDimension(dim.name) ||
    dim.activeValues.length > 0 ||
    dim.values.length > 0
  )
}

function combineHierarchyTags(
  parentTags: readonly string[],
  dimensionValues?: Record<string, string>,
  variantTags?: readonly string[]
): string[] {
  const set = new Set<string>()
  parentTags.forEach((pt) => {
    const n = pt.trim().replace(/^#+/, '')
    if (n) set.add(n)
  })
  if (dimensionValues) {
    Object.values(dimensionValues).forEach((v) => {
      if (typeof v !== 'string') return
      const value = v.trim()
      // Los colores hexadecimales no se indexan como tags.
      if (!value || HEX_COLOR_PATTERN.test(value)) return
      set.add(value.replace(/^#+/, ''))
    })
  }
  variantTags?.forEach((t) => {
    const n = t.trim().replace(/^#+/, '')
    if (n) set.add(n)
  })
  return Array.from(set)
}

export function VariantMatrixBuilder({
  tenantId: _tenantId,
  baseName,
  basePrice,
  parentTags = NO_PARENT_TAGS,
  disabled = false,
  onChange,
  availableImages = [],
  initialDimensions,
  photoScope,
  variantAttributeFields = [],
  dimensionValuesMap,
}: VariantMatrixBuilderProps) {
  const toast = useToast()

  // Group Photo Modal State
  const [groupPhotoModalTarget, setGroupPhotoModalTarget] = useState<string | null>(null)
  const groupFileInputRef = useRef<HTMLInputElement | null>(null)
  const [groupTargetForUpload, setGroupTargetForUpload] = useState<string | null>(null)
  const rowFileInputRef = useRef<HTMLInputElement | null>(null)
  const [rowTargetForUpload, setRowTargetForUpload] = useState<string | null>(null)
  const [rowPhotoModalTarget, setRowPhotoModalTarget] = useState<string | null>(null)
  const [groupStagedImages, setGroupStagedImages] = useState<Record<string, VariantImageItem[]>>({})

  // Color Hex Map
  const [colorHexMap, setColorHexMap] = useState<Record<string, string>>(DEFAULT_COLOR_MAP)
  const [colorModal, setColorModal] = useState<{
    mode: 'duplicate' | 'add-group' | 'extra'
    value: string
    hex: string
    rowId?: string
  } | null>(null)

  /** Hex de un color: acepta `#RRGGBB` o nombres históricos del catálogo. */
  const colorHexFor = useCallback(
    (value: string): string => {
      const clean = value.trim()
      if (!clean) return ''
      return HEX_COLOR_PATTERN.test(clean) ? clean.toLowerCase() : colorHexMap[clean] ?? ''
    },
    [colorHexMap]
  )

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
      // Los colores se asignan únicamente por hexadecimal: sin presets nominales.
      const values = isColor
        ? []
        : d.values && d.values.length > 0
          ? d.values
          : ['35-38', '39-41', '42-44']
      return {
        id: `dim-tpl-${idx}`,
        name: d.name,
        dimensionType: isColor ? 'Color' : 'Talla',
        values,
        activeValues: values,
        isColor,
        photoGroup: d.photoGroup === true,
        axisType: d.type,
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
    const activeDims = dimensions.filter(isDimensionActive)
    // Si el eje principal es color y aún no tiene valores (hex), espera a que el usuario cree el primer color.
    const colorDim = activeDims.find((d) => Boolean(d.isColor) || isColorDimension(d.name))
    const needsColorFirst = Boolean(
      colorDim && colorDim.values.length === 0 && colorDim.activeValues.length === 0
    )
    if (activeDims.length > 0 && rows.length === 0 && !needsColorFirst) {
      hasInitializedRows.current = true
      const defaultPrice = basePrice.trim() ? basePrice.trim() : ''

      const dimensionValues: Record<string, string> = {}
      activeDims.forEach((d) => {
        dimensionValues[d.name] = d.values[0] || d.activeValues[0] || ''
      })

      const variationLabel = Object.values(dimensionValues).filter(Boolean).join(' / ')
      const autoTitle = variationLabel || 'Variante 1'

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
          stagedImage: null,
          stagedImagePreview: null,
          stagedImages: [],
          variantTags: [],
          variantAttributes: {},
          extraColors: [],
        },
      ])
    }
  }, [dimensions, basePrice, rows.length])

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
        variantTags: [...(source.variantTags ?? [])],
        extraColors: [...(source.extraColors ?? [])],
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

  const handleVariantTagsChange = useCallback((rowId: string, tags: string[]) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, variantTags: tags } : r)))
  }, [])

  const handleVariantAttributeChange = useCallback((rowId: string, key: string, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, variantAttributes: { ...(r.variantAttributes ?? {}), [key]: value } }
          : r
      )
    )
  }, [])

  const handleExtraColorsChange = useCallback((rowId: string, colors: string[]) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, extraColors: colors } : r)))
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
    const act = dimensions.filter(isDimensionActive)
    if (act.length === 0) return null
    const isColor = (d: DimensionState) => Boolean(d.isColor) || isColorDimension(d.name)
    if (act.length === 1) {
      return isColor(act[0]) ? act[0] : null
    }
    return act.find((d) => isColor(d)) || act[0]
  }, [dimensions])

  const childDims = useMemo(() => {
    const act = dimensions.filter(isDimensionActive)
    if (!primaryDim) return act
    return act.filter((d) => d.id !== primaryDim.id)
  }, [dimensions, primaryDim])

  const isPrimaryColor = useMemo(
    () => (primaryDim ? Boolean(primaryDim.isColor) || isColorDimension(primaryDim.name) : false),
    [dimensions, primaryDim]
  )

  // Ejes que agrupan las fotos compartidas (ej. Color × Tipo de Caña). Sin flags, cae al eje primario.
  const photoGroupDims = useMemo(() => {
    const flagged = dimensions.filter((d) => isDimensionActive(d) && d.photoGroup === true)
    if (flagged.length > 0) return flagged
    return primaryDim ? [primaryDim] : []
  }, [dimensions, primaryDim])

  const useCompositePhotoBars =
    photoScope === 'group' &&
    photoGroupDims.length > 0 &&
    !(photoGroupDims.length === 1 && primaryDim?.id === photoGroupDims[0].id)

  const photoGroupKeyOf = useCallback(
    (dimensionValues: Record<string, string>) =>
      photoGroupDims.map((d) => (dimensionValues[d.name] || '').trim() || 'Sin definir').join('|'),
    [photoGroupDims]
  )

  const photoGroupLabelOf = useCallback(
    (dimensionValues: Record<string, string>) =>
      photoGroupDims.map((d) => (dimensionValues[d.name] || '').trim() || 'Sin definir').join(' · '),
    [photoGroupDims]
  )

  /** Valor de grupo de una fila, normalizado igual que la proyección de grupos. */
  const groupValueOf = useCallback(
    (row: VariantRowState): string => {
      if (!primaryDim) return 'General'
      return (row.dimensionValues[primaryDim.name] || '').trim() || 'Sin definir'
    },
    [primaryDim]
  )

  const duplicateSkus = useMemo(
    () => findDuplicateSkuValues(rows.map((r) => r.sku)),
    [rows]
  )
  const duplicateSkuSet = useMemo(
    () => new Set(duplicateSkus.map((sku) => sku.toUpperCase())),
    [duplicateSkus]
  )

  // Cambio de dimensión en una fila específica (selección por variante) - NO recrear el SKU
  const buildRowLabel = useCallback(
    (dimensionValues: Record<string, string>) => {
      const parts: string[] = []
      if (primaryDim) {
        const main = dimensionValues[primaryDim.name]
        if (main) parts.push(main)
      }
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
          const variationLabel = buildRowLabel(updatedDims)
          const autoTitle = variationLabel || 'Variante'

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
    [buildRowLabel]
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
          if (primaryDim && groupValueOf(r) !== groupVal) return r
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
    [photoScope, primaryDim, groupValueOf]
  )

  const handleRemoveAllGroupImages = useCallback(
    (groupVal: string) => {
      if (photoScope === 'group') {
        setGroupStagedImages((prev) => ({ ...prev, [groupVal]: [] }))
        return
      }

      setRows((prev) =>
        prev.map((r) => {
          if (primaryDim && groupValueOf(r) !== groupVal) return r
          return {
            ...r,
            stagedImages: [],
            stagedImage: null,
            stagedImagePreview: null,
          }
        })
      )
    },
    [photoScope, primaryDim, groupValueOf]
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
          if (primaryDim && groupValueOf(r) !== groupVal) return r
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
    [photoScope, primaryDim, groupValueOf]
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
          if (primaryDim && groupValueOf(r) !== groupVal) return r
          const filtered = (r.stagedImages || []).filter((i) => i.id !== imgId)
          return {
            ...r,
            stagedImages: filtered,
            stagedImagePreview: filtered[0]?.previewUrl || null,
          }
        })
      )
    },
    [photoScope, primaryDim, groupValueOf]
  )

  const handleTriggerUploadForRow = useCallback((rowId: string) => {
    setRowTargetForUpload(rowId)
    rowFileInputRef.current?.click()
  }, [])

  const handleOpenRowPhotoModal = useCallback((rowId: string) => {
    setRowPhotoModalTarget(rowId)
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
        const removed = (r.stagedImages || []).find((i) => i.id === imgId)
        if (removed?.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(removed.previewUrl)
        }
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

  const handleMoveRowPhoto = useCallback((rowId: string, imgId: string, direction: -1 | 1) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const list = [...(r.stagedImages || [])]
        const idx = list.findIndex((i) => i.id === imgId)
        if (idx < 0) return r
        const next = idx + direction
        if (next < 0 || next >= list.length) return r
        ;[list[idx], list[next]] = [list[next], list[idx]]
        return {
          ...r,
          stagedImages: list,
          stagedImage: list[0]?.file ?? null,
          stagedImagePreview: list[0]?.previewUrl ?? null,
        }
      })
    )
  }, [])

  type PhotoGroupProjection = {
    groupValue: string
    label: string
    rows: VariantRowState[]
    images: VariantImageItem[]
  }

  type GroupProjection = {
    groupValue: string
    rows: VariantRowState[]
    images: VariantImageItem[]
    photoGroups: PhotoGroupProjection[]
  }

  // Project rows into groups
  const groups = useMemo<GroupProjection[]>(() => {
    const buildPhotoGroups = (groupRows: VariantRowState[]): PhotoGroupProjection[] => {
      if (!useCompositePhotoBars) return []
      const map = new Map<string, PhotoGroupProjection>()
      groupRows.forEach((r) => {
        const key = photoGroupKeyOf(r.dimensionValues)
        if (!map.has(key)) {
          map.set(key, {
            groupValue: key,
            label: photoGroupLabelOf(r.dimensionValues),
            rows: [],
            images: [],
          })
        }
        map.get(key)!.rows.push(r)
      })
      return Array.from(map.values()).map((pg) => ({
        ...pg,
        images: groupStagedImages[pg.groupValue] ?? [],
      }))
    }

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
          photoGroups: buildPhotoGroups(rows),
        },
      ]
    }

    const map = new Map<string, { groupValue: string; rows: VariantRowState[]; images: VariantImageItem[] }>()

    rows.forEach((r) => {
      const gVal = groupValueOf(r)
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
      photoGroups: buildPhotoGroups(g.rows),
    }))
  }, [
    groupStagedImages,
    photoScope,
    primaryDim,
    rows,
    useCompositePhotoBars,
    photoGroupKeyOf,
    photoGroupLabelOf,
    groupValueOf,
  ])

  // Add sub-variant (talla) to a specific group
  const handleAddSubVariantToGroup = useCallback(
    (groupVal: string) => {
      const defaultPrice = basePrice.trim() ? basePrice.trim() : ''

      const firstChildDim = childDims[0]
      const existingChildVals = new Set(
        rows
          .filter((r) => (primaryDim ? groupValueOf(r) === groupVal : true))
          .map((r) => (firstChildDim ? r.dimensionValues[firstChildDim.name] : ''))
          .filter(Boolean)
      )
      const availableVal =
        firstChildDim?.values.find((v) => !existingChildVals.has(v)) || firstChildDim?.values[0] || 'Unica'

      const dimensionValues: Record<string, string> = {}
      if (primaryDim && groupVal !== 'General' && groupVal !== 'Sin definir') {
        dimensionValues[primaryDim.name] = groupVal
      }
      if (firstChildDim) {
        dimensionValues[firstChildDim.name] = availableVal
      }
      childDims.slice(1).forEach((cd) => {
        dimensionValues[cd.name] = cd.values[0] || ''
      })

      const groupRows = rows.filter((r) => (primaryDim ? groupValueOf(r) === groupVal : true))
      const groupImages =
        photoScope === 'group'
          ? []
          : groupRows.find((r) => r.stagedImages && r.stagedImages.length > 0)?.stagedImages || []

      const rowId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      const newRow: VariantRowState = {
        id: rowId,
        dimensionValues,
        variationLabel: `${groupVal} / ${availableVal}`,
        variantTitle: `${groupVal} / ${availableVal}`,
        isManualTitle: false,
        sku: '',
        barcode: '',
        basePrice: defaultPrice,
        isManualPrice: false,
        stagedImages: groupImages,
        stagedImagePreview: groupImages[0]?.previewUrl || null,
        variantTags: [],
        variantAttributes: {},
        extraColors: [],
      }

      setRows((prev) => [...prev, newRow])
    },
    [basePrice, childDims, groupValueOf, photoScope, primaryDim, rows]
  )

  // Add new group (e.g. Color)
  const handleAddNewGroup = useCallback(() => {
    if (!primaryDim) {
      handleAddSubVariantToGroup('General')
      return
    }

    if (isPrimaryColor) {
      setColorModal({ mode: 'add-group', value: '', hex: '#3b82f6' })
      return
    }

    const existingGroupVals = new Set(rows.map(groupValueOf).filter((v) => v !== 'Sin definir'))
    const nextVal = primaryDim.values.find((v) => !existingGroupVals.has(v))
    let groupValToUse = nextVal

    if (!groupValToUse) {
      const prompted = window.prompt(`Ingresa el nombre del nuevo ${primaryDim.name}:`)
      if (!prompted || !prompted.trim()) return
      groupValToUse = prompted.trim()
      handleAddCustomOptionToDimension(primaryDim.id, groupValToUse)
    }

    handleAddSubVariantToGroup(groupValToUse)
  }, [handleAddCustomOptionToDimension, handleAddSubVariantToGroup, isPrimaryColor, primaryDim, rows, groupValueOf])

  // Duplicate group (e.g. copy all sizes from Negro to Blanco)
  const handleDuplicateGroupTo = useCallback(
    (sourceGroupVal: string, targetVal: string) => {
      if (!primaryDim) return

      const sourceRows = rows.filter((r) => groupValueOf(r) === sourceGroupVal)
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
          variantTitle: label,
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
    [childDims, groupValueOf, primaryDim, rows, toast]
  )

  const handleDuplicateGroup = useCallback(
    (sourceGroupVal: string) => {
      if (!primaryDim) return

      if (isPrimaryColor) {
        setColorModal({
          mode: 'duplicate',
          value: sourceGroupVal,
          hex: colorHexFor(sourceGroupVal) || '#3b82f6',
        })
        return
      }

      const existingGroupVals = new Set(rows.map(groupValueOf).filter((v) => v !== 'Sin definir'))
      const nextVal = primaryDim.values.find((v) => !existingGroupVals.has(v))

      if (nextVal) {
        handleDuplicateGroupTo(sourceGroupVal, nextVal)
        return
      }

      const prompted = window.prompt(`Duplicar tallas a un nuevo ${primaryDim.name}:`)
      if (!prompted || !prompted.trim()) return
      const targetVal = prompted.trim()
      handleAddCustomOptionToDimension(primaryDim.id, targetVal)
      handleDuplicateGroupTo(sourceGroupVal, targetVal)
    },
    [colorHexFor, groupValueOf, handleAddCustomOptionToDimension, handleDuplicateGroupTo, isPrimaryColor, primaryDim, rows]
  )

  // Delete group
  const handleDeleteGroup = useCallback(
    (groupVal: string) => {
      if (!primaryDim) {
        setRows([])
        return
      }
      setRows((prev) => prev.filter((r) => groupValueOf(r) !== groupVal))
    },
    [groupValueOf, primaryDim]
  )

  // Rename group value
  const handleRenameGroupValue = useCallback(
    (oldVal: string, newVal: string) => {
      if (!primaryDim) return
      let targetVal = newVal
      if (newVal === '__add_new__') {
        const prompted = window.prompt(`Ingresa el nombre del nuevo ${primaryDim.name}:`)
        if (!prompted || !prompted.trim()) return
        targetVal = prompted.trim()
        handleAddCustomOptionToDimension(primaryDim.id, targetVal)
      }

      // Migrar las galerías compuestas cuyo valor de grupo cambia (ej. «Sin definir» → #hex)
      const photoMoves = new Map<string, string>()
      if (photoScope === 'group') {
        rows.forEach((r) => {
          if (groupValueOf(r) !== oldVal) return
          const updatedDims = { ...r.dimensionValues, [primaryDim.name]: targetVal }
          const from = photoGroupKeyOf(r.dimensionValues)
          const to = photoGroupKeyOf(updatedDims)
          if (from !== to && !photoMoves.has(from)) photoMoves.set(from, to)
        })
      }

      setRows((prev) =>
        prev.map((r) => {
          if (groupValueOf(r) !== oldVal) return r
          const updatedDims = { ...r.dimensionValues, [primaryDim.name]: targetVal }
          const subVal = childDims.map((cd) => updatedDims[cd.name]).filter(Boolean).join(' / ')
          const label = `${targetVal}${subVal ? ` / ${subVal}` : ''}`
          return {
            ...r,
            dimensionValues: updatedDims,
            variationLabel: label,
            variantTitle: r.isManualTitle ? r.variantTitle : label,
          }
        })
      )

      if (photoMoves.size > 0) {
        setGroupStagedImages((prev) => {
          const next = { ...prev }
          photoMoves.forEach((to, from) => {
            const images = next[from]
            if (!images || images.length === 0) return
            next[to] = [...(next[to] ?? []), ...images]
            delete next[from]
          })
          return next
        })
      }
    },
    [childDims, groupValueOf, handleAddCustomOptionToDimension, photoGroupKeyOf, photoScope, primaryDim, rows]
  )

  const handleConfirmColorModal = useCallback(() => {
    if (!colorModal) return
    const targetVal = normalizeHexColor(colorModal.hex)
    if (!targetVal) return

    if (colorModal.mode === 'extra') {
      if (!colorModal.rowId) return
      setColorHexMap((prev) => ({ ...prev, [targetVal]: targetVal }))
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== colorModal.rowId) return r
          const extras = r.extraColors ?? []
          if (extras.includes(targetVal)) return r
          return { ...r, extraColors: [...extras, targetVal] }
        })
      )
      setColorModal(null)
      return
    }

    if (!primaryDim) return

    if (colorModal.mode === 'duplicate' && targetVal === colorModal.value) {
      toast.show({
        title: 'Color duplicado',
        message: 'El nuevo color debe ser distinto al color de origen.',
        variant: 'warning',
      })
      return
    }

    handleAddCustomOptionToDimension(primaryDim.id, targetVal)
    setColorHexMap((prev) => ({ ...prev, [targetVal]: targetVal }))

    if (colorModal.mode === 'add-group') {
      handleAddSubVariantToGroup(targetVal)
    } else {
      handleDuplicateGroupTo(colorModal.value, targetVal)
    }

    setColorModal(null)
  }, [
    colorModal,
    handleAddCustomOptionToDimension,
    handleAddSubVariantToGroup,
    handleDuplicateGroupTo,
    primaryDim,
    toast,
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
    // Los valores de cada dimensión se derivan de las filas realmente asignadas
    // (los colores por hex no tienen presets nominales).
    const dimensionsConfig = dimensions
      .map((d) => {
        const name = d.name.trim() || 'Dimensión'
        const values = Array.from(
          new Set(
            rows
              .map((r) => (r.dimensionValues ? r.dimensionValues[d.name] : undefined))
              .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
              .map((v) => v.trim())
          )
        )
        return {
          name,
          values,
          ...(d.photoGroup ? { photoGroup: true } : {}),
          ...(d.axisType ? { type: d.axisType } : {}),
        }
      })
      .filter((d) => d.values.length > 0)

    const variantDimensionsJson = JSON.stringify(dimensionsConfig)
    const dimensionNames = dimensions.map((d) => d.name.trim())

    const payloadVariants: MatrixVariantPayloadWithImage[] = rows.map((r) => {
      const parsedPrice = r.basePrice.trim() ? Number(r.basePrice.replace(',', '.')) : null

      const customAttrs: Record<string, unknown> = {}
      if (r.dimensionValues) {
        Object.entries(r.dimensionValues).forEach(([dimName, val]) => {
          if (val && typeof val === 'string' && val.trim()) {
            customAttrs[dimName.toLowerCase()] = val.trim()
          }
        })
      }
      if (r.variantAttributes) {
        Object.entries(r.variantAttributes).forEach(([attrName, val]) => {
          if (val && typeof val === 'string' && val.trim()) {
            customAttrs[attrName.trim().toLowerCase()] = val.trim()
          }
        })
      }
      if (r.extraColors && r.extraColors.length > 0) {
        customAttrs['colores_secundarios'] = r.extraColors
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
        stagedImage: r.stagedImages?.[0]?.file ?? r.stagedImage ?? null,
        stagedImages: r.stagedImages && r.stagedImages.length > 0
          ? r.stagedImages
          : r.stagedImage && r.stagedImagePreview
            ? [{ id: '1', file: r.stagedImage, previewUrl: r.stagedImagePreview, name: r.variantTitle }]
            : [],
      }
    })

    const invalidReason =
      payloadVariants.length === 0
        ? 'Agrega al menos una variante física.'
        : payloadVariants.some((v) => v.variantTitle.length === 0)
          ? 'Completa el título de todas las variantes.'
          : duplicateSkus.length > 0
            ? `El SKU «${duplicateSkus[0]}» está repetido. Cámbialo en una de las variantes.`
            : payloadVariants.some((v) => v.sku.length === 0)
              ? 'Completa el SKU de todas las variantes.'
              : null

    onChange({
      variants: payloadVariants,
      variantDimensionsJson,
      dimensionNames,
      isValid: invalidReason === null,
      invalidReason,
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
    duplicateSkus,
  ])

  const renderGroupPhotosBar = (groupKey: string, label: string, images: VariantImageItem[]) => (
    <div className="ecu-variant-group-card__photos-bar" key={groupKey}>
      <span className="ecu-variant-group-card__photos-label">
        Fotos de «{label}» ({images.length}):
      </span>
      <div className="ecu-variant-group-card__photos-list">
        {images.map((img) => (
          <div key={img.id} className="ecu-variant-group-photo-thumb">
            <img src={img.previewUrl} alt={img.name} />
            <button
              type="button"
              className="ecu-variant-group-photo-remove"
              onClick={() => handleRemovePhotoFromGroup(groupKey, img.id)}
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
          onClick={() => setGroupPhotoModalTarget(groupKey)}
          disabled={disabled}
          title={`Gestionar fotografías para ${label}`}
        >
          <Camera size={13} /> {images.length === 0 ? '+ Subir Fotos' : '+ Gestionar Fotos'}
        </button>
      </div>
    </div>
  )

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
          {duplicateSkus.length > 0 && (
            <span className="ecu-matrix-bulk-bar__warn" role="alert">
              SKU repetido: {duplicateSkus.join(', ')}
            </span>
          )}
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
            const groupHex = isColor ? colorHexFor(group.groupValue) : ''
            const availableGroupVals = primaryDim ? (primaryDim.values.length > 0 ? primaryDim.values : primaryDim.activeValues) : []

            return (
              <div key={group.groupValue} className="ecu-variant-group-card">
                {/* Header */}
                <div className="ecu-variant-group-card__header">
                  <div className="ecu-variant-group-card__header-left">
                    <div className="ecu-variant-group-card__title-wrap">
                      <span className="ecu-variant-group-card__dim-label">
                        {primaryDim ? primaryDim.name : 'Grupo'}:
                      </span>
                      {isColor && primaryDim ? (
                        <div style={{ minWidth: 190, maxWidth: 260 }}>
                          <ColorPicker
                            size="sm"
                            variant="outline"
                            value={groupHex}
                            placeholder="#000000"
                            onChange={(hex: string) => {
                              const target = normalizeHexColor(hex)
                              if (!target || target === group.groupValue) return
                              setColorHexMap((prev) => ({ ...prev, [target]: target }))
                              handleAddCustomOptionToDimension(primaryDim.id, target)
                              handleRenameGroupValue(group.groupValue, target)
                            }}
                            disabled={disabled}
                            fullWidth
                          />
                        </div>
                      ) : primaryDim && primaryDim.id ? (
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

                {/* Shared Photos Bar (solo con alcance "Compartidas por grupo") */}
                {primaryDim && photoScope === 'group' && (
                  <>
                    {group.photoGroups.length > 0
                      ? group.photoGroups.map((pg) => renderGroupPhotosBar(pg.groupValue, pg.label, pg.images))
                      : renderGroupPhotosBar(group.groupValue, group.groupValue, group.images)}
                  </>
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

                      {/* Colores de la variante: base del grupo (heredado) + adicionales del diseño */}
                      {(() => {
                        const extras = row.extraColors ?? []
                        const baseHex =
                          isPrimaryColor && primaryDim
                            ? colorHexFor((row.dimensionValues[primaryDim.name] || '').trim())
                            : ''
                        const hasColors = Boolean(baseHex) || extras.length > 0

                        return (
                          <div
                            className="ecu-variant-sub-item-field"
                            style={{ minWidth: '210px', flex: '1.3 1 210px', maxWidth: '300px' }}
                          >
                            <label className="ecu-variant-sub-item-label">Colores</label>
                            {hasColors ? (
                              <div className="ecu-variant-color-field">
                                {baseHex && (
                                  <span
                                    className="ecu-extra-color-chip ecu-extra-color-chip--base"
                                    title={`Color base heredado del grupo: ${baseHex}`}
                                  >
                                    <span
                                      className="ecu-extra-color-dot"
                                      style={{ backgroundColor: baseHex }}
                                    />
                                    <span>{baseHex}</span>
                                  </span>
                                )}
                                {extras.map((hex) => (
                                  <span key={hex} className="ecu-extra-color-chip" title={`Color adicional: ${hex}`}>
                                    <span
                                      className="ecu-extra-color-dot"
                                      style={{ backgroundColor: colorHexFor(hex) || '#94a3b8' }}
                                    />
                                    <span>{hex}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleExtraColorsChange(row.id, extras.filter((c) => c !== hex))}
                                      disabled={disabled}
                                      title={`Quitar ${hex}`}
                                    >
                                      <X size={10} />
                                    </button>
                                  </span>
                                ))}
                                <button
                                  type="button"
                                  className="ecu-extra-color-add"
                                  onClick={() =>
                                    setColorModal({ mode: 'extra', rowId: row.id, value: '', hex: '#3b82f6' })
                                  }
                                  disabled={disabled}
                                  aria-label="Añadir color"
                                  title="Añadir color"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="ecu-extra-color-add ecu-extra-color-add--empty"
                                onClick={() =>
                                  setColorModal({ mode: 'extra', rowId: row.id, value: '', hex: '#3b82f6' })
                                }
                                disabled={disabled}
                                aria-label="Añadir color"
                                title="Añadir color"
                              >
                                <Plus size={12} /> Añadir color
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {/* Foto exclusiva de la variante (SKU) — modal para galería y orden */}
                      {photoScope !== 'group' && photoScope !== 'model' && (
                        <div className="ecu-variant-sub-item-field" style={{ minWidth: '96px', maxWidth: '120px' }}>
                          <label className="ecu-variant-sub-item-label">Foto</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {row.stagedImages && row.stagedImages.length > 0 ? (
                              <button
                                type="button"
                                className="ecu-variant-group-photo-thumb"
                                style={{ width: 36, height: 36, cursor: 'pointer', border: 'none', padding: 0 }}
                                onClick={() => handleOpenRowPhotoModal(row.id)}
                                disabled={disabled}
                                title="Administrar fotos de este código"
                              >
                                <img src={row.stagedImages[0].previewUrl} alt={row.variantTitle} />
                                {row.stagedImages.length > 1 && (
                                  <span className="ecu-variant-sub-item-photo-count">
                                    +{row.stagedImages.length - 1}
                                  </span>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ecu-variant-sub-item-photo-add"
                                onClick={() => handleOpenRowPhotoModal(row.id)}
                                disabled={disabled}
                                title="Administrar fotos de este código"
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
                          error={duplicateSkuSet.has(row.sku.trim().toUpperCase())}
                          errorMessage="SKU repetido"
                          disabled={disabled}
                          fullWidth
                        />
                      </div>

                      {/* Salto de línea para legibilidad de la ficha de variante */}
                      <div className="ecu-variant-sub-item-break" aria-hidden />

                      {/* Atributos del nivel terminal: se capturan por variante */}
                      {variantAttributeFields.map((field) => {
                        const lookup = dimensionValuesMap?.get(field.key.trim().toLowerCase())
                        const dataType = lookup?.dataType ?? 'text'
                        const value = row.variantAttributes?.[field.key] ?? ''

                        return (
                          <div
                            key={`attr-${field.key}`}
                            className="ecu-variant-sub-item-field"
                            style={{ minWidth: '170px', flex: '1 1 170px', maxWidth: '240px' }}
                          >
                            <label className="ecu-variant-sub-item-label">{field.key}</label>
                            {dataType === 'boolean' ? (
                              <Select
                                size="sm"
                                variant="outline"
                                value={value}
                                onChange={(v: string) =>
                                  handleVariantAttributeChange(row.id, field.key, v)
                                }
                                options={[
                                  { value: '', label: 'Sin definir' },
                                  { value: 'true', label: 'Sí' },
                                  { value: 'false', label: 'No' },
                                ]}
                                disabled={disabled}
                                fullWidth
                              />
                            ) : dataType === 'number' ? (
                              <NumberBox
                                size="sm"
                                variant="outline"
                                value={value}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  handleVariantAttributeChange(row.id, field.key, e.target.value)
                                }
                                step={1}
                                disabled={disabled}
                                fullWidth
                              />
                            ) : dataType === 'color' ? (
                              <ColorPicker
                                size="sm"
                                variant="outline"
                                value={value || '#ffffff'}
                                onChange={(hex: string) =>
                                  handleVariantAttributeChange(row.id, field.key, hex)
                                }
                                disabled={disabled}
                                fullWidth
                              />
                            ) : dataType === 'multiselect' ? (
                              <EcuTagInput
                                label={undefined}
                                tags={value
                                  .split(',')
                                  .map((v) => v.trim())
                                  .filter(Boolean)}
                                suggestedTags={lookup?.values ?? []}
                                onChange={(tags: string[]) =>
                                  handleVariantAttributeChange(row.id, field.key, tags.join(', '))
                                }
                                placeholder={`Añadir ${field.key}...`}
                                disabled={disabled}
                              />
                            ) : (lookup?.values.length ?? 0) > 0 ? (
                              <Select
                                size="sm"
                                variant="outline"
                                value={value}
                                onChange={(v: string) =>
                                  handleVariantAttributeChange(row.id, field.key, v)
                                }
                                options={[
                                  { value: '', label: 'Sin definir' },
                                  ...(lookup?.values ?? []).map((v) => ({ value: v, label: v })),
                                ]}
                                disabled={disabled}
                                fullWidth
                              />
                            ) : (
                              <TextBox
                                size="sm"
                                variant="outline"
                                value={value}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  handleVariantAttributeChange(row.id, field.key, e.target.value)
                                }
                                disabled={disabled}
                                fullWidth
                              />
                            )}
                          </div>
                        )
                      })}

                      {/* Tags / Actividad */}
                      <div className="ecu-variant-sub-item-field" style={{ minWidth: '200px', flex: '1.3 1 200px' }}>
                        <label className="ecu-variant-sub-item-label">Tags / Actividad</label>
                        <EcuTagInput
                          tags={row.variantTags ?? []}
                          onChange={(tags: string[]) => handleVariantTagsChange(row.id, tags)}
                          placeholder="Ej. Running, Casual..."
                          disabled={disabled}
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
        const targetPhotoGroup = targetGroup
          ? undefined
          : groups.flatMap((g) => g.photoGroups).find((pg) => pg.groupValue === groupPhotoModalTarget)
        const assigned =
          groupStagedImages[groupPhotoModalTarget] ?? targetGroup?.images ?? targetPhotoGroup?.images ?? []
        const targetRowsCount = targetGroup?.rows.length ?? targetPhotoGroup?.rows.length ?? 0
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
                  {targetRowsCount} {(targetRowsCount === 1 ? 'talla física compartirá' : 'tallas físicas compartirán')} estas fotografías en catálogo y POS.
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

      {rowPhotoModalTarget && (() => {
        const targetRow = rows.find((r) => r.id === rowPhotoModalTarget)
        const assigned = targetRow?.stagedImages ?? []
        const label =
          targetRow?.sku?.trim() ||
          targetRow?.variationLabel ||
          targetRow?.variantTitle ||
          'variante'

        return (
          <Popup
            open={true}
            onClose={() => setRowPhotoModalTarget(null)}
            title={`Fotos del código «${label}»`}
            width="540px"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--glb-muted)' }}>
                Galería propia de este SKU. La primera foto es la portada. Usa las flechas para
                reordenar. Al guardar el producto cada imagen se genera en sm / lg / xl.
              </p>

              {assigned.length > 0 ? (
                <div className="ecu-var-gallery-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {assigned.map((img, idx) => (
                    <div
                      key={img.id}
                      style={{
                        width: 112,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <div
                        className="ecu-variant-group-photo-thumb"
                        style={{ width: 112, height: 112, position: 'relative' }}
                      >
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                        />
                        {idx === 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              left: 6,
                              bottom: 6,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.35rem',
                              borderRadius: 4,
                              background: 'rgba(0,0,0,0.65)',
                              color: '#fff',
                            }}
                          >
                            Portada
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="ecu-variant-card__icon-btn"
                          onClick={() => handleMoveRowPhoto(rowPhotoModalTarget, img.id, -1)}
                          disabled={disabled || idx === 0}
                          title="Mover a la izquierda"
                        >
                          <ArrowLeft size={12} />
                        </button>
                        <button
                          type="button"
                          className="ecu-variant-card__icon-btn"
                          onClick={() => handleMoveRowPhoto(rowPhotoModalTarget, img.id, 1)}
                          disabled={disabled || idx === assigned.length - 1}
                          title="Mover a la derecha"
                        >
                          <ArrowRight size={12} />
                        </button>
                        <button
                          type="button"
                          className="ecu-variant-card__icon-btn ecu-variant-card__icon-btn--danger"
                          onClick={() => handleRemovePhotoFromRow(rowPhotoModalTarget, img.id)}
                          disabled={disabled}
                          title="Quitar foto"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: '1.25rem 1rem',
                    borderRadius: 8,
                    border: '2px dashed var(--shell-border, rgba(148,163,184,0.35))',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    color: 'var(--glb-muted)',
                  }}
                >
                  Aún no hay fotos en este código.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTriggerUploadForRow(rowPhotoModalTarget)}
                  disabled={disabled}
                >
                  <Upload size={14} /> Añadir fotos
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setRowPhotoModalTarget(null)}
                >
                  Listo ({assigned.length})
                </Button>
              </div>
            </div>
          </Popup>
        )
      })()}

      {colorModal && (primaryDim || colorModal.mode === 'extra') && (
        <Popup
          open={true}
          onClose={() => setColorModal(null)}
          title={
            colorModal.mode === 'duplicate'
              ? `Duplicar ${primaryDim?.name} a un color nuevo`
              : colorModal.mode === 'extra'
                ? 'Color adicional de la variante'
                : `Nuevo ${primaryDim?.name}`
          }
          width="420px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <div>
              <span className="ecu-color-preset-title">Elige un color</span>
              <div className="ecu-color-preset-grid">
                {DEFAULT_COLOR_PRESETS.map((preset) => {
                  const selected = normalizeHexColor(colorModal.hex) === preset
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={`ecu-color-preset${selected ? ' ecu-color-preset--active' : ''}`}
                      style={{ backgroundColor: preset }}
                      aria-label={`Color ${preset}`}
                      aria-pressed={selected}
                      title={preset}
                      onClick={() =>
                        setColorModal((prev) => (prev ? { ...prev, hex: preset } : prev))
                      }
                    />
                  )
                })}
              </div>
            </div>
            <ColorPicker
              label="Color personalizado (hexadecimal)"
              labelPosition="outlined"
              variant="outline"
              value={colorModal.hex}
              onChange={(hex: string) =>
                setColorModal((prev) => (prev ? { ...prev, hex: hex || '' } : prev))
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
                disabled={!normalizeHexColor(colorModal.hex)}
              >
                <Check size={14} /> Aceptar
              </Button>
            </div>
          </div>
        </Popup>
      )}

    </div>
  )
}

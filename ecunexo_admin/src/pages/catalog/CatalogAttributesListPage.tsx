import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataGrid,
  Popup,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
  type PageActionItem,
} from 'glubox'
import {
  Lock,
  Copy,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatCard,
  GridToolbarRefresh,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  adoptVariantDimensionTemplate,
  createVariantDimensionTemplate,
  deleteVariantDimensionTemplate,
  listVariantDimensionTemplates,
  updateVariantDimensionTemplate,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { VariantDimensionTemplateDto } from '@/types/catalogApi'

export type AttributeKind =
  | 'text_descriptive'
  | 'size_axis'
  | 'color_axis'
  | 'color_list'
  | 'options_axis'
  | 'number'
  | 'boolean'
  | 'multiselect'
  | 'media'

export interface AttributeKindConfig {
  value: AttributeKind
  label: string
  shortLabel: string
  description: string
  dimensionType: 'custom' | 'size' | 'color'
  dataType: 'text' | 'number' | 'boolean' | 'color' | 'multiselect' | 'colorlist' | 'media'
  isVariantAxis: boolean
  /** Muestra el editor de lista de opciones en el formulario. */
  allowsPredefinedValues: boolean
  /** Exige al menos una opción al guardar (solo para atributos que generan variantes). */
  requiresPredefinedValues: boolean
  hasUnit: boolean
  predefinedValuesHint: string
}

export const ATTRIBUTE_KINDS: AttributeKindConfig[] = [
  {
    value: 'text_descriptive',
    label: 'Texto Libre / Descripción',
    shortLabel: 'Texto Libre',
    description: 'Para notas, descripciones, especificaciones o composición. Campo abierto en cada producto.',
    dimensionType: 'custom',
    dataType: 'text',
    isVariantAxis: false,
    allowsPredefinedValues: true,
    requiresPredefinedValues: false,
    hasUnit: false,
    predefinedValuesHint:
      'Opcional. Sin opciones el campo es texto libre; con opciones se muestra como lista de selección única.',
  },
  {
    value: 'size_axis',
    label: 'Escala de Tallas o Medidas',
    shortLabel: 'Tallas / Medidas',
    description: 'Para variantes con opciones fijas de tallas (ej. S, M, L o 38, 39, 40).',
    dimensionType: 'size',
    dataType: 'text',
    isVariantAxis: true,
    allowsPredefinedValues: true,
    requiresPredefinedValues: true,
    hasUnit: false,
    predefinedValuesHint: 'Obligatorio. Cada opción genera una variante con SKU propio.',
  },
  {
    value: 'color_axis',
    label: 'Muestras de Color',
    shortLabel: 'Color',
    description: 'Para variantes con muestras cromáticas o tonos (ej. Blanco, Negro, Azul).',
    dimensionType: 'color',
    dataType: 'color',
    isVariantAxis: true,
    allowsPredefinedValues: true,
    requiresPredefinedValues: true,
    hasUnit: false,
    predefinedValuesHint: 'Obligatorio. Cada opción genera una variante con SKU propio.',
  },
  {
    value: 'color_list',
    label: 'Colores múltiples (varios tonos)',
    shortLabel: 'Colores Múltiples',
    description:
      'Para registrar varios colores o tonos en la ficha del producto sin generar variantes (ej. combinaciones disponibles).',
    dimensionType: 'color',
    dataType: 'colorlist',
    isVariantAxis: false,
    allowsPredefinedValues: false,
    requiresPredefinedValues: false,
    hasUnit: false,
    predefinedValuesHint: '',
  },
  {
    value: 'options_axis',
    label: 'Opciones de Variante (Caña, Calibre, etc.)',
    shortLabel: 'Opciones de Variante',
    description: 'Para características con opciones fijas que generan variantes (ej. Caña Alta/Baja).',
    dimensionType: 'custom',
    dataType: 'text',
    isVariantAxis: true,
    allowsPredefinedValues: true,
    requiresPredefinedValues: true,
    hasUnit: false,
    predefinedValuesHint: 'Obligatorio. Cada opción genera una variante con SKU propio.',
  },
  {
    value: 'number',
    label: 'Número o Medida técnica con unidad',
    shortLabel: 'Número',
    description: 'Para valores numéricos (ej. Peso, Potencia, Capacidad) con unidad de medida.',
    dimensionType: 'custom',
    dataType: 'number',
    isVariantAxis: false,
    allowsPredefinedValues: false,
    requiresPredefinedValues: false,
    hasUnit: true,
    predefinedValuesHint: '',
  },
  {
    value: 'boolean',
    label: 'Sí / No (Interruptor)',
    shortLabel: 'Sí / No',
    description: 'Para características que se activan o desactivan (ej. ¿Impermeable?, ¿Con Bluetooth?).',
    dimensionType: 'custom',
    dataType: 'boolean',
    isVariantAxis: false,
    allowsPredefinedValues: false,
    requiresPredefinedValues: false,
    hasUnit: false,
    predefinedValuesHint: '',
  },
  {
    value: 'multiselect',
    label: 'Selección múltiple (Etiquetas informativas)',
    shortLabel: 'Selección Múltiple',
    description: 'Lista de opciones para etiquetar el producto en ficha técnica (sin generar variantes).',
    dimensionType: 'custom',
    dataType: 'multiselect',
    isVariantAxis: false,
    allowsPredefinedValues: true,
    requiresPredefinedValues: false,
    hasUnit: false,
    predefinedValuesHint:
      'Opcional. Se ofrecen como sugerencias al etiquetar productos; también se pueden escribir etiquetas nuevas.',
  },
  {
    value: 'media',
    label: 'Fotos (varios)',
    shortLabel: 'Fotos',
    description:
      'Para adjuntar varias fotos en la ficha del producto sin generar variantes (ej. referencias, certificados).',
    dimensionType: 'custom',
    dataType: 'media',
    isVariantAxis: false,
    allowsPredefinedValues: false,
    requiresPredefinedValues: false,
    hasUnit: false,
    predefinedValuesHint: '',
  },
]

export function resolveAttributeKind(template: {
  dimensionType?: string | null
  dataType?: string | null
  isVariantAxis?: boolean | null
}): AttributeKind {
  if (template.dimensionType === 'size' && template.isVariantAxis !== false) return 'size_axis'
  if (template.dataType === 'colorlist') return 'color_list'
  if (template.dataType === 'media') return 'media'
  if (
    (template.dimensionType === 'color' || template.dataType === 'color') &&
    template.isVariantAxis !== false
  )
    return 'color_axis'
  if (template.dataType === 'number') return 'number'
  if (template.dataType === 'boolean') return 'boolean'
  if (template.dataType === 'multiselect') return 'multiselect'
  if (template.isVariantAxis === true) return 'options_axis'
  return 'text_descriptive'
}

type TemplateGridRow = VariantDimensionTemplateDto & {
  parsedValues: string[]
} & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('atributo', 'atributos')

export function CatalogAttributesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const hasItemRead = useHasPermission('catalog.item.read')
  const canManage = useHasPermission('catalog.scale.manage')
  const canRead = hasItemRead || canManage

  const [rows, setRows] = useState<VariantDimensionTemplateDto[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Modal Crear / Editar
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<VariantDimensionTemplateDto | null>(null)
  const [formName, setFormName] = useState('')
  const [formKind, setFormKind] = useState<AttributeKind>('text_descriptive')
  const [formUnit, setFormUnit] = useState('')
  const [formValues, setFormValues] = useState<string[]>([])
  const [newValueInput, setNewValueInput] = useState('')
  const [editingValueIndex, setEditingValueIndex] = useState<number | null>(null)
  const [editingValueDraft, setEditingValueDraft] = useState('')
  const [valueRenames, setValueRenames] = useState<{ from: string; to: string }[]>([])
  const [duplicateSource, setDuplicateSource] = useState<VariantDimensionTemplateDto | null>(null)
  const [reassignProducts, setReassignProducts] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedKindConfig = useMemo(
    () => ATTRIBUTE_KINDS.find((k) => k.value === formKind) ?? ATTRIBUTE_KINDS[0],
    [formKind]
  )

  // Modal Confirmar Eliminar
  const [confirmDelete, setConfirmDelete] = useState<VariantDimensionTemplateDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        const list = await listVariantDimensionTemplates(tenantId)
        setRows(list)
        if (!opts?.silent) {
          toast.show({
            title: 'Sincronizado',
            message: 'Diccionario de atributos y escalas actualizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar los atributos.')
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    if (!tenantId || !canRead) return
    void loadData({ silent: true })
  }, [canRead, loadData, tenantId])

  const openCreateModal = useCallback(() => {
    setEditingTemplate(null)
    setFormName('')
    setFormKind('text_descriptive')
    setFormUnit('')
    setFormValues([])
    setNewValueInput('')
    setEditingValueIndex(null)
    setEditingValueDraft('')
    setValueRenames([])
    setDuplicateSource(null)
    setReassignProducts(false)
    setEditModalOpen(true)
  }, [])

  const openEditModal = useCallback((template: VariantDimensionTemplateDto) => {
    setEditingTemplate(template)
    setFormName(template.name)
    setFormKind(resolveAttributeKind(template))
    setFormUnit(template.unit ?? '')
    try {
      const parsed = JSON.parse(template.predefinedValuesJson)
      setFormValues(Array.isArray(parsed) ? parsed : [])
    } catch {
      setFormValues([])
    }
    setNewValueInput('')
    setEditingValueIndex(null)
    setEditingValueDraft('')
    setValueRenames([])
    setDuplicateSource(null)
    setReassignProducts(false)
    setEditModalOpen(true)
  }, [])

  const openDuplicateModal = useCallback((template: VariantDimensionTemplateDto) => {
    setEditingTemplate(null)
    setDuplicateSource(template)
    setFormName(`${template.name} (copia)`)
    setFormKind(resolveAttributeKind(template))
    setFormUnit(template.unit ?? '')
    try {
      const parsed = JSON.parse(template.predefinedValuesJson)
      setFormValues(Array.isArray(parsed) ? parsed : [])
    } catch {
      setFormValues([])
    }
    setNewValueInput('')
    setEditingValueIndex(null)
    setEditingValueDraft('')
    setValueRenames([])
    setReassignProducts(Boolean(template.isInUse))
    setEditModalOpen(true)
  }, [])

  const handleAddValueToForm = useCallback(() => {
    const trimmed = newValueInput.trim()
    if (!trimmed) return
    if (formValues.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      toast.show({
        title: 'Valor repetido',
        message: `El valor «${trimmed}» ya está en la lista.`,
        variant: 'warning',
      })
      return
    }
    setFormValues((prev) => [...prev, trimmed])
    setNewValueInput('')
  }, [formValues, newValueInput, toast])

  const handleRemoveValueFromForm = useCallback(
    (index: number) => {
      const removed = formValues[index]
      setFormValues((prev) => prev.filter((_, i) => i !== index))
      if (removed) {
        const lower = removed.toLowerCase()
        setValueRenames((prev) =>
          prev.filter(
            (r) => r.from.toLowerCase() !== lower && r.to.toLowerCase() !== lower
          )
        )
      }
    },
    [formValues]
  )

  const startEditingValue = useCallback((index: number, value: string) => {
    setEditingValueIndex(index)
    setEditingValueDraft(value)
  }, [])

  const cancelEditingValue = useCallback(() => {
    setEditingValueIndex(null)
    setEditingValueDraft('')
  }, [])

  const commitEditingValue = useCallback(() => {
    if (editingValueIndex === null) return
    const trimmed = editingValueDraft.trim()
    if (!trimmed) {
      cancelEditingValue()
      return
    }
    if (
      formValues.some(
        (v, i) => i !== editingValueIndex && v.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      toast.show({
        title: 'Valor repetido',
        message: `El valor «${trimmed}» ya está en la lista.`,
        variant: 'warning',
      })
      return
    }
    const previous = formValues[editingValueIndex]
    setFormValues((prev) => prev.map((v, i) => (i === editingValueIndex ? trimmed : v)))
    if (previous && previous.toLowerCase() !== trimmed.toLowerCase()) {
      setValueRenames((prev) => {
        const isChained = prev.some(
          (r) => r.to.toLowerCase() === previous.toLowerCase()
        )
        const next = prev
          .filter((r) => r.from.toLowerCase() !== previous.toLowerCase())
          .map((r) =>
            r.to.toLowerCase() === previous.toLowerCase() ? { ...r, to: trimmed } : r
          )
        return isChained ? next : [...next, { from: previous, to: trimmed }]
      })
    }
    cancelEditingValue()
  }, [cancelEditingValue, editingValueDraft, editingValueIndex, formValues, toast])

  const handleSaveTemplate = useCallback(async () => {
    if (!tenantId) return
    const name = formName.trim()
    if (!name) {
      toast.show({
        title: 'Nombre requerido',
        message: 'Ingresa un nombre para el atributo.',
        variant: 'warning',
      })
      return
    }

    const kindConfig = ATTRIBUTE_KINDS.find((k) => k.value === formKind) ?? ATTRIBUTE_KINDS[0]
    if (kindConfig.requiresPredefinedValues && formValues.length === 0) {
      toast.show({
        title: 'Opciones requeridas',
        message: `Para «${kindConfig.label}», debes añadir al menos una opción predefinida (ej. S, M, L o Rojo, Azul).`,
        variant: 'warning',
      })
      return
    }

    setSaving(true)
    try {
      const kindUnchanged =
        editingTemplate !== null && resolveAttributeKind(editingTemplate) === formKind
      const payload = {
        name,
        dimensionType:
          (kindUnchanged ? editingTemplate?.dimensionType : null) ?? kindConfig.dimensionType,
        predefinedValuesJson: JSON.stringify(formValues),
        dataType: (kindUnchanged ? editingTemplate?.dataType : null) ?? kindConfig.dataType,
        isVariantAxis: kindConfig.isVariantAxis,
        unit: kindConfig.hasUnit && formUnit.trim() ? formUnit.trim() : null,
      }
      if (editingTemplate) {
        const result = await updateVariantDimensionTemplate(tenantId, editingTemplate.id, {
          ...payload,
          ...(valueRenames.length > 0 ? { valueRenames } : {}),
        })
        const affected = result.renamedItems ?? 0
        toast.show({
          title: 'Atributo actualizado',
          message:
            affected > 0
              ? `«${name}» se guardó y se actualizaron ${affected} productos asociados.`
              : `«${name}» se guardó correctamente.`,
          variant: 'success',
        })
      } else {
        const created = await createVariantDimensionTemplate(tenantId, payload)
        let message = `«${name}» se agregó al catálogo.`
        let variant: 'success' | 'warning' = 'success'
        if (duplicateSource && reassignProducts) {
          try {
            const adoptResult = await adoptVariantDimensionTemplate(
              tenantId,
              created.id,
              duplicateSource.name
            )
            const reassigned = adoptResult.reassignedItems ?? 0
            message =
              reassigned > 0
                ? `«${name}» se agregó y se reasignaron ${reassigned} productos.`
                : `«${name}» se agregó; no había productos para reasignar.`
          } catch (adoptErr: unknown) {
            variant = 'warning'
            message = `«${name}» se creó, pero no se pudieron reasignar los productos: ${readApiError(
              adoptErr,
              'error desconocido'
            )}`
          }
        }
        toast.show({
          title: 'Atributo registrado',
          message,
          variant,
        })
      }
      setEditModalOpen(false)
      await loadData({ silent: true })
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo guardar el atributo.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [duplicateSource, editingTemplate, formKind, formName, formUnit, formValues, loadData, reassignProducts, tenantId, toast, valueRenames])

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirmDelete) return
    setDeleting(true)
    try {
      await deleteVariantDimensionTemplate(tenantId, confirmDelete.id)
      toast.show({
        title: 'Atributo eliminado',
        message: `«${confirmDelete.name}» fue retirado del catálogo.`,
        variant: 'success',
      })
      setConfirmDelete(null)
      await loadData({ silent: true })
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo eliminar el atributo.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }, [confirmDelete, loadData, tenantId, toast])

  const stats = useMemo(() => {
    let totalValues = 0
    let inUseCount = 0
    let availableCount = 0

    for (const r of rows) {
      if (r.isInUse) inUseCount++
      else availableCount++
      try {
        const parsed = JSON.parse(r.predefinedValuesJson)
        if (Array.isArray(parsed)) totalValues += parsed.length
      } catch {
        // ignorar
      }
    }
    return {
      total: rows.length,
      inUse: inUseCount,
      available: availableCount,
      values: totalValues,
    }
  }, [rows])

  const filteredRows = useMemo<TemplateGridRow[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (filterType !== 'all') {
          const kind = resolveAttributeKind(r)
          if (filterType === 'text' && kind !== 'text_descriptive') return false
          if (filterType === 'size' && kind !== 'size_axis') return false
          if (filterType === 'color' && kind !== 'color_axis') return false
          if (filterType === 'color_list' && kind !== 'color_list') return false
          if (filterType === 'media' && kind !== 'media') return false
          if (filterType === 'options_axis' && kind !== 'options_axis') return false
          if (filterType === 'number' && kind !== 'number') return false
        }
        if (!q) return true
        const inName = r.name.toLowerCase().includes(q)
        const inValues = r.predefinedValuesJson.toLowerCase().includes(q)
        return inName || inValues
      })
      .map((r) => {
        let parsed: string[] = []
        try {
          parsed = JSON.parse(r.predefinedValuesJson)
          if (!Array.isArray(parsed)) parsed = []
        } catch {
          parsed = []
        }
        return {
          ...r,
          parsedValues: parsed,
        }
      })
  }, [filterType, rows, searchQuery])

  const columns = useMemo((): ColumnDef<TemplateGridRow>[] => {
    return [
      {
        key: 'name',
        header: 'Atributo',
        width: 240,
        sortable: true,
        renderCell: (_val: unknown, row: TemplateGridRow) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {row.isInUse ? (
              <span title="Asociado a productos del catálogo">
                <Lock size={13} style={{ color: 'var(--idt-warn, #b45309)', flexShrink: 0 }} />
              </span>
            ) : (
              <Tag size={13} style={{ color: 'var(--idt-muted, #64748b)', flexShrink: 0 }} />
            )}
            <strong>{row.name}</strong>
          </div>
        ),
      },
      {
        key: 'dimensionType',
        header: 'Tipo de Atributo',
        width: 190,
        sortable: true,
        renderCell: (_val: unknown, row: TemplateGridRow) => {
          const kind = resolveAttributeKind(row)
          const config = ATTRIBUTE_KINDS.find((k) => k.value === kind) ?? ATTRIBUTE_KINDS[0]
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span className="ecu-chip">{config.shortLabel}</span>
              {row.unit && <span className="ecu-hint">Unidad: {row.unit}</span>}
            </div>
          )
        },
      },
      {
        key: 'parsedValues',
        header: 'Valores Predefinidos',
        width: 420,
        renderCell: (_val: unknown, row: TemplateGridRow) => (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {row.parsedValues.length === 0 ? (
              <span className="ecu-hint">Texto libre</span>
            ) : (
              row.parsedValues.slice(0, 7).map((val) => (
                <span key={val} className="ecu-token">
                  {val}
                </span>
              ))
            )}
            {row.parsedValues.length > 7 && (
              <span className="ecu-token-more">+{row.parsedValues.length - 7} más</span>
            )}
          </div>
        ),
      },
      {
        key: 'isInUse',
        header: 'Estado',
        width: 140,
        sortable: true,
        renderCell: (_val: unknown, row: TemplateGridRow) => (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {row.isInUse ? (
              <span className="ecu-status ecu-status--warning">
                <span className="ecu-status__dot" aria-hidden />
                En uso
              </span>
            ) : (
              <span className="ecu-status ecu-status--inactive">
                <span className="ecu-status__dot" aria-hidden />
                Sin registros
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 110,
        align: 'center',
        renderCell: (_val: unknown, row: TemplateGridRow) => {
          return (
            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
              <GridIconButton
                icon={Pencil}
                label={`Editar «${row.name}»`}
                onClick={() => openEditModal(row)}
                disabled={!canManage}
              />
              <GridIconButton
                icon={Copy}
                label={`Duplicar «${row.name}» (útil para cambiar el tipo)`}
                onClick={() => openDuplicateModal(row)}
                disabled={!canManage}
              />
              <GridIconButton
                icon={Trash2}
                label={
                  row.isInUse
                    ? `Inmutable: «${row.name}» tiene productos asociados`
                    : `Eliminar «${row.name}»`
                }
                danger
                onClick={() => setConfirmDelete(row)}
                disabled={!canManage || Boolean(row.isInUse)}
              />
            </div>
          )
        },
      },
    ]
  }, [canManage, openDuplicateModal, openEditModal])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'items',
        label: 'Productos',
        icon: 'package',
        route: '/catalogo/items',
        disabled: false,
      },
      {
        id: 'templates',
        label: 'Plantillas',
        icon: 'layers',
        route: '/catalogo/plantillas',
        disabled: false,
      },
    ],
    []
  )

  return (
    <TenantSessionGate
      title="Atributos"
      lead="Administra las opciones de tallas, colores y medidas para tus productos."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid ecu-section-page ecu-catalog-page">
        <PageHeader
          title="Atributos"
          subtitle="Tallas, colores y medidas reutilizables en todo el catálogo."
        />

        <div className="ecu-stat-grid">
          <StatCard label="Atributos" value={stats.total} />
          <StatCard label="En uso" value={stats.inUse} />
          <StatCard label="Disponibles" value={stats.available} />
          <StatCard label="Valores" value={stats.values} />
        </div>

        <SectionCard title="Directorio">
          <div className="ecu-commandbar">
            <div className="ecu-commandbar__search">
              <TextBox
                id="search-attr"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                fullWidth
              />
            </div>
            <div className="ecu-commandbar__filter">
              <Select
                id="filter-type"
                options={[
                  { value: 'all', label: 'Todos los tipos' },
                  { value: 'text', label: 'Texto Libre / Descripción' },
                  { value: 'size', label: 'Tallas y Medidas' },
                  { value: 'color', label: 'Colores' },
                  { value: 'color_list', label: 'Colores múltiples' },
                  { value: 'media', label: 'Fotos' },
                  { value: 'options_axis', label: 'Opciones de Variante' },
                  { value: 'number', label: 'Números con unidad' },
                ]}
                value={filterType}
                onChange={setFilterType}
                fullWidth
              />
            </div>
            <div className="ecu-commandbar__spacer" />
            <div className="ecu-commandbar__action">
              <div className="ecu-grid-toolbar-actions">
                <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                {canManage && (
                  <Button type="button" variant="primary" onClick={openCreateModal}>
                    <Plus size={15} />
                    <span>Nuevo Atributo</span>
                  </Button>
                )}
                <EcuPageActions
                  items={actionItems}
                  triggerLabel="Acciones de catálogo"
                  renderIcon={renderSidebarIcon}
                  onNavigate={(route: string) => void navigate(route)}
                />
              </div>
            </div>
          </div>

          <DataGrid<TemplateGridRow>
            dataSource={filteredRows}
            columns={columns}
            loading={loading}
            keyExpr="id"
            showSearch={false}
            emptyMessage={
              searchQuery || filterType !== 'all'
                ? 'No se encontraron atributos con los filtros seleccionados.'
                : 'No hay atributos registrados.'
            }
            messages={gridMessages}
            paging={paging}
            pageSizeOptions={pageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </SectionCard>

        {/* Modal Crear / Editar Atributo */}
        <Popup
          open={editModalOpen}
          onClose={() => !saving && setEditModalOpen(false)}
          title={
            editingTemplate
              ? `Editar «${editingTemplate.name}»`
              : duplicateSource
                ? `Duplicar «${duplicateSource.name}»`
                : 'Nuevo Atributo'
          }
          width={520}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
            <TextBox
              id="template-name"
              label="Nombre"
              labelPosition="outlined"
              variant="outline"
              placeholder="Escriba aquí..."
              value={formName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
              disabled={saving}
              required
              fullWidth
            />
            {editingTemplate?.isInUse && (
              <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 500 }}>
                * Atributo en uso: al cambiar el nombre o renombrar una opción se actualizarán
                automáticamente todos los productos y variantes asociados.
              </span>
            )}
            {editingTemplate?.isInUse && (
              <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 500 }}>
                * El tipo no se puede cambiar porque hay productos asociados. Usa «Duplicar» para
                crear una versión con otro tipo y reasignar los productos.
              </span>
            )}

            {duplicateSource && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--shell-border, rgba(0,0,0,0.1))',
                  background: 'var(--glb-surface-variant, rgba(0,0,0,0.02))',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: 'var(--glb-text, #1e293b)' }}>
                  Se creará un atributo nuevo a partir de «{duplicateSource.name}». Ajusta el tipo y
                  las opciones que necesites.
                </span>
                {duplicateSource.isInUse && (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={reassignProducts}
                      disabled={saving}
                      onChange={(e) => setReassignProducts(e.target.checked)}
                    />
                    <span>
                      Reasignar los productos que usan «{duplicateSource.name}» a este nuevo
                      atributo
                    </span>
                  </label>
                )}
              </div>
            )}

            <Select
              id="template-kind"
              label="Tipo de Atributo"
              labelPosition="outlined"
              variant="outline"
              options={ATTRIBUTE_KINDS.map((k) => ({
                value: k.value,
                label: k.label,
              }))}
              value={formKind}
              onChange={(v: string) => setFormKind(v as AttributeKind)}
              disabled={saving || Boolean(editingTemplate?.isInUse)}
              fullWidth
            />
            <span
              style={{
                marginTop: '-0.35rem',
                fontSize: '0.75rem',
                color: 'var(--glb-muted, #64748b)',
              }}
            >
              {selectedKindConfig.description}
            </span>

            {selectedKindConfig.hasUnit && (
              <TextBox
                id="template-unit"
                label="Unidad"
                labelPosition="outlined"
                variant="outline"
                placeholder="Escriba aquí (ej. cm, kg)..."
                value={formUnit}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormUnit(e.target.value)}
                disabled={saving || Boolean(editingTemplate?.isInUse)}
                fullWidth
              />
            )}

            {selectedKindConfig.allowsPredefinedValues && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '0.35rem',
                    color: 'var(--glb-text, #1e293b)',
                  }}
                >
                  Opciones predefinidas
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <TextBox
                    id="new-val-input"
                    placeholder="Escriba aquí..."
                    value={newValueInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewValueInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddValueToForm()
                      }
                    }}
                    disabled={saving}
                    fullWidth
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddValueToForm}
                    disabled={saving || !newValueInput.trim()}
                  >
                    <Plus size={15} />
                    <span>Añadir</span>
                  </Button>
                </div>

                {formValues.length === 0 ? (
                  <span style={{ fontSize: '0.78rem', color: 'var(--glb-muted, #64748b)' }}>
                    Sin opciones agregadas
                  </span>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                      maxHeight: '140px',
                      overflowY: 'auto',
                      padding: '0.4rem',
                      borderRadius: '6px',
                      background: 'var(--glb-surface-ground, rgba(0, 0, 0, 0.02))',
                      border: '1px solid var(--shell-border, rgba(0, 0, 0, 0.1))',
                    }}
                  >
                    {formValues.map((val, idx) =>
                      idx === editingValueIndex ? (
                        <TextBox
                          key={`edit-${idx}`}
                          autoFocus
                          size="sm"
                          variant="outline"
                          value={editingValueDraft}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            setEditingValueDraft(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              commitEditingValue()
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              cancelEditingValue()
                            }
                          }}
                          onBlur={commitEditingValue}
                          disabled={saving}
                          width={180}
                        />
                      ) : (
                        <span
                          key={val}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            background: 'var(--glb-surface, #fff)',
                            border: '1px solid var(--shell-border, rgba(0, 0, 0, 0.15))',
                            color: 'var(--glb-text, #1e293b)',
                          }}
                        >
                          <span>{val}</span>
                          <button
                            type="button"
                            onClick={() => startEditingValue(idx, val)}
                            disabled={saving}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: 'var(--glb-muted, #94a3b8)',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Renombrar opción"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveValueFromForm(idx)}
                            disabled={saving}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: 'var(--glb-muted, #94a3b8)',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Quitar"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      )
                    )}
                  </div>
                )}

                <span
                  style={{
                    display: 'block',
                    marginTop: '0.4rem',
                    fontSize: '0.75rem',
                    color: 'var(--glb-muted, #64748b)',
                  }}
                >
                  {selectedKindConfig.predefinedValuesHint}
                </span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
              }}
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleSaveTemplate()}
                loading={saving}
                disabled={saving}
              >
                {editingTemplate ? 'Guardar Cambios' : 'Registrar Atributo'}
              </Button>
            </div>
          </div>
        </Popup>

        {/* Modal Confirmar Eliminar */}
        <Popup
          open={confirmDelete !== null}
          onClose={() => !deleting && setConfirmDelete(null)}
          title="Eliminar Atributo"
          width={440}
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--glb-text, #1e293b)' }}>
              ¿Estás seguro de eliminar el atributo{' '}
              <strong>«{confirmDelete?.name}»</strong>?
            </p>
            <p className="app-shell__muted" style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem' }}>
              Este atributo no tiene registros asociados actualmente. Dejará de sugerirse en la creación de productos.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleDelete()}
                loading={deleting}
                disabled={deleting}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Popup>
      </div>
    </TenantSessionGate>
  )
}

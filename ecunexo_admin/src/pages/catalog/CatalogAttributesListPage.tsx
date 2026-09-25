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
  | 'options_axis'
  | 'number'
  | 'boolean'
  | 'multiselect'

export interface AttributeKindConfig {
  value: AttributeKind
  label: string
  shortLabel: string
  description: string
  dimensionType: 'custom' | 'size' | 'color'
  dataType: 'text' | 'number' | 'boolean' | 'color' | 'multiselect'
  isVariantAxis: boolean
  requiresPredefinedValues: boolean
  hasUnit: boolean
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
    requiresPredefinedValues: false,
    hasUnit: false,
  },
  {
    value: 'size_axis',
    label: 'Escala de Tallas o Medidas',
    shortLabel: 'Tallas / Medidas',
    description: 'Para variantes con opciones fijas de tallas (ej. S, M, L o 38, 39, 40).',
    dimensionType: 'size',
    dataType: 'text',
    isVariantAxis: true,
    requiresPredefinedValues: true,
    hasUnit: false,
  },
  {
    value: 'color_axis',
    label: 'Muestras de Color',
    shortLabel: 'Color',
    description: 'Para variantes con muestras cromáticas o tonos (ej. Blanco, Negro, Azul).',
    dimensionType: 'color',
    dataType: 'color',
    isVariantAxis: true,
    requiresPredefinedValues: true,
    hasUnit: false,
  },
  {
    value: 'options_axis',
    label: 'Opciones de Variante (Caña, Calibre, etc.)',
    shortLabel: 'Opciones de Variante',
    description: 'Para características con opciones fijas que generan variantes (ej. Caña Alta/Baja).',
    dimensionType: 'custom',
    dataType: 'text',
    isVariantAxis: true,
    requiresPredefinedValues: true,
    hasUnit: false,
  },
  {
    value: 'number',
    label: 'Número o Medida técnica con unidad',
    shortLabel: 'Número',
    description: 'Para valores numéricos (ej. Peso, Potencia, Capacidad) con unidad de medida.',
    dimensionType: 'custom',
    dataType: 'number',
    isVariantAxis: false,
    requiresPredefinedValues: false,
    hasUnit: true,
  },
  {
    value: 'boolean',
    label: 'Sí / No (Interruptor)',
    shortLabel: 'Sí / No',
    description: 'Para características que se activan o desactivan (ej. ¿Impermeable?, ¿Con Bluetooth?).',
    dimensionType: 'custom',
    dataType: 'boolean',
    isVariantAxis: false,
    requiresPredefinedValues: false,
    hasUnit: false,
  },
  {
    value: 'multiselect',
    label: 'Selección múltiple (Etiquetas informativas)',
    shortLabel: 'Selección Múltiple',
    description: 'Lista de opciones para etiquetar el producto en ficha técnica (sin generar variantes).',
    dimensionType: 'custom',
    dataType: 'multiselect',
    isVariantAxis: false,
    requiresPredefinedValues: false,
    hasUnit: false,
  },
]

export function resolveAttributeKind(template: {
  dimensionType?: string | null
  dataType?: string | null
  isVariantAxis?: boolean | null
}): AttributeKind {
  if (template.dimensionType === 'size' && template.isVariantAxis !== false) return 'size_axis'
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

  const handleRemoveValueFromForm = useCallback((index: number) => {
    setFormValues((prev) => prev.filter((_, i) => i !== index))
  }, [])

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
      const payload = {
        name,
        dimensionType: kindConfig.dimensionType,
        predefinedValuesJson: JSON.stringify(formValues),
        dataType: kindConfig.dataType,
        isVariantAxis: kindConfig.isVariantAxis,
        unit: kindConfig.hasUnit && formUnit.trim() ? formUnit.trim() : null,
      }
      if (editingTemplate) {
        await updateVariantDimensionTemplate(tenantId, editingTemplate.id, payload)
        toast.show({
          title: 'Atributo actualizado',
          message: `«${name}» se guardó correctamente.`,
          variant: 'success',
        })
      } else {
        await createVariantDimensionTemplate(tenantId, payload)
        toast.show({
          title: 'Atributo registrado',
          message: `«${name}» se agregó al catálogo.`,
          variant: 'success',
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
  }, [editingTemplate, formKind, formName, formUnit, formValues, loadData, tenantId, toast])

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
              <span title="Inmutable: asociado a productos en el catálogo">
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
        key: 'isSystemDefault',
        header: 'Estado / Registros',
        width: 170,
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
            <span className="ecu-source">{row.isSystemDefault ? 'Base' : 'Empresa'}</span>
          </div>
        ),
      },
      {
        key: 'id',
        header: 'Acciones',
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
  }, [canManage, openEditModal])

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
          title={editingTemplate ? `Editar «${editingTemplate.name}»` : 'Nuevo Atributo'}
          width={480}
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
              disabled={saving || Boolean(editingTemplate?.isInUse)}
              required
              fullWidth
            />
            {editingTemplate?.isInUse && (
              <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 500 }}>
                * Nombre inmutable por estar asociado a productos.
              </span>
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
              disabled={saving}
              fullWidth
            />

            {selectedKindConfig.hasUnit && (
              <TextBox
                id="template-unit"
                label="Unidad"
                labelPosition="outlined"
                variant="outline"
                placeholder="Escriba aquí (ej. cm, kg)..."
                value={formUnit}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormUnit(e.target.value)}
                disabled={saving}
                fullWidth
              />
            )}

            {selectedKindConfig.requiresPredefinedValues && (
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
                  Opciones
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
                    {formValues.map((val, idx) => (
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
                    ))}
                  </div>
                )}
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

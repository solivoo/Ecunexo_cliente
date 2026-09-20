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
  RefreshCw,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
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

type TemplateGridRow = VariantDimensionTemplateDto & {
  parsedValues: string[]
} & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('atributo', 'atributos')

export function CatalogAttributesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canRead =
    useHasPermission('catalog.item.read') ||
    useHasPermission('catalog.scale.manage') ||
    useHasPermission('catalog.product.read')
  const canManage = useHasPermission('catalog.scale.manage')

  const [rows, setRows] = useState<VariantDimensionTemplateDto[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')

  // Modal Crear / Editar
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<VariantDimensionTemplateDto | null>(null)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('custom')
  const [formValues, setFormValues] = useState<string[]>([])
  const [newValueInput, setNewValueInput] = useState('')
  const [saving, setSaving] = useState(false)

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
    setFormType('custom')
    setFormValues([])
    setNewValueInput('')
    setEditModalOpen(true)
  }, [])

  const openEditModal = useCallback((template: VariantDimensionTemplateDto) => {
    if (template.isSystemDefault) {
      toast.show({
        title: 'Escala protegida',
        message: 'Las escalas base del sistema no pueden modificarse para preservar la integridad.',
        variant: 'warning',
      })
      return
    }
    setEditingTemplate(template)
    setFormName(template.name)
    setFormType(template.dimensionType || 'custom')
    try {
      const parsed = JSON.parse(template.predefinedValuesJson)
      setFormValues(Array.isArray(parsed) ? parsed : [])
    } catch {
      setFormValues([])
    }
    setNewValueInput('')
    setEditModalOpen(true)
  }, [toast])

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
        message: 'Ingresa un nombre para el atributo o escala.',
        variant: 'warning',
      })
      return
    }
    if (formValues.length === 0) {
      toast.show({
        title: 'Valores requeridos',
        message: 'Añade al menos un valor predefinido (ej. Corta, Media, Larga).',
        variant: 'warning',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name,
        dimensionType: formType,
        predefinedValuesJson: JSON.stringify(formValues),
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
          message: `«${name}» se agregó al diccionario de catálogo.`,
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
  }, [editingTemplate, formName, formType, formValues, loadData, tenantId, toast])

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
    let systemCount = 0
    let customCount = 0

    for (const r of rows) {
      if (r.isSystemDefault) systemCount++
      else customCount++
      try {
        const parsed = JSON.parse(r.predefinedValuesJson)
        if (Array.isArray(parsed)) totalValues += parsed.length
      } catch {
        // ignorar
      }
    }
    return {
      total: rows.length,
      system: systemCount,
      custom: customCount,
      values: totalValues,
    }
  }, [rows])

  const filteredRows = useMemo<TemplateGridRow[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (filterType !== 'all' && r.dimensionType !== filterType) return false
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
        header: 'Atributo / Escala',
        width: 240,
        sortable: true,
        renderCell: (_val: unknown, row: TemplateGridRow) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {row.isSystemDefault ? (
                <span title="Escala base de sistema">
                  <Lock size={13} style={{ color: 'var(--glb-muted, #64748b)' }} />
                </span>
              ) : (
                <Tag size={13} style={{ color: 'var(--shell-primary, #4f46e5)' }} />
              )}
              <strong>{row.name}</strong>
            </div>
          </div>
        ),
      },
      {
        key: 'dimensionType',
        header: 'Clasificación',
        width: 160,
        sortable: true,
        renderCell: (_val: unknown, row: TemplateGridRow) => {
          if (row.dimensionType === 'size') {
            return <StatusBadge tone="info">Tallas / Medidas</StatusBadge>
          }
          if (row.dimensionType === 'color') {
            return <StatusBadge tone="warning">Color / Acabado</StatusBadge>
          }
          return <StatusBadge tone="neutral">Especificación</StatusBadge>
        },
      },
      {
        key: 'parsedValues',
        header: 'Valores Predefinidos',
        width: 420,
        renderCell: (_val: unknown, row: TemplateGridRow) => (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {row.parsedValues.slice(0, 7).map((val) => (
              <span
                key={val}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  background: 'var(--glb-surface-ground, rgba(0, 0, 0, 0.04))',
                  border: '1px solid var(--shell-border, rgba(0, 0, 0, 0.12))',
                  color: 'var(--glb-text, #1e293b)',
                  whiteSpace: 'nowrap',
                }}
              >
                {val}
              </span>
            ))}
            {row.parsedValues.length > 7 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--glb-muted, #64748b)',
                  fontWeight: 600,
                }}
              >
                +{row.parsedValues.length - 7} más
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'isSystemDefault',
        header: 'Origen',
        width: 140,
        sortable: true,
        renderCell: (_val: unknown, row: TemplateGridRow) =>
          row.isSystemDefault ? (
            <StatusBadge tone="neutral">Sistema (Base)</StatusBadge>
          ) : (
            <StatusBadge tone="success">Empresa</StatusBadge>
          ),
      },
      {
        key: 'id',
        header: 'Acciones',
        width: 110,
        align: 'center',
        renderCell: (_val: unknown, row: TemplateGridRow) => {
          if (row.isSystemDefault) {
            return (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--glb-muted, #94a3b8)',
                  fontStyle: 'italic',
                }}
              >
                Inmutable
              </span>
            )
          }
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
                label={`Eliminar «${row.name}»`}
                danger
                onClick={() => setConfirmDelete(row)}
                disabled={!canManage}
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
        id: 'categories',
        label: 'Categorías',
        icon: 'folder-tree',
        route: '/catalogo/categorias',
        disabled: false,
      },
    ],
    []
  )

  return (
    <TenantSessionGate
      title="Atributos y Escalas"
      lead="Diccionario corporativo de atributos, escalas de tallas y valores estandarizados para el catálogo."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Atributos y Escalas"
          subtitle="Estandariza los nombres y valores de atributos (tallas, caña, colores, materiales) para evitar inconsistencias en variantes y especificaciones."
          badge={
            <StatusBadge tone="info">
              {rows.length} {rows.length === 1 ? 'Atributo' : 'Atributos'}
            </StatusBadge>
          }
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadData()}
                disabled={loading}
                title="Refrescar diccionario"
              >
                <RefreshCw size={15} className={loading ? 'app-shell__spin' : undefined} />
                <span>Refrescar</span>
              </Button>
              {canManage && (
                <Button type="button" variant="primary" onClick={openCreateModal}>
                  <Plus size={15} />
                  <span>Nuevo Atributo</span>
                </Button>
              )}
            </div>
          }
        />

        <EcuPageActions
          items={actionItems}
          triggerLabel="Acciones de catálogo"
          renderIcon={renderSidebarIcon}
          onNavigate={(route: string) => void navigate(route)}
        />

        <div className="ecu-stat-grid" style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
          <StatCard
            label="Total Atributos"
            value={stats.total}
            icon="tags"
            toneColor="#4f46e5"
            footerText="Atributos y escalas disponibles"
          />
          <StatCard
            label="Escalas del Sistema"
            value={stats.system}
            icon="lock"
            toneColor="#64748b"
            footerText="Plantillas base protegidas para Ecuador"
          />
          <StatCard
            label="Personalizadas"
            value={stats.custom}
            icon="tag"
            toneColor="#0ea5e9"
            footerText="Creadas por tu empresa"
          />
          <StatCard
            label="Valores Normalizados"
            value={stats.values}
            icon="sparkles"
            toneColor="#10b981"
            footerText="Opciones precargadas para 1 clic"
          />
        </div>

        <SectionCard
          title="Diccionario Maestro de Atributos"
          subtitle="Selecciona o gestiona los atributos que se reutilizan en variantes (tallas, colores) y campos adicionales de productos."
        >
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
            }}
          >
            <div style={{ flex: '1 1 280px', maxWidth: '400px' }}>
              <TextBox
                id="search-attr"
                placeholder="Buscar por nombre o valor (ej. Caña, 35-38, Algodón)…"
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                fullWidth
              />
            </div>
            <div style={{ width: '220px' }}>
              <Select
                id="filter-type"
                options={[
                  { value: 'all', label: 'Todas las clasificaciones' },
                  { value: 'size', label: 'Tallas y Medidas' },
                  { value: 'color', label: 'Colores y Acabados' },
                  { value: 'custom', label: 'Especificaciones' },
                ]}
                value={filterType}
                onChange={setFilterType}
                fullWidth
              />
            </div>
          </div>

          <DataGrid<TemplateGridRow>
            dataSource={filteredRows}
            columns={columns}
            loading={loading}
            keyExpr="id"
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
          title={editingTemplate ? `Editar Atributo «${editingTemplate.name}»` : 'Nuevo Atributo o Escala'}
          width={560}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <TextBox
              id="template-name"
              label="Nombre del Atributo o Escala"
              labelPosition="outlined"
              variant="outline"
              placeholder="Ej. Tipo de Caña / Altura, Material, Grosor de Hilo"
              value={formName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
              disabled={saving}
              required
              fullWidth
            />

            <Select
              id="template-type"
              label="Tipo / Clasificación"
              labelPosition="outlined"
              variant="outline"
              options={[
                { value: 'custom', label: 'Especificación / Dimensión Personalizada' },
                { value: 'size', label: 'Talla o Medida Física' },
                { value: 'color', label: 'Color o Muestra Cromática' },
              ]}
              value={formType}
              onChange={setFormType}
              disabled={saving}
              fullWidth
            />

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.4rem',
                  color: 'var(--glb-text, #1e293b)',
                }}
              >
                Valores Predefinidos (Opciones Estandarizadas)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <TextBox
                  id="new-val-input"
                  placeholder="Ej. Tobillera, Media Canilla, Caña Alta…"
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
                <p
                  className="app-shell__muted"
                  style={{
                    fontSize: '0.82rem',
                    margin: 0,
                    padding: '0.75rem',
                    borderRadius: '6px',
                    background: 'var(--glb-surface-ground, rgba(0, 0, 0, 0.03))',
                    border: '1px dashed var(--shell-border, rgba(0, 0, 0, 0.12))',
                  }}
                >
                  No has añadido valores. Escribe una opción arriba y pulsa «Añadir» o Enter.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: 'var(--glb-surface-ground, rgba(0, 0, 0, 0.02))',
                    border: '1px solid var(--shell-border, rgba(0, 0, 0, 0.12))',
                  }}
                >
                  {formValues.map((val, idx) => (
                    <span
                      key={val}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        padding: '0.2rem 0.6rem',
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
                        title="Quitar opción"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

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
              ¿Estás seguro de eliminar el atributo personalizado{' '}
              <strong>«{confirmDelete?.name}»</strong>?
            </p>
            <p className="app-shell__muted" style={{ margin: '0 0 1.25rem 0', fontSize: '0.82rem' }}>
              Los productos y variantes ya creados con estos valores conservarán su información intacta.
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

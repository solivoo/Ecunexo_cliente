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
} from 'glubox'
import {
  Camera,
  Layers,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useCatalogLimits } from '@/hooks/useCatalogLimits'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  deleteProductTemplate,
  listProductTemplates,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type {
  ProductTemplateDto,
  ProductTemplateLevel,
} from '@/types/catalogApi'

type TemplateGridRow = ProductTemplateDto & {
  parsedLevels: ProductTemplateLevel[]
  hierarchy?: string
  levelsCount?: number
  actions?: string
}

const gridMessages = createSpanishDataGridMessages('plantilla', 'plantillas')

export function ProductTemplatesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canCreateItems = useHasPermission('catalog.item.create')
  const canManageScales = useHasPermission('catalog.scale.manage')
  const canManage = canCreateItems || canManageScales

  const [rows, setRows] = useState<ProductTemplateDto[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  // Modal Confirmar Eliminar
  const [confirmDelete, setConfirmDelete] = useState<ProductTemplateDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        const list = await listProductTemplates(tenantId)
        setRows(list)
        if (!opts?.silent) {
          toast.show({
            title: 'Sincronizado',
            message: 'Listado de plantillas de producto actualizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar las plantillas de producto.')
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    void loadData({ silent: true })
  }, [loadData])

  const handleDelete = async () => {
    if (!tenantId || !confirmDelete) return
    setDeleting(true)
    try {
      await deleteProductTemplate(tenantId, confirmDelete.id)
      toast.show({
        title: 'Plantilla eliminada',
        message: `La plantilla «${confirmDelete.name}» ha sido eliminada.`,
        variant: 'success',
      })
      setConfirmDelete(null)
      await loadData({ silent: true })
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo eliminar la plantilla.')
      toast.show({ title: 'Error al eliminar', message, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  // Enriched rows with parsed levels
  const enrichedRows: TemplateGridRow[] = useMemo(() => {
    return rows.map((tpl) => {
      let parsedLevels: ProductTemplateLevel[] = []
      try {
        const parsed = JSON.parse(tpl.hierarchyTreeJson)
        if (Array.isArray(parsed)) {
          parsedLevels = parsed
        }
      } catch {
        parsedLevels = []
      }
      return {
        ...tpl,
        parsedLevels,
      }
    })
  }, [rows])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return enrichedRows.filter((r) => {
      if (filterStatus === 'active' && !r.isActive) return false
      if (filterStatus === 'inactive' && r.isActive) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.parsedLevels.some((lvl) => lvl.name.toLowerCase().includes(q))
      )
    })
  }, [enrichedRows, filterStatus, searchQuery])

  // KPIs
  const totalCount = rows.length
  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])
  const { maxProductTemplates } = useCatalogLimits()
  const templateLimitReached =
    maxProductTemplates != null && rows.length >= maxProductTemplates
  const maxDepth = useMemo(() => {
    return enrichedRows.reduce((max, r) => Math.max(max, r.parsedLevels.length), 0)
  }, [enrichedRows])

  // Columns definition
  const columns = useMemo((): ColumnDef<TemplateGridRow>[] => [
    {
      key: 'name',
      header: 'Nombre de la Plantilla',
      width: 280,
      renderCell: (_val: unknown, row: TemplateGridRow) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--glb-text)' }}>{row.name}</span>
          {row.description ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
              {row.description}
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--glb-muted)' }}>
              Sin descripción
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'hierarchy',
      header: 'Jerarquía y Niveles',
      width: 420,
      renderCell: (_val: unknown, row: TemplateGridRow) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          {row.parsedLevels.map((lvl: ProductTemplateLevel, idx: number) => (
            <div
              key={lvl.id || idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                background: 'var(--shell-surface-subtle, rgba(255,255,255,0.04))',
                border: '1px solid var(--shell-border, rgba(255,255,255,0.08))',
                color: 'var(--glb-text)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--shell-primary, #3b82f6)' }}>
                N{idx + 1}:
              </span>
              <span>{lvl.name}</span>
              {lvl.hasColor && (
                <span title="Lleva color" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Palette size={12} color="#10b981" />
                </span>
              )}
              {(lvl.photoScope ?? (lvl.hasImages ? 'variant' : 'none')) !== 'none' && (
                <span
                  title={
                    lvl.photoScope === 'model'
                      ? 'Fotos del modelo (todas las variantes las heredan)'
                      : lvl.photoScope === 'group'
                        ? 'Fotos compartidas por grupo'
                        : 'Fotos por variante (SKU)'
                  }
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <Camera size={12} color="#a78bfa" />
                </span>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'levelsCount',
      header: 'Profundidad',
      width: 130,
      renderCell: (_val: unknown, row: TemplateGridRow) => (
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--glb-text)' }}>
          {row.parsedLevels.length} {row.parsedLevels.length === 1 ? 'nivel' : 'niveles'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Estado',
      width: 130,
      renderCell: (_val: unknown, row: TemplateGridRow) => (
        <StatusBadge tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Activo' : 'Inactivo'}
        </StatusBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Fecha Creación',
      width: 160,
      renderCell: (_val: unknown, row: TemplateGridRow) => {
        const date = new Date(row.createdAt)
        return (
          <span style={{ fontSize: '0.85rem', color: 'var(--glb-muted)' }}>
            {date.toLocaleDateString('es-EC', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )
      },
    },
    {
      key: 'usageCount',
      header: 'Uso',
      width: 140,
      sortable: true,
      renderCell: (_val: unknown, row: TemplateGridRow) => (
        <StatusBadge tone={row.usageCount && row.usageCount > 0 ? 'info' : 'neutral'}>
          {row.usageCount && row.usageCount > 0
            ? `${row.usageCount} ${row.usageCount === 1 ? 'producto' : 'productos'}`
            : 'Sin uso'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      width: 110,
      align: 'center',
      renderCell: (_val: unknown, row: TemplateGridRow) => (
        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
          <GridIconButton
            icon={Pencil}
            label={`Editar ${row.name}`}
            onClick={() => navigate(`/catalogo/plantillas/${row.id}`)}
            disabled={!canManage}
          />
          <GridIconButton
            icon={Trash2}
            label={
              row.usageCount && row.usageCount > 0
                ? `En uso por ${row.usageCount} producto(s): no se puede eliminar`
                : `Eliminar ${row.name}`
            }
            danger
            onClick={() => setConfirmDelete(row)}
            disabled={!canManage || Boolean(row.usageCount && row.usageCount > 0)}
          />
        </div>
      ),
    },
  ], [canManage, navigate])

  return (
    <TenantSessionGate
      title="Plantillas de Producto"
      lead="Diseña arquetipos y jerarquías para estructurar familias, modelos y variantes sin repetir configuración."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Plantillas de Producto"
          subtitle="Diseña arquetipos y jerarquías para estructurar familias, modelos y variantes sin repetir configuración."
          badge={
            <StatusBadge tone="info">
              {rows.length} {rows.length === 1 ? 'Plantilla' : 'Plantillas'}
            </StatusBadge>
          }
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadData()}
                disabled={loading}
              >
                <RefreshCw size={15} className={loading ? 'app-shell__spin' : undefined} />
                <span>Actualizar</span>
              </Button>
              {canManage && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/catalogo/plantillas/nueva')}
                  disabled={templateLimitReached}
                  title={
                    templateLimitReached
                      ? `Tu plan permite hasta ${maxProductTemplates} plantillas de producto.`
                      : undefined
                  }
                >
                  <Plus size={16} />
                  <span>Nueva Plantilla</span>
                </Button>
              )}
            </div>
          }
        />

        {templateLimitReached && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid color-mix(in srgb, #f59e0b 30%, var(--shell-border, rgba(255, 255, 255, 0.1)))',
              backgroundColor: 'color-mix(in srgb, #f59e0b 8%, var(--glb-surface, transparent))',
              fontSize: '0.85rem',
            }}
          >
            <Layers size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span>
              Alcanzaste el máximo de <strong>{maxProductTemplates}</strong> plantillas de producto de tu plan.
              Actualiza tu plan para crear más arquetipos.
            </span>
          </div>
        )}

        {/* KPIs in ecu-stat-grid */}
        <div className="ecu-stat-grid" style={{ marginBottom: '1.25rem' }}>
          <StatCard
            label="Total Plantillas"
            value={totalCount}
            icon={<Layers size={20} />}
            toneColor="#4f46e5"
            footerText="Arquetipos configurados"
          />
          <StatCard
            label="Plantillas Activas"
            value={activeCount}
            icon={<Sparkles size={20} />}
            toneColor="#10b981"
            footerText="Listas para usar en catálogo"
          />
          <StatCard
            label="Máximo de Niveles"
            value={`${maxDepth} ${maxDepth === 1 ? 'nivel' : 'niveles'}`}
            icon={<Layers size={20} />}
            toneColor="#0ea5e9"
            footerText="Profundidad máxima alcanzada"
          />
        </div>

        {/* SectionCard with DataGrid */}
        <SectionCard
          title="Directorio de Plantillas Jerárquicas"
          subtitle="Administra los modelos estructurales para organizar productos simples y multinivel."
        >
          {/* Filters Bar */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '1rem',
            }}
          >
            <div style={{ flex: '1 1 260px', maxWidth: '400px' }}>
              <TextBox
                id="search-template"
                variant="outline"
                placeholder="Buscar por nombre, descripción o nivel..."
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                fullWidth
              />
            </div>
            <div style={{ width: '200px' }}>
              <Select
                id="filter-template-status"
                value={filterStatus}
                onChange={(val: string) => setFilterStatus(val as 'all' | 'active' | 'inactive')}
                options={[
                  { value: 'all', label: 'Todos los estados' },
                  { value: 'active', label: 'Solo activas' },
                  { value: 'inactive', label: 'Solo inactivas' },
                ]}
                fullWidth
              />
            </div>
          </div>

          <DataGrid<TemplateGridRow>
            columns={columns}
            dataSource={filteredRows}
            loading={loading}
            keyExpr="id"
            paging={paging}
            pageSizeOptions={pageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            messages={gridMessages}
            emptyMessage="No hay plantillas de producto creadas. Crea una para definir arquetipos jerárquicos."
          />
        </SectionCard>

        {/* Modal Confirmar Eliminar */}
        {confirmDelete && (
          <Popup
            title="Eliminar Plantilla de Producto"
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            width={480}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--glb-text)' }}>
                ¿Estás seguro de que deseas eliminar la plantilla{' '}
                <strong>«{confirmDelete.name}»</strong>?
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--glb-muted)' }}>
                Los productos creados previamente mantendrán sus variantes y datos intactos.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? 'Eliminando...' : 'Eliminar Plantilla'}
                </Button>
              </div>
            </div>
          </Popup>
        )}
      </div>
    </TenantSessionGate>
  )
}

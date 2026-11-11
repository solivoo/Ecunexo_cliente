import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataGrid,
  Popup,
  Select,
  TextArea,
  TextBox,
  useToast,
  type ColumnDef,
  type PageActionItem,
} from 'glubox'
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  EcuPageActions,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { buildCategorySelectOptions, categorySelectLabel } from '@/lib/catalogCategoryLabels'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/services/catalogApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { CategoryListItemDto } from '@/types/catalogApi'

type CategoryGridRow = CategoryListItemDto & {
  parentName: string | null
} & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('categoría', 'categorías')

export function CategoriesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const hasCategoryRead = useHasPermission('catalog.category.read')
  const hasItemRead = useHasPermission('catalog.item.read')
  const canManage = useHasPermission('catalog.category.manage')
  const canRead = hasCategoryRead || hasItemRead || canManage

  const [rows, setRows] = useState<CategoryListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryListItemDto | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formParentId, setFormParentId] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<CategoryListItemDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        const list = await listCategories(tenantId)
        setRows(list)
        if (!opts?.silent) {
          toast.show({
            title: 'Sincronizado',
            message: 'Categorías actualizadas.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar las categorías.')
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    if (!tenantId || !canRead) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData({ silent: true })
  }, [canRead, loadData, tenantId])

  const openCreateModal = useCallback(() => {
    setEditingCategory(null)
    setFormName('')
    setFormDescription('')
    setFormParentId('')
    setEditModalOpen(true)
  }, [])

  const openEditModal = useCallback((category: CategoryListItemDto) => {
    setEditingCategory(category)
    setFormName(category.name)
    setFormDescription(category.description ?? '')
    setFormParentId(category.parentId ?? '')
    setEditModalOpen(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!tenantId) return
    const name = formName.trim()
    if (!name) {
      toast.show({
        title: 'Nombre requerido',
        message: 'Ingresa un nombre para la categoría.',
        variant: 'warning',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name,
        description: formDescription.trim() || null,
        parentId: formParentId || null,
      }
      if (editingCategory) {
        await updateCategory(tenantId, editingCategory.id, payload)
        toast.show({
          title: 'Categoría actualizada',
          message: `«${name}» se guardó correctamente.`,
          variant: 'success',
        })
      } else {
        await createCategory(tenantId, payload)
        toast.show({
          title: 'Categoría registrada',
          message: `«${name}» se agregó al catálogo.`,
          variant: 'success',
        })
      }
      setEditModalOpen(false)
      await loadData({ silent: true })
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo guardar la categoría.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [editingCategory, formDescription, formName, formParentId, loadData, tenantId, toast])

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirmDelete) return
    setDeleting(true)
    try {
      await deleteCategory(tenantId, confirmDelete.id)
      toast.show({
        title: 'Categoría eliminada',
        message: `«${confirmDelete.name}» fue retirada del catálogo.`,
        variant: 'success',
      })
      setConfirmDelete(null)
      await loadData({ silent: true })
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo eliminar la categoría.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }, [confirmDelete, loadData, tenantId, toast])

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryListItemDto>()
    for (const r of rows) {
      map.set(r.id, r)
    }
    return map
  }, [rows])

  const stats = useMemo(() => {
    let roots = 0
    let withParent = 0
    for (const r of rows) {
      if (r.parentId) withParent++
      else roots++
    }
    return {
      total: rows.length,
      roots,
      withParent,
    }
  }, [rows])

  const filteredRows = useMemo<CategoryGridRow[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    return rows
      .map((r) => ({
        ...r,
        parentName: (() => {
          const parent = r.parentId ? categoryById.get(r.parentId) : undefined
          return parent ? categorySelectLabel(parent, categoryById) : null
        })(),
      }))
      .filter((r) => {
        if (!q) return true
        return (
          r.name.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q) ||
          (r.parentName ?? '').toLowerCase().includes(q)
        )
      })
  }, [categoryById, rows, searchQuery])

  const parentSelectOptions = useMemo(
    () =>
      buildCategorySelectOptions(rows, {
        emptyLabel: 'Sin categoría padre',
        excludeId: editingCategory?.id,
      }),
    [editingCategory?.id, rows]
  )

  const columns = useMemo((): ColumnDef<CategoryGridRow>[] => {
    return [
      {
        key: 'name',
        header: 'Nombre',
        width: 280,
        sortable: true,
        renderCell: (_val: unknown, row: CategoryGridRow) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FolderTree size={14} style={{ color: 'var(--idt-muted, #64748b)', flexShrink: 0 }} />
            <strong>{row.name}</strong>
          </div>
        ),
      },
      {
        key: 'parentName',
        header: 'Padre',
        width: 220,
        sortable: true,
        renderCell: (_val: unknown, row: CategoryGridRow) =>
          row.parentName ? (
            <span className="ecu-chip">{row.parentName}</span>
          ) : (
            <span className="ecu-hint">—</span>
          ),
      },
      {
        key: 'description',
        header: 'Descripción',
        width: 380,
        renderCell: (_val: unknown, row: CategoryGridRow) =>
          row.description ? (
            <span>{row.description}</span>
          ) : (
            <span className="ecu-hint">—</span>
          ),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 100,
        align: 'center',
        renderCell: (_val: unknown, row: CategoryGridRow) => (
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
        ),
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
        id: 'attributes',
        label: 'Atributos',
        icon: 'tag',
        route: '/catalogo/atributos',
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
      title="Categorías"
      lead="Clasificación jerárquica de productos del catálogo."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid ecu-section-page ecu-catalog-page">
        <PageHeader
          title="Categorías"
          info="Clasificación comercial para organizar productos del catálogo."
        />

        <div className="ecu-stat-grid">
          <StatCard label="Categorías totales" value={stats.total} />
          <StatCard label="Principales (raíz)" value={stats.roots} />
          <StatCard label="Subcategorías" value={stats.withParent} />
        </div>

        <SectionCard title="Directorio">
          <div className="ecu-commandbar">
            <div className="ecu-commandbar__search">
              <TextBox
                id="search-cat"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                fullWidth
              />
            </div>
            <div className="ecu-commandbar__spacer" />
            <div className="ecu-commandbar__action">
              <div className="ecu-grid-toolbar-actions">
                <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                {canManage && (
                  <Button
                    type="button"
                    variant="primary"
                    iconLeft={<Plus size={15} />}
                    onClick={openCreateModal}
                  >
                    <span>Nueva Categoría</span>
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

          <DataGrid<CategoryGridRow>
            dataSource={filteredRows}
            columns={columns}
            loading={loading}
            keyExpr="id"
            showSearch={false}
            emptyMessage={
              searchQuery
                ? 'No se encontraron categorías con el filtro actual.'
                : 'No hay categorías registradas.'
            }
            messages={gridMessages}
            paging={paging}
            pageSizeOptions={pageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </SectionCard>

        <Popup
          open={editModalOpen}
          onClose={() => !saving && setEditModalOpen(false)}
          title={editingCategory ? `Editar «${editingCategory.name}»` : 'Nueva Categoría'}
          width={480}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.25rem 0' }}>
            <TextBox
              id="cat-name"
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

            <Select
              id="cat-parent"
              label="Categoría padre"
              labelPosition="outlined"
              variant="outline"
              placeholder="Seleccione..."
              options={parentSelectOptions}
              value={formParentId}
              onChange={setFormParentId}
              disabled={saving}
              fullWidth
            />

            <TextArea
              id="cat-desc"
              label="Descripción"
              labelPosition="outlined"
              variant="outline"
              placeholder="Escriba aquí..."
              value={formDescription}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormDescription(e.target.value)}
              disabled={saving}
              rows={2}
              fullWidth
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '0.5rem',
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
                onClick={() => void handleSave()}
                loading={saving}
                disabled={saving}
              >
                {editingCategory ? 'Guardar Cambios' : 'Registrar Categoría'}
              </Button>
            </div>
          </div>
        </Popup>

        <Popup
          open={confirmDelete !== null}
          onClose={() => !deleting && setConfirmDelete(null)}
          title="Eliminar Categoría"
          width={440}
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.9rem', color: 'var(--glb-text, #1e293b)' }}>
              ¿Estás seguro de eliminar la categoría <strong>«{confirmDelete?.name}»</strong>?
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

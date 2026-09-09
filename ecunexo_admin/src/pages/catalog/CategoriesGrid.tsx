import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, type ColumnDef } from 'glubox'
import { Pencil, Trash2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import type { CategoryListItemDto } from '@/types/catalogApi'

export type CategoryGridRow = CategoryListItemDto & Record<string, unknown>

export type CategoriesGridProps = {
  readonly rows: CategoryListItemDto[]
  readonly loading?: boolean
  readonly canEdit?: boolean
  readonly canDelete?: boolean
  readonly deletingId?: string | null
  readonly onDelete?: (row: CategoryListItemDto) => void
}

const gridMessages = createSpanishDataGridMessages('categoría', 'categorías')

export function CategoriesGrid({
  rows,
  loading = false,
  canEdit = false,
  canDelete = false,
  deletingId = null,
  onDelete,
}: CategoriesGridProps) {
  const navigate = useNavigate()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r.name])), [rows])

  const columns = useMemo((): ColumnDef<CategoryGridRow>[] => {
    const cols: ColumnDef<CategoryGridRow>[] = [
      {
        key: 'name',
        header: 'Nombre',
        width: 240,
        sortable: true,
        renderCell: (_value: CategoryGridRow['name'], row: CategoryGridRow) => (
          <strong>{row.name}</strong>
        ),
      },
      {
        key: 'parentId',
        header: 'Padre',
        width: 200,
        sortable: true,
        renderCell: (_value: CategoryGridRow['parentId'], row: CategoryGridRow) =>
          row.parentId ? (byId.get(row.parentId) ?? '—') : '—',
      },
      {
        key: 'description',
        header: 'Descripción',
        width: 360,
        sortable: true,
        renderCell: (_value: CategoryGridRow['description'], row: CategoryGridRow) =>
          row.description ?? '—',
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 170,
        sortable: true,
        renderCell: (_value: CategoryGridRow['createdAt'], row: CategoryGridRow) =>
          formatDateTime(row.createdAt),
      },
    ]

    if (canEdit || canDelete) {
      cols.push({
        key: 'id',
        header: 'Acciones',
        width: canDelete ? 112 : 72,
        align: 'center',
        sortable: false,
        renderCell: (_value: CategoryGridRow['id'], row: CategoryGridRow) => (
          <div className="ecu-companies-grid__actions">
            {canEdit ? (
              <GridIconButton
                label="Editar"
                icon={Pencil}
                onClick={() => navigate(`/catalogo/categorias/${row.id}/editar`)}
              />
            ) : null}
            {canDelete && onDelete ? (
              <GridIconButton
                label="Eliminar"
                icon={Trash2}
                danger
                disabled={deletingId === row.id}
                loading={deletingId === row.id}
                onClick={() => onDelete(row)}
              />
            ) : null}
          </div>
        ),
      })
    }

    return cols
  }, [byId, canDelete, canEdit, deletingId, navigate, onDelete])

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={rows as CategoryGridRow[]}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
      showSearch
      searchPosition="left"
      searchWidth={280}
      searchPlaceholder="Buscar categoría…"
      searchKeys={['name', 'description']}
      paging={paging}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      paginationMode="client"
      pageSizeOptions={pageSizeOptions}
      layout="auto"
      loading={loading}
      messages={gridMessages}
    />
  )
}

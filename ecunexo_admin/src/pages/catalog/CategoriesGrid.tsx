import { useMemo } from 'react'
import { DataGrid, type ColumnDef } from 'glubox'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import type { CategoryListItemDto } from '@/types/catalogApi'

export type CategoryGridRow = CategoryListItemDto & Record<string, unknown>

export type CategoriesGridProps = {
  readonly rows: CategoryListItemDto[]
  readonly loading?: boolean
}

const gridMessages = createSpanishDataGridMessages('categoría', 'categorías')

export function CategoriesGrid({ rows, loading = false }: CategoriesGridProps) {
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r.name])), [rows])

  const columns = useMemo((): ColumnDef<CategoryGridRow>[] => {
    return [
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
  }, [byId])

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

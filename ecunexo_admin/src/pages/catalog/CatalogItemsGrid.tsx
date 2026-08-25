import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, type ColumnDef } from 'glubox'
import { Pencil } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { catalogItemKindLabel, catalogItemStatusLabel } from '@/lib/catalogLabels'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import type { CatalogItemListItemDto } from '@/types/catalogApi'

export type CatalogItemGridRow = CatalogItemListItemDto & Record<string, unknown>

export type CatalogItemsGridProps = {
  readonly rows: CatalogItemListItemDto[]
  readonly loading?: boolean
  readonly canEdit?: boolean
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('ítem', 'ítems')

export function CatalogItemsGrid({
  rows,
  loading = false,
  canEdit = false,
  toolbarRight,
}: CatalogItemsGridProps) {
  const navigate = useNavigate()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<CatalogItemGridRow>[] => {
    const cols: ColumnDef<CatalogItemGridRow>[] = [
      {
        key: 'name',
        header: 'Nombre',
        width: 240,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['name'], row: CatalogItemGridRow) => (
          <strong>{row.name}</strong>
        ),
      },
      {
        key: 'kind',
        header: 'Tipo',
        width: 110,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['kind'], row: CatalogItemGridRow) =>
          catalogItemKindLabel(row.kind),
      },
      {
        key: 'sku',
        header: 'SKU',
        width: 140,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['sku'], row: CatalogItemGridRow) =>
          row.sku ?? '—',
      },
      {
        key: 'categoryName',
        header: 'Categoría',
        width: 180,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['categoryName'], row: CatalogItemGridRow) =>
          row.categoryName ?? '—',
      },
      {
        key: 'basePrice',
        header: 'Precio',
        width: 110,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['basePrice'], row: CatalogItemGridRow) =>
          row.basePrice == null ? '—' : row.basePrice.toFixed(2),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 110,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['status'], row: CatalogItemGridRow) =>
          catalogItemStatusLabel(row.status),
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 170,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['createdAt'], row: CatalogItemGridRow) =>
          formatDateTime(row.createdAt),
      },
    ]

    if (canEdit) {
      cols.push({
        key: 'id',
        header: 'Acciones',
        width: 72,
        align: 'center',
        sortable: false,
        renderCell: (_value: CatalogItemGridRow['id'], row: CatalogItemGridRow) => (
          <div className="ecu-companies-grid__actions">
            <GridIconButton
              label="Editar"
              icon={Pencil}
              onClick={() => navigate(`/catalogo/items/${row.id}`)}
            />
          </div>
        ),
      })
    }

    return cols
  }, [canEdit, navigate])

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={rows as CatalogItemGridRow[]}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
      showSearch
      searchPosition="left"
      searchWidth={280}
      searchPlaceholder="Buscar nombre o SKU…"
      searchKeys={['name', 'sku', 'categoryName', 'description']}
      toolbarRight={toolbarRight}
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

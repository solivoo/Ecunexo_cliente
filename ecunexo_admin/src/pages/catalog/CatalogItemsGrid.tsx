import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, type ColumnDef } from 'glubox'
import { Pencil, Trash2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { StatusBadge } from '@/components/ui'
import { catalogItemKindLabel, catalogItemStatusLabel } from '@/lib/catalogLabels'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import {
  CatalogItemKind,
  CatalogItemStatus,
  type CatalogItemListItemDto,
} from '@/types/catalogApi'

export type CatalogItemGridRow = CatalogItemListItemDto & Record<string, unknown>

export type CatalogItemsGridProps = {
  readonly rows: CatalogItemListItemDto[]
  readonly loading?: boolean
  readonly canEdit?: boolean
  readonly canDelete?: boolean
  readonly deletingId?: string | null
  readonly onDelete?: (row: CatalogItemListItemDto) => void
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('ítem', 'ítems')

export function CatalogItemsGrid({
  rows,
  loading = false,
  canEdit = false,
  canDelete = false,
  deletingId = null,
  onDelete,
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
        width: 120,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['kind'], row: CatalogItemGridRow) => (
          <StatusBadge tone={row.kind === CatalogItemKind.Physical ? 'info' : 'neutral'}>
            {catalogItemKindLabel(row.kind)}
          </StatusBadge>
        ),
      },
      {
        key: 'sku',
        header: 'SKU',
        width: 140,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['sku'], row: CatalogItemGridRow) =>
          row.sku ? <code className="ecu-code">{row.sku}</code> : '—',
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
        header: 'Precio base',
        width: 120,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['basePrice'], row: CatalogItemGridRow) =>
          row.basePrice == null ? '—' : `$ ${row.basePrice.toFixed(2)}`,
      },
      {
        key: 'status',
        header: 'Estado',
        width: 120,
        sortable: true,
        renderCell: (_value: CatalogItemGridRow['status'], row: CatalogItemGridRow) => (
          <StatusBadge
            tone={row.status === CatalogItemStatus.Active ? 'success' : 'neutral'}
            withDot={row.status === CatalogItemStatus.Active}
          >
            {catalogItemStatusLabel(row.status)}
          </StatusBadge>
        ),
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

    if (canEdit || canDelete) {
      cols.push({
        key: 'id',
        header: 'Acciones',
        width: canDelete ? 112 : 72,
        align: 'center',
        sortable: false,
        renderCell: (_value: CatalogItemGridRow['id'], row: CatalogItemGridRow) => (
          <div className="ecu-companies-grid__actions">
            {canEdit ? (
              <GridIconButton
                label="Editar"
                icon={Pencil}
                onClick={() => navigate(`/catalogo/items/${row.id}`)}
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
  }, [canDelete, canEdit, deletingId, navigate, onDelete])

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

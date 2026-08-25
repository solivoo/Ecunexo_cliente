import { useMemo, type ReactNode } from 'react'
import { DataGrid, type ColumnDef } from 'glubox'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'

export type CompraGridRow = {
  id: string
  issueDate: string
  documentKind: string
  supplierName: string
  number: string
  total: string
  state: string
} & Record<string, unknown>

export type ComprasGridProps = {
  readonly rows: readonly CompraGridRow[]
  readonly loading?: boolean
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('documento', 'documentos')

export function ComprasGrid({
  rows,
  loading = false,
  toolbarRight,
}: ComprasGridProps) {
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<CompraGridRow>[] => {
    return [
      { key: 'issueDate', header: 'Fecha', width: 110, sortable: true },
      { key: 'documentKind', header: 'Tipo', width: 160, sortable: true },
      {
        key: 'supplierName',
        header: 'Proveedor',
        width: 220,
        sortable: true,
        renderCell: (_v, row) => <strong>{row.supplierName}</strong>,
      },
      { key: 'number', header: 'Número', width: 140, sortable: true },
      { key: 'total', header: 'Total', width: 110, align: 'right', sortable: true },
      { key: 'state', header: 'Estado', width: 140, sortable: true },
    ]
  }, [])

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={[...rows]}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
      showSearch
      searchPosition="left"
      searchWidth={280}
      searchPlaceholder="Buscar proveedor o número…"
      toolbarRight={toolbarRight}
      paging={paging}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      paginationMode="client"
      pageSizeOptions={pageSizeOptions}
      layout="auto"
      cardBreakpoint={720}
      virtualized
      virtualThreshold={40}
      showRowCount
      fullWidth
      loading={loading}
      messages={gridMessages}
      stickyFirstColumn
    />
  )
}

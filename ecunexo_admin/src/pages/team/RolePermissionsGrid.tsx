import { useMemo, type ReactNode } from 'react'
import { DataGrid, type ColumnDef } from 'glubox'
import { moduleLabel } from '@/lib/moduleLabels'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'

export type RolePermissionRow = {
  id: string
  code: string
  displayName: string | null
  description: string | null
  module: string | null
  assigned: boolean
} & Record<string, unknown>

export type RolePermissionsGridProps = {
  readonly rows: RolePermissionRow[]
  readonly selectedRowIds: Array<string | number>
  readonly loading?: boolean
  readonly onSelectionChange: (rows: RolePermissionRow[]) => void
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('permiso', 'permisos')

export function RolePermissionsGrid({
  rows,
  selectedRowIds,
  loading = false,
  onSelectionChange,
  toolbarRight,
}: RolePermissionsGridProps) {
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<RolePermissionRow>[] => {
    return [
      {
        key: 'code',
        header: 'Código',
        width: 260,
        sortable: true,
        renderCell: (_value: RolePermissionRow['code'], row: RolePermissionRow) => (
          <strong>{row.code}</strong>
        ),
      },
      {
        key: 'displayName',
        header: 'Nombre',
        width: 200,
        sortable: true,
        renderCell: (_value: RolePermissionRow['displayName'], row: RolePermissionRow) =>
          row.displayName ?? '—',
      },
      {
        key: 'module',
        header: 'Módulo',
        width: 140,
        sortable: true,
        renderCell: (_value: RolePermissionRow['module'], row: RolePermissionRow) =>
          row.module ? moduleLabel(row.module) : '—',
      },
      {
        key: 'description',
        header: 'Descripción',
        width: 320,
        sortable: true,
        renderCell: (_value: RolePermissionRow['description'], row: RolePermissionRow) =>
          row.description ?? '—',
      },
    ]
  }, [])

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={rows}
      keyExpr="id"
      columns={columns}
      selectionMode="multiple"
      selectedRowIds={selectedRowIds}
      onSelectionChange={onSelectionChange}
      showSearch
      searchPosition="left"
      searchWidth={280}
      searchPlaceholder="Buscar código o nombre…"
      searchKeys={['code', 'displayName', 'description', 'module']}
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

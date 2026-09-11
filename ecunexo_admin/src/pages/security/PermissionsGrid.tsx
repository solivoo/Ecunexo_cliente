import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, type ColumnDef } from 'glubox'
import { Eye } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { moduleLabel } from '@/lib/moduleLabels'
import { StatusBadge } from '@/components/ui'
import { permissionStatusLabel } from '@/lib/enumLabels'
import type { PermissionListItemDto } from '@/types/identityApi'

export type PermissionGridRow = PermissionListItemDto & Record<string, unknown>

export type PermissionsGridProps = {
  readonly rows: PermissionListItemDto[]
  readonly loading?: boolean
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('permiso', 'permisos')

export function PermissionsGrid({ rows, loading = false, toolbarRight }: PermissionsGridProps) {
  const navigate = useNavigate()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<PermissionGridRow>[] => {
    return [
      {
        key: 'code',
        header: 'Código',
        width: 280,
        sortable: true,
        renderCell: (_value: PermissionGridRow['code'], row: PermissionGridRow) => (
          <strong>
            <code className="ecu-code">{row.code}</code>
          </strong>
        ),
      },
      {
        key: 'displayName',
        header: 'Nombre',
        width: 220,
        sortable: true,
        renderCell: (_value: PermissionGridRow['displayName'], row: PermissionGridRow) =>
          row.displayName ?? '—',
      },
      {
        key: 'module',
        header: 'Módulo',
        width: 140,
        sortable: true,
        renderCell: (_value: PermissionGridRow['module'], row: PermissionGridRow) =>
          row.module ? moduleLabel(row.module) : '—',
      },
      {
        key: 'status',
        header: 'Estado',
        width: 130,
        sortable: true,
        renderCell: (_value: PermissionGridRow['status'], row: PermissionGridRow) => (
          <StatusBadge
            tone={row.status === 0 ? 'success' : 'neutral'}
            withDot={row.status === 0}
          >
            {permissionStatusLabel(row.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 72,
        align: 'center',
        sortable: false,
        renderCell: (_value: PermissionGridRow['id'], row: PermissionGridRow) => (
          <div className="ecu-companies-grid__actions">
            <GridIconButton
              label="Abrir"
              icon={Eye}
              onClick={() => navigate(`/seguridad/permisos/${row.id}`)}
            />
          </div>
        ),
      },
    ]
  }, [navigate])

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={rows as PermissionGridRow[]}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
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

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, type ColumnDef } from 'glubox'
import { Eye, Unlink } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { moduleLabel } from '@/lib/moduleLabels'

export type EffectivePermissionRow = {
  id: string
  code: string
  displayName: string | null
  description: string | null
  module: string | null
  permissionId: string | null
} & Record<string, unknown>

export type EffectivePermissionsGridProps = {
  readonly rows: EffectivePermissionRow[]
  readonly loading?: boolean
  readonly canRevoke?: boolean
  readonly revokeBusyId?: string | null
  readonly onRevoke?: (row: EffectivePermissionRow) => void
}

const gridMessages = createSpanishDataGridMessages('permiso', 'permisos')

export function EffectivePermissionsGrid({
  rows,
  loading = false,
  canRevoke = false,
  revokeBusyId = null,
  onRevoke,
}: EffectivePermissionsGridProps) {
  const navigate = useNavigate()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<EffectivePermissionRow>[] => {
    return [
      {
        key: 'code',
        header: 'Código',
        width: 260,
        sortable: true,
        renderCell: (_value: EffectivePermissionRow['code'], row: EffectivePermissionRow) => (
          <strong>{row.code}</strong>
        ),
      },
      {
        key: 'displayName',
        header: 'Nombre',
        width: 200,
        sortable: true,
        renderCell: (_value: EffectivePermissionRow['displayName'], row: EffectivePermissionRow) =>
          row.displayName ?? '—',
      },
      {
        key: 'description',
        header: 'Descripción',
        width: 300,
        sortable: true,
        renderCell: (_value: EffectivePermissionRow['description'], row: EffectivePermissionRow) =>
          row.description ?? '—',
      },
      {
        key: 'module',
        header: 'Módulo',
        width: 140,
        sortable: true,
        renderCell: (_value: EffectivePermissionRow['module'], row: EffectivePermissionRow) =>
          row.module ? moduleLabel(row.module) : '—',
      },
      {
        key: 'id',
        header: 'Acciones',
        width: canRevoke ? 108 : 72,
        align: 'center',
        sortable: false,
        renderCell: (_value: EffectivePermissionRow['id'], row: EffectivePermissionRow) =>
          row.permissionId ? (
            <div className="ecu-companies-grid__actions">
              <GridIconButton
                label="Abrir"
                icon={Eye}
                onClick={() => navigate(`/seguridad/permisos/${row.permissionId}`)}
              />
              {canRevoke && onRevoke ? (
                <GridIconButton
                  label="Quitar"
                  icon={Unlink}
                  danger
                  loading={revokeBusyId === row.id}
                  disabled={revokeBusyId !== null}
                  onClick={() => onRevoke(row)}
                />
              ) : null}
            </div>
          ) : (
            <span className="app-shell__muted">—</span>
          ),
      },
    ]
  }, [canRevoke, navigate, onRevoke, revokeBusyId])

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={rows}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
      showSearch
      searchPosition="left"
      searchWidth={280}
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

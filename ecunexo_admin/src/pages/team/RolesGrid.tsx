import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, type ColumnDef } from 'glubox'
import { Eye, KeyRound } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { formatDateTime } from '@/lib/formatDate'
import type { RoleListItemDto } from '@/types/identityApi'

export type RoleGridRow = RoleListItemDto & Record<string, unknown>

export type RolesGridProps = {
  readonly rows: RoleListItemDto[]
  readonly loading?: boolean
}

const gridMessages = createSpanishDataGridMessages('rol', 'roles')

export function RolesGrid({ rows, loading = false }: RolesGridProps) {
  const navigate = useNavigate()
  const canManage = useHasPermission('identity.roles.manage')
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<RoleGridRow>[] => {
    return [
      {
        key: 'name',
        header: 'Nombre',
        width: 220,
        sortable: true,
        renderCell: (_value: RoleGridRow['name'], row: RoleGridRow) => (
          <strong>{row.name}</strong>
        ),
      },
      {
        key: 'description',
        header: 'Descripción',
        width: 360,
        sortable: true,
        renderCell: (_value: RoleGridRow['description'], row: RoleGridRow) =>
          row.description ?? '—',
      },
      {
        key: 'isSystem',
        header: 'Sistema',
        width: 110,
        sortable: true,
        renderCell: (_value: RoleGridRow['isSystem'], row: RoleGridRow) =>
          row.isSystem ? 'Sí' : 'No',
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 170,
        sortable: true,
        renderCell: (_value: RoleGridRow['createdAt'], row: RoleGridRow) =>
          formatDateTime(row.createdAt),
      },
      {
        key: 'id',
        header: 'Acciones',
        width: canManage ? 104 : 72,
        align: 'center',
        sortable: false,
        renderCell: (_value: RoleGridRow['id'], row: RoleGridRow) => (
          <div className="ecu-companies-grid__actions">
            <GridIconButton
              label="Abrir"
              icon={Eye}
              onClick={() => navigate(`/equipo/roles/${row.id}`)}
            />
            {canManage ? (
              <GridIconButton
                label="Gestionar permisos"
                icon={KeyRound}
                onClick={() => navigate(`/equipo/roles/${row.id}/permisos`)}
              />
            ) : null}
          </div>
        ),
      },
    ]
  }, [canManage, navigate])

  const dataSource = useMemo(
    () => (Array.isArray(rows) ? rows : []) as RoleGridRow[],
    [rows]
  )

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={dataSource}
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

import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, type ColumnDef } from 'glubox'
import { Eye, Pencil, Trash2, UserCheck, UserX } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { formatDate } from '@/lib/formatDate'
import type { UserListItemDto } from '@/types/identityApi'

export type UserGridRow = UserListItemDto & Record<string, unknown>

export type UsersGridProps = {
  readonly rows: UserListItemDto[]
  readonly loading?: boolean
  readonly canUpdate: boolean
  readonly canDelete: boolean
  readonly actionBusyId: string | null
  readonly currentUserId: string | null
  readonly onDisable: (user: UserListItemDto) => void
  readonly onEnable: (user: UserListItemDto) => void
  readonly onDelete: (user: UserListItemDto) => void
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('usuario', 'usuarios')

export function UsersGrid({
  rows,
  loading = false,
  canUpdate,
  canDelete,
  actionBusyId,
  currentUserId,
  onDisable,
  onEnable,
  onDelete,
  toolbarRight,
}: UsersGridProps) {
  const navigate = useNavigate()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<UserGridRow>[] => {
    return [
      {
        key: 'email',
        header: 'Correo',
        width: 240,
        sortable: true,
        renderCell: (_value: UserGridRow['email'], row: UserGridRow) => (
          <strong>{row.email}</strong>
        ),
      },
      {
        key: 'name',
        header: 'Nombre',
        width: 180,
        sortable: true,
      },
      {
        key: 'isDisabled',
        header: 'Estado',
        width: 130,
        sortable: true,
        renderCell: (_value: UserGridRow['isDisabled'], row: UserGridRow) => (
          <span
            className={`ecu-status ${row.isDisabled ? 'ecu-status--inactive' : 'ecu-status--active'}`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {row.isDisabled ? 'Deshabilitado' : 'Activo'}
          </span>
        ),
      },
      {
        key: 'department',
        header: 'Departamento',
        width: 150,
        sortable: true,
        renderCell: (_value: UserGridRow['department'], row: UserGridRow) =>
          row.department ?? '—',
      },
      {
        key: 'lastLoginAt',
        header: 'Último acceso',
        width: 120,
        sortable: true,
        renderCell: (_value: UserGridRow['lastLoginAt'], row: UserGridRow) =>
          formatDate(row.lastLoginAt),
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 110,
        sortable: true,
        renderCell: (_value: UserGridRow['createdAt'], row: UserGridRow) =>
          formatDate(row.createdAt),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 168,
        align: 'center',
        sortable: false,
        renderCell: (_value: UserGridRow['id'], row: UserGridRow) => {
          const busy = actionBusyId === row.id
          const isSelf = currentUserId === row.id
          return (
            <div className="ecu-companies-grid__actions">
              <GridIconButton
                label="Abrir"
                icon={Eye}
                disabled={busy}
                onClick={() => navigate(`/equipo/usuarios/${row.id}`)}
              />
              {canUpdate ? (
                <GridIconButton
                  label="Editar"
                  icon={Pencil}
                  disabled={busy}
                  onClick={() => navigate(`/equipo/usuarios/${row.id}/editar`)}
                />
              ) : null}
              {canUpdate ? (
                <GridIconButton
                  label={row.isDisabled ? 'Habilitar' : 'Deshabilitar'}
                  icon={row.isDisabled ? UserCheck : UserX}
                  loading={busy}
                  disabled={busy || isSelf}
                  onClick={() => (row.isDisabled ? onEnable(row) : onDisable(row))}
                />
              ) : null}
              {canDelete ? (
                <GridIconButton
                  label="Eliminar"
                  icon={Trash2}
                  danger
                  loading={busy}
                  disabled={busy || isSelf}
                  onClick={() => onDelete(row)}
                />
              ) : null}
            </div>
          )
        },
      },
    ]
  }, [
    actionBusyId,
    canDelete,
    canUpdate,
    currentUserId,
    navigate,
    onDelete,
    onDisable,
    onEnable,
  ])

  const dataSource = useMemo(
    () => (Array.isArray(rows) ? rows : []) as UserGridRow[],
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

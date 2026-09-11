import { useMemo } from 'react'
import { DataGrid, type ColumnDef } from 'glubox'
import { LogIn, Pencil, Trash2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { StatusBadge } from '@/components/ui'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { formatDateTime } from '@/lib/formatDate'
import { tenantStatusLabel } from '@/lib/enumLabels'
import type { SubscriptionCompanyListItemDto } from '@/types/companiesApi'

export type CompanyGridRow = SubscriptionCompanyListItemDto & Record<string, unknown>

export type CompaniesGridProps = {
  readonly rows: SubscriptionCompanyListItemDto[]
  readonly loading?: boolean
  readonly activeTenantId: string | null
  readonly canEnter: boolean
  readonly canEdit: boolean
  readonly canDelete: boolean
  readonly enterBusyId: string | null
  readonly actionBusyId: string | null
  readonly onEnter: (companyId: string) => void
  readonly onEdit: (companyId: string) => void
  readonly onDelete: (company: SubscriptionCompanyListItemDto) => void
}

const gridMessages = createSpanishDataGridMessages('empresa', 'empresas')

export function CompaniesGrid({
  rows,
  loading = false,
  activeTenantId,
  canEnter,
  canEdit,
  canDelete,
  enterBusyId,
  actionBusyId,
  onEnter,
  onEdit,
  onDelete,
}: CompaniesGridProps) {
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<CompanyGridRow>[] => {
    return [
      {
        key: 'name',
        header: 'Empresa',
        width: 280,
        sortable: true,
        renderCell: (_value: CompanyGridRow['name'], row: CompanyGridRow) => (
          <strong>{row.name}</strong>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 130,
        sortable: true,
        renderCell: (_value: CompanyGridRow['status'], row: CompanyGridRow) => {
          const tone =
            row.status === 1
              ? 'success'
              : row.status === 2
                ? 'danger'
                : row.status === 0
                  ? 'warning'
                  : 'neutral'
          return (
            <StatusBadge tone={tone} withDot>
              {tenantStatusLabel(row.status)}
            </StatusBadge>
          )
        },
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 170,
        sortable: true,
        renderCell: (_value: CompanyGridRow['createdAt'], row: CompanyGridRow) =>
          formatDateTime(row.createdAt),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 132,
        align: 'center',
        sortable: false,
        renderCell: (_value: CompanyGridRow['id'], row: CompanyGridRow) => {
          const busyEnter = enterBusyId === row.id
          const busyAction = actionBusyId === row.id

          return (
            <div className="ecu-companies-grid__actions">
              {activeTenantId === row.id ? (
                <span className="app-shell__muted">Actual</span>
              ) : canEnter ? (
                <GridIconButton
                  label="Entrar"
                  icon={LogIn}
                  loading={busyEnter}
                  disabled={busyEnter || busyAction}
                  onClick={() => onEnter(row.id)}
                />
              ) : null}

              {canEdit ? (
                <GridIconButton
                  label="Editar"
                  icon={Pencil}
                  disabled={busyEnter || busyAction}
                  onClick={() => onEdit(row.id)}
                />
              ) : null}

              {canDelete ? (
                <GridIconButton
                  label="Eliminar"
                  icon={Trash2}
                  danger
                  loading={busyAction}
                  disabled={busyEnter || busyAction}
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
    activeTenantId,
    canDelete,
    canEdit,
    canEnter,
    enterBusyId,
    onDelete,
    onEdit,
    onEnter,
  ])

  const dataSource = useMemo(
    () => (Array.isArray(rows) ? rows : []) as CompanyGridRow[],
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

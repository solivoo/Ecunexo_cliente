import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, type ColumnDef } from 'glubox'
import { Pencil, Trash2 } from 'lucide-react'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { formatDate } from '@/lib/formatDate'
import type { DepartmentListItemDto } from '@/types/identityApi'

export type DepartmentGridRow = DepartmentListItemDto & Record<string, unknown>

export type DepartmentsGridProps = {
  readonly rows: DepartmentListItemDto[]
  readonly loading?: boolean
  readonly canManage?: boolean
  readonly actionBusyId?: string | null
  readonly onDelete?: (row: DepartmentGridRow) => void
  readonly toolbarRight?: ReactNode
}

const gridMessages = createSpanishDataGridMessages('departamento', 'departamentos')

export function DepartmentsGrid({
  rows,
  loading = false,
  canManage = false,
  actionBusyId = null,
  onDelete,
  toolbarRight,
}: DepartmentsGridProps) {
  const navigate = useNavigate()
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const columns = useMemo((): ColumnDef<DepartmentGridRow>[] => {
    return [
      {
        key: 'name',
        header: 'Nombre',
        width: 240,
        sortable: true,
        renderCell: (_value: DepartmentGridRow['name'], row: DepartmentGridRow) => (
          <strong>{row.name}</strong>
        ),
      },
      {
        key: 'description',
        header: 'Descripción',
        width: 400,
        sortable: true,
        renderCell: (_value: DepartmentGridRow['description'], row: DepartmentGridRow) =>
          row.description ? (
            <span className="ecu-clip ecu-clip--wide" title={row.description}>
              {row.description}
            </span>
          ) : (
            '—'
          ),
      },
      {
        key: 'createdAt',
        header: 'Alta',
        width: 110,
        sortable: true,
        renderCell: (_value: DepartmentGridRow['createdAt'], row: DepartmentGridRow) =>
          formatDate(row.createdAt),
      },
      ...(canManage
        ? [
            {
              key: 'id',
              header: 'Acciones',
              sticky: 'right',
              width: 104,
              align: 'center' as const,
              sortable: false,
              renderCell: (_value: DepartmentGridRow['id'], row: DepartmentGridRow) => {
                const busy = actionBusyId === row.id
                const isSystem =
                  row.name.trim().toLowerCase() === 'administración' ||
                  row.name.trim().toLowerCase() === 'administracion'
                return (
                  <div className="ecu-companies-grid__actions">
                    <GridIconButton
                      label="Editar"
                      icon={Pencil}
                      disabled={busy}
                      onClick={() => navigate(`/equipo/departamentos/${row.id}/editar`)}
                    />
                    <GridIconButton
                      label={isSystem ? 'Departamento protegido' : 'Eliminar'}
                      icon={Trash2}
                      danger
                      loading={busy}
                      disabled={busy || isSystem}
                      title={
                        isSystem
                          ? 'El departamento de administración no se puede eliminar'
                          : 'Eliminar departamento'
                      }
                      onClick={() => onDelete?.(row)}
                    />
                  </div>
                )
              },
            } satisfies ColumnDef<DepartmentGridRow>,
          ]
        : []),
    ]
  }, [actionBusyId, canManage, navigate, onDelete])

  const dataSource = useMemo(
    () => (Array.isArray(rows) ? rows : []) as DepartmentGridRow[],
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
      loading={loading}
      emptyState="Sin departamentos. Crea el primero para organizar a tu equipo."
      messages={gridMessages}
    />
  )
}

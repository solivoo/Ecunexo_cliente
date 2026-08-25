import { useMemo } from 'react'
import { DataGrid, type ColumnDef } from 'glubox'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { formatDateTime } from '@/lib/formatDate'
import { policyEffectLabel } from '@/lib/enumLabels'
import type { PolicyListItemDto } from '@/types/identityApi'

export type PolicyGridRow = PolicyListItemDto & {
  effectLabel: string
} & Record<string, unknown>

export type PoliciesGridProps = {
  readonly rows: PolicyListItemDto[]
  readonly loading?: boolean
}

const gridMessages = createSpanishDataGridMessages('política', 'políticas')

export function PoliciesGrid({ rows, loading = false }: PoliciesGridProps) {
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const data = useMemo(
    (): PolicyGridRow[] =>
      rows.map((p) => ({
        ...p,
        effectLabel: policyEffectLabel(p.effect),
      })),
    [rows]
  )

  const columns = useMemo((): ColumnDef<PolicyGridRow>[] => {
    return [
      {
        key: 'effectLabel',
        header: 'Efecto',
        width: 120,
        sortable: true,
        renderCell: (_value: PolicyGridRow['effectLabel'], row: PolicyGridRow) => (
          <strong>{row.effectLabel}</strong>
        ),
      },
      {
        key: 'condition',
        header: 'Condición',
        width: 420,
        sortable: true,
        renderCell: (_value: PolicyGridRow['condition'], row: PolicyGridRow) =>
          row.condition ? <code className="ecu-code">{row.condition}</code> : '— (siempre)',
      },
      {
        key: 'createdAt',
        header: 'Creada',
        width: 180,
        sortable: true,
        renderCell: (_value: PolicyGridRow['createdAt'], row: PolicyGridRow) =>
          formatDateTime(row.createdAt),
      },
    ]
  }, [])

  return (
    <DataGrid
      className="ecu-companies-grid"
      dataSource={data}
      keyExpr="id"
      columns={columns}
      selectionMode="none"
      showSearch={false}
      paging={paging}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      paginationMode="client"
      pageSizeOptions={pageSizeOptions}
      layout="auto"
      cardBreakpoint={720}
      showRowCount
      fullWidth
      loading={loading}
      messages={gridMessages}
      stickyFirstColumn
    />
  )
}

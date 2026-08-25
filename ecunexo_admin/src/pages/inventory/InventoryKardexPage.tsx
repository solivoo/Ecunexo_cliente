import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { isoInstantInRange } from '@/lib/gridLookback'
import { inventoryMovementDirectionLabel } from '@/lib/inventoryLabels'
import { readApiError } from '@/lib/readApiError'
import { listInventoryMovements } from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  InventoryMovementDirection,
  type InventoryMovementListItemDto,
} from '@/types/inventoryApi'

type Row = InventoryMovementListItemDto & Record<string, unknown>
const messages = createSpanishDataGridMessages('movimiento', 'movimientos')

export function InventoryKardexPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canRead =
    useHasPermission('inventory.movement.read') || useHasPermission('inventory.stock.read')
  const [rows, setRows] = useState<InventoryMovementListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const { from, to, setRange, lookback } = useGridDateRange()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listInventoryMovements(tenantId))
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Kárdex sincronizado.', variant: 'success' })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar el kárdex.')
        setError(message)
        setRows([])
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    if (canRead) void load({ silent: true })
  }, [canRead, load])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'occurredAt',
        header: 'Fecha',
        width: 170,
        sortable: true,
        renderCell: (_v: Row['occurredAt'], row: Row) => formatDateTime(row.occurredAt),
      },
      {
        key: 'direction',
        header: 'Movimiento',
        width: 120,
        sortable: true,
        renderCell: (_v: Row['direction'], row: Row) => inventoryMovementDirectionLabel(row.direction),
      },
      {
        key: 'catalogItemName',
        header: 'Ítem',
        width: 220,
        sortable: true,
        renderCell: (_v: Row['catalogItemName'], row: Row) => <strong>{row.catalogItemName}</strong>,
      },
      {
        key: 'warehouseName',
        header: 'Bodega',
        width: 180,
        sortable: true,
        renderCell: (_v: Row['warehouseName'], row: Row) => row.warehouseName,
      },
      {
        key: 'quantity',
        header: 'Cantidad',
        width: 110,
        sortable: true,
        renderCell: (_v: Row['quantity'], row: Row) => row.quantity.toFixed(2),
      },
    ],
    []
  )

  const visibleRows = useMemo(
    () => rows.filter((r) => isoInstantInRange(r.occurredAt, { from, to })),
    [from, rows, to]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="Kárdex" lead="Historial append-only de movimientos.">
        <p className="app-shell__page-lead">Requieres inventory.movement.read.</p>
      </TenantSessionGate>
    )
  }

  const inbound = visibleRows.filter((r) => r.direction === InventoryMovementDirection.In).length
  const outbound = visibleRows.filter((r) => r.direction === InventoryMovementDirection.Out).length

  return (
    <TenantSessionGate title="Kárdex" lead="Solo INSERT: aquí no se edita el pasado.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">Últimos 500 movimientos del tenant.</p>
          <EcuPageActions
            items={
              [
                {
                  id: 'stock',
                  label: 'Stock',
                  icon: 'package',
                  route: '/inventario/stock',
                  disabled: false,
                },
                {
                  id: 'refresh',
                  label: 'Actualizar',
                  icon: 'refresh-cw',
                  route: null,
                  disabled: loading,
                },
              ] satisfies PageActionItem[]
            }
            variant="outline"
            triggerLabel="Acciones de kárdex"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={(item: PageActionItem) => {
              if (item.id === 'refresh') void load()
            }}
          />
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de kárdex">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Movimientos</p>
            <p className="ecu-companies-page__metric-value">{visibleRows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Entradas</p>
            <p className="ecu-companies-page__metric-value">{inbound}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Salidas</p>
            <p className="ecu-companies-page__metric-value">{outbound}</p>
          </article>
        </div>

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="ecu-companies-page__body">
          <DataGrid
            className="ecu-companies-grid"
            dataSource={visibleRows as Row[]}
            keyExpr="id"
            columns={columns}
            selectionMode="none"
            showSearch
            searchPosition="left"
            searchWidth={280}
            searchPlaceholder="Buscar ítem o bodega…"
            searchKeys={['catalogItemName', 'warehouseName']}
            toolbarRight={
              <GridDateRangeBox
                from={from}
                to={to}
                lookback={lookback}
                disabled={loading}
                onChange={setRange}
              />
            }
            paging={paging}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            paginationMode="client"
            pageSizeOptions={pageSizeOptions}
            layout="auto"
            loading={loading}
            messages={messages}
          />
        </div>
      </div>
    </TenantSessionGate>
  )
}

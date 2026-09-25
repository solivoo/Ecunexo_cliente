import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, useToast, type ColumnDef } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
  GridToolbarRefresh,
} from '@/components/ui'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
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
        width: 120,
        sortable: true,
        renderCell: (_v: Row['occurredAt'], row: Row) => formatDate(row.occurredAt),
      },
      {
        key: 'direction',
        header: 'Flujo',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['direction'], row: Row) => (
          <span
            className={`ecu-status ${
              row.direction === InventoryMovementDirection.In
                ? 'ecu-status--active'
                : 'ecu-status--danger'
            }`}
          >
            <span className="ecu-status__dot" aria-hidden />
            {inventoryMovementDirectionLabel(row.direction)}
          </span>
        ),
      },
      {
        key: 'catalogItemName',
        header: 'Ítem físico',
        width: 240,
        sortable: true,
        renderCell: (_v: Row['catalogItemName'], row: Row) => <strong>{row.catalogItemName}</strong>,
      },
      {
        key: 'warehouseName',
        header: 'Bodega',
        width: 180,
        sortable: true,
        renderCell: (_v: Row['warehouseName'], row: Row) => (
          <span className="ecu-chip">{row.warehouseName}</span>
        ),
      },
      {
        key: 'quantity',
        header: 'Cantidad',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['quantity'], row: Row) => (
          <span
            style={{
              fontWeight: 600,
              color:
                row.direction === InventoryMovementDirection.In
                  ? 'var(--color-success, #10b981)'
                  : 'var(--color-danger, #ef4444)',
            }}
          >
            {row.direction === InventoryMovementDirection.In ? '+' : '-'}
            {row.quantity.toFixed(2)}
          </span>
        ),
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
      <TenantSessionGate title="Kárdex" lead="Historial de movimientos.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres inventory.movement.read para consultar la trazabilidad de kárdex."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  const inbound = visibleRows.filter((r) => r.direction === InventoryMovementDirection.In).length
  const outbound = visibleRows.filter((r) => r.direction === InventoryMovementDirection.Out).length

  return (
    <TenantSessionGate
      title="Kárdex"
      lead="Auditoría inmutable de movimientos logísticos de stock."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Kárdex de Movimientos"
          subtitle="Registro cronológico de entradas, salidas y ajustes de existencias."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de kárdex">
          <StatCard label="Movimientos" value={visibleRows.length} />
          <StatCard label="Entradas" value={inbound} />
          <StatCard label="Salidas" value={outbound} />
        </div>

        <SectionCard title="Trazabilidad">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {visibleRows.length === 0 && !loading ? (
            <EmptyState
              icon="receipt_long"
              title="Sin movimientos registrados en este período"
              description="Ajusta el rango de fechas en la barra superior o registra nuevos movimientos para visualizar transacciones en el kárdex."
            />
          ) : (
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
                <div className="ecu-grid-toolbar-actions">
                  <GridDateRangeBox
                    from={from}
                    to={to}
                    lookback={lookback}
                    disabled={loading}
                    onChange={setRange}
                  />
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  <EcuPageActions
                    items={[
                      {
                        id: 'stock',
                        label: 'Stock',
                        icon: 'package',
                        route: '/inventario/stock',
                        disabled: false,
                      },
                      {
                        id: 'docs',
                        label: 'Documentos',
                        icon: 'file-text',
                        route: '/inventario/documentos',
                        disabled: false,
                      },
                    ]}
                    variant="outline"
                    triggerLabel="Acciones de kárdex"
                    renderIcon={renderSidebarIcon}
                    onNavigate={(route: string) => navigate(route)}
                  />
                </div>
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
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

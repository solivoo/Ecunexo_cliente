import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
} from '@/components/ui'
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
        header: 'Fecha y hora',
        width: 170,
        sortable: true,
        renderCell: (_v: Row['occurredAt'], row: Row) => formatDateTime(row.occurredAt),
      },
      {
        key: 'direction',
        header: 'Tipo de flujo',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['direction'], row: Row) => (
          <StatusBadge
            tone={row.direction === InventoryMovementDirection.In ? 'success' : 'danger'}
            withDot
          >
            {inventoryMovementDirectionLabel(row.direction)}
          </StatusBadge>
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
        header: 'Bodega afectada',
        width: 180,
        sortable: true,
        renderCell: (_v: Row['warehouseName'], row: Row) => row.warehouseName,
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
        <div className="ecu-dashboard-layout">
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
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Kárdex de Movimientos"
          subtitle="Registro inmutable de todas las transacciones físicas de inventario (entradas, salidas y ajustes). Los saldos históricos garantizan trazabilidad total."
          badge={
            <StatusBadge tone="primary" withDot>
              {visibleRows.length} {visibleRows.length === 1 ? 'Movimiento' : 'Movimientos'}
            </StatusBadge>
          }
          actions={
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
                {
                  id: 'refresh',
                  label: 'Actualizar',
                  icon: 'refresh-cw',
                  route: null,
                  disabled: loading,
                },
              ]}
              variant="outline"
              triggerLabel="Acciones de kárdex"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
              onActionSelect={(item: PageActionItem) => {
                if (item.id === 'refresh') void load()
              }}
            />
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de kárdex">
          <StatCard
            label="Total Movimientos"
            value={visibleRows.length}
            icon="receipt_long"
            toneColor="#4f46e5"
            footerText="En el período seleccionado"
          />
          <StatCard
            label="Entradas (Ingresos)"
            value={inbound}
            icon="arrow_downward"
            toneColor="#10b981"
            footerText="Recepciones y ajustes (+)"
          />
          <StatCard
            label="Salidas (Egresos)"
            value={outbound}
            icon="arrow_upward"
            toneColor="#ef4444"
            footerText="Despachos y salidas (-)"
          />
        </div>

        <SectionCard
          title="Trazabilidad Cronológica"
          subtitle="Auditoría secuencial de movimientos con filtro configurable por rango de fechas"
        >
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
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

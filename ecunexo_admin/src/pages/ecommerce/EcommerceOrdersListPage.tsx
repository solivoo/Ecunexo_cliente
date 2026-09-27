import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataGrid, Select, useToast, type ColumnDef } from 'glubox'
import {
  EmptyState,
  GridDateRangeBox,
  GridIconButton,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { Eye, Package, ShoppingBag, Truck, XCircle } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { toApiDateRange } from '@/lib/gridLookback'
import { readApiError } from '@/lib/readApiError'
import { getEcommerceMetrics, listEcommerceOrders } from '@/services/ecommerceApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  ecommerceOrderStatusBadgeTone,
  ecommerceOrderStatusLabel,
  ecommercePaymentMethodLabel,
  ecommercePaymentStatusLabel,
  EcommerceOrderStatus,
  type EcommerceOrderMetricsDto,
  type EcommerceOrderSummaryDto,
} from '@/types/ecommerceApi'
import { ShipEcommerceOrderModal } from './ShipEcommerceOrderModal'
import { CancelEcommerceOrderModal } from './CancelEcommerceOrderModal'
import './ecommerce-orders.css'

type Row = EcommerceOrderSummaryDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('pedido', 'pedidos')

export function EcommerceOrdersListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canManage = useHasPermission('ecommerce.orders.manage')

  const [rows, setRows] = useState<EcommerceOrderSummaryDto[]>([])
  const [metrics, setMetrics] = useState<EcommerceOrderMetricsDto | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modals state
  const [selectedOrderForShip, setSelectedOrderForShip] = useState<EcommerceOrderSummaryDto | null>(null)
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<EcommerceOrderSummaryDto | null>(null)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()
  const { from, to, setRange, lookback } = useGridDateRange()

  const loadData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        let statusParam: EcommerceOrderStatus | undefined
        if (statusFilter === 'placed') statusParam = EcommerceOrderStatus.Placed
        else if (statusFilter === 'processing') statusParam = EcommerceOrderStatus.Processing
        else if (statusFilter === 'shipped') statusParam = EcommerceOrderStatus.Shipped
        else if (statusFilter === 'delivered') statusParam = EcommerceOrderStatus.Delivered
        else if (statusFilter === 'cancelled') statusParam = EcommerceOrderStatus.Cancelled

        const [ordersRes, metricsRes] = await Promise.all([
          listEcommerceOrders(tenantId, {
            status: statusParam,
            ...toApiDateRange({ from, to }),
            page: 1,
            pageSize: 100,
          }),
          getEcommerceMetrics(tenantId),
        ])

        setRows(ordersRes.items)
        setMetrics(metricsRes)
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Pedidos sincronizados con éxito.', variant: 'success' })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar los pedidos ecommerce.')
        setError(message)
        setRows([])
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, statusFilter, from, to, toast]
  )

  useEffect(() => {
    void loadData({ silent: true })
  }, [loadData])

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    return [
      {
        key: 'orderNumber',
        header: 'Orden',
        width: 150,
        renderCell: (_val, row: Row) => (
          <button
            type="button"
            className="ecu-btn-link"
            style={{ fontWeight: 600, textAlign: 'left', cursor: 'pointer', color: 'var(--shell-primary)' }}
            onClick={() => navigate(`/ecommerce/pedidos/${row.id}`)}
          >
            {row.orderNumber}
          </button>
        ),
      },
      {
        key: 'orderDate',
        header: 'Fecha',
        width: 140,
        renderCell: (_val, row: Row) => formatDate(row.orderDate),
      },
      {
        key: 'customerName',
        header: 'Cliente',
        width: 200,
        renderCell: (_val, row: Row) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 500 }}>{row.customerName}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>{row.customerTaxId}</span>
          </div>
        ),
      },
      {
        key: 'recipientCity',
        header: 'Ciudad Destino',
        width: 140,
        renderCell: (_val, row: Row) => row.recipientCity,
      },
      {
        key: 'itemsCount',
        header: 'Ítems',
        width: 90,
        align: 'center',
        renderCell: (_val, row: Row) => (
          <span style={{ fontWeight: 600 }}>{row.itemsCount}</span>
        ),
      },
      {
        key: 'totalAmount',
        header: 'Total',
        width: 110,
        align: 'right',
        renderCell: (_val, row: Row) => (
          <span style={{ fontWeight: 600 }}>
            ${row.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ),
      },
      {
        key: 'paymentStatus',
        header: 'Pago',
        width: 150,
        renderCell: (_val, row: Row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <StatusBadge
              tone={row.paymentStatus === 2 ? 'success' : row.paymentStatus === 1 ? 'info' : 'warning'}
            >
              {ecommercePaymentStatusLabel(row.paymentStatus)}
            </StatusBadge>
            <span style={{ fontSize: '0.7rem', color: 'var(--glb-muted)' }}>
              {ecommercePaymentMethodLabel(row.paymentMethod)}
            </span>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Estado Pedido',
        width: 170,
        renderCell: (_val, row: Row) => (
          <StatusBadge tone={ecommerceOrderStatusBadgeTone(row.status)}>
            {ecommerceOrderStatusLabel(row.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'billingInvoiceId',
        header: 'Facturación SRI',
        width: 130,
        renderCell: (_val, row: Row) =>
          row.billingInvoiceId ? (
            <StatusBadge tone="success">Facturado SRI</StatusBadge>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Sin facturar</span>
          ),
      },
      {
        key: 'id',
        header: 'Acciones',
        width: 120,
        align: 'center',
        renderCell: (_val: unknown, row: Row) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
            <GridIconButton
              label="Ver detalle del pedido"
              icon={Eye}
              onClick={() => navigate(`/ecommerce/pedidos/${row.id}`)}
            />
            {canManage && (row.status === EcommerceOrderStatus.Processing || row.status === EcommerceOrderStatus.Confirmed) && (
              <GridIconButton
                label="Despachar pedido"
                icon={Truck}
                active
                onClick={() => setSelectedOrderForShip(row)}
              />
            )}
            {canManage && row.status === EcommerceOrderStatus.Placed && (
              <GridIconButton
                label="Anular pedido y liberar stock"
                icon={XCircle}
                danger
                onClick={() => setSelectedOrderForCancel(row)}
              />
            )}
          </div>
        ),
      },
    ]
  }, [canManage, navigate])

  return (
    <TenantSessionGate
      title="Pedidos Ecommerce"
      lead="Administración y despacho de pedidos online con reserva de stock e integración SRI."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Pedidos Ecommerce"
          badge={<StatusBadge tone="primary">Ventas Online</StatusBadge>}
          subtitle="Administración y despacho de pedidos online con reserva automática de stock e integración SRI."
        />

        {/* Strip de KPIs */}
        <div className="ecu-stat-grid" aria-label="Resumen de pedidos">
          <StatCard
            label="Total Pedidos"
            value={metrics?.totalOrders ?? 0}
            icon={<ShoppingBag size={20} />}
          />
          <StatCard
            label="Pendientes (Reservados)"
            value={metrics?.pendingCount ?? 0}
            icon={<Package size={20} />}
            toneColor="var(--shell-warning)"
          />
          <StatCard
            label="En Preparación"
            value={metrics?.processingCount ?? 0}
            icon={<Package size={20} />}
            toneColor="var(--shell-primary)"
          />
          <StatCard
            label="En Tránsito"
            value={metrics?.shippedCount ?? 0}
            icon={<Truck size={20} />}
            toneColor="var(--shell-info)"
          />
          <StatCard
            label="Ventas Facturadas"
            value={`$${(metrics?.totalSalesAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<ShoppingBag size={20} />}
            toneColor="var(--shell-success)"
          />
        </div>

        {/* Contenedor principal con DataGrid */}
        <SectionCard
          title="Bandeja de Pedidos"
          action={
            <Select
              id="ecommerce-orders-status-filter"
              aria-label="Filtrar por estado"
              variant="outline"
              options={[
                { value: 'all', label: `Todos (${metrics?.totalOrders ?? 0})` },
                { value: 'placed', label: `Pendientes (${metrics?.pendingCount ?? 0})` },
                {
                  value: 'processing',
                  label: `En preparación (${metrics?.processingCount ?? 0})`,
                },
                { value: 'shipped', label: `Despachados (${metrics?.shippedCount ?? 0})` },
                { value: 'delivered', label: `Entregados (${metrics?.deliveredCount ?? 0})` },
                { value: 'cancelled', label: `Cancelados (${metrics?.cancelledCount ?? 0})` },
              ]}
              value={statusFilter}
              onChange={(value) => setStatusFilter(String(value))}
            />
          }
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {rows.length === 0 && !loading ? (
            <EmptyState
              icon="shopping_bag"
              title={
                statusFilter === 'all'
                  ? 'No hay pedidos registrados'
                  : 'No hay pedidos en este estado'
              }
              description={
                statusFilter === 'all'
                  ? 'Los pedidos realizados desde la tienda en línea aparecerán en esta bandeja con su reserva de inventario.'
                  : 'Cambia el filtro de estado o ajusta el rango de fechas para ver más pedidos.'
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={rows as Row[]}
              columns={columns}
              keyExpr="id"
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={260}
              searchPlaceholder="Buscar orden, cliente o RUC…"
              searchKeys={['orderNumber', 'customerName', 'customerTaxId']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridDateRangeBox
                    from={from}
                    to={to}
                    lookback={lookback}
                    disabled={loading}
                    onChange={setRange}
                  />
                  <GridToolbarRefresh
                    loading={loading}
                    onRefresh={() => void loadData({ silent: true })}
                  />
                </div>
              }
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              layout="auto"
              loading={loading}
              messages={messages}
            />
          )}
        </SectionCard>
      </div>

      {/* Modales de Despacho y Cancelación accesibles desde la tabla */}
      {selectedOrderForShip && (
        <ShipEcommerceOrderModal
          open={Boolean(selectedOrderForShip)}
          onClose={() => setSelectedOrderForShip(null)}
          onShipped={() => void loadData({ silent: true })}
          tenantId={tenantId ?? ''}
          orderId={selectedOrderForShip.id}
          orderNumber={selectedOrderForShip.orderNumber}
        />
      )}

      {selectedOrderForCancel && (
        <CancelEcommerceOrderModal
          open={Boolean(selectedOrderForCancel)}
          onClose={() => setSelectedOrderForCancel(null)}
          onCancelled={() => void loadData({ silent: true })}
          tenantId={tenantId ?? ''}
          orderId={selectedOrderForCancel.id}
          orderNumber={selectedOrderForCancel.orderNumber}
        />
      )}
    </TenantSessionGate>
  )
}

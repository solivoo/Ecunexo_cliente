import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast } from 'glubox'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  Package,
  Truck,
  User,
  XCircle,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import {
  getEcommerceOrderById,
  processEcommerceOrder,
} from '@/services/ecommerceApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  ecommerceOrderStatusBadgeTone,
  ecommerceOrderStatusLabel,
  ecommercePaymentMethodLabel,
  ecommercePaymentStatusLabel,
  ecommerceShippingMethodLabel,
  EcommerceOrderStatus,
  EcommercePaymentStatus,
  type EcommerceOrderDetailDto,
} from '@/types/ecommerceApi'
import { ConfirmEcommercePaymentModal } from './ConfirmEcommercePaymentModal'
import { ShipEcommerceOrderModal } from './ShipEcommerceOrderModal'
import { CancelEcommerceOrderModal } from './CancelEcommerceOrderModal'
import { LinkEcommerceInvoiceModal } from './LinkEcommerceInvoiceModal'
import './ecommerce-orders.css'

export function EcommerceOrderDetailPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { orderId } = useParams<{ orderId: string }>()
  const tenantId = useAppSelector(selectTenantId)

  const canManage = useHasPermission('ecommerce.orders.manage')

  const [order, setOrder] = useState<EcommerceOrderDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // Modals
  const [openPaymentModal, setOpenPaymentModal] = useState(false)
  const [openShipModal, setOpenShipModal] = useState(false)
  const [openCancelModal, setOpenCancelModal] = useState(false)
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false)

  const loadOrder = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId || !orderId) return
      if (!opts?.silent) setLoading(true)
      try {
        const data = await getEcommerceOrderById(tenantId, orderId)
        setOrder(data)
        setError(null)
      } catch (err: unknown) {
        const msg = readApiError(err, 'No se pudo cargar el pedido ecommerce.')
        setError(msg)
        toast.show({ title: 'Error', message: msg, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, orderId, toast]
  )

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  const handleStartProcessing = async () => {
    if (!tenantId || !order) return
    setProcessing(true)
    try {
      await processEcommerceOrder(tenantId, order.id)
      toast.show({
        title: 'Preparación Iniciada',
        message: 'El pedido ahora está en preparación en bodega.',
        variant: 'success',
      })
      void loadOrder({ silent: true })
    } catch (err) {
      const msg = readApiError(err, 'No se pudo cambiar el estado a En Preparación.')
      toast.show({ title: 'Error', message: msg, variant: 'error' })
    } finally {
      setProcessing(false)
    }
  }

  if (loading && !order) {
    return (
      <TenantSessionGate
        title="Detalle de Pedido"
        lead="Gestión y trazabilidad de orden ecommerce"
      >
        <div className="ecommerce-page" style={{ padding: '2rem' }}>
          Cargando detalle del pedido...
        </div>
      </TenantSessionGate>
    )
  }

  if (error || !order) {
    return (
      <TenantSessionGate
        title="Detalle de Pedido"
        lead="Gestión y trazabilidad de orden ecommerce"
      >
        <div className="ecommerce-page">
          <PageHeader
            title="Detalle del Pedido"
            actions={
              <Button
                variant="outline"
                iconLeft={<ArrowLeft size={16} />}
                onClick={() => navigate('/ecommerce/pedidos')}
              >
                Volver al Listado
              </Button>
            }
          />
          <EmptyState
            title="Pedido no encontrado"
            description={error ?? 'La orden solicitada no existe o no tiene permisos para consultarla.'}
          />
        </div>
      </TenantSessionGate>
    )
  }

  const isPendingPayment = order.paymentStatus === EcommercePaymentStatus.Pending
  const isPlaced = order.status === EcommerceOrderStatus.Placed
  const isConfirmed = order.status === EcommerceOrderStatus.Confirmed
  const isProcessing = order.status === EcommerceOrderStatus.Processing
  const isShipped = order.status === EcommerceOrderStatus.Shipped
  const isDelivered = order.status === EcommerceOrderStatus.Delivered
  const isCancelled = order.status === EcommerceOrderStatus.Cancelled

  return (
    <TenantSessionGate
      title="Detalle de Pedido"
      lead="Gestión y trazabilidad de orden ecommerce"
    >
      <div className="ecommerce-page ecommerce-order-detail">
        <PageHeader
          title={`Pedido ${order.orderNumber}`}
          badge={
            <StatusBadge tone={ecommerceOrderStatusBadgeTone(order.status)}>
              {ecommerceOrderStatusLabel(order.status)}
            </StatusBadge>
          }
          subtitle={`Registrado el ${formatDate(order.orderDate)} • Método de entrega: ${ecommerceShippingMethodLabel(order.shippingMethod)}`}
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                variant="outline"
                iconLeft={<ArrowLeft size={16} />}
                onClick={() => navigate('/ecommerce/pedidos')}
              >
                Volver
              </Button>

              {canManage && isPendingPayment && !isCancelled && (
                <Button
                  variant="primary"
                  iconLeft={<CreditCard size={16} />}
                  onClick={() => setOpenPaymentModal(true)}
                >
                  Confirmar Pago
                </Button>
              )}

              {canManage && (isPlaced || isConfirmed) && (
                <Button
                  variant="primary"
                  iconLeft={<Package size={16} />}
                  onClick={handleStartProcessing}
                  disabled={processing}
                >
                  {processing ? 'Actualizando...' : 'Iniciar Preparación (Picking)'}
                </Button>
              )}

              {canManage && (isProcessing || isConfirmed) && (
                <Button
                  variant="primary"
                  iconLeft={<Truck size={16} />}
                  onClick={() => setOpenShipModal(true)}
                >
                  Despachar con Guía
                </Button>
              )}

              {canManage && isShipped && (
                <Button
                  variant="primary"
                  iconLeft={<CheckCircle2 size={16} />}
                  onClick={() => {
                    toast.show({
                      title: 'Pedido Entregado',
                      message: 'Orden completada satisfactoriamente.',
                      variant: 'success',
                    })
                  }}
                >
                  Confirmar Entrega
                </Button>
              )}

              {canManage && !order.billingInvoiceId && !isCancelled && (
                <Button
                  variant="outline"
                  iconLeft={<FileText size={16} />}
                  onClick={() => setOpenInvoiceModal(true)}
                >
                  Vincular Factura SRI
                </Button>
              )}

              {canManage && !isShipped && !isDelivered && !isCancelled && (
                <Button
                  variant="danger"
                  iconLeft={<XCircle size={16} />}
                  onClick={() => setOpenCancelModal(true)}
                >
                  Anular Pedido
                </Button>
              )}
            </div>
          }
        />

        {/* Bloque superior con 3 Cards de Información */}
        <div className="ecommerce-detail-grid">
          {/* Tarjeta 1: Cliente y Facturación */}
          <div className="ecommerce-info-card">
            <h4 className="ecommerce-info-card__title">
              <User size={18} />
              Cliente & Facturación
            </h4>
            <div className="ecommerce-info-list">
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Nombre / Razón:</span>
                <span className="ecommerce-info-value">{order.customer.customerName}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Cédula / RUC:</span>
                <span className="ecommerce-info-value">{order.customer.taxId}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Email:</span>
                <span className="ecommerce-info-value">{order.customer.email}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Teléfono:</span>
                <span className="ecommerce-info-value">{order.customer.phone || 'N/A'}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Dirección Fiscal:</span>
                <span className="ecommerce-info-value">{order.customer.address || 'N/A'}</span>
              </div>
              <div className="ecommerce-info-row" style={{ marginTop: '0.25rem' }}>
                <span className="ecommerce-info-label">Factura SRI:</span>
                <span className="ecommerce-info-value">
                  {order.billingInvoiceId ? (
                    <StatusBadge tone="success">Facturada #{order.billingInvoiceId.substring(0, 8)}</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Pendiente de emisión</StatusBadge>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Envío y Despacho */}
          <div className="ecommerce-info-card">
            <h4 className="ecommerce-info-card__title">
              <Truck size={18} />
              Destino y Despacho
            </h4>
            <div className="ecommerce-info-list">
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Destinatario:</span>
                <span className="ecommerce-info-value">{order.shipping.recipientName}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Teléfono:</span>
                <span className="ecommerce-info-value">{order.shipping.recipientPhone || 'N/A'}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Dirección:</span>
                <span className="ecommerce-info-value">{order.shipping.addressLine1}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Ciudad / Prov:</span>
                <span className="ecommerce-info-value">
                  {order.shipping.city} {order.shipping.province ? `(${order.shipping.province})` : ''}
                </span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Courier:</span>
                <span className="ecommerce-info-value">
                  {order.shipping.carrier ? (
                    <strong>{order.shipping.carrier}</strong>
                  ) : (
                    <span style={{ color: 'var(--glb-muted)' }}>Por asignar</span>
                  )}
                </span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Guía / Tracking:</span>
                <span className="ecommerce-info-value">
                  {order.shipping.trackingNumber ? (
                    <code>{order.shipping.trackingNumber}</code>
                  ) : (
                    <span style={{ color: 'var(--glb-muted)' }}>Sin tracking</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Logística y Reserva de Stock */}
          <div className="ecommerce-info-card">
            <h4 className="ecommerce-info-card__title">
              <Package size={18} />
              Reserva de Stock & Pago
            </h4>
            <div className="ecommerce-info-list">
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Bodega Origen:</span>
                <span className="ecommerce-info-value">{order.warehouseName || 'Bodega Central'}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Estado Reserva:</span>
                <span className="ecommerce-info-value">
                  {isCancelled ? (
                    <StatusBadge tone="danger">Reserva Liberada</StatusBadge>
                  ) : isShipped || isDelivered ? (
                    <StatusBadge tone="success">Stock Egresado de Kárdex</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Stock 100% Reservado</StatusBadge>
                  )}
                </span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Método Pago:</span>
                <span className="ecommerce-info-value">{ecommercePaymentMethodLabel(order.paymentMethod)}</span>
              </div>
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Estado Pago:</span>
                <span className="ecommerce-info-value">
                  <StatusBadge tone={order.paymentStatus === 2 ? 'success' : order.paymentStatus === 1 ? 'info' : 'warning'}>
                    {ecommercePaymentStatusLabel(order.paymentStatus)}
                  </StatusBadge>
                </span>
              </div>
              {order.paymentReference && (
                <div className="ecommerce-info-row">
                  <span className="ecommerce-info-label">Referencia Pago:</span>
                  <span className="ecommerce-info-value"><code>{order.paymentReference}</code></span>
                </div>
              )}
              {order.customerNotes && (
                <div className="ecommerce-info-row">
                  <span className="ecommerce-info-label">Nota Cliente:</span>
                  <span className="ecommerce-info-value" style={{ fontStyle: 'italic' }}>{order.customerNotes}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla de Productos */}
        <SectionCard title="Productos Solicitados">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--shell-border, rgba(0,0,0,0.08))', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>SKU</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Producto</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Cantidad</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Precio Unit.</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Descuento</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>IVA (15%)</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--shell-border, rgba(0,0,0,0.06))' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{item.sku || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.itemName}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      ${item.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      ${item.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                      ${item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabla de Totales */}
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <table className="ecommerce-totals-table">
              <tbody>
                <tr>
                  <td className="totals-label">Subtotal:</td>
                  <td className="totals-value">${order.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                {order.discountAmount > 0 && (
                  <tr>
                    <td className="totals-label">Descuento:</td>
                    <td className="totals-value">-${order.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr>
                  <td className="totals-label">IVA (15%):</td>
                  <td className="totals-value">${order.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className="totals-label">Costo de Envío:</td>
                  <td className="totals-value">${order.shippingCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr className="totals-row--highlight">
                  <td className="totals-label">Total a Cobrar:</td>
                  <td className="totals-value">${order.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Trazabilidad / Timeline de Auditoría */}
        <SectionCard title="Trazabilidad y Auditoría de Estados">
          <div className="ecommerce-timeline">
            {order.timeline.map((event) => (
              <div key={event.id} className="ecommerce-timeline-item">
                <div className="ecommerce-timeline-item__dot" />
                <div className="ecommerce-timeline-item__header">
                  <span className="ecommerce-timeline-item__title">
                    {ecommerceOrderStatusLabel(event.newStatus)}
                  </span>
                  <span className="ecommerce-timeline-item__date">
                    {formatDate(event.occurredAt)} • Por {event.userName || 'Sistema'}
                  </span>
                </div>
                {event.notes && (
                  <p className="ecommerce-timeline-item__notes">{event.notes}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Modales de Gestión */}
        <ConfirmEcommercePaymentModal
          open={openPaymentModal}
          onClose={() => setOpenPaymentModal(false)}
          onConfirmed={() => void loadOrder({ silent: true })}
          tenantId={tenantId ?? ''}
          orderId={order.id}
          orderNumber={order.orderNumber}
        />

        <ShipEcommerceOrderModal
          open={openShipModal}
          onClose={() => setOpenShipModal(false)}
          onShipped={() => void loadOrder({ silent: true })}
          tenantId={tenantId ?? ''}
          orderId={order.id}
          orderNumber={order.orderNumber}
        />

        <CancelEcommerceOrderModal
          open={openCancelModal}
          onClose={() => setOpenCancelModal(false)}
          onCancelled={() => void loadOrder({ silent: true })}
          tenantId={tenantId ?? ''}
          orderId={order.id}
          orderNumber={order.orderNumber}
        />

        <LinkEcommerceInvoiceModal
          open={openInvoiceModal}
          onClose={() => setOpenInvoiceModal(false)}
          onLinked={() => void loadOrder({ silent: true })}
          tenantId={tenantId ?? ''}
          orderId={order.id}
          orderNumber={order.orderNumber}
        />
      </div>
    </TenantSessionGate>
  )
}

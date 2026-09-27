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
  Ban,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Package,
  ShieldAlert,
  Truck,
  XCircle,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate, formatDateTime } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import {
  getEcommerceOrderById,
  getEcommerceOrderPaymentProofUrl,
  deliverEcommerceOrder,
  processEcommerceOrder,
} from '@/services/ecommerceApi'
import { listEcommerceBlockedContacts } from '@/services/storefrontApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  ecommerceOrderStatusBadgeTone,
  ecommerceOrderStatusLabel,
  ecommercePaymentMethodLabel,
  ecommercePaymentStatusBadgeTone,
  ecommercePaymentStatusLabel,
  ecommerceShippingMethodLabel,
  EcommerceOrderStatus,
  EcommercePaymentStatus,
  type EcommerceOrderDetailDto,
} from '@/types/ecommerceApi'
import type { EcommerceBlockedContact } from '@/types/storefrontApi'
import { ConfirmEcommercePaymentModal } from './ConfirmEcommercePaymentModal'
import { ShipEcommerceOrderModal } from './ShipEcommerceOrderModal'
import { CancelEcommerceOrderModal } from './CancelEcommerceOrderModal'
import { LinkEcommerceInvoiceModal } from './LinkEcommerceInvoiceModal'
import { BlockEcommerceContactModal } from './BlockEcommerceContactModal'
import { MarkEcommerceOrderSpamModal } from './MarkEcommerceOrderSpamModal'
import './ecommerce-orders.css'

const normalizeEmail = (email: string): string => email.trim().toLowerCase()
const normalizePhone = (phone: string): string => phone.replace(/\D/g, '')

export function EcommerceOrderDetailPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { orderId } = useParams<{ orderId: string }>()
  const tenantId = useAppSelector(selectTenantId)

  const canManage = useHasPermission('ecommerce.orders.manage')
  const canManageStorefront = useHasPermission('ecommerce.storefront.manage')
  const canCreateInvoicePrimary = useHasPermission('facturacion.facturas.create')
  const canCreateInvoiceLegacy = useHasPermission('billing.invoices.create')
  const canCreateInvoice = canCreateInvoicePrimary || canCreateInvoiceLegacy

  const [order, setOrder] = useState<EcommerceOrderDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [proofUrlLoading, setProofUrlLoading] = useState(false)
  const [blockedContacts, setBlockedContacts] = useState<EcommerceBlockedContact[]>([])

  // Modals
  const [openPaymentModal, setOpenPaymentModal] = useState(false)
  const [openShipModal, setOpenShipModal] = useState(false)
  const [openCancelModal, setOpenCancelModal] = useState(false)
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false)
  const [openBlockContactModal, setOpenBlockContactModal] = useState(false)
  const [openSpamModal, setOpenSpamModal] = useState(false)

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

  const loadBlockedContacts = useCallback(async () => {
    if (!tenantId || !canManageStorefront) return
    try {
      const contacts = await listEcommerceBlockedContacts(tenantId)
      setBlockedContacts(contacts)
    } catch {
      setBlockedContacts([])
    }
  }, [tenantId, canManageStorefront])

  useEffect(() => {
    if (!tenantId || !canManageStorefront) return
    let cancelled = false
    listEcommerceBlockedContacts(tenantId)
      .then((contacts) => {
        if (!cancelled) setBlockedContacts(contacts)
      })
      .catch(() => {
        if (!cancelled) setBlockedContacts([])
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, canManageStorefront])

  const handleViewPaymentProof = async () => {
    if (!tenantId || !order) return
    setProofUrlLoading(true)
    try {
      const { url } = await getEcommerceOrderPaymentProofUrl(tenantId, order.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      const msg = readApiError(err, 'No se pudo obtener el comprobante de pago.')
      toast.show({ title: 'Error', message: msg, variant: 'error' })
    } finally {
      setProofUrlLoading(false)
    }
  }

  const handleConfirmDelivery = async () => {
    if (!tenantId || !order) return
    setDelivering(true)
    try {
      await deliverEcommerceOrder(tenantId, order.id)
      toast.show({
        title: 'Pedido Entregado',
        message: 'Orden completada satisfactoriamente.',
        variant: 'success',
      })
      await loadOrder({ silent: true })
    } catch (err) {
      const msg = readApiError(err, 'No se pudo marcar el pedido como entregado.')
      toast.show({ title: 'Error', message: msg, variant: 'error' })
    } finally {
      setDelivering(false)
    }
  }

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
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Detalle del Pedido"
            subtitle="Gestión y trazabilidad de la orden ecommerce."
          />
          <SectionCard title="Cargando…">
            <p className="app-shell__muted">Obteniendo el detalle del pedido…</p>
          </SectionCard>
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
        <div className="ecu-dashboard-layout ecu-section-page">
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
          <SectionCard title="Pedido">
            <EmptyState
              icon="receipt_long"
              title="Pedido no encontrado"
              description={
                error ?? 'La orden solicitada no existe o no tiene permisos para consultarla.'
              }
            />
          </SectionCard>
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

  const normalizedEmail = normalizeEmail(order.customer.email ?? '')
  const normalizedPhone = normalizePhone(order.customer.phone ?? '')
  const isEmailBlocked =
    normalizedEmail.length > 0 &&
    blockedContacts.some(
      (contact) => contact.kind === 'Email' && contact.valueNormalized === normalizedEmail
    )
  const isPhoneBlocked =
    normalizedPhone.length > 0 &&
    blockedContacts.some(
      (contact) => contact.kind === 'Phone' && contact.valueNormalized === normalizedPhone
    )
  const isContactBlocked = isEmailBlocked || isPhoneBlocked

  return (
    <TenantSessionGate
      title="Detalle de Pedido"
      lead="Gestión y trazabilidad de orden ecommerce"
    >
      <div className="ecu-dashboard-layout ecu-section-page">
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
                  variant={isPlaced && !isPendingPayment ? 'primary' : 'outline'}
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
                  loading={delivering}
                  disabled={delivering}
                  onClick={() => void handleConfirmDelivery()}
                >
                  Confirmar Entrega
                </Button>
              )}

              {canCreateInvoice && !order.billingInvoiceId && !isCancelled && (
                <Button
                  variant="outline"
                  iconLeft={<FileText size={16} />}
                  onClick={() =>
                    navigate(`/facturacion/facturas/emitir?pedido=${encodeURIComponent(order.id)}`)
                  }
                >
                  Facturar pedido
                </Button>
              )}

              {canManage && !canCreateInvoice && !order.billingInvoiceId && !isCancelled && (
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

        {/* Información del pedido */}
        <div className="ecommerce-detail-grid">
          <SectionCard title="Cliente & Facturación">
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
              <span
                className="ecommerce-info-value"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
              >
                {order.customer.email || 'N/A'}
                {isEmailBlocked ? <StatusBadge tone="danger">Bloqueado</StatusBadge> : null}
              </span>
            </div>
            <div className="ecommerce-info-row">
              <span className="ecommerce-info-label">Teléfono:</span>
              <span
                className="ecommerce-info-value"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
              >
                {order.customer.phone || 'N/A'}
                {isPhoneBlocked ? <StatusBadge tone="danger">Bloqueado</StatusBadge> : null}
              </span>
            </div>
            <div className="ecommerce-info-row">
              <span className="ecommerce-info-label">Dirección Fiscal:</span>
              <span className="ecommerce-info-value">{order.customer.address || 'N/A'}</span>
            </div>
            <div className="ecommerce-info-row">
              <span className="ecommerce-info-label">Factura SRI:</span>
              <span className="ecommerce-info-value">
                {order.billingInvoiceId ? (
                  <StatusBadge tone="success">
                    Facturada #{order.billingInvoiceId.substring(0, 8)}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Pendiente de emisión</StatusBadge>
                )}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Destino y Despacho">
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
                  <span className="app-shell__muted">Por asignar</span>
                )}
              </span>
            </div>
            <div className="ecommerce-info-row">
              <span className="ecommerce-info-label">Guía / Tracking:</span>
              <span className="ecommerce-info-value">
                {order.shipping.trackingNumber ? (
                  <code className="ecu-code">{order.shipping.trackingNumber}</code>
                ) : (
                  <span className="app-shell__muted">Sin tracking</span>
                )}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Reserva de Stock & Pago">
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
              <span className="ecommerce-info-value">
                {ecommercePaymentMethodLabel(order.paymentMethod)}
              </span>
            </div>
            <div className="ecommerce-info-row">
              <span className="ecommerce-info-label">Estado Pago:</span>
              <span className="ecommerce-info-value">
                <StatusBadge tone={ecommercePaymentStatusBadgeTone(order.paymentStatus)}>
                  {ecommercePaymentStatusLabel(order.paymentStatus)}
                </StatusBadge>
              </span>
            </div>
            {order.paymentReference && (
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Referencia Pago:</span>
                <span className="ecommerce-info-value">
                  <code className="ecu-code">{order.paymentReference}</code>
                </span>
              </div>
            )}
            <div className="ecommerce-info-row">
              <span className="ecommerce-info-label">Comprobante de pago:</span>
              <span className="ecommerce-info-value">
                {order.paymentProofUploadedAtUtc ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{formatDateTime(order.paymentProofUploadedAtUtc)}</span>
                    <Button
                      variant="outline"
                      iconLeft={<Eye size={16} />}
                      onClick={handleViewPaymentProof}
                      disabled={proofUrlLoading}
                    >
                      {proofUrlLoading ? 'Abriendo...' : 'Ver comprobante'}
                    </Button>
                  </span>
                ) : (
                  <span className="app-shell__muted">No recibido</span>
                )}
              </span>
            </div>
            <div className="ecommerce-info-row">
              <span className="ecommerce-info-label">Consentimiento de datos:</span>
              <span className="ecommerce-info-value">
                {order.dataConsentAtUtc ? (
                  formatDateTime(order.dataConsentAtUtc)
                ) : (
                  <span className="app-shell__muted">No registrado</span>
                )}
              </span>
            </div>
            {order.customerNotes && (
              <div className="ecommerce-info-row">
                <span className="ecommerce-info-label">Nota Cliente:</span>
                <span className="ecommerce-info-value" style={{ fontStyle: 'italic' }}>
                  {order.customerNotes}
                </span>
              </div>
            )}
          </div>
          </SectionCard>
        </div>

        {/* Control de abuso */}
        {canManageStorefront && (
          <SectionCard
            title="Control de abuso"
            subtitle="Bloquea contactos o marca el pedido como spam para proteger la tienda pública."
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="outline"
                iconLeft={<ShieldAlert size={16} />}
                onClick={() => setOpenBlockContactModal(true)}
              >
                Bloquear contacto
              </Button>
              <Button
                variant="danger"
                iconLeft={<Ban size={16} />}
                onClick={() => setOpenSpamModal(true)}
                disabled={!canManage || isCancelled || isShipped || isDelivered}
              >
                Marcar como spam
              </Button>
              {isContactBlocked ? (
                <StatusBadge tone="danger">Contacto bloqueado</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Sin bloqueos</StatusBadge>
              )}
            </div>
            {!canManage ? (
              <p className="app-shell__muted" style={{ marginTop: '0.75rem' }}>
                Necesitas el permiso ecommerce.orders.manage para cancelar el pedido al marcarlo
                como spam.
              </p>
            ) : null}
          </SectionCard>
        )}

        {/* Tabla de Productos */}
        <SectionCard title="Productos Solicitados">
          <div style={{ overflowX: 'auto' }}>
            <table className="ecu-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th style={{ textAlign: 'center' }}>Cantidad</th>
                  <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                  <th style={{ textAlign: 'right' }}>Descuento</th>
                  <th style={{ textAlign: 'right' }}>IVA (15%)</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {item.thumbUrl ? (
                          <img
                            src={item.thumbUrl}
                            alt={item.itemName}
                            loading="lazy"
                            style={{
                              width: 40,
                              height: 40,
                              objectFit: 'cover',
                              borderRadius: 6,
                              border: '1px solid var(--shell-border, rgba(0,0,0,0.12))',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 6,
                              border: '1px dashed var(--shell-border, rgba(0,0,0,0.2))',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ fontWeight: 600 }}>{item.sku || 'N/A'}</span>
                      </div>
                    </td>
                    <td>{item.itemName}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right' }}>
                      ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      ${item.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      ${item.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
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

        <BlockEcommerceContactModal
          open={openBlockContactModal}
          onClose={() => setOpenBlockContactModal(false)}
          onBlocked={() => void loadBlockedContacts()}
          tenantId={tenantId ?? ''}
          orderNumber={order.orderNumber}
          customerEmail={order.customer.email ?? ''}
          customerPhone={order.customer.phone ?? null}
        />

        <MarkEcommerceOrderSpamModal
          open={openSpamModal}
          onClose={() => setOpenSpamModal(false)}
          onDone={() => {
            void loadBlockedContacts()
            void loadOrder({ silent: true })
          }}
          tenantId={tenantId ?? ''}
          orderId={order.id}
          orderNumber={order.orderNumber}
          customerEmail={order.customer.email ?? ''}
          customerPhone={order.customer.phone ?? null}
        />
      </div>
    </TenantSessionGate>
  )
}

import { useEffect, useState } from 'react'
import { Popup } from 'glubox'
import { AlertCircle, Building2, PackageCheck } from 'lucide-react'
import { StatusBadge } from '@/components/ui'
import { readApiError } from '@/lib/readApiError'
import { getPurchaseById } from '@/services/purchasesApi'
import type { PurchaseDetailDto, PurchaseStatus } from '@/types/purchasesApi'

interface PurchaseDetailModalProps {
  open: boolean
  tenantId: string
  purchaseId: string | null
  onClose: () => void
  onReceiveClick?: () => void
}

function formatStatus(status: PurchaseStatus): { label: string; tone: 'neutral' | 'primary' | 'success' | 'danger' | 'warning' } {
  switch (status) {
    case 1:
      return { label: 'Borrador', tone: 'neutral' }
    case 2:
      return { label: 'Mercadería Recibida', tone: 'success' }
    case 3:
      return { label: 'Facturado', tone: 'primary' }
    case 4:
      return { label: 'Cancelado', tone: 'danger' }
    default:
      return { label: 'Desconocido', tone: 'neutral' }
  }
}

export function PurchaseDetailModal({
  open,
  tenantId,
  purchaseId,
  onClose,
  onReceiveClick,
}: PurchaseDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [purchase, setPurchase] = useState<PurchaseDetailDto | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !purchaseId) {
      setPurchase(null)
      setErrorMessage(null)
      return
    }

    const fetchDetail = async () => {
      setLoading(true)
      setErrorMessage(null)
      try {
        const data = await getPurchaseById(tenantId, purchaseId)
        setPurchase(data)
      } catch (err) {
        setErrorMessage(
          readApiError(err, 'No se pudo cargar el detalle del comprobante de compra.')
        )
      } finally {
        setLoading(false)
      }
    }

    void fetchDetail()
  }, [open, purchaseId, tenantId])

  const statusInfo = purchase ? formatStatus(purchase.status) : null

  return (
    <Popup
      open={open}
      title={`Factura de Compra: ${purchase?.invoiceNumber ?? ''}`}
      onClose={onClose}
      width="min(95vw, 56rem)"
      actions={[
        ...(purchase?.status === 1 && onReceiveClick
          ? [
              {
                id: 'receive',
                label: 'Recepcionar en Bodega',
                variant: 'primary' as const,
                onClick: () => {
                  onClose()
                  onReceiveClick()
                },
              },
            ]
          : []),
        {
          id: 'close',
          label: 'Cerrar',
          variant: 'outline' as const,
          onClick: onClose,
        },
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.5rem' }}>
        {errorMessage && (
          <div className="ecu-form-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--glb-muted, #64748b)' }}>
            Cargando información del documento...
          </div>
        ) : purchase ? (
          <>
            {/* Header Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
                backgroundColor: 'var(--glb-surface, #ffffff)',
                border: '1px solid var(--shell-border, #e2e8f0)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <Building2 size={18} style={{ color: 'var(--shell-primary, #4f46e5)' }} />
                  <strong style={{ fontSize: '1rem' }}>{purchase.supplierBusinessName}</strong>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)' }}>
                  RUC: <strong>{purchase.supplierTaxId}</strong>
                </div>
                {purchase.expenseTypeName && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.35rem' }}>
                    Tipo de Gasto: <span style={{ fontWeight: 500, color: 'var(--glb-text, #1e293b)' }}>{purchase.expenseTypeName}</span>
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)' }}>N° Factura:</span>
                  <strong style={{ fontSize: '0.9375rem' }}>{purchase.invoiceNumber}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)' }}>Fecha Emisión:</span>
                  <span>{purchase.issueDate}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--glb-muted, #64748b)' }}>Estado:</span>
                  {statusInfo && <StatusBadge tone={statusInfo.tone} withDot>{statusInfo.label}</StatusBadge>}
                </div>
                {purchase.authorizationNumber && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.35rem' }}>
                    Autorización SRI: <span style={{ fontFamily: 'monospace' }}>{purchase.authorizationNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Inventory Status Note */}
            {purchase.status === 2 && (
              <div
                style={{
                  backgroundColor: 'rgba(240, 253, 244, 0.7)',
                  border: '1px solid #bbf7d0',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  fontSize: '0.8125rem',
                  color: '#15803d',
                }}
              >
                <PackageCheck size={18} />
                <span>
                  Mercadería ingresada a bodega. Costo promedio ponderado y kárdex actualizados.
                </span>
              </div>
            )}

            {/* Line Items Table */}
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                Líneas de la Factura ({purchase.items?.length ?? 0})
              </span>
              <div
                style={{
                  border: '1px solid var(--shell-border, #e2e8f0)',
                  borderRadius: '0.5rem',
                  overflowX: 'auto',
                  backgroundColor: 'var(--glb-surface, transparent)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--glb-surface-hover, rgba(255, 255, 255, 0.04))',
                        borderBottom: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '0.5rem 0.75rem' }}>Cód.</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Descripción</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Cant.</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>P. Unit.</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Desc.</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>IVA %</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Inventariable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(purchase.items ?? []).map((item) => (
                      <tr
                        key={item.id}
                        style={{ borderBottom: '1px solid var(--shell-border, #e2e8f0)' }}
                      >
                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {item.itemCode || '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>
                          {item.description}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          {item.discount > 0 ? `-$${item.discount.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                          {item.taxRate}%
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                          ${item.total.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          {item.affectsInventory ? (
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>Sí</span>
                          ) : (
                            <span style={{ color: 'var(--glb-muted, #64748b)' }}>No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Box */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <div
                style={{
                  width: '300px',
                  backgroundColor: 'rgba(248, 250, 252, 0.8)',
                  border: '1px solid var(--shell-border, #e2e8f0)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--glb-muted, #64748b)' }}>Subtotal 0%:</span>
                  <span>${purchase.subtotalZero.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--glb-muted, #64748b)' }}>Subtotal Gravado ({purchase.taxRate}%):</span>
                  <span>${purchase.subtotalTaxed.toFixed(2)}</span>
                </div>
                {purchase.totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ color: 'var(--glb-muted, #64748b)' }}>Descuento:</span>
                    <span>-${purchase.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--glb-muted, #64748b)' }}>IVA:</span>
                  <span>${purchase.taxAmount.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '0.35rem',
                    borderTop: '1px solid var(--shell-border, #cbd5e1)',
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    color: 'var(--shell-primary, #4f46e5)',
                  }}
                >
                  <span>Total Factura:</span>
                  <span>${purchase.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Popup>
  )
}

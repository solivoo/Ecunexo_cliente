import { useEffect, useMemo, useState } from 'react'
import { Popup, Select } from 'glubox'
import { AlertCircle, PackageCheck } from 'lucide-react'
import { readApiError } from '@/lib/readApiError'
import { getPurchaseById, receivePurchase } from '@/services/purchasesApi'
import type { WarehouseListItemDto } from '@/types/inventoryApi'
import type {
  PurchaseDetailDto,
  PurchaseSummaryDto,
  ReceivePurchaseLineMappingPayload,
  ReceivePurchasePayload,
} from '@/types/purchasesApi'
import '@/pages/repairs/ecu-customer-form.css'

interface ReceivePurchaseModalProps {
  open: boolean
  tenantId: string
  purchase: PurchaseSummaryDto | null
  warehouses: WarehouseListItemDto[]
  onClose: () => void
  onSuccess: (purchaseId: string) => void
}

export function ReceivePurchaseModal({
  open,
  tenantId,
  purchase,
  warehouses,
  onClose,
  onSuccess,
}: ReceivePurchaseModalProps) {
  const [loading, setLoading] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [purchaseDetail, setPurchaseDetail] = useState<PurchaseDetailDto | null>(null)
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>('')
  const [lineWarehouseMap, setLineWarehouseMap] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !purchase) {
      setPurchaseDetail(null)
      setErrorMessage(null)
      setReceiving(false)
      setLineWarehouseMap({})
      return
    }

    if (warehouses.length > 0) {
      setDefaultWarehouseId(warehouses[0].id)
    }

    const fetchDetail = async () => {
      setLoading(true)
      setErrorMessage(null)
      try {
        const detail = await getPurchaseById(tenantId, purchase.id)
        setPurchaseDetail(detail)
        // Initialize line mapping
        const map: Record<string, string> = {}
        for (const item of detail.items) {
          if (item.affectsInventory) {
            map[item.id] = item.warehouseId || warehouses[0]?.id || ''
          }
        }
        setLineWarehouseMap(map)
      } catch (err) {
        setErrorMessage(
          readApiError(err, 'No se pudo cargar el detalle del comprobante de compra.')
        )
      } finally {
        setLoading(false)
      }
    }

    void fetchDetail()
  }, [open, purchase, tenantId, warehouses])

  const warehouseOptions = useMemo(() => {
    return warehouses.map((wh) => ({
      value: wh.id,
      label: `${wh.name} (${wh.code})`,
    }))
  }, [warehouses])

  const inventoryItems = useMemo(() => {
    if (!purchaseDetail?.items) return []
    return purchaseDetail.items.filter((item) => item.affectsInventory)
  }, [purchaseDetail])

  const handleDefaultWarehouseChange = (whId: string) => {
    setDefaultWarehouseId(whId)
    // Update all mapped lines to new default
    setLineWarehouseMap((prev) => {
      const updated = { ...prev }
      for (const lineId of Object.keys(updated)) {
        updated[lineId] = whId
      }
      return updated
    })
  }

  const handleLineWarehouseChange = (lineId: string, whId: string) => {
    setLineWarehouseMap((prev) => ({
      ...prev,
      [lineId]: whId,
    }))
  }

  const handleConfirmReceive = async () => {
    if (!purchase) return
    setReceiving(true)
    setErrorMessage(null)

    try {
      const lineMappings: ReceivePurchaseLineMappingPayload[] = []
      if (purchaseDetail) {
        for (const item of inventoryItems) {
          const targetWh = lineWarehouseMap[item.id] || defaultWarehouseId
          if (item.catalogItemId && targetWh) {
            lineMappings.push({
              lineId: item.id,
              catalogItemId: item.catalogItemId,
              warehouseId: targetWh,
            })
          }
        }
      }

      const payload: ReceivePurchasePayload = {
        defaultWarehouseId: defaultWarehouseId || null,
        lineMappings: lineMappings.length > 0 ? lineMappings : undefined,
      }

      await receivePurchase(tenantId, purchase.id, payload)
      onSuccess(purchase.id)
    } catch (err) {
      setErrorMessage(
        readApiError(err, 'No se pudo completar la recepción de mercadería en bodega.')
      )
    } finally {
      setReceiving(false)
    }
  }

  return (
    <Popup
      open={open}
      title={`Recepcionar Mercadería: Factura ${purchase?.invoiceNumber ?? ''}`}
      onClose={onClose}
      width="min(95vw, 48rem)"
      actions={[
        {
          id: 'cancel',
          label: 'Cancelar',
          variant: 'outline',
          onClick: onClose,
          disabled: receiving,
        },
        {
          id: 'confirm',
          label: receiving ? 'Ingresando a stock...' : 'Confirmar Ingreso a Bodega',
          variant: 'primary',
          onClick: () => void handleConfirmReceive(),
          disabled: receiving || loading || !defaultWarehouseId,
          loading: receiving,
        },
      ]}
    >
      <div className="ecu-customer-form" style={{ gap: '1.25rem' }}>
        {errorMessage && (
          <div className="ecu-form-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div
          style={{
            backgroundColor: 'rgba(240, 253, 244, 0.6)',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <PackageCheck size={20} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.8125rem', color: '#15803d' }}>
            <strong>Ingreso automático al Kárdex y Stock Físico</strong>
            <p style={{ margin: '0.25rem 0 0', lineHeight: 1.4 }}>
              Al confirmar, se generará un documento de recepción física en el módulo de Inventario y
              se actualizarán automáticamente las existencias y el costo promedio ponderado de los ítems.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--glb-muted, #64748b)' }}>
            Cargando ítems de la factura...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                backgroundColor: 'var(--glb-surface, #ffffff)',
                border: '1px solid var(--shell-border, #e2e8f0)',
                borderRadius: '0.5rem',
                padding: '1rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>Proveedor</span>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{purchase?.supplierBusinessName}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
                  RUC: {purchase?.supplierTaxId}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>Fecha Emisión</span>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 600 }}>{purchase?.issueDate}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)' }}>
                  Total: ${purchase?.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>

            {warehouseOptions.length > 0 && (
              <div>
                <Select
                  id="receive-default-warehouse"
                  label="Bodega de Destino General *"
                  labelPosition="outlined"
                  variant="outline"
                  value={defaultWarehouseId}
                  options={warehouseOptions}
                  onChange={handleDefaultWarehouseChange}
                  fullWidth
                />
              </div>
            )}

            <div>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                Ítems para ingreso a inventario ({inventoryItems.length})
              </span>

              {inventoryItems.length === 0 ? (
                <div
                  style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    border: '1px dashed var(--shell-border, #cbd5e1)',
                    borderRadius: '0.5rem',
                    color: 'var(--glb-muted, #64748b)',
                    fontSize: '0.8125rem',
                  }}
                >
                  Esta factura no contiene ítems marcados para control de inventario (posiblemente son servicios o gastos varios).
                </div>
              ) : (
                <div
                  style={{
                    border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))',
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
                        <th style={{ padding: '0.5rem 0.75rem' }}>Descripción</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Cantidad</th>
                        <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Costo U.</th>
                        <th style={{ padding: '0.5rem 0.75rem' }}>Bodega Destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map((item) => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid var(--shell-border, #e2e8f0)',
                          }}
                        >
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ fontWeight: 500 }}>{item.description}</div>
                            {item.itemCode && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)', fontFamily: 'monospace' }}>
                                Cód: {item.itemCode}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                            {item.quantity}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                            ${item.unitPrice.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', minWidth: '180px' }}>
                            <select
                              value={lineWarehouseMap[item.id] ?? defaultWarehouseId}
                              onChange={(e) => handleLineWarehouseChange(item.id, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.35rem 0.5rem',
                                borderRadius: '0.375rem',
                                border: '1px solid var(--shell-border, #cbd5e1)',
                                fontSize: '0.75rem',
                                backgroundColor: 'var(--glb-surface, #ffffff)',
                                color: 'var(--glb-text, #1e293b)',
                              }}
                            >
                              {warehouseOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Popup>
  )
}

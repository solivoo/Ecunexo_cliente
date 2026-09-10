import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
import {
  inventoryDocumentStatusLabel,
  inventoryDocumentTypeLabel,
  inventoryReceiptOriginLabel,
} from '@/lib/inventoryLabels'
import { readApiError } from '@/lib/readApiError'
import {
  approveInventoryDocument,
  getInventoryDocument,
  receiveInventoryTransfer,
} from '@/services/inventoryApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  InventoryDocumentStatus,
  InventoryDocumentType,
  type InventoryDocumentDetailDto,
} from '@/types/inventoryApi'

function getDocStatusBadgeTone(status: InventoryDocumentStatus) {
  switch (status) {
    case InventoryDocumentStatus.Approved:
      return 'success'
    case InventoryDocumentStatus.InTransit:
      return 'warning'
    case InventoryDocumentStatus.Cancelled:
      return 'danger'
    default:
      return 'neutral'
  }
}

export function InventoryDocumentDetailPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { documentId } = useParams<{ documentId: string }>()
  const tenantId = useAppSelector(selectTenantId)
  const canApprove = useHasPermission('inventory.documents.approve')
  const [doc, setDoc] = useState<InventoryDocumentDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId || !documentId) return
    try {
      setDoc(await getInventoryDocument(tenantId, documentId))
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo cargar el documento.'))
    }
  }, [documentId, tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const onApprove = useCallback(async () => {
    if (!tenantId || !documentId) return
    setBusy(true)
    try {
      await approveInventoryDocument(tenantId, documentId)
      const isTransfer = doc?.documentType === InventoryDocumentType.Transfer
      toast.show({
        title: isTransfer ? 'Despachado' : 'Aprobado',
        message: isTransfer
          ? 'Stock en tránsito. Confirma la recepción cuando llegue a destino.'
          : 'Kárdex y stock actualizados.',
        variant: 'success',
      })
      await load()
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo aprobar.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }, [doc?.documentType, documentId, load, tenantId, toast])

  const onReceive = useCallback(async () => {
    if (!tenantId || !documentId) return
    setBusy(true)
    try {
      await receiveInventoryTransfer(tenantId, documentId)
      toast.show({
        title: 'Recibido',
        message: 'El stock ya está en la bodega destino.',
        variant: 'success',
      })
      await load()
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo recibir la transferencia.')
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }, [documentId, load, tenantId, toast])

  return (
    <TenantSessionGate
      title="Documento de inventario"
      lead="Detalle de comprobante y trazabilidad de líneas físicas."
    >
      <div className="ecu-dashboard-layout">
        {!doc ? (
          <SectionCard title="Cargando…">
            <p className="app-shell__muted">Recuperando detalles del documento de inventario…</p>
          </SectionCard>
        ) : (
          <>
            <PageHeader
              title={`${inventoryDocumentTypeLabel(doc.documentType)} #${doc.id.slice(0, 8)}`}
              subtitle={`Bodega: ${doc.warehouseName}${doc.destinationWarehouseName ? ` → ${doc.destinationWarehouseName}` : ''} · Emitido el ${formatDateTime(doc.createdAt)}`}
              badge={
                <StatusBadge
                  tone={getDocStatusBadgeTone(doc.status)}
                  withDot={doc.status === InventoryDocumentStatus.Approved}
                >
                  {inventoryDocumentStatusLabel(doc.status)}
                </StatusBadge>
              }
              actions={
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {canApprove && doc.status === InventoryDocumentStatus.Draft ? (
                    <Button
                      type="button"
                      variant="primary"
                      loading={busy}
                      disabled={busy}
                      onClick={() => void onApprove()}
                    >
                      {doc.documentType === InventoryDocumentType.Transfer
                        ? 'Despachar a Tránsito'
                        : 'Aprobar Documento'}
                    </Button>
                  ) : null}
                  {canApprove &&
                  doc.documentType === InventoryDocumentType.Transfer &&
                  doc.status === InventoryDocumentStatus.InTransit ? (
                    <Button
                      type="button"
                      variant="primary"
                      loading={busy}
                      disabled={busy}
                      onClick={() => void onReceive()}
                    >
                      Confirmar Recepción
                    </Button>
                  ) : null}
                  <EcuPageActions
                    items={[
                      {
                        id: 'list',
                        label: 'Documentos',
                        icon: 'file-text',
                        route: '/inventario/documentos',
                        disabled: false,
                      },
                    ]}
                    variant="outline"
                    triggerLabel="Acciones"
                    renderIcon={renderSidebarIcon}
                    onNavigate={(route: string) => navigate(route)}
                  />
                </div>
              }
            />

            <div className="ecu-stat-grid" aria-label="Resumen del documento">
              <StatCard
                label="Tipo de Movimiento"
                value={inventoryDocumentTypeLabel(doc.documentType)}
                icon="category"
                toneColor="#4f46e5"
                footerText="Naturaleza de la operación"
              />
              <StatCard
                label="Estado Actual"
                value={inventoryDocumentStatusLabel(doc.status)}
                icon="verified"
                toneColor={
                  doc.status === InventoryDocumentStatus.Approved
                    ? '#10b981'
                    : doc.status === InventoryDocumentStatus.InTransit
                      ? '#f59e0b'
                      : '#6b7280'
                }
                footerText="Ciclo de vida logístico"
              />
              <StatCard
                label="Total de Líneas"
                value={doc.lines.length}
                icon="format_list_bulleted"
                toneColor="#0ea5e9"
                footerText="Artículos en comprobante"
              />
              <StatCard
                label="Unidades Físicas"
                value={doc.lines.reduce((acc, l) => acc + l.quantity, 0).toFixed(2)}
                icon="numbers"
                toneColor="#8b5cf6"
                footerText="Cantidad neta movilizada"
              />
            </div>

            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <SectionCard
              title="Información del Comprobante"
              subtitle="Detalles operativos, referencias documentales y marcas de tiempo"
            >
              <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                <div className="ecu-companies-form__field">
                  <p className="ecu-companies-form__hint">
                    {doc.documentType === InventoryDocumentType.Transfer ? 'Bodega Origen' : 'Bodega'}
                  </p>
                  <p style={{ fontWeight: 500 }}>{doc.warehouseName}</p>
                </div>
                {doc.destinationWarehouseName ? (
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-form__hint">Bodega Destino</p>
                    <p style={{ fontWeight: 500 }}>{doc.destinationWarehouseName}</p>
                  </div>
                ) : null}
                {doc.documentType === InventoryDocumentType.Receipt ? (
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-form__hint">Origen de Recepción</p>
                    <p>{inventoryReceiptOriginLabel(doc.receiptOrigin)}</p>
                  </div>
                ) : null}
                {doc.sourceDocumentNumber ? (
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-form__hint">Nº Factura Proveedor</p>
                    <p>
                      <code className="ecu-code">{doc.sourceDocumentNumber}</code>
                    </p>
                  </div>
                ) : null}
                <div className="ecu-companies-form__field">
                  <p className="ecu-companies-form__hint">Fecha de Emisión</p>
                  <p>{formatDateTime(doc.createdAt)}</p>
                </div>
                {doc.shippedAt ? (
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-form__hint">Fecha de Despacho</p>
                    <p>{formatDateTime(doc.shippedAt)}</p>
                  </div>
                ) : null}
                {doc.approvedAt ? (
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-form__hint">
                      {doc.documentType === InventoryDocumentType.Transfer ? 'Recepción Confirmada' : 'Fecha de Aprobación'}
                    </p>
                    <p>{formatDateTime(doc.approvedAt)}</p>
                  </div>
                ) : null}
                {doc.notes ? (
                  <div className="ecu-companies-form__field ecu-companies-form__field--span-4">
                    <p className="ecu-companies-form__hint">Observación / Justificación</p>
                    <p className="app-shell__muted">{doc.notes}</p>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Artículos Movilizados"
              subtitle="Desglose de productos físicos y cantidades asentadas"
            >
              <div className="ecu-doc-lines__wrap">
                <table className="ecu-doc-lines">
                  <thead>
                    <tr>
                      <th scope="col" className="ecu-doc-lines__n">
                        #
                      </th>
                      <th scope="col">Ítem físico</th>
                      <th scope="col" className="ecu-doc-lines__qty">
                        Cantidad
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.lines.map((line, idx) => (
                      <tr key={line.catalogItemId}>
                        <td className="ecu-doc-lines__n">{idx + 1}</td>
                        <td>
                          <strong>{line.catalogItemName}</strong>
                        </td>
                        <td className="ecu-doc-lines__qty">
                          <span style={{ fontWeight: 600 }}>{line.quantity.toFixed(2)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                className="ecu-companies-form__actions"
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--glb-surface-border, rgba(0, 0, 0, 0.08))',
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/inventario/documentos')}
                >
                  Volver al Listado
                </Button>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </TenantSessionGate>
  )
}

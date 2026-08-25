import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast } from 'glubox'
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
      lead="Detalle de un documento. Si hay varias transferencias en camino, usa Documentos → Por recibir."
    >
      <div className="ecu-companies-page">
        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}
        {!doc ? (
          <p className="app-shell__muted">Cargando…</p>
        ) : (
          <>
            <section className="app-shell__card ecu-companies-form__card">
              <h2 className="app-shell__section-title">
                {inventoryDocumentTypeLabel(doc.documentType)} · {inventoryDocumentStatusLabel(doc.status)}
              </h2>
              <p className="app-shell__muted">
                {doc.documentType === InventoryDocumentType.Transfer ? 'Origen' : 'Bodega'}:{' '}
                {doc.warehouseName}
              </p>
              {doc.destinationWarehouseName ? (
                <p className="app-shell__muted">Destino: {doc.destinationWarehouseName}</p>
              ) : null}
              {doc.documentType === InventoryDocumentType.Receipt ? (
                <p className="app-shell__muted">
                  Origen: {inventoryReceiptOriginLabel(doc.receiptOrigin)}
                  {doc.sourceDocumentNumber ? ` · Factura ${doc.sourceDocumentNumber}` : ''}
                </p>
              ) : null}
              <p className="app-shell__muted">Creado: {formatDateTime(doc.createdAt)}</p>
              {doc.shippedAt ? (
                <p className="app-shell__muted">Despachado: {formatDateTime(doc.shippedAt)}</p>
              ) : null}
              {doc.approvedAt ? (
                <p className="app-shell__muted">
                  {doc.documentType === InventoryDocumentType.Transfer ? 'Recibido' : 'Aprobado'}:{' '}
                  {formatDateTime(doc.approvedAt)}
                </p>
              ) : null}
              {doc.notes ? <p>{doc.notes}</p> : null}
              <ul>
                {doc.lines.map((line) => (
                  <li key={line.catalogItemId}>
                    {line.catalogItemName} — {line.quantity}
                  </li>
                ))}
              </ul>
            </section>
            <div className="ecu-companies-form__actions">
              {canApprove && doc.status === InventoryDocumentStatus.Draft ? (
                <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={() => void onApprove()}>
                  {doc.documentType === InventoryDocumentType.Transfer ? 'Despachar' : 'Aprobar'}
                </Button>
              ) : null}
              {canApprove &&
              doc.documentType === InventoryDocumentType.Transfer &&
              doc.status === InventoryDocumentStatus.InTransit ? (
                <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={() => void onReceive()}>
                  Confirmar recepción
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => navigate('/inventario/documentos')}>
                Atrás
              </Button>
            </div>
          </>
        )}
      </div>
    </TenantSessionGate>
  )
}

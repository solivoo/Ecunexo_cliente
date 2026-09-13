import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, DataGrid, Popup, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { Copy, ExternalLink, Eye, FileDown, Plus, QrCode } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { downloadDispatchDeliveryNotePdf } from '@/pages/repairs/pdf/dispatchPdfDownloads'
import { ManageCarriersModal } from '@/pages/repairs/ManageCarriersModal'
import { getRepairDispatch, listRepairDispatches } from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  RepairDispatchStatus,
  DispatchExitType,
  dispatchExitTypeLabel,
  dispatchExitTypeBadgeTone,
  type RepairDispatchDto,
} from '@/types/repairsApi'

type Row = RepairDispatchDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('despacho', 'despachos')

function statusBadge(status: RepairDispatchStatus) {
  switch (status) {
    case RepairDispatchStatus.Invoiced:
      return <StatusBadge tone="success" withDot>Facturado</StatusBadge>
    case RepairDispatchStatus.Confirmed:
      return <StatusBadge tone="primary" withDot>Confirmado</StatusBadge>
    default:
      return <StatusBadge tone="neutral" withDot>Borrador</StatusBadge>
  }
}

export function RepairDispatchesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tenantId = useAppSelector(selectTenantId)
  const initialBatchId = params.get('batchId')

  const canRead = useHasPermission('repairs.dispatches.read')
  const canCreate = useHasPermission('repairs.dispatches.create')
  const canReadBatches = useHasPermission('repairs.batches.read')
  const canViewPortal = useHasPermission('repairs.b2b.portal.view')

  const [dispatches, setDispatches] = useState<RepairDispatchDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCarriersModalOpen, setIsCarriersModalOpen] = useState(false)
  const [selectedQrDispatch, setSelectedQrDispatch] = useState<RepairDispatchDto | null>(null)
  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  useEffect(() => {
    if (initialBatchId && canCreate) {
      navigate(`/taller/despachos/nuevo?batchId=${encodeURIComponent(initialBatchId)}`, { replace: true })
    }
  }, [initialBatchId, canCreate, navigate])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        const dList = await listRepairDispatches(tenantId)
        setDispatches(dList)
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Despachos sincronizados.', variant: 'success' })
        }
      } catch (err: unknown) {
        const msg = readApiError(err, 'No se pudieron cargar los despachos.')
        setError(msg)
        setDispatches([])
        toast.show({ title: 'Error', message: msg, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  const handleDownloadPdfRow = async (row: RepairDispatchDto) => {
    if (!tenantId) return
    try {
      toast.show({ title: 'Generando PDF', message: `Preparando acta ${row.dispatchNumber}...`, variant: 'info' })
      const fullDispatch = (!row.items || row.items.length === 0)
        ? await getRepairDispatch(tenantId, row.id)
        : row
      const { filename } = await downloadDispatchDeliveryNotePdf(tenantId, fullDispatch)
      toast.show({ title: 'Descarga completa', message: `Acta guardada: ${filename}`, variant: 'success' })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al generar PDF',
        message: readApiError(err, 'No se pudo descargar el acta en PDF.'),
        variant: 'error',
      })
    }
  }

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canReadBatches) {
      items.push({
        id: 'batches',
        label: 'Lotes de taller',
        icon: 'layers',
        route: '/taller/lotes',
        disabled: false,
      })
    }
    if (canViewPortal) {
      items.push({
        id: 'portal',
        label: 'Portal Corporativo',
        icon: 'shield-check',
        route: '/taller/portal',
        disabled: false,
      })
    }
    items.push({
      id: 'carriers',
      label: 'Transportistas',
      icon: 'truck',
      route: null,
      disabled: false,
    })
    items.push({
      id: 'refresh',
      label: 'Actualizar',
      icon: 'refresh-cw',
      route: null,
      disabled: loading,
    })
    return items
  }, [canReadBatches, canViewPortal, loading])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'dispatchNumber',
        header: 'Nº Acta',
        width: 170,
        sortable: true,
        renderCell: (_v, row) => (
          <button
            type="button"
            className="ecu-link-button"
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 700,
              background: 'none',
              border: 'none',
              color: 'var(--shell-primary)',
              cursor: 'pointer',
              padding: 0,
            }}
            onClick={() => navigate(`/taller/despachos/${row.id}`)}
          >
            {row.dispatchNumber}
          </button>
        ),
      },
      {
        key: 'customerName',
        header: 'Cliente / Lote',
        width: 220,
        sortable: true,
        renderCell: (_v, row) => (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--glb-text)' }}>
              {row.customerName || 'Cliente Corporativo'}
            </div>
            {row.batchNumber && (
              <span className="app-shell__muted" style={{ fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>
                Lote: {row.batchNumber}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'carrierName',
        header: 'Transportista',
        width: 230,
        sortable: true,
        renderCell: (_v, row) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, color: 'var(--glb-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.carrierName || 'No registrado'}
              </div>
              {row.carrierVehiclePlate && (
                <span className="app-shell__muted" style={{ fontSize: '0.75rem', fontFamily: 'ui-monospace, monospace' }}>
                  Placa: {row.carrierVehiclePlate}
                </span>
              )}
            </div>
            {row.verificationHash && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedQrDispatch(row)
                }}
                title="Ver código QR de este despacho"
                style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem', flexShrink: 0 }}
              >
                <QrCode size={13} strokeWidth={2} aria-hidden />
                QR
              </Button>
            )}
          </div>
        ),
      },
      {
        key: 'exitType',
        header: 'Tipo de salida',
        width: 170,
        renderCell: (_v, row) => {
          const et = (row.exitType ?? DispatchExitType.Repaired) as DispatchExitType
          return (
            <StatusBadge tone={dispatchExitTypeBadgeTone(et)} withDot>
              {dispatchExitTypeLabel(et)}
            </StatusBadge>
          )
        },
      },
      {
        key: 'id',
        header: 'Equipos',
        width: 100,
        align: 'center',
        renderCell: (_v, row) => (
          <span style={{ fontWeight: 700 }}>{row.items?.length ?? 0}</span>
        ),
      },
      {
        key: 'dispatchedAt',
        header: 'Fecha salida',
        width: 160,
        sortable: true,
        renderCell: (_v, row) => (
          <span>{row.dispatchedAt ? formatDateTime(row.dispatchedAt) : '—'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 120,
        renderCell: (_v, row) => statusBadge(row.status),
      },
      {
        key: 'verificationHash',
        header: 'Acciones',
        sticky: 'right',
        width: 130,
        align: 'center',
        renderCell: (_v, row) => (
          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
            <GridIconButton
              icon={Eye}
              label="Ver detalle del acta"
              onClick={() => navigate(`/taller/despachos/${row.id}`)}
            />
            <GridIconButton
              icon={FileDown}
              label="Descargar Acta (PDF)"
              onClick={() => void handleDownloadPdfRow(row)}
            />
            <GridIconButton
              icon={QrCode}
              label="Ver código QR oficial"
              onClick={() => setSelectedQrDispatch(row)}
            />
          </div>
        ),
      },
    ],
    [navigate]
  )

  const totalDispatchedEquipments = useMemo(
    () => dispatches.reduce((acc, d) => acc + (d.items?.length ?? 0), 0),
    [dispatches]
  )

  const invoicedCount = useMemo(
    () => dispatches.filter((d) => d.status === RepairDispatchStatus.Invoiced).length,
    [dispatches]
  )

  if (!canRead) {
    return (
      <TenantSessionGate
        title="Despachos"
        lead="Entrega certificada de electrodomésticos reparados con código QR."
      >
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso restringido"
            subtitle="Requieres repairs.dispatches.read para visualizar las actas de despacho."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Actas y Despachos"
      lead="Despachos parciales o totales con acta QR y facturación por salida."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Actas y Despachos"
          subtitle="Cada salida puede incluir un subconjunto de equipos listos; luego facturas el servicio del acta."
          badge={<StatusBadge tone="primary" withDot>Operaciones</StatusBadge>}
          actions={
            <>
              {canCreate && (
                <Button type="button" variant="primary" onClick={() => navigate('/taller/despachos/nuevo')}>
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Nueva Acta
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={(item) => {
                  if (item.id === 'refresh') void load()
                  if (item.id === 'carriers') setIsCarriersModalOpen(true)
                }}
              />
            </>
          }
        />

        {error && (
          <div className="ecu-form-error-banner" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="ecu-stat-grid">
          <StatCard label="Actas emitidas" value={String(dispatches.length)} icon="receipt_long" toneColor="var(--shell-primary)" />
          <StatCard label="Equipos despachados" value={String(totalDispatchedEquipments)} icon="inventory_2" toneColor="var(--shell-primary)" />
          <StatCard label="Actas facturadas" value={String(invoicedCount)} icon="payments" toneColor="var(--shell-primary)" />
        </div>

        <SectionCard title="Historial de actas" subtitle="Haz clic en el número de acta para ver detalle, QR y facturación">
          {!loading && dispatches.length === 0 ? (
            <EmptyState
              icon="local_shipping"
              title="Aún no hay actas de despacho"
              description="Genera una acta parcial cuando haya equipos en estado «Listo para Retiro»."
              action={
                canCreate ? (
                  <Button type="button" variant="primary" onClick={() => navigate('/taller/despachos/nuevo')}>
                    <Plus size={16} strokeWidth={2} aria-hidden />
                    Nueva Acta
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid<Row>
              className="ecu-repairs-grid"
              columns={columns}
              dataSource={dispatches as Row[]}
              keyExpr="id"
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar por acta o transportista..."
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
              fullWidth
            />
          )}
        </SectionCard>
      </div>

      <ManageCarriersModal
        isOpen={isCarriersModalOpen}
        onClose={() => setIsCarriersModalOpen(false)}
        tenantId={tenantId ?? ''}
      />

      {/* Modal / Popup de Código QR de Despacho */}
      {selectedQrDispatch && (
        <Popup
          open={!!selectedQrDispatch}
          onClose={() => setSelectedQrDispatch(null)}
          title={`Código QR — Acta ${selectedQrDispatch.dispatchNumber}`}
          width={420}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '0.5rem 0' }}>
            <p className="ecu-modal-section-lead" style={{ margin: 0, textAlign: 'center', fontSize: '0.8125rem' }}>
              Escanea este código desde cualquier celular para verificar el acta oficial del transportista{' '}
              <strong>{selectedQrDispatch.carrierName || 'asignado'}</strong>.
            </p>

            <div
              style={{
                background: '#ffffff',
                padding: '12px',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  `${window.location.origin}/verificar/despacho/${selectedQrDispatch.verificationHash}`
                )}`}
                alt="Código QR de verificación oficial"
                style={{ width: 180, height: 180, display: 'block' }}
              />
            </div>

            <div style={{ textAlign: 'center', maxWidth: '340px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', marginBottom: '0.25rem' }}>
                Firma criptográfica:
              </div>
              <code
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.6875rem',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'var(--glb-surface-muted, rgba(0,0,0,0.04))',
                  borderRadius: '6px',
                  border: '1px solid var(--shell-border)',
                  wordBreak: 'break-all',
                  display: 'inline-block',
                }}
              >
                {selectedQrDispatch.verificationHash}
              </code>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', paddingTop: '0.5rem' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${window.location.origin}/verificar/despacho/${selectedQrDispatch.verificationHash}`
                  )
                  toast.show({ title: 'Enlace copiado', message: 'URL de verificación en el portapapeles.', variant: 'success' })
                }}
              >
                <Copy size={14} strokeWidth={2} aria-hidden />
                Copiar enlace
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  window.open(`${window.location.origin}/verificar/despacho/${selectedQrDispatch.verificationHash}`, '_blank')
                }
              >
                <ExternalLink size={14} strokeWidth={2} aria-hidden />
                Abrir portal público
              </Button>
            </div>
          </div>
        </Popup>
      )}
    </TenantSessionGate>
  )
}

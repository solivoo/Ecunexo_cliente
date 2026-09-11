import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, DataGrid, useToast, type ColumnDef, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { ArrowLeft, Copy, ExternalLink, FileDown, FileText, QrCode } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { downloadDispatchDeliveryNotePdf } from '@/pages/repairs/pdf/dispatchPdfDownloads'
import { createAndLinkDispatchInvoice } from '@/pages/repairs/dispatchInvoiceHelper'
import {
  getDispatchInvoicePreview,
  getRepairBatch,
  getRepairDispatch,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  damageLevelBadgeTone,
  damageLevelLabel,
  RepairDispatchStatus,
  type BatchDetailDto,
  type DispatchInvoicePreviewDto,
  type RepairDispatchDto,
  type RepairEquipmentDto,
} from '@/types/repairsApi'

type EqRow = RepairEquipmentDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('equipo', 'equipos')

function dispatchStatusBadge(status: RepairDispatchStatus) {
  switch (status) {
    case RepairDispatchStatus.Invoiced:
      return <StatusBadge tone="success" withDot>Facturado</StatusBadge>
    case RepairDispatchStatus.Confirmed:
      return <StatusBadge tone="primary" withDot>Confirmado</StatusBadge>
    default:
      return <StatusBadge tone="neutral" withDot>Borrador</StatusBadge>
  }
}

export function RepairDispatchDetailPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { dispatchId = '' } = useParams()
  const tenantId = useAppSelector(selectTenantId)

  const canRead = useHasPermission('repairs.dispatches.read')
  const canInvoice =
    useHasPermission('repairs.invoices.generate') ||
    useHasPermission('repairs.dispatches.create') ||
    useHasPermission('facturacion.facturas.create')

  const [dispatch, setDispatch] = useState<RepairDispatchDto | null>(null)
  const [batch, setBatch] = useState<BatchDetailDto | null>(null)
  const [preview, setPreview] = useState<DispatchInvoicePreviewDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [invoicing, setInvoicing] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId || !dispatchId) return
      setLoading(true)
      try {
        const d = await getRepairDispatch(tenantId, dispatchId)
        setDispatch(d)
        const [b, invPreview] = await Promise.all([
          getRepairBatch(tenantId, d.batchId).catch(() => null),
          d.status === RepairDispatchStatus.Confirmed && !d.invoiceId
            ? getDispatchInvoicePreview(tenantId, dispatchId).catch(() => null)
            : Promise.resolve(null),
        ])
        setBatch(b)
        setPreview(invPreview)
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Acta sincronizada.', variant: 'success' })
        }
      } catch (err: unknown) {
        const msg = readApiError(err, 'No se pudo cargar el acta de despacho.')
        setError(msg)
        setDispatch(null)
        toast.show({ title: 'Error', message: msg, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, dispatchId, toast]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  const publicVerifyUrl = useMemo(() => {
    if (!dispatch?.verificationHash) return ''
    return `${window.location.origin}/verificar/despacho/${dispatch.verificationHash}`
  }, [dispatch])

  const equipments = useMemo(
    () =>
      (dispatch?.items ?? [])
        .map((i) => i.equipment)
        .filter((e): e is RepairEquipmentDto => Boolean(e)),
    [dispatch]
  )

  const columns = useMemo(
    (): ColumnDef<EqRow>[] => [
      {
        key: 'serialNumber',
        header: 'Serie',
        width: 160,
        sortable: true,
        renderCell: (_v, row) => (
          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{row.serialNumber}</span>
        ),
      },
      { key: 'model', header: 'Modelo', width: 200, sortable: true },
      { key: 'brand', header: 'Marca', width: 120, sortable: true },
      {
        key: 'damageLevel',
        header: 'Nivel',
        width: 180,
        renderCell: (_v, row) => (
          <StatusBadge tone={damageLevelBadgeTone(row.damageLevel)}>
            {damageLevelLabel(row.damageLevel)}
          </StatusBadge>
        ),
      },
    ],
    []
  )

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = [
      {
        id: 'refresh',
        label: 'Actualizar',
        icon: 'refresh-cw',
        route: null,
        disabled: loading,
      },
      {
        id: 'list',
        label: 'Lista de actas',
        icon: 'truck',
        route: '/taller/despachos',
        disabled: false,
      },
    ]
    if (dispatch?.batchId) {
      items.push({
        id: 'batch',
        label: 'Ver lote origen',
        icon: 'layers',
        route: `/taller/lotes/${dispatch.batchId}`,
        disabled: false,
      })
    }
    return items
  }, [loading, dispatch?.batchId])

  const copyVerifyUrl = async () => {
    if (!publicVerifyUrl) return
    await navigator.clipboard.writeText(publicVerifyUrl)
    toast.show({
      title: 'Enlace copiado',
      message: 'URL de verificación pública en el portapapeles.',
      variant: 'success',
    })
  }

  const handleDownloadPdf = async () => {
    if (!tenantId || !dispatch) return
    setDownloadingPdf(true)
    try {
      toast.show({ title: 'Generando PDF', message: 'Preparando acta oficial de despacho...', variant: 'info' })
      const { filename } = await downloadDispatchDeliveryNotePdf(tenantId, dispatch, batch)
      toast.show({
        title: 'PDF Generado',
        message: `Acta descargada con éxito: ${filename}`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al generar PDF',
        message: readApiError(err, 'No se pudo generar el documento PDF del acta.'),
        variant: 'error',
      })
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleInvoice = async () => {
    if (!tenantId || !dispatch) return
    if (!canInvoice) {
      toast.show({
        title: 'Sin permiso',
        message: 'Necesitas permiso para generar la factura del despacho.',
        variant: 'error',
      })
      return
    }
    if (preview && !preview.canInvoice) {
      toast.show({
        title: 'No facturable',
        message: preview.blockingReason ?? 'Este despacho no puede facturarse aún.',
        variant: 'error',
      })
      return
    }

    setInvoicing(true)
    try {
      await createAndLinkDispatchInvoice(tenantId, dispatch.id)
      toast.show({
        title: 'Borrador de factura creado',
        message: `Factura vinculada al acta ${dispatch.dispatchNumber}. Continúa la emisión SRI en Facturación.`,
        variant: 'success',
      })
      await load({ silent: true })
      navigate(`/facturacion/comprobantes`)
    } catch (err: unknown) {
      toast.show({
        title: 'Error al facturar',
        message: readApiError(err, 'No se pudo generar el borrador de factura.'),
        variant: 'error',
      })
    } finally {
      setInvoicing(false)
    }
  }

  if (!canRead) {
    return (
      <TenantSessionGate title="Acta de Despacho" lead="Detalle y facturación del acta.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso restringido"
            subtitle="Requieres repairs.dispatches.read."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Acta de Despacho"
      lead="Certificación QR, equipos incluidos y facturación del servicio."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title={dispatch ? `Acta ${dispatch.dispatchNumber}` : 'Acta de Despacho'}
          subtitle={
            batch
              ? `Lote ${batch.batchNumber} · ${batch.customerName}`
              : 'Detalle operativo del despacho parcial o total'
          }
          badge={dispatch ? dispatchStatusBadge(dispatch.status) : undefined}
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => navigate('/taller/despachos')}>
                <ArrowLeft size={16} strokeWidth={2} aria-hidden />
                Volver
              </Button>
              {dispatch && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDownloadPdf()}
                  disabled={downloadingPdf}
                >
                  <FileDown size={16} strokeWidth={2} aria-hidden />
                  {downloadingPdf ? 'Generando PDF...' : 'Descargar Acta (PDF)'}
                </Button>
              )}
              {dispatch && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (publicVerifyUrl) {
                      window.open(publicVerifyUrl, '_blank')
                    }
                  }}
                  disabled={!publicVerifyUrl}
                >
                  <QrCode size={16} strokeWidth={2} aria-hidden />
                  Verificación QR
                </Button>
              )}
              {dispatch && !dispatch.invoiceId && dispatch.status === RepairDispatchStatus.Confirmed && canInvoice && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleInvoice()}
                  disabled={invoicing || !preview?.canInvoice}
                >
                  <FileText size={16} strokeWidth={2} aria-hidden />
                  {invoicing ? 'Generando factura...' : 'Facturar despacho'}
                </Button>
              )}
              {dispatch?.invoiceId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/facturacion/comprobantes')}
                >
                  Ver facturación
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
          <StatCard
            label="Equipos en acta"
            value={String(dispatch?.items?.length ?? 0)}
            icon="inventory_2"
            toneColor="var(--shell-primary)"
          />
          <StatCard
            label="Salida"
            value={dispatch?.dispatchedAt ? formatDateTime(dispatch.dispatchedAt) : '—'}
            icon="local_shipping"
            toneColor="var(--shell-primary)"
          />
          <StatCard
            label="Estimado factura"
            value={preview ? `$${preview.subtotal.toFixed(2)}` : dispatch?.invoiceId ? 'Vinculada' : '—'}
            icon="payments"
            toneColor="var(--shell-primary)"
            footerText={preview ? `+ IVA ≈ $${preview.taxTotal.toFixed(2)}` : undefined}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <SectionCard title="Transportista" subtitle="Datos registrados en el acta">
            <div className="ecu-modal-meta-list" style={{ border: 'none', padding: 0, background: 'transparent' }}>
              <div className="ecu-modal-meta-list__row">
                <span className="ecu-modal-meta-list__label">Conductor</span>
                <span className="ecu-modal-meta-list__value">{dispatch?.carrierName ?? '—'}</span>
              </div>
              <div className="ecu-modal-meta-list__row">
                <span className="ecu-modal-meta-list__label">Documento</span>
                <span className="ecu-modal-meta-list__value">{dispatch?.carrierDocument ?? '—'}</span>
              </div>
              <div className="ecu-modal-meta-list__row">
                <span className="ecu-modal-meta-list__label">Placa</span>
                <span className="ecu-modal-meta-list__value" style={{ fontFamily: 'ui-monospace, monospace' }}>
                  {dispatch?.carrierVehiclePlate ?? '—'}
                </span>
              </div>
              {dispatch?.notes && (
                <div className="ecu-modal-meta-list__row">
                  <span className="ecu-modal-meta-list__label">Notas</span>
                  <span className="ecu-modal-meta-list__value">{dispatch.notes}</span>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Verificación QR"
            subtitle="Consulta pública sin autenticación"
            action={
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => void copyVerifyUrl()} disabled={!publicVerifyUrl}>
                  <Copy size={14} strokeWidth={2} aria-hidden />
                  Copiar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(publicVerifyUrl, '_blank')}
                  disabled={!publicVerifyUrl}
                >
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                  Abrir
                </Button>
              </div>
            }
          >
            {dispatch ? (
              <div className="ecu-modal-qr">
                <div className="ecu-modal-qr__frame">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicVerifyUrl)}`}
                    alt="Código QR de verificación"
                  />
                </div>
                <span className="ecu-modal-qr__hash">Hash: {dispatch.verificationHash}</span>
                <p className="ecu-modal-section-lead">
                  El transportista o auditor puede validar las series autorizadas escaneando este código.
                </p>
              </div>
            ) : (
              <EmptyState
                className="ecu-empty-state--compact"
                icon={<QrCode size={22} strokeWidth={1.75} aria-hidden />}
                title={loading ? 'Cargando...' : 'Sin datos'}
                description="No hay información de verificación disponible."
              />
            )}
          </SectionCard>
        </div>

        {preview && !dispatch?.invoiceId && (
          <SectionCard
            title="Vista previa de factura"
            subtitle="Líneas agrupadas por nivel de daño según tarifas N1/N2/N3 del lote"
            action={
              <StatusBadge tone="primary" withDot>
                Por Facturar
              </StatusBadge>
            }
          >
            <div className="ecu-modal-meta-list">
              {preview.lines.map((line) => (
                <div key={line.damageLevel} className="ecu-modal-meta-list__row">
                  <span className="ecu-modal-meta-list__label">{line.description}</span>
                  <span className="ecu-modal-meta-list__value">
                    {line.quantity} × ${line.unitPrice.toFixed(2)} = ${line.lineSubtotal.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="ecu-modal-meta-list__row">
                <span className="ecu-modal-meta-list__label">Subtotal</span>
                <span className="ecu-modal-meta-list__value">${preview.subtotal.toFixed(2)}</span>
              </div>
              <div className="ecu-modal-meta-list__row">
                <span className="ecu-modal-meta-list__label">IVA (15%)</span>
                <span className="ecu-modal-meta-list__value">${preview.taxTotal.toFixed(2)}</span>
              </div>
              <div className="ecu-modal-meta-list__row">
                <span className="ecu-modal-meta-list__label">Total estimado</span>
                <span
                  className="ecu-modal-meta-list__value"
                  style={{ color: 'var(--shell-primary)', fontWeight: 700 }}
                >
                  ${preview.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
            {!preview.canInvoice && preview.blockingReason && (
              <p
                className="ecu-modal-section-lead"
                style={{ marginTop: '0.75rem', color: 'var(--shell-danger, #f87171)' }}
              >
                {preview.blockingReason}
              </p>
            )}
            {canInvoice && preview.canInvoice && (
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleInvoice()}
                  disabled={invoicing}
                >
                  <FileText size={16} strokeWidth={2} aria-hidden />
                  {invoicing ? 'Generando factura...' : 'Emitir factura por este despacho'}
                </Button>
              </div>
            )}
          </SectionCard>
        )}

        {dispatch?.invoiceId && (
          <SectionCard
            title="Facturación electrónica SRI"
            subtitle="Comprobante de venta vinculado a esta acta de salida"
            action={
              <Button
                type="button"
                variant="primary"
                onClick={() => navigate('/facturacion/comprobantes')}
              >
                <FileText size={16} strokeWidth={2} aria-hidden />
                Ver en Comprobantes SRI
              </Button>
            }
          >
            <div className="ecu-modal-meta-list">
              <div className="ecu-modal-meta-list__row">
                <span className="ecu-modal-meta-list__label">Estado del comprobante</span>
                <span className="ecu-modal-meta-list__value">
                  <StatusBadge tone="success" withDot>
                    Factura Vinculada
                  </StatusBadge>
                </span>
              </div>
              <div className="ecu-modal-meta-list__row">
                <span className="ecu-modal-meta-list__label">ID de factura</span>
                <span
                  className="ecu-modal-meta-list__value"
                  style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
                >
                  {dispatch.invoiceId}
                </span>
              </div>
            </div>
            <p className="ecu-modal-section-lead" style={{ marginTop: '0.75rem' }}>
              Este despacho ya tiene una factura electrónica generada con los equipos y tarifas del lote. Puedes firmarla o consultar la autorización SRI desde el módulo de Facturación.
            </p>
          </SectionCard>
        )}

        <SectionCard title={`Equipos despachados (${equipments.length})`}>
          {loading ? (
            <p className="ecu-modal-section-lead" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              Cargando...
            </p>
          ) : equipments.length === 0 ? (
            <EmptyState
              className="ecu-empty-state--compact"
              icon="inventory_2"
              title="Sin detalle de equipos"
              description="El acta no incluye equipos o aún no se cargó el detalle."
            />
          ) : (
            <DataGrid<EqRow>
              className="ecu-repairs-grid"
              columns={columns}
              dataSource={equipments as EqRow[]}
              keyExpr="id"
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar serie o modelo..."
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
              fullWidth
            />
          )}
        </SectionCard>

        <SectionCard
          title="Firmas de Responsabilidad y Traspaso de Custodia"
          subtitle="Acreditación física y técnica del retiro de equipos del taller"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '0.5rem' }}>
            <div
              style={{
                border: '1px solid var(--shell-border)',
                borderRadius: '8px',
                padding: '1.25rem',
                backgroundColor: 'var(--glb-surface)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--shell-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Quien Solicita / Conductor / Retiro
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--glb-text)', marginTop: '0.5rem' }}>
                  {dispatch?.carrierName || 'No registrado en formulario'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted)', marginTop: '0.25rem' }}>
                  C.I. / Documento: {dispatch?.carrierDocument || 'No registrado'}
                </div>
                {dispatch?.carrierVehiclePlate && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted)', marginTop: '0.25rem' }}>
                    Vehículo: <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{dispatch.carrierVehiclePlate}</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '2.5rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--shell-border)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                Firma y Huella de Recepción Conforme
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--shell-border)',
                borderRadius: '8px',
                padding: '1.25rem',
                backgroundColor: 'var(--glb-surface)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--shell-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Quien Aprueba la Salida / Taller
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--glb-text)', marginTop: '0.5rem' }}>
                  Responsable de Control Técnico y Despacho
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted)', marginTop: '0.25rem' }}>
                  Fecha y Hora: {dispatch?.dispatchedAt ? formatDateTime(dispatch.dispatchedAt) : dispatch?.createdAt ? formatDateTime(dispatch.createdAt) : '—'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted)', marginTop: '0.25rem' }}>
                  Estado Operativo: {dispatch?.status === 2 ? 'Facturado' : 'Salida Autorizada'}
                </div>
              </div>
              <div style={{ marginTop: '2.5rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--shell-border)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
                Firma de Aprobación y Sello del Taller
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

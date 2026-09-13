import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { ArrowLeft, Copy, ExternalLink, Eye, FileDown, QrCode } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { downloadDispatchDeliveryNotePdf } from '@/pages/repairs/pdf/dispatchPdfDownloads'
import { downloadInvoiceRide } from '@/pages/facturacion/invoiceDownloads'
import { ensureBillingEmitter, loadIssuerDefaults } from '@/pages/facturacion/invoiceEmitApi'
import { getInvoiceDetail } from '@/services/billingApi'
import {
  getRepairBatch,
  getRepairDispatch,
} from '@/services/repairsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { InvoiceDetail } from '@/types/billingApi'
import {
  DamageLevel,
  damageLevelBadgeTone,
  damageLevelLabel,
  dispatchExitTypeBadgeTone,
  dispatchExitTypeLabel,
  RepairDispatchStatus,
  repairEquipmentStatusBadgeTone,
  repairEquipmentStatusLabel,
  type BatchDetailDto,
  type RepairDispatchDto,
  type RepairEquipmentDto,
} from '@/types/repairsApi'

type EqRow = RepairEquipmentDto & { actions?: unknown } & Record<string, unknown>

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

  const [dispatch, setDispatch] = useState<RepairDispatchDto | null>(null)
  const [batch, setBatch] = useState<BatchDetailDto | null>(null)
  const [linkedInvoice, setLinkedInvoice] = useState<InvoiceDetail | null>(null)
  const [emitterId, setEmitterId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingRide, setDownloadingRide] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId || !dispatchId) return
      setLoading(true)
      try {
        const d = await getRepairDispatch(tenantId, dispatchId)
        setDispatch(d)

        let resolvedEmitterId: string | null = null
        if (d.invoiceId) {
          try {
            const defaults = await loadIssuerDefaults(tenantId)
            resolvedEmitterId = await ensureBillingEmitter({
              emitterRuc: defaults.emitterRuc,
              company: defaults.company,
              companyLabel: defaults.company?.legalName || '',
              tenantId,
            })
            setEmitterId(resolvedEmitterId)
          } catch {
            // Continuar si aún no hay emisor configurado
          }
        }

        const [b, invDetail] = await Promise.all([
          getRepairBatch(tenantId, d.batchId).catch(() => null),
          d.invoiceId && resolvedEmitterId
            ? getInvoiceDetail(resolvedEmitterId, d.invoiceId).catch(() => null)
            : Promise.resolve(null),
        ])
        setBatch(b)
        setLinkedInvoice(invDetail)
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

  const damageBreakdown = useMemo(() => {
    let n1 = 0
    let n2 = 0
    let n3 = 0
    let irr = 0
    for (const eq of equipments) {
      if (eq.damageLevel === DamageLevel.Level1) n1++
      else if (eq.damageLevel === DamageLevel.Level2) n2++
      else if (eq.damageLevel === DamageLevel.Level3) n3++
      else if (eq.damageLevel === DamageLevel.Irreparable) irr++
    }
    return { n1, n2, n3, irr }
  }, [equipments])

  const columns = useMemo(
    (): ColumnDef<EqRow>[] => [
      {
        key: 'serialNumber',
        header: 'Serie',
        width: 170,
        sortable: true,
        renderCell: (_v, row) => (
          <button
            type="button"
            onClick={() => {
              if (dispatch?.batchId) {
                navigate(`/taller/lotes/${dispatch.batchId}/equipos/${row.id}`)
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 700,
              color: 'var(--shell-primary)',
              textDecoration: 'underline',
              textAlign: 'left',
            }}
            title="Ver ficha técnica y fotos del equipo"
          >
            {row.serialNumber}
          </button>
        ),
      },
      { key: 'model', header: 'Modelo', width: 180, sortable: true },
      { key: 'brand', header: 'Marca', width: 120, sortable: true },
      {
        key: 'damageLevel',
        header: 'Nivel',
        width: 150,
        renderCell: (_v, row) => (
          <StatusBadge tone={damageLevelBadgeTone(row.damageLevel)}>
            {damageLevelLabel(row.damageLevel)}
          </StatusBadge>
        ),
      },
      {
        key: 'status',
        header: 'Estado Técnico',
        width: 160,
        renderCell: (_v, row) => (
          <StatusBadge tone={repairEquipmentStatusBadgeTone(row.status)}>
            {repairEquipmentStatusLabel(row.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'actions',
        header: 'Acciones',
        width: 80,
        align: 'center',
        renderCell: (_v: unknown, row: EqRow) => (
          <GridIconButton
            icon={Eye}
            label="Ver ficha técnica"
            onClick={() => {
              if (dispatch?.batchId) {
                navigate(`/taller/lotes/${dispatch.batchId}/equipos/${row.id}`)
              }
            }}
          />
        ),
      },
    ],
    [dispatch?.batchId, navigate]
  )

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (dispatch?.batchId) {
      items.push({
        id: 'batch',
        label: 'Ver lote origen',
        icon: 'layers',
        route: `/taller/lotes/${dispatch.batchId}`,
        disabled: false,
      })
    }
    if (publicVerifyUrl) {
      items.push({
        id: 'public-qr',
        label: 'Abrir verificación QR',
        icon: 'qr-code',
        route: null,
        disabled: false,
      })
      items.push({
        id: 'copy-url',
        label: 'Copiar enlace QR',
        icon: 'copy',
        route: null,
        disabled: false,
      })
    }
    items.push({
      id: 'refresh',
      label: 'Actualizar',
      icon: 'refresh-cw',
      route: null,
      disabled: loading,
    })
    return items
  }, [dispatch?.batchId, publicVerifyUrl, loading])

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

  const handleDownloadRide = async () => {
    if (!tenantId || !dispatch?.invoiceId) return
    setDownloadingRide(true)
    try {
      toast.show({ title: 'Generando RIDE', message: 'Preparando PDF oficial del comprobante SRI...', variant: 'info' })
      let emId = emitterId
      if (!emId) {
        const defaults = await loadIssuerDefaults(tenantId)
        emId = await ensureBillingEmitter({
          emitterRuc: defaults.emitterRuc,
          company: defaults.company,
          companyLabel: defaults.company?.legalName || '',
          tenantId,
        })
        setEmitterId(emId)
      }
      const { filename } = await downloadInvoiceRide(emId, dispatch.invoiceId)
      toast.show({
        title: 'RIDE Descargado',
        message: `Comprobante descargado: ${filename}`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al descargar RIDE',
        message: readApiError(err, 'No se pudo generar el RIDE de la factura.'),
        variant: 'error',
      })
    } finally {
      setDownloadingRide(false)
    }
  }

  if (!canRead) {
    return (
      <TenantSessionGate title="Acta de Despacho" lead="Detalle y entrega del acta de despacho.">
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
      lead="Certificación QR, equipos incluidos y entrega de taller."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title={dispatch ? `Acta ${dispatch.dispatchNumber}` : 'Acta de Despacho'}
          subtitle={
            batch
              ? `Lote ${batch.batchNumber} · ${batch.customerName}`
              : dispatch?.batchNumber
                ? `Lote ${dispatch.batchNumber} · ${dispatch.customerName ?? 'Taller'}`
                : 'Detalle operativo del despacho de equipos'
          }
          badge={
            dispatch ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {dispatchStatusBadge(dispatch.status)}
                <StatusBadge tone={dispatchExitTypeBadgeTone(dispatch.exitType)}>
                  {dispatchExitTypeLabel(dispatch.exitType)}
                </StatusBadge>
              </div>
            ) : undefined
          }
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
              {dispatch?.invoiceId && (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => void handleDownloadRide()}
                    disabled={downloadingRide}
                  >
                    <FileDown size={16} strokeWidth={2} aria-hidden />
                    {downloadingRide ? 'Generando RIDE...' : 'Descargar RIDE'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/facturacion/comprobantes')}
                  >
                    <ExternalLink size={16} strokeWidth={2} aria-hidden />
                    Ver en SRI
                  </Button>
                </>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Más opciones"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={(item) => {
                  if (item.id === 'refresh') void load()
                  if (item.id === 'public-qr' && publicVerifyUrl) window.open(publicVerifyUrl, '_blank')
                  if (item.id === 'copy-url') void copyVerifyUrl()
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

        {/* Franja de Indicadores KPI */}
        <div className="ecu-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <StatCard
            label="Equipos en acta"
            value={String(dispatch?.items?.length ?? 0)}
            icon="inventory_2"
            toneColor="var(--shell-primary)"
            footerText={
              equipments.length > 0
                ? `N1: ${damageBreakdown.n1} · N2: ${damageBreakdown.n2} · N3: ${damageBreakdown.n3}${
                    damageBreakdown.irr > 0 ? ` · Irr: ${damageBreakdown.irr}` : ''
                  }`
                : undefined
            }
          />
          <StatCard
            label="Tipo de salida"
            value={dispatch ? dispatchExitTypeLabel(dispatch.exitType) : '—'}
            icon="local_shipping"
            toneColor="var(--shell-primary)"
            footerText="Egreso autorizado de taller"
          />
          <StatCard
            label="Salida del taller"
            value={dispatch?.dispatchedAt ? formatDateTime(dispatch.dispatchedAt) : 'En preparación'}
            icon="event_available"
            toneColor="var(--shell-primary)"
            footerText={dispatch?.dispatchedAt ? 'Fecha y hora de retiro' : 'Pendiente de entrega'}
          />
          {dispatch?.invoiceId && (
            <StatCard
              label="Comprobante SRI"
              value={
                linkedInvoice
                  ? `${linkedInvoice.establishment}-${linkedInvoice.emissionPoint}-${linkedInvoice.sequential}`
                  : 'Facturado'
              }
              icon="description"
              toneColor="var(--shell-success, #10b981)"
              footerText="RIDE oficial disponible"
            />
          )}
        </div>

        {/* Datos del Despacho y Transportista */}
        <SectionCard
          title="Datos del Despacho"
          subtitle="Custodia de transporte y certificación"
          action={
            publicVerifyUrl ? (
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQrModal(true)}
                >
                  <QrCode size={14} strokeWidth={2} aria-hidden />
                  Ver Código QR
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(publicVerifyUrl, '_blank')}
                >
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                  Abrir portal móvil
                </Button>
              </div>
            ) : undefined
          }
        >
          <div className="ecu-property-grid">
            <div className="ecu-property-tile">
              <span className="ecu-property-tile__label">Conductor / Transportista</span>
              <span className="ecu-property-tile__value">{dispatch?.carrierName || '—'}</span>
            </div>
            <div className="ecu-property-tile">
              <span className="ecu-property-tile__label">C.I. / Documento</span>
              <span className="ecu-property-tile__value">{dispatch?.carrierDocument || '—'}</span>
            </div>
            <div className="ecu-property-tile">
              <span className="ecu-property-tile__label">Vehículo / Placa</span>
              <span className="ecu-property-tile__value ecu-property-tile__value--mono">
                {dispatch?.carrierVehiclePlate || '—'}
              </span>
            </div>
            {dispatch?.batchId && (
              <div className="ecu-property-tile">
                <span className="ecu-property-tile__label">Lote Origen</span>
                <span className="ecu-property-tile__value">
                  <button
                    type="button"
                    onClick={() => navigate(`/taller/lotes/${dispatch.batchId}`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--shell-primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontWeight: 600,
                      fontSize: 'inherit',
                    }}
                  >
                    {batch?.batchNumber ? `Lote ${batch.batchNumber}` : 'Ver lote'}
                  </button>
                </span>
              </div>
            )}
            {dispatch?.invoiceId && (
              <div className="ecu-property-tile">
                <span className="ecu-property-tile__label">Factura SRI</span>
                <span className="ecu-property-tile__value">
                  <span className="ecu-property-tile__value--mono">
                    {linkedInvoice
                      ? `${linkedInvoice.establishment}-${linkedInvoice.emissionPoint}-${linkedInvoice.sequential}`
                      : 'Factura vinculada'}
                  </span>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => void handleDownloadRide()}
                    disabled={downloadingRide}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                  >
                    <FileDown size={13} strokeWidth={2} aria-hidden />
                    {downloadingRide ? '...' : 'Descargar RIDE'}
                  </Button>
                </span>
              </div>
            )}
            {dispatch?.notes && (
              <div className="ecu-property-tile ecu-property-tile--full">
                <span className="ecu-property-tile__label">Notas / Observaciones</span>
                <span className="ecu-property-tile__value" style={{ fontWeight: 500 }}>
                  {dispatch.notes}
                </span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Tabla de Equipos Despachados con enlaces interactivos */}
        <SectionCard
          title={`Equipos despachados (${equipments.length})`}
          subtitle="Haz clic en cualquier número de serie o en el botón para ver su ficha técnica individual"
        >
          {loading ? (
            <p className="ecu-modal-section-lead" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              Cargando detalle de equipos...
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
              searchPlaceholder="Buscar serie, modelo o marca..."
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
              fullWidth
            />
          )}
        </SectionCard>

        {/* Custodia y Responsabilidad */}
        <SectionCard
          title="Custodia y Responsabilidad"
          subtitle="Responsables del retiro y autorización de salida"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
            <div className="ecu-property-tile" style={{ padding: '0.85rem 1rem' }}>
              <span className="ecu-property-tile__label">Recepción / Conductor</span>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--shell-text)' }}>
                {dispatch?.carrierName || 'No registrado'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted)' }}>
                C.I. {dispatch?.carrierDocument || '—'} {dispatch?.carrierVehiclePlate ? `· Placa: ${dispatch.carrierVehiclePlate}` : ''}
              </div>
            </div>

            <div className="ecu-property-tile" style={{ padding: '0.85rem 1rem' }}>
              <span className="ecu-property-tile__label">Autorización / Taller</span>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--shell-text)' }}>
                Control Técnico y Despacho
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--glb-muted)' }}>
                {dispatch?.dispatchedAt ? formatDateTime(dispatch.dispatchedAt) : 'Pendiente de entrega'} · {dispatch?.status === RepairDispatchStatus.Invoiced ? 'Facturado SRI' : 'Salida Autorizada'}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Modal / Popup de Código QR */}
      {dispatch && publicVerifyUrl && (
        <Popup
          open={showQrModal}
          onClose={() => setShowQrModal(false)}
          title={`Código QR — Acta ${dispatch.dispatchNumber}`}
          width={420}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '0.5rem 0' }}>
            <p className="ecu-modal-section-lead" style={{ margin: 0, textAlign: 'center', fontSize: '0.8125rem' }}>
              Escanea este código desde un teléfono móvil para validar la autenticidad del acta de entrega emitida por el taller.
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
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicVerifyUrl)}`}
                alt="Código QR de verificación oficial"
                style={{ width: 180, height: 180, display: 'block' }}
              />
            </div>

            <div style={{ textAlign: 'center', maxWidth: '340px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)', marginBottom: '0.25rem' }}>
                Firma criptográfica del acta:
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
                {dispatch.verificationHash}
              </code>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', paddingTop: '0.5rem' }}>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyVerifyUrl()}>
                <Copy size={14} strokeWidth={2} aria-hidden />
                Copiar enlace
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => window.open(publicVerifyUrl, '_blank')}
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


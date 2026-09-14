import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, OptionGroup, Popup, useToast, type ColumnDef } from 'glubox'
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Navigation,
  Plus,
  RefreshCw,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { GridDateRangeBox } from '@/components/ui/GridDateRangeBox'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useGridDateRange } from '@/hooks/useGridDateRange'
import { useHasPermission } from '@/hooks/useHasPermission'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  downloadRemisionGuideXml,
  getRemisionGuideById,
  listRemisionGuides,
  updateRemisionGuideStatus,
} from '@/services/remisionGuidesApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  RemisionGuideStatus,
  type RemisionGuideDetailDto,
  type RemisionGuideSummaryDto,
} from '@/types/remisionGuidesApi'

type RemisionRow = RemisionGuideSummaryDto & Record<string, unknown>

export function RemisionGuidesListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('facturacion.guias.remision.read') ||
    useHasPermission('facturacion.read') ||
    useHasPermission('facturacion.comprobantes.read')
  const canCreate =
    useHasPermission('facturacion.guias.remision.create') ||
    useHasPermission('facturacion.read')

  const { from, to, lookback, setRange } = useGridDateRange()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [guides, setGuides] = useState<RemisionGuideSummaryDto[]>([])
  const [stats, setStats] = useState({
    total: 0,
    authorized: 0,
    inTransit: 0,
    delivered: 0,
    draft: 0,
  })

  // Detalle para inspección
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null)
  const [detailGuide, setDetailGuide] = useState<RemisionGuideDetailDto | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let statusEnum: RemisionGuideStatus | undefined
      if (statusFilter === 'in_transit') statusEnum = RemisionGuideStatus.InTransit
      else if (statusFilter === 'authorized') statusEnum = RemisionGuideStatus.Authorized
      else if (statusFilter === 'delivered') statusEnum = RemisionGuideStatus.Delivered
      else if (statusFilter === 'draft') statusEnum = RemisionGuideStatus.Draft

      const response = await listRemisionGuides(tenantId, {
        status: statusEnum,
        from: from || undefined,
        to: to || undefined,
      })

      setGuides(response.guides as RemisionGuideSummaryDto[])
      setStats({
        total: response.totalCount,
        authorized: response.authorizedCount,
        inTransit: response.inTransitCount,
        delivered: response.deliveredCount,
        draft: response.draftCount,
      })
    } catch (err) {
      toast.show({
        title: 'Error al consultar guías',
        message: readApiError(err, 'No se pudieron cargar las guías de remisión.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [from, statusFilter, tenantId, to, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleStatusChange = async (guide: RemisionGuideSummaryDto, newStatus: RemisionGuideStatus) => {
    if (!tenantId) return
    setUpdatingId(guide.id)
    try {
      await updateRemisionGuideStatus(tenantId, guide.id, { newStatus })
      toast.show({
        title: 'Estado actualizado',
        message: `La guía ${guide.documentNumber} cambió de estado correctamente.`,
        variant: 'success',
      })
      void loadData()
    } catch (err) {
      toast.show({
        title: 'Error al actualizar',
        message: readApiError(err, 'No se pudo actualizar el estado de la guía.'),
        variant: 'error',
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDownloadXml = async (guide: RemisionGuideSummaryDto) => {
    if (!tenantId) return
    try {
      await downloadRemisionGuideXml(tenantId, guide.id, guide.documentNumber)
      toast.show({
        title: 'XML Descargado',
        message: `Guía ${guide.documentNumber} descargada en XML oficial SRI.`,
        variant: 'success',
      })
    } catch (err) {
      toast.show({
        title: 'Error de descarga',
        message: readApiError(err, 'No se pudo descargar el archivo XML del comprobante.'),
        variant: 'error',
      })
    }
  }

  const handleViewDetail = async (guideId: string) => {
    if (!tenantId) return
    setSelectedGuideId(guideId)
    setLoadingDetail(true)
    try {
      const data = await getRemisionGuideById(tenantId, guideId)
      setDetailGuide(data)
    } catch (err) {
      toast.show({
        title: 'Error de consulta',
        message: readApiError(err, 'No se pudo cargar el detalle de la guía.'),
        variant: 'error',
      })
      setSelectedGuideId(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const columns = useMemo((): ColumnDef<RemisionRow>[] => [
    {
      key: 'documentNumber',
      header: 'Comprobante SRI',
      width: 160,
      renderCell: (_val: unknown, row: RemisionRow) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--glb-text)' }}>
            {row.documentNumber}
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>
            {row.issueDate}
          </div>
        </div>
      ),
    },
    {
      key: 'licensePlate',
      header: 'Vehículo / Placa',
      width: 140,
      renderCell: (_val: unknown, row: RemisionRow) => (
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'color-mix(in srgb, var(--glb-primary) 10%, transparent)',
            color: 'var(--glb-primary)',
            letterSpacing: '0.05em',
          }}
        >
          {row.licensePlate}
        </span>
      ),
    },
    {
      key: 'carrierName',
      header: 'Transportista / Chofer',
      width: 220,
      renderCell: (_val: unknown, row: RemisionRow) => (
        <div title={row.carrierName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 500 }}>{row.carrierName}</span>
        </div>
      ),
    },
    {
      key: 'recipientName',
      header: 'Destinatario',
      width: 200,
      renderCell: (_val: unknown, row: RemisionRow) => (
        <div title={row.recipientName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span>{row.recipientName}</span>
        </div>
      ),
    },
    {
      key: 'routeDescription',
      header: 'Ruta de Traslado',
      width: 220,
      renderCell: (_val: unknown, row: RemisionRow) => (
        <div
          title={row.routeDescription}
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.8125rem',
            color: 'var(--glb-muted)',
          }}
        >
          <Navigation size={12} style={{ display: 'inline', marginRight: 4 }} />
          {row.routeDescription}
        </div>
      ),
    },
    {
      key: 'startDate',
      header: 'Fechas Traslado',
      width: 170,
      renderCell: (_val: unknown, row: RemisionRow) => (
        <div style={{ fontSize: '0.8125rem' }}>
          <div>{row.startDate}</div>
          <div style={{ color: 'var(--glb-muted)' }}>al {row.endDate}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado SRI / Ruta',
      width: 150,
      renderCell: (_val: unknown, row: RemisionRow) => {
        switch (row.status) {
          case RemisionGuideStatus.Authorized:
            return <StatusBadge tone="success" withDot>Autorizada SRI</StatusBadge>
          case RemisionGuideStatus.InTransit:
            return <StatusBadge tone="warning" withDot>En Tránsito</StatusBadge>
          case RemisionGuideStatus.Delivered:
            return <StatusBadge tone="primary" withDot>Entregada</StatusBadge>
          case RemisionGuideStatus.Cancelled:
            return <StatusBadge tone="danger">Anulada</StatusBadge>
          case RemisionGuideStatus.Issued:
            return <StatusBadge tone="neutral" withDot>Emitida</StatusBadge>
          default:
            return <StatusBadge tone="neutral">Borrador</StatusBadge>
        }
      },
    },
    {
      key: 'id',
      header: 'Acciones',
      width: 180,
      renderCell: (_val: unknown, row: RemisionRow) => {
        const isUpdating = updatingId === row.id
        return (
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            <Button
              variant="outline"
              size="sm"
              title="Ver detalle completo"
              onClick={() => handleViewDetail(row.id)}
            >
              <Eye size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              title="Descargar XML SRI"
              onClick={() => handleDownloadXml(row)}
            >
              <Download size={14} />
            </Button>
            {canCreate && row.status === RemisionGuideStatus.Authorized && (
              <Button
                variant="primary"
                size="sm"
                title="Despachar vehículo (Iniciar tránsito)"
                disabled={isUpdating}
                onClick={() => handleStatusChange(row, RemisionGuideStatus.InTransit)}
              >
                <Truck size={14} style={{ marginRight: 2 }} /> Salida
              </Button>
            )}
            {canCreate && row.status === RemisionGuideStatus.InTransit && (
              <Button
                variant="primary"
                size="sm"
                title="Confirmar entrega de mercadería"
                disabled={isUpdating}
                onClick={() => handleStatusChange(row, RemisionGuideStatus.Delivered)}
              >
                <CheckCircle2 size={14} style={{ marginRight: 2 }} /> Entrega
              </Button>
            )}
          </div>
        )
      },
    },
  ], [canCreate, updatingId])

  const { paging, onPageChange, onPageSizeChange, pageSizeOptions } = useGluDataGridPaging(15)

  if (!canRead) {
    return (
      <TenantSessionGate title="Guías de Remisión" lead="Comprobantes electrónicos de transporte.">
        <div className="ecu-dashboard-layout">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Sin permiso para consultar guías de remisión (facturacion.guias.remision.read)."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Guías de Remisión SRI"
      lead="Emisión y seguimiento logístico de guías de remisión (SRI Tipo 06) para fletes y traslados."
    >
      <div className="ecu-dashboard-layout ecu-dashboard-layout--fluid">
        <PageHeader
          title="Guías de Remisión SRI"
          subtitle="Comprobantes oficiales de traslado de mercadería (Tipo 06). Control de transportistas, placas vehiculares, rutas y entregas."
          badge={
            <StatusBadge tone="primary" withDot>
              {stats.total} {stats.total === 1 ? 'Guía' : 'Guías'}
            </StatusBadge>
          }
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadData()}
                disabled={loading}
              >
                <RefreshCw size={14} style={{ marginRight: 4 }} />
                Actualizar
              </Button>
              {canCreate && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/facturacion/guias-remision/nueva')}
                >
                  <Plus size={16} style={{ marginRight: 4 }} />
                  + Nueva Guía de Remisión
                </Button>
              )}
            </div>
          }
        />

        {/* Tira analítica de KPIs obligatoria dentro de .ecu-stat-grid */}
        <div className="ecu-stat-grid" aria-label="Métricas de Guías de Remisión">
          <StatCard
            label="Total Guías Registradas"
            value={stats.total}
            icon={<FileText size={20} />}
            toneColor="#4f46e5"
            footerText="En el período seleccionado"
          />
          <StatCard
            label="Autorizadas por el SRI"
            value={stats.authorized}
            icon={<ShieldCheck size={20} />}
            toneColor="#10b981"
            footerText="Validez fiscal vigente"
          />
          <StatCard
            label="En Tránsito / Ruta"
            value={stats.inTransit}
            icon={<Truck size={20} />}
            toneColor="#f59e0b"
            footerText="Mercadería en camino"
          />
          <StatCard
            label="Entregadas con Éxito"
            value={stats.delivered}
            icon={<CheckCircle2 size={20} />}
            toneColor="#06b6d4"
            footerText="Despachos completados"
          />
        </div>

        {/* Grilla Canónica Enterprise */}
        <SectionCard
          title="Historial de Guías de Remisión"
          subtitle="Listado cronológico de comprobantes de transporte y estado en carretera."
          action={
            <OptionGroup
              layout="segmented"
              variant="outline"
              size="sm"
              value={statusFilter}
              onChange={(val) => setStatusFilter(String(val))}
              options={[
                { value: 'all', label: `Todas (${stats.total})` },
                { value: 'in_transit', label: `En Tránsito (${stats.inTransit})` },
                { value: 'authorized', label: `Autorizadas (${stats.authorized})` },
                { value: 'delivered', label: `Entregadas (${stats.delivered})` },
                { value: 'draft', label: `Borrador (${stats.draft})` },
              ]}
            />
          }
        >
          {guides.length === 0 && !loading ? (
            <EmptyState
              title="No se encontraron guías de remisión"
              description="Aún no se han emitido guías de traslado de mercaderías con los filtros seleccionados."
              action={
                canCreate ? (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate('/facturacion/guias-remision/nueva')}
                  >
                    <Plus size={16} style={{ marginRight: 4 }} />
                    Emitir Primera Guía
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={guides as RemisionRow[]}
              keyExpr="id"
              columns={columns}
              loading={loading}
              messages={createSpanishDataGridMessages('guía de remisión', 'guías de remisión')}
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar por placa, chofer, ruta…"
              searchKeys={['licensePlate', 'carrierName', 'recipientName', 'routeDescription', 'documentNumber']}
              toolbarRight={
                <GridDateRangeBox
                  from={from}
                  to={to}
                  lookback={lookback}
                  disabled={loading}
                  onChange={setRange}
                />
              }
              paging={paging}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              pageSizeOptions={pageSizeOptions}
              paginationMode="client"
            />
          )}
        </SectionCard>

        {/* Modal de Detalle e Inspección RIDE / XML */}
        {selectedGuideId && (
          <Popup
            open={Boolean(selectedGuideId)}
            onClose={() => {
              setSelectedGuideId(null)
              setDetailGuide(null)
            }}
            title={detailGuide ? `Detalle Guía ${detailGuide.documentNumber}` : 'Cargando información...'}
          >
            {loadingDetail || !detailGuide ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando datos de la guía...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Clave de Acceso SRI</span>
                    <p style={{ fontFamily: 'monospace', fontSize: '0.8125rem', wordBreak: 'break-all', fontWeight: 600 }}>
                      {detailGuide.accessKey}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Transportista</span>
                    <p style={{ fontWeight: 600 }}>{detailGuide.carrierName} ({detailGuide.carrierIdentification})</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Placa Vehicular</span>
                    <p style={{ fontWeight: 600, color: 'var(--glb-primary)' }}>{detailGuide.licensePlate}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Ruta</span>
                    <p style={{ fontWeight: 500 }}>{detailGuide.routeDescription}</p>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--glb-border)', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>Mercadería Transportada</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--glb-border)', textAlign: 'left', color: 'var(--glb-muted)' }}>
                          <th style={{ padding: '6px' }}>Código</th>
                          <th style={{ padding: '6px' }}>Descripción</th>
                          <th style={{ padding: '6px' }}>Cantidad</th>
                          <th style={{ padding: '6px' }}>Unidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailGuide.items.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            <td style={{ padding: '6px', fontFamily: 'monospace' }}>{item.itemCode}</td>
                            <td style={{ padding: '6px' }}>{item.description}</td>
                            <td style={{ padding: '6px', fontWeight: 600 }}>{item.quantity}</td>
                            <td style={{ padding: '6px', color: 'var(--glb-muted)' }}>{item.unitOfMeasure || 'UNID'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {detailGuide.supportDocumentNumber && (
                  <div style={{ background: 'color-mix(in srgb, var(--glb-primary) 6%, transparent)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted)' }}>Comprobante de Sustento</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 600 }}>
                      Factura N° {detailGuide.supportDocumentNumber}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Popup>
        )}
      </div>
    </TenantSessionGate>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, DataGrid, useToast, type ColumnDef } from 'glubox'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  GridToolbarRefresh,
} from '@/components/ui'
import {
  AlertCircle,
  Building2,
  FilePlus,
  ShieldCheck,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import { listPurchaseSettlements } from '@/services/purchasesApi'
import { getSigningCertificateStatus, getTenant, type SigningCertificateStatusDto } from '@/services/tenantApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { PurchaseSummaryDto } from '@/types/purchasesApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'
import { getBillingEmitProfile, readBillingEmitProfile } from '@/lib/billingEmitProfile'

type SettlementRow = PurchaseSummaryDto & Record<string, unknown>

export function PurchaseSettlementsListPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('facturacion.liquidacion.compra.read') ||
    useHasPermission('purchases.documents.read') ||
    useHasPermission('facturacion.read')
  const canIssue =
    useHasPermission('facturacion.liquidacion.compra.issue') ||
    useHasPermission('purchases.documents.manage')

  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [certStatus, setCertStatus] = useState<SigningCertificateStatusDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [settlements, setSettlements] = useState<PurchaseSummaryDto[]>([])

  const emitProfile = useMemo(() => {
    return getBillingEmitProfile(readBillingEmitProfile(tenantId))
  }, [tenantId])

  const loadData = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [tenantData, certData, settlementsData] = await Promise.all([
        getTenant(tenantId).catch(() => null),
        getSigningCertificateStatus(tenantId).catch(() => null),
        listPurchaseSettlements(tenantId).catch(() => null),
      ])

      if (tenantData) setTenant(tenantData)
      if (certData) setCertStatus(certData)
      if (settlementsData?.purchases) {
        setSettlements(settlementsData.purchases)
      } else {
        setSettlements([])
      }
    } catch (err) {
      toast.show({
        title: 'Error de carga',
        message: readApiError(err, 'No se pudieron cargar las liquidaciones de compra.'),
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const stats = useMemo(() => {
    const total = settlements.length
    const authorized = settlements.filter(
      (s) => !!s.authorizationNumber || s.status === 2 || s.status === 3
    ).length
    const draft = settlements.filter((s) => s.status === 1).length
    const totalAmount = settlements.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0)

    return {
      total,
      authorized,
      draft,
      totalAmount,
    }
  }, [settlements])

  const {
    paging,
    pageSizeOptions,
    onPageChange,
    onPageSizeChange,
  } = useGluDataGridPaging(settlements.length)

  const messages = useMemo(
    () => createSpanishDataGridMessages('liquidación', 'liquidaciones'),
    []
  )

  const columns = useMemo((): ColumnDef<SettlementRow>[] => [
    {
      key: 'issueDate',
      header: 'Fecha',
      width: 110,
      renderCell: (_value, row: SettlementRow) => formatDate(row.issueDate),
    },
    {
      key: 'invoiceNumber',
      header: 'Secuencial',
      width: 170,
      renderCell: (_value, row: SettlementRow) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <code className="ecu-code">{row.invoiceNumber}</code>
          <span className="ecu-source">SRI Tipo 03</span>
        </div>
      ),
    },
    {
      key: 'supplierBusinessName',
      header: 'Sujeto Pasivo / Proveedor',
      width: 240,
      renderCell: (_value, row: SettlementRow) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="ecu-clip ecu-clip--wide" style={{ fontWeight: 500, fontSize: '0.85rem' }}>
            {row.supplierBusinessName}
          </span>
          <span className="ecu-source">Doc: {row.supplierTaxId}</span>
        </div>
      ),
    },
    {
      key: 'sriSustentoCode',
      header: 'Sustento SRI',
      width: 120,
      renderCell: (_value, row: SettlementRow) => (
        <code className="ecu-code">{row.sriSustentoCode || '01'}</code>
      ),
    },
    {
      key: 'subtotalTaxed',
      header: 'Subtotal 15%',
      width: 120,
      renderCell: (_value, row: SettlementRow) => (
        <span style={{ fontSize: '0.85rem' }}>
          ${(row.subtotalTaxed || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'taxAmount',
      header: 'IVA (Ret. 100%)',
      width: 130,
      renderCell: (_value, row: SettlementRow) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            ${(row.taxAmount || 0).toFixed(2)}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#10b981' }}>
            Retenido 100%
          </span>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total Bruto',
      width: 120,
      renderCell: (_value, row: SettlementRow) => (
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--shell-primary, #4f46e5)' }}>
          ${(row.totalAmount || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      width: 140,
      renderCell: (_value, row: SettlementRow) => {
        if (row.authorizationNumber || row.status === 2 || row.status === 3) {
          return (
            <span className="ecu-status ecu-status--active">
              <span className="ecu-status__dot" aria-hidden />
              Emitida / SRI
            </span>
          )
        }
        if (row.status === 4) {
          return (
            <span className="ecu-status ecu-status--danger">
              <span className="ecu-status__dot" aria-hidden />
              Anulada
            </span>
          )
        }
        return (
          <span className="ecu-status ecu-status--warning">
            <span className="ecu-status__dot" aria-hidden />
            Borrador
          </span>
        )
      },
    },
  ], [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Liquidaciones de Compra" lead="Liquidaciones de compra de bienes y servicios.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos de compras o facturación para consultar liquidaciones de compra."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Liquidaciones de Compra"
      lead="Liquidaciones de compra de bienes y prestación de servicios (SRI Tipo 03) emitidas a personas sin RUC."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Liquidaciones de Compra SRI"
          subtitle="Emisión de liquidaciones SRI Tipo 03 a personas naturales sin RUC."
        />

        {/* Tarjeta de Conexión Fiscal con Ajustes de Empresa */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid color-mix(in srgb, var(--shell-primary, #4f46e5) 25%, var(--shell-border, rgba(255, 255, 255, 0.1)))',
            backgroundColor: 'color-mix(in srgb, var(--shell-primary, #4f46e5) 4%, var(--glb-surface, transparent))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'color-mix(in srgb, var(--shell-primary, #4f46e5) 15%, transparent)',
                color: 'var(--shell-primary, #4f46e5)',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--glb-text, inherit)' }}>
                  {tenant?.legalName || tenant?.name || 'Cargando emisor fiscal...'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--glb-muted, #64748b)', fontFamily: 'monospace' }}>
                  RUC: {tenant?.taxId || 'No configurado'}
                </span>
                <StatusBadge tone="primary" withDot>
                  Emisor Tipo 03
                </StatusBadge>
                <StatusBadge tone={emitProfile.isDevelopment ? 'warning' : 'success'} withDot>
                  {emitProfile.isDevelopment ? 'SRI Pruebas' : 'SRI Producción'}
                </StatusBadge>
                <StatusBadge
                  tone={certStatus?.isConfigured && !certStatus.isExpired ? 'success' : certStatus?.isExpired ? 'danger' : 'warning'}
                  withDot
                >
                  {certStatus?.isConfigured && !certStatus.isExpired
                    ? 'Firma Digital Activa'
                    : certStatus?.isExpired
                      ? 'Firma Expirada'
                      : 'Sin Firma Digital'}
                </StatusBadge>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.2rem' }}>
                Serie autorizada: <strong>{tenant?.establishmentCode || '001'}-001</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Informativo de Emisión y Firma */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: certStatus?.isConfigured && !certStatus.isExpired
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : '1px solid rgba(234, 179, 8, 0.3)',
            backgroundColor: certStatus?.isConfigured && !certStatus.isExpired
              ? 'rgba(16, 185, 129, 0.08)'
              : 'rgba(234, 179, 8, 0.08)',
            fontSize: '0.8125rem',
            color: 'var(--glb-text, inherit)',
          }}
        >
          {certStatus?.isConfigured && !certStatus.isExpired ? (
            <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0 }} />
          ) : (
            <AlertCircle size={16} style={{ color: '#eab308', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            {certStatus?.isConfigured && !certStatus.isExpired ? (
              <>
                <strong>Firma electrónica activa (AES-256-GCM):</strong> Titular: <em>{certStatus.subject || 'SRI'}</em> · Vigente ({certStatus.daysRemaining} días restantes). Las liquidaciones de compra (Tipo 03) se firman y autorizan en línea ante el SRI.
              </>
            ) : (
              <>
                <strong>Normativa SRI (Art. 48 RCVR):</strong> Las liquidaciones de compra son comprobantes autorizados emitidos por el comprador. Requieren firma electrónica configurada en <em>Ajustes de Empresa &rarr; Facturación Electrónica</em> y retención del 100% de IVA e IR aplicable.
              </>
            )}
          </div>
        </div>

        {/* Tira de KPIs de Liquidaciones */}
        <div className="ecu-stat-grid" aria-label="Resumen de liquidaciones de compra">
          <StatCard label="Total Liquidaciones" value={stats.total} />
          <StatCard label="Autorizadas SRI" value={stats.authorized} />
          <StatCard label="En Borrador" value={stats.draft} />
          <StatCard label="Monto Liquidado ($)" value={stats.totalAmount} />
        </div>

        {/* Listado / Estado de Liquidaciones */}
        <SectionCard title="Liquidaciones de Compra Emitidas">
          {!loading && settlements.length === 0 ? (
            <EmptyState
              icon="receipt_long"
              title="No hay liquidaciones de compra registradas"
              description="Emite una liquidación de compra (Tipo 03) cuando adquieras productos o contrates servicios a personas naturales que por disposición legal no poseen RUC ni emiten facturas."
              action={
                canIssue ? (
                  <Button variant="primary" onClick={() => navigate('/compras/liquidaciones/nueva')}>
                    <FilePlus size={16} />
                    Emitir Primera Liquidación
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataGrid
              dataSource={settlements as SettlementRow[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={300}
              searchPlaceholder="Buscar por secuencial, proveedor..."
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void loadData()} />
                  {canIssue && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => navigate('/compras/liquidaciones/nueva')}
                    >
                      <FilePlus size={16} />
                      Nueva Liquidación
                    </Button>
                  )}
                </div>
              }
              loading={loading}
              paging={paging}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              messages={messages}
            />
          )}
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

export default PurchaseSettlementsListPage

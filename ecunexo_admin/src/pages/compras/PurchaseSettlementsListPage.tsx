import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'glubox'
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import {
  AlertCircle,
  Building2,
  FilePlus,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { getSigningCertificateStatus, getTenant, type SigningCertificateStatusDto } from '@/services/tenantApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantByIdDto } from '@/types/tenantApi'

export function PurchaseSettlementsListPage() {
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('facturacion.liquidacion.compra.read') ||
    useHasPermission('purchases.documents.read') ||
    useHasPermission('facturacion.read')
  const canIssue =
    useHasPermission('facturacion.liquidacion.compra.issue') ||
    useHasPermission('purchases.documents.manage') ||
    useHasPermission('facturacion.read')

  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [certStatus, setCertStatus] = useState<SigningCertificateStatusDto | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    let active = true
    setLoading(true)
    Promise.all([
      getTenant(tenantId).catch(() => null),
      getSigningCertificateStatus(tenantId).catch(() => null),
    ])
      .then(([tenantData, certData]) => {
        if (active) {
          if (tenantData) setTenant(tenantData)
          if (certData) setCertStatus(certData)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [tenantId])

  const stats = useMemo(() => {
    return {
      total: 0,
      authorized: 0,
      draft: 0,
      totalAmount: 0,
    }
  }, [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Liquidaciones de Compra" lead="Liquidaciones de compra de bienes y servicios.">
        <div className="ecu-dashboard-layout">
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
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Liquidaciones de Compra SRI"
          subtitle="Comprobante electrónico emitido por la empresa al adquirir bienes o servicios a personas naturales no obligadas a tener RUC (artesanos, mano de obra rural)."
          badge={
            <StatusBadge tone="primary" withDot>
              SRI Tipo 03
            </StatusBadge>
          }
          actions={
            canIssue ? (
              <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {}}
                  disabled={loading}
                >
                  <RefreshCw size={15} className={loading ? 'ecu-spin' : ''} />
                  Actualizar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {}}
                >
                  <FilePlus size={16} />
                  Nueva Liquidación
                </Button>
              </div>
            ) : undefined
          }
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
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.2rem' }}>
                Serie autorizada: <strong>{tenant?.establishmentCode || '001'}-001</strong> · Certificado .p12 y clave de acceso de 49 dígitos centralizados en Ajustes de Empresa.
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/organizacion/facturacion-electronica')}
          >
            <KeyRound size={14} />
            Configurar Firma Electrónica (.p12)
          </Button>
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
                <strong>Normativa SRI (Art. 48 RCVR):</strong> Las liquidaciones de compra son comprobantes autorizados emitidos por el comprador. Requieren firma electrónica .p12 configurada en <em>Ajustes de Empresa &rarr; Facturación Electrónica</em> y retención del 100% de IVA e IR aplicable.
              </>
            )}
          </div>
        </div>

        {/* Tira de KPIs de Liquidaciones */}
        <div className="ecu-stat-grid" aria-label="Resumen de liquidaciones de compra">
          <StatCard
            label="Total Liquidaciones"
            value={String(stats.total)}
            icon="receipt_long"
            toneColor="#4f46e5"
            footerText="Emitidas en el ejercicio"
          />
          <StatCard
            label="Autorizadas SRI"
            value={String(stats.authorized)}
            icon="verified"
            toneColor="#10b981"
            footerText="Con autorización electrónica"
          />
          <StatCard
            label="En Borrador"
            value={String(stats.draft)}
            icon="edit_note"
            toneColor="#f59e0b"
            footerText="Pendientes de emisión"
          />
          <StatCard
            label="Monto Liquidado"
            value={`$${stats.totalAmount.toFixed(2)}`}
            icon="monetization_on"
            toneColor="#8b5cf6"
            footerText="Total compras liquidadas"
          />
        </div>

        {/* Listado / Estado de Liquidaciones */}
        <SectionCard
          title="Liquidaciones de Compra Emitidas"
          subtitle="Comprobantes autorizados ante el SRI conforme al Art. 48 del Reglamento de Comprobantes de Venta y Retención"
        >
          <EmptyState
            icon="receipt_long"
            title="No hay liquidaciones de compra registradas"
            description="Emite una liquidación de compra (Tipo 03) cuando adquieras productos o contrates servicios a personas naturales que por disposición legal no poseen RUC ni emiten facturas."
            action={
              canIssue ? (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button variant="primary" onClick={() => navigate('/compras/proveedores')}>
                    <UserCheck size={16} />
                    Ver Proveedores Registrados
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/organizacion/facturacion-electronica')}>
                    <KeyRound size={16} />
                    Verificar Estado de Firma Digital (.p12)
                  </Button>
                </div>
              ) : undefined
            }
          />
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

export default PurchaseSettlementsListPage

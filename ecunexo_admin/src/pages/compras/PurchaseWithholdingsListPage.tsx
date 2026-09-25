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
  FileCheck2,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { getSigningCertificateStatus, getTenant, type SigningCertificateStatusDto } from '@/services/tenantApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantByIdDto } from '@/types/tenantApi'
import { getBillingEmitProfile, readBillingEmitProfile } from '@/lib/billingEmitProfile'

export function PurchaseWithholdingsListPage() {
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('purchases.withholdings.read') ||
    useHasPermission('purchases.documents.read') ||
    useHasPermission('purchases.read')
  const canIssue =
    useHasPermission('purchases.withholdings.issue') ||
    useHasPermission('purchases.documents.manage') ||
    useHasPermission('purchases.manage')

  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [certStatus, setCertStatus] = useState<SigningCertificateStatusDto | null>(null)

  const emitProfile = useMemo(() => {
    return getBillingEmitProfile(readBillingEmitProfile(tenantId))
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    let active = true
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
    return () => {
      active = false
    }
  }, [tenantId])

  const stats = useMemo(() => {
    return {
      total: 0,
      authorized: 0,
      pendingSri: 0,
      totalWithheld: 0,
    }
  }, [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Retenciones" lead="Comprobantes de retención electrónica en compras.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="Requieres permisos para consultar comprobantes de retención en compras."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Retenciones en Compras"
      lead="Comprobantes de retención electrónica (SRI Tipo 07) emitidos a proveedores de bienes y servicios."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Comprobantes de Retención SRI"
          subtitle="Retenciones SRI Tipo 07 de Impuesto a la Renta e IVA sobre facturas de compra."
          actions={
            canIssue ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => {}}
              >
                <Plus size={16} />
                Nueva Retención
              </Button>
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
                <StatusBadge tone={tenant?.isWithholdingAgent ? 'success' : 'neutral'} withDot>
                  {tenant?.isWithholdingAgent ? 'Agente de Retención SRI' : 'Régimen General'}
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

        {/* Banner Informativo de Firma Electrónica */}
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
                <strong>Firma digital activa (AES-256-GCM):</strong> Titular: <em>{certStatus.subject || 'SRI'}</em> · Vigente ({certStatus.daysRemaining} días restantes). Las retenciones (Tipo 07) se firmarán automáticamente al transmitirse al SRI.
              </>
            ) : certStatus?.isExpired ? (
              <>
                <strong>Certificado digital expirado:</strong> La firma electrónica expiró. Actualiza el certificado en <em>Ajustes de Empresa &rarr; Facturación Electrónica</em> para emitir retenciones.
              </>
            ) : (
              <>
                <strong>Firma digital compartida:</strong> Las retenciones electrónicas (Tipo 07) toman automáticamente la firma electrónica cargada en <em>Ajustes de Empresa &rarr; Facturación Electrónica</em>. Puedes generar y revisar borradores de retención antes de su transmisión al SRI.
              </>
            )}
          </div>
        </div>

        {/* Tira de KPIs de Retenciones */}
        <div className="ecu-stat-grid" aria-label="Resumen de retenciones en compras">
          <StatCard label="Total Retenciones" value={stats.total} />
          <StatCard label="Autorizadas SRI" value={stats.authorized} />
          <StatCard label="Pendientes" value={stats.pendingSri} />
          <StatCard label="Retenido ($)" value={stats.totalWithheld} />
        </div>

        {/* Listado / Estado de Retenciones */}
        <SectionCard title="Retenciones Electrónicas Emitidas">
          <EmptyState
            icon="receipt"
            title="No hay retenciones emitidas registradas"
            description="Las retenciones se generan al liquidar facturas de compra sujetas a retención de Impuesto a la Renta o IVA conforme a la condición tributaria de tu empresa ante el SRI."
            action={
              canIssue ? (
                <Button variant="primary" onClick={() => navigate('/compras/documentos')}>
                  <FileCheck2 size={16} />
                  Ver Facturas de Compra Recibidas
                </Button>
              ) : undefined
            }
          />
        </SectionCard>
      </div>
    </TenantSessionGate>
  )
}

export default PurchaseWithholdingsListPage

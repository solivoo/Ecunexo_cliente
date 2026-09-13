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
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useHasPermission } from '@/hooks/useHasPermission'
import { getTenant } from '@/services/tenantApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantByIdDto } from '@/types/tenantApi'

export function PurchaseWithholdingsListPage() {
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission('purchases.withholdings.read') ||
    useHasPermission('purchases.documents.read') ||
    useHasPermission('facturacion.read')
  const canIssue =
    useHasPermission('purchases.withholdings.issue') ||
    useHasPermission('purchases.documents.manage') ||
    useHasPermission('facturacion.read')

  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    let active = true
    setLoading(true)
    getTenant(tenantId)
      .then((data) => {
        if (active) setTenant(data)
      })
      .catch(() => {})
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
      pendingSri: 0,
      totalWithheld: 0,
    }
  }, [])

  if (!canRead) {
    return (
      <TenantSessionGate title="Retenciones" lead="Comprobantes de retención electrónica en compras.">
        <div className="ecu-dashboard-layout">
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
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Comprobantes de Retención SRI"
          subtitle="Emisión, firma electrónica (XAdES-BES) y autorización ante el SRI de retenciones de Impuesto a la Renta e IVA aplicadas a facturas de compra."
          badge={
            <StatusBadge tone="primary" withDot>
              SRI Tipo 07
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
                  <Plus size={16} />
                  Nueva Retención
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
                <StatusBadge tone={tenant?.isWithholdingAgent ? 'success' : 'neutral'} withDot>
                  {tenant?.isWithholdingAgent ? 'Agente de Retención SRI' : 'Régimen General'}
                </StatusBadge>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)', marginTop: '0.2rem' }}>
                Serie autorizada: <strong>{tenant?.establishmentCode || '001'}-001</strong> · La firma digital .p12 y ambiente SRI se consumen desde Ajustes de Empresa.
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

        {/* Banner Informativo de Firma Electrónica */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            backgroundColor: 'rgba(234, 179, 8, 0.08)',
            fontSize: '0.8125rem',
            color: 'var(--glb-text, inherit)',
          }}
        >
          <AlertCircle size={16} style={{ color: '#eab308', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>Firma digital compartida:</strong> Las retenciones electrónicas (Tipo 07) toman automáticamente el certificado .p12 cargado en <em>Ajustes de Empresa &rarr; Facturación Electrónica</em>. Puedes generar y revisar borradores de retención antes de su transmisión al SRI.
          </div>
        </div>

        {/* Tira de KPIs de Retenciones */}
        <div className="ecu-stat-grid" aria-label="Resumen de retenciones en compras">
          <StatCard
            label="Total Retenciones"
            value={String(stats.total)}
            icon="receipt"
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
            label="Pendientes / En Cola"
            value={String(stats.pendingSri)}
            icon="schedule"
            toneColor="#f59e0b"
            footerText="Por transmitir o firmar"
          />
          <StatCard
            label="Monto Retenido"
            value={`$${stats.totalWithheld.toFixed(2)}`}
            icon="monetization_on"
            toneColor="#8b5cf6"
            footerText="Total retenciones IR e IVA"
          />
        </div>

        {/* Listado / Estado de Retenciones */}
        <SectionCard
          title="Retenciones Electrónicas Emitidas"
          subtitle="Historial de comprobantes de retención transmitidos al SRI conforme a la Ficha Técnica v2.32"
        >
          <EmptyState
            icon="receipt"
            title="No hay retenciones emitidas registradas"
            description="Las retenciones se generan al liquidar facturas de compra sujetas a retención de Impuesto a la Renta o IVA conforme a la condición tributaria de tu empresa ante el SRI."
            action={
              canIssue ? (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button variant="primary" onClick={() => navigate('/compras/documentos')}>
                    <FileCheck2 size={16} />
                    Ver Facturas de Compra Recibidas
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/organizacion/facturacion-electronica')}>
                    <ShieldCheck size={16} />
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

export default PurchaseWithholdingsListPage

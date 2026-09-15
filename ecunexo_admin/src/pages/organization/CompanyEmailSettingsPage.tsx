import { useNavigate } from 'react-router-dom'
import { Button } from 'glubox'
import {
  CheckCircle2,
  Globe,
  Info,
  Mail,
  Receipt,
  Server,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { PageHeader, SectionCard, StatCard, StatusBadge } from '@/components/ui'
import { AppSettingsEmailSection } from '@/pages/settings/AppSettingsEmailSection'
import { PLATFORM_SETTINGS_READ, PLATFORM_SETTINGS_UPDATE } from '@/services/settingsApi'
import { useHasPermission } from '@/hooks/useHasPermission'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'

export function CompanyEmailSettingsPage() {
  const navigate = useNavigate()
  const size = useGluComponentSize()
  const canRead =
    useHasPermission(PLATFORM_SETTINGS_READ) || useHasPermission('tenancy.tenant.read')
  const canUpdate =
    useHasPermission(PLATFORM_SETTINGS_UPDATE) ||
    useHasPermission('tenancy.tenant.update') ||
    useHasPermission('tenancy.tenant.read')

  if (!canRead) {
    return (
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Correo Electrónico"
          subtitle="No tienes permiso para acceder a la configuración de correo."
          badge={<StatusBadge tone="danger">Acceso Restringido</StatusBadge>}
        />
      </div>
    )
  }

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title="Configuración de Correo Electrónico"
        subtitle="Servidor SMTP (Zoho Mail) para el envío de facturas electrónicas, comprobantes SRI y notificaciones automáticas para todas las empresas de la plataforma."
        badge={<StatusBadge tone="primary">Zoho Mail SMTP</StatusBadge>}
        actions={
          <Button
            size={size}
            variant="outline"
            onClick={() => navigate('/app/configuracion')}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2 inline-block" />
            Preferencias del Sistema
          </Button>
        }
      />

      {/* KPI / StatCard Strip */}
      <div className="ecu-companies-kpi-grid">
        <StatCard
          label="Servidor SMTP"
          value="smtp.zoho.com"
          footerText="Puerto 465 (SSL) / 587 (TLS)"
          icon={<Server className="w-5 h-5" />}
        />
        <StatCard
          label="Cifrado & Seguridad"
          value="SSL / TLS"
          footerText="Conexión cifrada segura"
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <StatCard
          label="Alcance del Motor"
          value="Todas las empresas"
          footerText="Configuración global del sistema"
          icon={<Globe className="w-5 h-5" />}
        />
        <StatCard
          label="Despacho SRI"
          value="RIDE + XML"
          footerText="Adjuntos automáticos al cliente"
          icon={<Receipt className="w-5 h-5" />}
        />
      </div>

      <div className="ecu-companies-form">
        {/* Componente reactivo de configuración y prueba */}
        <AppSettingsEmailSection disabled={!canUpdate} />

        {/* Guía y recomendaciones de Zoho Mail */}
        <SectionCard
          title="Guía de Integración con Zoho Mail"
          subtitle="Pasos recomendados para garantizar alta entregabilidad y autenticación adecuada."
          action={<StatusBadge tone="info">Documentación</StatusBadge>}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
              paddingTop: '0.5rem',
            }}
          >
            <div
              style={{
                background: 'var(--glb-surface-2, rgba(0,0,0,0.02))',
                border: '1px solid var(--glb-border, rgba(0,0,0,0.08))',
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <strong style={{ fontSize: '0.9rem', color: 'var(--glb-text)' }}>
                  Contraseña de Aplicación (App Password)
                </strong>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--glb-muted)', lineHeight: 1.45 }}>
                Si tu cuenta de Zoho Mail tiene verificación en dos pasos (2FA), debes generar una contraseña de aplicación en{' '}
                <em>Zoho Accounts &gt; Seguridad &gt; Contraseñas de aplicación</em> e ingresarla en el campo contraseña.
              </p>
            </div>

            <div
              style={{
                background: 'var(--glb-surface-2, rgba(0,0,0,0.02))',
                border: '1px solid var(--glb-border, rgba(0,0,0,0.08))',
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Mail className="w-4 h-4 text-blue-600" />
                <strong style={{ fontSize: '0.9rem', color: 'var(--glb-text)' }}>
                  Registro SPF en DNS
                </strong>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--glb-muted)', lineHeight: 1.45 }}>
                Para evitar que los correos con comprobantes lleguen a spam, configura en el DNS de tu dominio el registro TXT:
                <code
                  style={{
                    display: 'block',
                    marginTop: '0.35rem',
                    padding: '0.25rem 0.5rem',
                    background: 'var(--glb-surface-3, rgba(0,0,0,0.05))',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  }}
                >
                  v=spf1 include:zoho.com ~all
                </code>
              </p>
            </div>

            <div
              style={{
                background: 'var(--glb-surface-2, rgba(0,0,0,0.02))',
                border: '1px solid var(--glb-border, rgba(0,0,0,0.08))',
                borderRadius: '8px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Info className="w-4 h-4 text-amber-600" />
                <strong style={{ fontSize: '0.9rem', color: 'var(--glb-text)' }}>
                  Persistencia y Aplicación Inmediata
                </strong>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--glb-muted)', lineHeight: 1.45 }}>
                Los cambios se guardan de forma centralizada en la base de datos (PostgreSQL) y son utilizados en tiempo real
                por el backend sin necesidad de reiniciar contenedores ni stacks en Portainer.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

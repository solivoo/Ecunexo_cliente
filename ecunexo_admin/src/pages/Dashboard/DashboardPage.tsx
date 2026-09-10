import { useNavigate } from 'react-router-dom'
import { Button } from 'glubox'
import { useHasPermission } from '@/hooks/useHasPermission'
import {
  selectIsSubscriptionHolder,
  selectTenantId,
  selectTenantBranding,
  selectCanReturnToCompanies,
  selectSubscription,
  selectUserName,
  selectUserEmail,
  selectEnabledModules,
  selectPermissions,
} from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  QuickActionCard,
  EmptyState,
} from '@/components/ui'
import './css/dashboardPage.css'

type DashboardTile = {
  readonly to: string
  readonly icon: string
  readonly title: string
  readonly desc: string
  readonly permission: string
  readonly badge?: string
}

const COMPANY_TILES: readonly DashboardTile[] = [
  {
    to: '/equipo/usuarios',
    icon: 'group',
    title: 'Usuarios y Accesos',
    desc: 'Administración de colaboradores, credenciales y perfiles.',
    permission: 'identity.users.read',
    badge: 'Equipo',
  },
  {
    to: '/equipo/roles',
    icon: 'admin_panel_settings',
    title: 'Roles y Privilegios',
    desc: 'Matriz de permisos granulares por departamento.',
    permission: 'identity.roles.read',
    badge: 'Seguridad',
  },
  {
    to: '/organizacion/perfil',
    icon: 'domain',
    title: 'Perfil y Branding',
    desc: 'Identidad corporativa, logotipos y configuración legal.',
    permission: 'tenancy.tenant.read',
    badge: 'Empresa',
  },
  {
    to: '/seguridad/permisos',
    icon: 'key',
    title: 'Catálogo de Permisos',
    desc: 'Auditoría de directivas y políticas del sistema.',
    permission: 'identity.permissions.read',
    badge: 'Global',
  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const isSubscriptionHolder = useAppSelector(selectIsSubscriptionHolder)
  const tenantId = useAppSelector(selectTenantId)
  const tenant = useAppSelector(selectTenantBranding)
  const canReturn = useAppSelector(selectCanReturnToCompanies)
  const subscription = useAppSelector(selectSubscription)
  const userName = useAppSelector(selectUserName)
  const userEmail = useAppSelector(selectUserEmail)
  const enabledModules = useAppSelector(selectEnabledModules)
  const permissions = useAppSelector(selectPermissions)

  const canUsers = useHasPermission('identity.users.read')
  const canRoles = useHasPermission('identity.roles.read')
  const canTenant = useHasPermission('tenancy.tenant.read')
  const canPermissions = useHasPermission('identity.permissions.read')

  const holderOnly = isSubscriptionHolder && !tenantId

  // --- MODO TITULAR (Gestión global de la suscripción) ---
  if (holderOnly) {
    const planName = subscription?.servicePlanName || 'Plan Profesional'
    const maxTenants = subscription?.subscriptionMaxTenants ?? 1
    const maxUsers = subscription?.maxUsers ?? 'Ilimitado'
    const maxWarehouses = subscription?.maxWarehouses ?? 'Sin límite'

    return (
      <div className="ecu-dashboard-layout">
        <PageHeader
          title={`Bienvenido, ${userName || 'Titular'}`}
          subtitle="Panel global de administración. Supervisa el estado de tu suscripción, cupos contratados y gestiona todas tus organizaciones."
          badge={
            <StatusBadge tone="primary" withDot>
              Titular de Licencia
            </StatusBadge>
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigate('/organizacion/empresas')}
              >
                Mis Empresas
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void navigate('/organizacion/empresas/nueva')}
              >
                + Nueva Empresa
              </Button>
            </>
          }
        />

        {/* Métricas Principales (KPI Strip) */}
        <div className="ecu-stat-grid">
          <StatCard
            label="Plan Actual"
            value={planName}
            icon="workspace_premium"
            toneColor="#4f46e5"
            badge={<StatusBadge tone="success">Activo</StatusBadge>}
            footerText="Suscripción vigente"
          />
          <StatCard
            label="Cupo de Empresas"
            value={`${maxTenants} autorizadas`}
            icon="apartment"
            toneColor="#0284c7"
            footerText="Organizaciones permitidas"
          />
          <StatCard
            label="Límite de Usuarios"
            value={String(maxUsers)}
            icon="group"
            toneColor="#059669"
            footerText="Cuentas para tu equipo"
          />
          <StatCard
            label="Capacidad de Bodegas"
            value={String(maxWarehouses)}
            icon="warehouse"
            toneColor="#d97706"
            footerText="Almacenes por licencia"
          />
        </div>

        {/* Distribución en 2 Columnas */}
        <div className="ecu-dashboard-columns">
          <SectionCard
            title="Espacios de Trabajo y Licencia"
            subtitle="Acciones principales para orquestar tus sedes y módulos"
          >
            <div className="ecu-action-grid">
              <QuickActionCard
                to="/organizacion/empresas"
                icon="apartment"
                title="Listado de empresas"
                description="Supervisa, configura parámetros o ingresa al entorno operativo de cada empresa."
                badge={<StatusBadge tone="info">Gestión</StatusBadge>}
              />
              <QuickActionCard
                to="/organizacion/empresas/nueva"
                icon="add_business"
                title="Crear nueva empresa"
                description="Registra una nueva sede o razón social aprovechando los cupos de tu licencia."
                badge={<StatusBadge tone="primary">Alta</StatusBadge>}
              />
              <QuickActionCard
                to="/organizacion/plan"
                icon="tune"
                title="Plan y cupos"
                description="Consulta módulos habilitados, límites de consumo y vigencia del servicio."
                badge={<StatusBadge tone="neutral">Límites</StatusBadge>}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Guía Operativa para Titulares"
            subtitle="Pasos recomendados para comenzar a operar"
          >
            <div className="ecu-dashboard-guide-list">
              <div className="ecu-dashboard-guide-item">
                <span className="ecu-dashboard-guide-step">1</span>
                <div className="ecu-dashboard-guide-content">
                  <strong>Entra a una empresa concreta</strong>
                  <span>
                    Ve a <em>Listado de empresas</em> y pulsa <strong>Entrar</strong> en la fila
                    correspondiente para emitir documentos y gestionar inventario.
                  </span>
                </div>
              </div>
              <div className="ecu-dashboard-guide-item">
                <span className="ecu-dashboard-guide-step">2</span>
                <div className="ecu-dashboard-guide-content">
                  <strong>Configura colaboradores y roles</strong>
                  <span>
                    Dentro de cada empresa puedes crear usuarios con permisos específicos según su
                    departamento.
                  </span>
                </div>
              </div>
              <div className="ecu-dashboard-guide-item">
                <span className="ecu-dashboard-guide-step">3</span>
                <div className="ecu-dashboard-guide-content">
                  <strong>Alterna libremente de entorno</strong>
                  <span>
                    Usa el menú de cuenta (arriba a la derecha) → <em>Mis empresas</em> para regresar a
                    este panel o cambiar de sede en cualquier momento.
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    )
  }

  // --- MODO EMPRESA (Operando en un tenant concreto) ---
  const orgLabel = tenant.name || 'Tu Organización'
  const granted = new Set(
    [
      canUsers ? 'identity.users.read' : null,
      canRoles ? 'identity.roles.read' : null,
      canTenant ? 'tenancy.tenant.read' : null,
      canPermissions ? 'identity.permissions.read' : null,
    ].filter((p): p is string => p !== null),
  )
  const tiles = COMPANY_TILES.filter((tile) => granted.has(tile.permission))

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title={orgLabel}
        subtitle="Entorno de operación activo. El menú lateral y todas las transacciones aplican únicamente a esta empresa."
        badge={
          <StatusBadge tone="success" withDot>
            Empresa Activa
          </StatusBadge>
        }
        actions={
          canReturn ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate('/organizacion/empresas')}
            >
              Cambiar de Empresa
            </Button>
          ) : undefined
        }
      />

      {/* Indicadores de Entorno */}
      <div className="ecu-stat-grid">
        <StatCard
          label="Empresa"
          value={orgLabel}
          icon="domain"
          toneColor="#4f46e5"
          badge={<StatusBadge tone="primary">En Línea</StatusBadge>}
          footerText="Sede en operación"
        />
        <StatCard
          label="Módulos Habilitados"
          value={`${enabledModules?.length ?? 'Todos'}`}
          icon="apps"
          toneColor="#0284c7"
          footerText="Capacidades de la empresa"
        />
        <StatCard
          label="Sesión Activa"
          value={userName || 'Colaborador'}
          icon="badge"
          toneColor="#059669"
          footerText={userEmail || 'Cuenta autenticada'}
        />
        <StatCard
          label="Nivel de Acceso"
          value={`${permissions.length} permisos`}
          icon="verified_user"
          toneColor="#7c3aed"
          footerText="Privilegios asignados"
        />
      </div>

      {/* Accesos de Configuración y Administración */}
      <SectionCard
        title="Administración de la Empresa"
        subtitle="Accesos directos para la gestión del equipo, permisos y configuración corporativa"
      >
        {tiles.length > 0 ? (
          <div className="ecu-action-grid">
            {tiles.map((tile) => (
              <QuickActionCard
                key={tile.to}
                to={tile.to}
                icon={tile.icon}
                title={tile.title}
                description={tile.desc}
                badge={tile.badge ? <StatusBadge tone="neutral">{tile.badge}</StatusBadge> : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="lock_open"
            title="Funciones operativas activas"
            description="Tu rol tiene accesos enfocados en la operación diaria. Utiliza el menú lateral para acceder a facturación, inventario o catálogo."
          />
        )}
      </SectionCard>
    </div>
  )
}

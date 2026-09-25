import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'glubox'
import {
  selectIsSubscriptionHolder,
  selectTenantId,
  selectTenantBranding,
  selectSubscription,
  selectUserName,
  selectPermissions,
} from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  QuickActionCard,
} from '@/components/ui'
import { DashboardChartsSection } from './DashboardChartsSection'
import './css/dashboardPage.css'

type DashboardTile = {
  readonly to: string
  readonly icon: string
  readonly title: string
  readonly desc: string
  readonly permission: string
  readonly badge?: string
  readonly isPrimary?: boolean
}

// Accesos Rápidos Esenciales (Top Operaciones de Alta Frecuencia)
const COMPANY_TILES: readonly DashboardTile[] = [
  {
    to: '/facturacion/facturas/emitir',
    icon: 'add_notes',
    title: '+ Nueva Factura',
    desc: 'Emisión rápida de comprobante electrónico al SRI.',
    permission: 'facturacion.facturas.create|facturacion.facturas.read|billing.invoices.read',
    badge: 'Facturación',
    isPrimary: true,
  },
  {
    to: '/catalogo/items/nuevo',
    icon: 'add_box',
    title: '+ Nuevo Ítem',
    desc: 'Registro rápido de producto o servicio.',
    permission: 'catalog.item.create|catalog.item.read',
    badge: 'Catálogo',
    isPrimary: true,
  },
  {
    to: '/facturacion/comprobantes',
    icon: 'receipt_long',
    title: 'Comprobantes Emitidos',
    desc: 'Bandeja de facturas, notas de crédito y RIDE PDF.',
    permission: 'facturacion.facturas.read|billing.invoices.read',
    badge: 'Facturación',
  },
  {
    to: '/facturacion/guias-remision/nueva',
    icon: 'local_shipping',
    title: 'Guía de Remisión',
    desc: 'Documento logístico de traslado de mercadería (Tipo 06).',
    permission: 'facturacion.guias.remision.create|facturacion.guias.remision.read',
    badge: 'Logística',
  },
  {
    to: '/catalogo/items',
    icon: 'inventory_2',
    title: 'Productos y Precios',
    desc: 'Catálogo de ítems físicos y servicios.',
    permission: 'catalog.item.read|catalog.matrix.read',
    badge: 'Catálogo',
  },
  {
    to: '/clientes',
    icon: 'contacts',
    title: 'Directorio Clientes',
    desc: 'Gestión B2B/B2C, RUC y Cédulas.',
    permission: 'facturacion.facturas.read|customers.read|clientes.read',
    badge: 'Clientes',
  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const isSubscriptionHolder = useAppSelector(selectIsSubscriptionHolder)
  const tenantId = useAppSelector(selectTenantId)
  const tenant = useAppSelector(selectTenantBranding)
  const subscription = useAppSelector(selectSubscription)
  const userName = useAppSelector(selectUserName)
  const permissions = useAppSelector(selectPermissions)

  const holderOnly = isSubscriptionHolder && !tenantId

  const userPermissionsSet = useMemo(() => {
    const set = new Set<string>()
    for (const p of permissions) {
      set.add(p.toLowerCase())
    }
    return set
  }, [permissions])

  const tiles = useMemo(() => {
    return COMPANY_TILES.filter((tile) => {
      if (isSubscriptionHolder) return true
      const reqPerms = tile.permission.toLowerCase().split('|')
      return reqPerms.some((p) => userPermissionsSet.has(p.trim()))
    })
  }, [isSubscriptionHolder, userPermissionsSet])

  // --- MODO TITULAR (Gestión global de la suscripción) ---
  if (holderOnly) {
    const maxTenants = subscription?.subscriptionMaxTenants ?? 1
    const maxUsers = subscription?.maxUsers ?? 'Ilimitado'
    const maxWarehouses = subscription?.maxWarehouses ?? 'Sin límite'

    return (
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title={`Bienvenido, ${userName || 'Titular'}`}
          subtitle="Panel global de tu suscripción y empresas."
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
        <div className="ecu-stat-grid" aria-label="Resumen de la licencia">
          <StatCard label="Empresas (máx.)" value={String(maxTenants)} />
          <StatCard label="Usuarios (máx.)" value={String(maxUsers)} />
          <StatCard label="Bodegas (máx.)" value={String(maxWarehouses)} />
        </div>

        {/* Distribución en 2 Columnas */}
        <div className="ecu-dashboard-columns">
          <SectionCard
            title="Espacios de Trabajo y Licencia"
            bodyClassName="ecu-section-card__body--padded"
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
            bodyClassName="ecu-section-card__body--padded"
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

  return (
    <div className="ecu-dashboard-layout ecu-section-page">
      <PageHeader
        title={orgLabel}
        subtitle={`Operando como ${userName || 'Colaborador'}.`}
      />

      {/* Accesos Rápidos Principales (5 Atajos Esenciales de Alta Frecuencia) */}
      {tiles.length > 0 && (
        <div className="ecu-dashboard-quick-strip">
          <div className="ecu-dashboard-quick-strip__label">Atajos Rápidos:</div>
          <div className="ecu-dashboard-quick-strip__items">
            {tiles.map((tile) => (
              <a
                key={tile.to}
                href={tile.to}
                onClick={(e) => {
                  e.preventDefault()
                  void navigate(tile.to)
                }}
                className={`ecu-dashboard-quick-pill ${tile.isPrimary ? 'ecu-dashboard-quick-pill--primary' : ''}`}
              >
                <span className="material-symbols-outlined ecu-dashboard-quick-pill__icon">{tile.icon}</span>
                <span className="ecu-dashboard-quick-pill__title">{tile.title}</span>
                {tile.badge && <span className="ecu-dashboard-quick-pill__badge">{tile.badge}</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Sección de Indicadores Visuales y Gráficos según permisos RBAC/ABAC */}
      <DashboardChartsSection />
    </div>
  )
}

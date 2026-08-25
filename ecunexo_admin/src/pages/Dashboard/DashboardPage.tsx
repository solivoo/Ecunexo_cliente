import { Link } from 'react-router-dom'
import { useHasPermission } from '@/hooks/useHasPermission'
import {
  selectIsSubscriptionHolder,
  selectTenantId,
  selectTenantBranding,
  selectCanReturnToCompanies,
} from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

type DashboardTile = {
  readonly to: string
  readonly icon: string
  readonly title: string
  readonly desc: string
  readonly permission: string
}

const COMPANY_TILES: readonly DashboardTile[] = [
  {
    to: '/equipo/usuarios',
    icon: 'group',
    title: 'Usuarios',
    desc: 'Equipo y accesos',
    permission: 'identity.users.read',
  },
  {
    to: '/equipo/roles',
    icon: 'admin_panel_settings',
    title: 'Roles',
    desc: 'Asignación de permisos',
    permission: 'identity.roles.read',
  },
  {
    to: '/organizacion/perfil',
    icon: 'domain',
    title: 'Perfil y branding',
    desc: 'Identidad de la organización',
    permission: 'tenancy.tenant.read',
  },
  {
    to: '/seguridad/permisos',
    icon: 'key',
    title: 'Permisos globales',
    desc: 'Catálogo de permisos',
    permission: 'identity.permissions.read',
  },
]

export function DashboardPage() {
  const isSubscriptionHolder = useAppSelector(selectIsSubscriptionHolder)
  const tenantId = useAppSelector(selectTenantId)
  const tenant = useAppSelector(selectTenantBranding)
  const canReturn = useAppSelector(selectCanReturnToCompanies)
  const canUsers = useHasPermission('identity.users.read')
  const canRoles = useHasPermission('identity.roles.read')
  const canTenant = useHasPermission('tenancy.tenant.read')
  const canPermissions = useHasPermission('identity.permissions.read')
  const holderOnly = isSubscriptionHolder && !tenantId

  if (holderOnly) {
    return (
      <>
        <h1 className="app-shell__page-title">Inicio (titular)</h1>
        <p className="app-shell__page-lead">
          Aquí gestionas <strong>todas</strong> las empresas de la licencia. Para trabajar el día a
          día (usuarios, roles), entra a una empresa concreta.
        </p>

        <ol className="ecu-guide-steps">
          <li>
            Ve a <strong>Listado de empresas</strong> y crea una si aún no tienes.
          </li>
          <li>
            Pulsa <strong>Entrar</strong> en la fila de la empresa.
          </li>
          <li>
            Cuando termines, usa <strong>Mis empresas</strong> (menú de cuenta o banner) para volver
            a este plano.
          </li>
        </ol>

        <div className="app-shell__dashboard-grid" style={{ marginTop: '1rem' }}>
          <Link to="/organizacion/empresas" className="app-shell__tile">
            <span className="material-symbols-outlined app-shell__tile-icon" aria-hidden>
              apartment
            </span>
            <span className="app-shell__tile-title">Listado de empresas</span>
            <span className="app-shell__tile-desc">Crear, eliminar o entrar</span>
          </Link>
          <Link to="/organizacion/empresas/nueva" className="app-shell__tile">
            <span className="material-symbols-outlined app-shell__tile-icon" aria-hidden>
              add_business
            </span>
            <span className="app-shell__tile-title">Crear empresa</span>
            <span className="app-shell__tile-desc">Nueva bajo la licencia</span>
          </Link>
          <Link to="/organizacion/plan" className="app-shell__tile">
            <span className="material-symbols-outlined app-shell__tile-icon" aria-hidden>
              workspace_premium
            </span>
            <span className="app-shell__tile-title">Plan</span>
            <span className="app-shell__tile-desc">Cupos y módulos</span>
          </Link>
        </div>
      </>
    )
  }

  const orgLabel = tenant.name || 'tu organización'
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
    <>
      <h1 className="app-shell__page-title">Inicio (empresa)</h1>
      <p className="app-shell__page-lead">
        Estás operando <strong>{orgLabel}</strong>. El menú lateral es solo de esta empresa.
        {canReturn ? (
          <>
            {' '}
            Para gestionar otras, abre el menú de cuenta → <strong>Mis empresas</strong>.
          </>
        ) : null}
      </p>

      {tiles.length > 0 ? (
        <div className="app-shell__dashboard-grid">
          {tiles.map((tile) => (
            <Link key={tile.to} to={tile.to} className="app-shell__tile">
              <span className="material-symbols-outlined app-shell__tile-icon" aria-hidden>
                {tile.icon}
              </span>
              <span className="app-shell__tile-title">{tile.title}</span>
              <span className="app-shell__tile-desc">{tile.desc}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="app-shell__page-lead">
          No tienes accesos administrativos en esta empresa. Usa el menú para las funciones de tu
          rol.
        </p>
      )}
    </>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { selectIsSubscriptionHolder, selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

type TenantSessionGateProps = {
  readonly children: ReactNode
  readonly title: string
  readonly lead: string
}

/** Páginas de Equipo/RBAC que solo aplican dentro de una empresa (sesión operativa). */
export function TenantSessionGate({ children, title, lead }: TenantSessionGateProps) {
  const tenantId = useAppSelector(selectTenantId)
  const isSubscriptionHolder = useAppSelector(selectIsSubscriptionHolder)

  if (tenantId) {
    return <>{children}</>
  }

  return (
    <>
      <h1 className="app-shell__page-title">{title}</h1>
      <p className="app-shell__page-lead">{lead}</p>
      <div className="app-shell__card">
        <p className="app-shell__muted app-shell__muted--pad-bottom">
          {isSubscriptionHolder
            ? 'Estás en sesión de titular. Entra a una empresa para gestionar usuarios, roles y permisos.'
            : 'No hay empresa activa en la sesión. Vuelve a iniciar sesión o entra a una empresa.'}
        </p>
        <Link to="/organizacion/empresas" className="app-shell__btn app-shell__btn--primary">
          Ir a Empresas
        </Link>
      </div>
    </>
  )
}

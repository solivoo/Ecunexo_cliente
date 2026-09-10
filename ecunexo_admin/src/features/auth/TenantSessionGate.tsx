import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'glubox'
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { selectIsSubscriptionHolder, selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

type TenantSessionGateProps = {
  readonly children: ReactNode
  readonly title: string
  readonly lead: string
}

/** Páginas de Equipo/RBAC que solo aplican dentro de una empresa (sesión operativa). */
export function TenantSessionGate({ children, title, lead }: TenantSessionGateProps) {
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const isSubscriptionHolder = useAppSelector(selectIsSubscriptionHolder)

  if (tenantId) {
    return <>{children}</>
  }

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title={title}
        subtitle={lead}
        badge={<StatusBadge tone="warning">Requiere Empresa</StatusBadge>}
      />
      <SectionCard
        title="Selección de Empresa Requerida"
        subtitle="Esta funcionalidad requiere operar dentro del contexto de una empresa de la suscripción."
      >
        <EmptyState
          icon="building-2"
          title="No hay empresa activa en la sesión"
          description={
            isSubscriptionHolder
              ? 'Estás en sesión de titular de licencia. Selecciona y entra a una empresa para gestionar usuarios, roles, catálogo y operaciones.'
              : 'No hay empresa activa en la sesión. Vuelve a iniciar sesión o selecciona una empresa.'
          }
          action={
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate('/organizacion/empresas')}
            >
              Ir a Empresas
            </Button>
          }
        />
      </SectionCard>
    </div>
  )
}

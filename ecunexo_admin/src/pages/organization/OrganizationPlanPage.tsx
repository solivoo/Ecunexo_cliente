import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast, type PageActionItem } from 'glubox'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { ApplyLicenseSection } from '@/features/organization/components/ApplyLicenseSection'
import {
  EntitlementCards,
  ModuleChips,
  PlanMetrics,
} from '@/features/organization/components/PlanPageSections'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { readApiError } from '@/lib/readApiError'
import { fetchSubscriptionSession } from '@/services/authApi'
import { getTenant, listTenantUsers } from '@/services/tenantApi'
import { selectIsSubscriptionHolder, selectSubscription, selectTenantId, setSessionPayload } from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { GetTenantByIdDto } from '@/types/tenantApi'

export function OrganizationPlanPage() {
  const toast = useToast()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const isSubscriptionHolder = useAppSelector(selectIsSubscriptionHolder)
  const subscription = useAppSelector(selectSubscription)
  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [userCount, setUserCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (isSubscriptionHolder && subscription) {
      setLoading(false)
      setError(null)
      setTenant(null)
      setUserCount(0)
      return
    }

    if (!tenantId) {
      setError('No hay sesión activa.')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [t, users] = await Promise.all([getTenant(tenantId), listTenantUsers(tenantId)])
      setTenant(t)
      setUserCount(users.length)
      setError(null)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo cargar el plan y el uso.')
      setError(message)
      setTenant(null)
      setUserCount(0)
      toast.show({ title: 'Error', message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [isSubscriptionHolder, subscription, tenantId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'companies',
        label: 'Empresas',
        icon: 'building-2',
        route: '/organizacion/empresas',
        disabled: false,
      },
    ],
    []
  )

  const userPct =
    tenant && tenant.maxUsers > 0 ? Math.min(100, Math.round((userCount / tenant.maxUsers) * 100)) : 0

  const holderModules = subscription?.enabledModules ?? []
  const holderEntitlements = subscription?.moduleEntitlements ?? []
  const tenantModules = tenant?.enabledModules ?? []

  return (
    <div className="ecu-dashboard-layout ecu-plan-page">
      <PageHeader
        title="Plan de Servicio y Licencia"
        subtitle={
          isSubscriptionHolder
            ? 'Límites del plan de servicio de la suscripción y entitlements de módulos.'
            : 'Capacidad contratada y consumo actual del tenant activo.'
        }
        badge={
          <StatusBadge tone="info" withDot>
            {subscription?.servicePlanName ?? tenant?.servicePlanName ?? 'Plan de Servicio'}
          </StatusBadge>
        }
        actions={
          isSubscriptionHolder ? (
            <EcuPageActions
              items={actionItems}
              variant="outline"
              triggerLabel="Acciones de plan"
              renderIcon={renderSidebarIcon}
              onNavigate={(route: string) => navigate(route)}
            />
          ) : undefined
        }
      />

      {isSubscriptionHolder && subscription ? (
        <>
          <PlanMetrics
            planName={subscription.servicePlanName}
            maxUsers={subscription.maxUsers}
            maxWarehouses={subscription.maxWarehouses}
            maxTenants={subscription.subscriptionMaxTenants}
          />

          <SectionCard
            title="Módulos Habilitados"
            subtitle="Capacidad incluida en la licencia. Entra a una empresa para operar con roles y menú."
          >
            <ModuleChips modules={holderModules} />
          </SectionCard>

          <SectionCard
            title="Capacidad por Módulo"
            subtitle="Tier y límites efectivos asignados a cada módulo del sistema."
          >
            <EntitlementCards entitlements={holderEntitlements} />
          </SectionCard>

          <ApplyLicenseSection
            onApplied={async () => {
              dispatch(setSessionPayload(await fetchSubscriptionSession()))
            }}
          />

          <p className="app-shell__muted">
            Como titular, entra a una empresa desde Organización → Empresas (mismo correo del
            administrador) para ver el menú operativo.
          </p>
        </>
      ) : (
        <PageLoadState loading={loading} error={error} empty={!tenant}>
          {tenant ? (
            <>
              <PlanMetrics
                planName={tenant.servicePlanName}
                maxUsers={tenant.maxUsers}
                maxWarehouses={tenant.maxWarehouses}
                maxTenants={tenant.subscriptionMaxTenants}
                usersLabel="Usuarios"
                warehousesLabel="Bodegas máx."
                tenantsLabel="Empresas en cupo"
                userUsage={{ used: userCount }}
              />

              {userPct > 0 ? (
                <div className="ecu-meter" aria-label={`Uso de usuarios ${userPct}%`}>
                  <div className="ecu-meter__bar" style={{ width: `${userPct}%` }} />
                </div>
              ) : null}

              <SectionCard
                title="Módulos Habilitados"
                subtitle="Módulos autorizados para esta empresa."
              >
                <ModuleChips modules={tenantModules} />
              </SectionCard>
            </>
          ) : null}
        </PageLoadState>
      )}
    </div>
  )
}

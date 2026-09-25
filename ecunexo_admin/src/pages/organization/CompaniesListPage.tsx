import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, useToast } from 'glubox'
import { Plus } from 'lucide-react'
import {
  EmptyState,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
} from '@/components/ui'
import { CompaniesGrid } from '@/pages/organization/CompaniesGrid'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { fetchSession } from '@/services/authApi'
import {
  deleteSubscriptionCompany,
  enterCompanySession,
  listSubscriptionCompanies,
} from '@/services/companiesApi'
import {
  selectAccessToken,
  selectIsSubscriptionHolder,
  selectTenantId,
  selectUserId,
  setCredentials,
  setHolderResume,
  setSessionPayload,
} from '@/store/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type {
  ListSubscriptionCompaniesDto,
  SubscriptionCompanyListItemDto,
} from '@/types/companiesApi'

export function CompaniesListPage() {
  const toast = useToast()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const activeTenantId = useAppSelector(selectTenantId)
  const isSubscriptionHolder = useAppSelector(selectIsSubscriptionHolder)
  const holderToken = useAppSelector(selectAccessToken)
  const holderUserId = useAppSelector(selectUserId)
  const canCreate = useHasPermission('tenancy.tenants.create')
  const canEdit = useHasPermission('tenancy.tenants.update') || isSubscriptionHolder
  const canDeletePermission = useHasPermission('tenancy.tenants.delete')
  // Titular siempre puede dar de baja empresas de su cupo (permiso fijo del plano suscripción).
  const canDelete = canDeletePermission || isSubscriptionHolder
  const [summary, setSummary] = useState<ListSubscriptionCompaniesDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enterBusyId, setEnterBusyId] = useState<string | null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SubscriptionCompanyListItemDto | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setLoading(true)
      try {
        setSummary(await listSubscriptionCompanies())
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Listado de empresas sincronizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar las empresas de la suscripción.')
        setError(message)
        setSummary(null)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    // Solo el titular (plano suscripción) puede listar empresas.
    if (activeTenantId && !isSubscriptionHolder) {
      void navigate('/inicio', { replace: true })
      return
    }
    void load({ silent: true })
  }, [load, activeTenantId, isSubscriptionHolder, navigate])

  const handleEnterCompany = useCallback(
    async (companyId: string) => {
      setEnterBusyId(companyId)
      try {
        if (isSubscriptionHolder && holderToken && holderUserId) {
          dispatch(setHolderResume({ accessToken: holderToken, userId: holderUserId }))
        }
        const auth = await enterCompanySession(companyId)
        const session = await fetchSession(auth.tenantId, {
          accessToken: auth.accessToken,
          tenantId: auth.tenantId,
          userId: auth.userId,
        })
        dispatch(
          setCredentials({
            accessToken: auth.accessToken,
            tenantId: auth.tenantId,
            userId: auth.userId,
          })
        )
        dispatch(setSessionPayload(session))
        toast.show({
          title: 'Modo empresa',
          message: 'Estás operando dentro de esta empresa. Usa «Mis empresas» para volver.',
          variant: 'success',
        })
        void navigate('/inicio', { replace: true })
      } catch (err: unknown) {
        toast.show({
          title: 'Error',
          message: readApiError(err, 'No se pudo entrar a la empresa.'),
          variant: 'error',
        })
      } finally {
        setEnterBusyId(null)
      }
    },
    [dispatch, holderToken, holderUserId, isSubscriptionHolder, navigate, toast]
  )

  const companyLabel = (c: SubscriptionCompanyListItemDto): string => c.name

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return
    setActionBusyId(confirmDelete.id)
    const label = companyLabel(confirmDelete)
    try {
      await deleteSubscriptionCompany(confirmDelete.id)
      toast.show({
        title: 'Empresa eliminada',
        message: `«${label}» dada de baja. El cupo quedó liberado.`,
        variant: 'success',
      })
      await load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo eliminar la empresa.'),
        variant: 'error',
      })
    } finally {
      setActionBusyId(null)
      setConfirmDelete(null)
    }
  }, [confirmDelete, load, toast])

  const singleCompanyPlan = summary?.maxTenants === 1
  const isEmpty = summary !== null && summary.companies.length === 0
  const canCreateMore = summary?.canCreateMore ?? false

  return (
    <>
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Empresas de la Licencia"
          subtitle="Empresas asociadas a tu suscripción."
        />

        {summary ? (
          <div className="ecu-stat-grid" aria-label="Resumen de cupos y empresas">
            <StatCard label="Cupos usados" value={summary.usedCount} />
            <StatCard label="Cupos libres" value={summary.slotsRemaining} />
            <StatCard label="Empresas" value={summary.companies.length} />
            <StatCard label="Cupo total" value={summary.maxTenants} />
          </div>
        ) : null}

        {singleCompanyPlan ? (
          <p className="app-shell__muted">
            Tu plan permite una sola empresa. Para multiempresa, contacta a Ecunexo para ampliar la
            licencia.
          </p>
        ) : null}

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <SectionCard title="Directorio de Empresas">
          {isEmpty && !loading ? (
            <EmptyState
              title="Aún no hay empresas registradas"
              description="Crea la primera para definir un administrador y empezar a operar con tu licencia."
              icon="domain"
              action={
                canCreate && canCreateMore ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/organizacion/empresas/nueva')}
                  >
                    Crear primera empresa
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <CompaniesGrid
              rows={summary?.companies ?? []}
              loading={loading}
              activeTenantId={activeTenantId}
              canEnter={isSubscriptionHolder}
              canEdit={canEdit}
              canDelete={canDelete}
              enterBusyId={enterBusyId}
              actionBusyId={actionBusyId}
              onEnter={(id) => {
                void handleEnterCompany(id)
              }}
              onEdit={(id) => {
                void navigate(`/organizacion/empresas/${id}/editar`)
              }}
              onDelete={setConfirmDelete}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  {canCreate ? (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={!canCreateMore}
                      title={canCreateMore ? undefined : 'No quedan cupos en la licencia'}
                      onClick={() => navigate('/organizacion/empresas/nueva')}
                    >
                      <Plus size={16} strokeWidth={2} aria-hidden />
                      Crear empresa
                    </Button>
                  ) : null}
                </div>
              }
            />
          )}
        </SectionCard>
      </div>

      <Popup
        open={confirmDelete !== null}
        title="Eliminar empresa"
        onClose={() => setConfirmDelete(null)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDelete(null),
            disabled: actionBusyId !== null,
          },
          {
            id: 'confirm',
            label: 'Sí, eliminar',
            variant: 'primary',
            onClick: () => {
              void handleDelete()
            },
            disabled: actionBusyId !== null,
          },
        ]}
      >
        {confirmDelete ? (
          <p className="app-shell__muted">
            Se dará de baja lógica «{companyLabel(confirmDelete)}». Dejará de aparecer en el listado
            y <strong>liberará un cupo</strong> de la licencia.
          </p>
        ) : null}
      </Popup>
    </>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { CompaniesGrid } from '@/pages/organization/CompaniesGrid'
import { renderSidebarIcon } from '@/config/sidebarIcons'
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

  const actionItems = useMemo((): PageActionItem[] => {
    const items: PageActionItem[] = []
    if (canCreate) {
      items.push({
        id: 'create',
        label: 'Crear empresa',
        icon: 'plus',
        route: '/organizacion/empresas/nueva',
        disabled: !canCreateMore,
        disabledReason: canCreateMore
          ? null
          : 'No quedan cupos en la licencia',
      })
    }
    items.push({
      id: 'refresh',
      label: 'Actualizar',
      icon: 'refresh-cw',
      route: null,
      disabled: loading,
    })
    return items
  }, [canCreate, canCreateMore, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
      }
    },
    [load]
  )

  return (
    <>
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Modo titular: crea, edita o da de baja empresas. Pulsa <strong>Entrar</strong> para operar una
            (equipo, roles). Luego usa <strong>Mis empresas</strong> en la barra superior para volver
            aquí.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de empresas"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={handleActionSelect}
          />
        </div>

        {summary ? (
          <div className="ecu-companies-page__metrics" aria-label="Cupo de licencia">
            <article className="ecu-companies-page__metric">
              <p className="ecu-companies-page__metric-label">Cupo usado</p>
              <p className="ecu-companies-page__metric-value">
                {summary.usedCount}
                <span className="ecu-companies-page__metric-unit"> / {summary.maxTenants}</span>
              </p>
            </article>
            <article className="ecu-companies-page__metric">
              <p className="ecu-companies-page__metric-label">Cupos restantes</p>
              <p className="ecu-companies-page__metric-value">{summary.slotsRemaining}</p>
            </article>
            <article className="ecu-companies-page__metric">
              <p className="ecu-companies-page__metric-label">Empresas</p>
              <p className="ecu-companies-page__metric-value">{summary.companies.length}</p>
            </article>
            <article className="ecu-companies-page__metric">
              <p className="ecu-companies-page__metric-label">Plan</p>
              <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                {singleCompanyPlan ? '1 empresa' : 'Multiempresa'}
              </p>
            </article>
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

        <div className="ecu-companies-page__body">
          {isEmpty && !loading ? (
            <div className="ecu-companies-page__empty">
              <h2 className="app-shell__section-title">Aún no hay empresas</h2>
              <p className="app-shell__muted app-shell__muted--pad-bottom">
                Crea la primera para definir un administrador y empezar a operar.
              </p>
              {canCreate && canCreateMore ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/organizacion/empresas/nueva')}
                >
                  Crear primera empresa
                </Button>
              ) : canCreate ? (
                <p className="app-shell__muted">No quedan cupos disponibles en la licencia.</p>
              ) : (
                <p className="app-shell__muted">
                  Requieres el permiso tenancy.tenants.create para crear empresas.
                </p>
              )}
            </div>
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
            />
          )}
        </div>
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

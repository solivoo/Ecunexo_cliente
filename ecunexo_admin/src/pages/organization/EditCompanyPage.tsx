import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import { PageHeader, StatusBadge } from '@/components/ui'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { CompanyBrandingFields } from '@/features/organization/components/CompanyBrandingFields'
import { CompanyLegalFields } from '@/features/organization/components/CompanyLegalFields'
import { CompanyLogoStudio } from '@/features/organization/components/CompanyLogoStudio'
import { CompanyRideFields } from '@/features/organization/components/CompanyRideFields'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { useEditCompanyForm } from '@/features/organization/useEditCompanyForm'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { getSubscriptionCompany, updateSubscriptionCompany } from '@/services/companiesApi'
import { selectIsSubscriptionHolder } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

const LIST_PATH = '/organizacion/empresas'

export function EditCompanyPage() {
  const { companyId = '' } = useParams<{ companyId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const isHolder = useAppSelector(selectIsSubscriptionHolder)
  const canUpdate = useHasPermission('tenancy.tenants.update') || isHolder
  const { applyTenant, branding, legal, ride, patchBranding, patchLegal, patchRide, toBody } =
    useEditCompanyForm()

  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      applyTenant(await getSubscriptionCompany(companyId))
      setHydrated(true)
      setError(null)
    } catch (err: unknown) {
      setHydrated(false)
      setError(readApiError(err, 'No se pudo cargar la empresa.'))
    } finally {
      setLoading(false)
    }
  }, [applyTenant, companyId])

  useEffect(() => {
    void load()
  }, [load])

  const actionItems = useMemo(
    (): PageActionItem[] => [
      { id: 'back-list', label: 'Volver al listado', icon: 'building-2', route: LIST_PATH },
      {
        id: 'billing-config',
        label: 'Facturación electrónica',
        icon: 'receipt',
        route: '/organizacion/facturacion-electronica',
      },
    ],
    []
  )

  const onSubmit = useCallback(async () => {
    const body = toBody()
    if (typeof body === 'string') {
      setError(body)
      return
    }
    setError(null)
    setBusy(true)
    try {
      await updateSubscriptionCompany(companyId, body)
      toast.show({
        title: 'Empresa actualizada',
        message: `Se guardaron los datos de «${body.name}».`,
        variant: 'success',
      })
      void navigate(LIST_PATH, { replace: true })
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo guardar la empresa.')
      setError(message)
      toast.show({ title: 'No se pudo guardar', message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }, [companyId, navigate, toBody, toast])

  if (!canUpdate) {
    return (
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Editar Empresa"
          subtitle="Requieres el permiso tenancy.tenants.update para editar empresas."
          badge={<StatusBadge tone="danger">Acceso Restringido</StatusBadge>}
        />
        <Button type="button" variant="outline" onClick={() => navigate(LIST_PATH)}>
          Volver al listado
        </Button>
      </div>
    )
  }

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title="Editar Empresa"
        subtitle="Edita el nombre comercial, branding corporativo e identidad legal. Puntos de emisión, secuencial y modo SRI están en Facturación electrónica."
        badge={<StatusBadge tone="primary">Modo Edición</StatusBadge>}
        actions={
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de editar empresa"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        }
      />

      <PageLoadState
        loading={loading}
        error={!hydrated ? error : null}
        empty={false}
      >
        {hydrated && error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="ecu-companies-form">
          <CompanyBrandingFields
            idPrefix="ec"
            hint="Nombre visible de la empresa. El SRI lo muestra como nombre comercial."
            disabled={busy}
            values={branding}
            onChange={patchBranding}
          />
          <CompanyLogoStudio
            tenantId={companyId}
            companyName={branding.tenantName}
            disabled={busy}
          />
          <form
            className="ecu-companies-form"
            onSubmit={(e) => {
              e.preventDefault()
              void onSubmit()
            }}
            noValidate
          >
            <CompanyLegalFields
              idPrefix="ec"
              disabled={busy}
              tradeNameReadOnly
              values={legal}
              onChange={patchLegal}
            />
            <CompanyRideFields
              idPrefix="ec"
              disabled={busy}
              values={ride}
              onChange={patchRide}
            />
            <div className="ecu-companies-form__actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                fullWidth
                onClick={() => navigate(LIST_PATH)}
              >
                Atrás
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                disabled={busy || loading}
                fullWidth
              >
                Guardar
              </Button>
            </div>
          </form>
        </div>
      </PageLoadState>
    </div>
  )
}

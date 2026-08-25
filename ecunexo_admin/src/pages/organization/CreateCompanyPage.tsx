import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { UserRound } from 'lucide-react'
import { CompanyBrandingFields } from '@/features/organization/components/CompanyBrandingFields'
import { isAccentColorValid } from '@/features/organization/companyFormOptions'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { listSubscriptionCompanies, provisionSubscriptionCompany } from '@/services/companiesApi'
import { selectUserEmail, selectUserName } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function CreateCompanyPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const canCreate = useHasPermission('tenancy.tenants.create')
  const defaultEmail = useAppSelector(selectUserEmail) ?? ''
  const defaultName = useAppSelector(selectUserName) ?? ''

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quotaHint, setQuotaHint] = useState<string | null>(null)

  const [tenantName, setTenantName] = useState('')
  const [timeZoneId, setTimeZoneId] = useState('America/Guayaquil')
  const [locale, setLocale] = useState('es-EC')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColorHex, setPrimaryColorHex] = useState('#3B82F6')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [ownerPasswordConfirm, setOwnerPasswordConfirm] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')

  useEffect(() => {
    if (defaultEmail) setOwnerEmail(defaultEmail)
  }, [defaultEmail])

  useEffect(() => {
    if (defaultName && !ownerName) setOwnerName(defaultName)
  }, [defaultName, ownerName])

  const checkQuota = useCallback(async () => {
    try {
      const summary = await listSubscriptionCompanies()
      if (!summary.canCreateMore) {
        setQuotaHint('No quedan cupos disponibles en la licencia.')
      } else {
        setQuotaHint(
          `Cupo: ${summary.usedCount} / ${summary.maxTenants} empresas (${summary.slotsRemaining} restantes).`
        )
      }
      return summary.canCreateMore
    } catch {
      setQuotaHint(null)
      return true
    }
  }, [])

  useEffect(() => {
    void checkQuota()
  }, [checkQuota])

  const goToList = useCallback(() => {
    void navigate('/organizacion/empresas')
  }, [navigate])

  const actionItems = useMemo(
    (): PageActionItem[] => [
      {
        id: 'back-list',
        label: 'Volver al listado',
        icon: 'building-2',
        route: '/organizacion/empresas',
      },
      {
        id: 'plan',
        label: 'Plan y licencia',
        icon: 'bar-chart-3',
        route: '/organizacion/plan',
      },
    ],
    []
  )

  const onSubmit = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const email = (defaultEmail || ownerEmail).trim()
      if (!tenantName.trim()) throw new Error('El nombre de la empresa es obligatorio.')
      if (!email) throw new Error('No hay correo del titular en la sesión. Vuelve a iniciar sesión.')
      if (!ownerName.trim()) throw new Error('El nombre del administrador es obligatorio.')
      if (ownerPassword.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
      if (ownerPassword !== ownerPasswordConfirm) {
        throw new Error('La contraseña y su confirmación no coinciden.')
      }

      const color = primaryColorHex.trim()
      if (!isAccentColorValid(color)) {
        throw new Error('El color de acento debe ser #RGB o #RRGGBB.')
      }

      const can = await checkQuota()
      if (!can) throw new Error('No quedan cupos disponibles en la licencia.')

      const companyName = tenantName.trim()
      await provisionSubscriptionCompany({
        tenantName: companyName,
        timeZoneId: timeZoneId.trim() || 'America/Guayaquil',
        locale: locale.trim() || 'es-EC',
        logoUrl: logoUrl.trim() || null,
        primaryColorHex: color || null,
        ownerEmail: email,
        ownerName: ownerName.trim(),
        ownerPassword,
        ownerDepartment: null,
        ownerPhone: ownerPhone.trim() || null,
        ownerJobTitle: null,
      })

      toast.show({
        title: 'Empresa creada',
        message: `«${companyName}» quedó registrada. Usa Entrar cuando quieras operar en ella.`,
        variant: 'success',
      })
      void navigate('/organizacion/empresas', { replace: true })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : readApiError(err, 'No se pudo crear la empresa.')
      setError(message)
      toast.show({ title: 'No se pudo crear', message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }, [
    checkQuota,
    defaultEmail,
    locale,
    logoUrl,
    navigate,
    ownerEmail,
    ownerName,
    ownerPassword,
    ownerPasswordConfirm,
    ownerPhone,
    primaryColorHex,
    tenantName,
    timeZoneId,
    toast,
  ])

  if (!canCreate) {
    return (
      <div className="ecu-companies-page">
        <p className="app-shell__page-lead">
          Requieres el permiso tenancy.tenants.create para crear empresas.
        </p>
        <Button type="button" variant="outline" onClick={goToList}>
          Volver al listado
        </Button>
      </div>
    )
  }

  return (
    <div className="ecu-companies-page">
      <div className="ecu-page-header">
        <div>
          {quotaHint ? (
            <p className="app-shell__page-lead">{quotaHint}</p>
          ) : (
            <p className="app-shell__page-lead">
              Alta de una empresa bajo la organización de la licencia. Sin empresas aún, el titular
              solo gestiona el cupo.
            </p>
          )}
        </div>
        <EcuPageActions
          items={actionItems}
          variant="outline"
          triggerLabel="Acciones de crear empresa"
          renderIcon={renderSidebarIcon}
          onNavigate={(route: string) => navigate(route)}
        />
      </div>

      {error ? (
        <p className="welcome-onboarding__error" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="ecu-companies-form"
        onSubmit={(e) => {
          e.preventDefault()
          void onSubmit()
        }}
        noValidate
      >
        <CompanyBrandingFields
          idPrefix="cc"
          hint="La licencia cubre la organización (titular). Aquí das de alta una empresa bajo ese cupo."
          disabled={busy}
          values={{ tenantName, timeZoneId, locale, logoUrl, primaryColorHex }}
          onChange={(key, value) => {
            if (key === 'tenantName') setTenantName(value)
            if (key === 'timeZoneId') setTimeZoneId(value)
            if (key === 'locale') setLocale(value)
            if (key === 'logoUrl') setLogoUrl(value)
            if (key === 'primaryColorHex') setPrimaryColorHex(value)
          }}
        />

        <section className="app-shell__card ecu-companies-form__card">
          <h2 className="app-shell__section-title">
            <UserRound size={18} strokeWidth={1.75} aria-hidden /> Administrador (titular)
          </h2>
          <p className="ecu-companies-form__hint">
            El correo queda fijado al del titular. Define la contraseña inicial del usuario en esta
            empresa.
          </p>
          <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
            <div className="ecu-companies-form__field">
              <TextBox
                id="cc-email"
                label="Correo del titular"
                labelPosition="outlined"
                variant="outline"
                type="email"
                value={ownerEmail}
                readOnly
                disabled
                required
                fullWidth
              />
            </div>
            <div className="ecu-companies-form__field">
              <TextBox
                id="cc-owner"
                label="Nombre"
                labelPosition="outlined"
                variant="outline"
                value={ownerName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setOwnerName(e.target.value)}
                required
                disabled={busy}
                fullWidth
              />
            </div>
            <div className="ecu-companies-form__field">
              <TextBox
                id="cc-password"
                label="Contraseña inicial"
                labelPosition="outlined"
                variant="outline"
                type="password"
                value={ownerPassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setOwnerPassword(e.target.value)}
                required
                disabled={busy}
                fullWidth
              />
            </div>
            <div className="ecu-companies-form__field">
              <TextBox
                id="cc-password-confirm"
                label="Confirmar contraseña"
                labelPosition="outlined"
                variant="outline"
                type="password"
                value={ownerPasswordConfirm}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setOwnerPasswordConfirm(e.target.value)
                }
                required
                disabled={busy}
                fullWidth
                error={
                  ownerPasswordConfirm.length > 0 && ownerPassword !== ownerPasswordConfirm
                }
                errorMessage={
                  ownerPasswordConfirm.length > 0 && ownerPassword !== ownerPasswordConfirm
                    ? 'No coincide con la contraseña'
                    : undefined
                }
              />
            </div>
            <div className="ecu-companies-form__field">
              <TextBox
                id="cc-phone"
                label="Teléfono"
                labelPosition="outlined"
                variant="outline"
                value={ownerPhone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setOwnerPhone(e.target.value)}
                disabled={busy}
                fullWidth
              />
            </div>
          </div>
        </section>

        <div className="ecu-companies-form__actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            fullWidth
            onClick={goToList}
          >
            Atrás
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={busy}
            fullWidth
          >
            Guardar
          </Button>
        </div>
      </form>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, TextBox, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { KeyRound } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { getTenantUser, setTenantUserPassword } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantUserDto } from '@/types/identityApi'

export function ResetUserPasswordPage() {
  const { userId = '' } = useParams<{ userId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canUpdate = useHasPermission('identity.users.update')

  const [user, setUser] = useState<GetTenantUserDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const detailPath = `/equipo/usuarios/${userId}`

  const load = useCallback(async () => {
    if (!tenantId || !userId) return
    setLoading(true)
    try {
      const u = await getTenantUser(tenantId, userId)
      setUser(u)
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo cargar el usuario.'))
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId, userId])

  useEffect(() => {
    void load()
  }, [load])

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      {
        id: 'detail',
        label: 'Ficha del usuario',
        icon: 'users',
        route: detailPath,
        disabled: false,
      },
      {
        id: 'edit',
        label: 'Editar perfil',
        icon: 'pencil',
        route: `/equipo/usuarios/${userId}/editar`,
        disabled: false,
      },
      {
        id: 'list',
        label: 'Listado de usuarios',
        icon: 'users',
        route: '/equipo/usuarios',
        disabled: false,
      },
    ],
    [detailPath, userId]
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId) return
      setBusy(true)
      setError(null)
      try {
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
        if (password !== passwordConfirm) throw new Error('Las contraseñas no coinciden.')
        await setTenantUserPassword(tenantId, userId, { password })
        toast.show({
          title: 'Contraseña actualizada',
          message: user
            ? `«${user.name}» ya puede iniciar sesión con la nueva contraseña.`
            : 'La contraseña quedó guardada.',
          variant: 'success',
        })
        void navigate(detailPath, { replace: true })
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : readApiError(err, 'No se pudo restablecer la contraseña.')
        setError(message)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [detailPath, navigate, password, passwordConfirm, tenantId, toast, user, userId]
  )

  if (!canUpdate) {
    return (
      <TenantSessionGate
        title="Restablecer contraseña"
        lead="Define una nueva contraseña para el usuario."
      >
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres identity.users.update para restablecer contraseñas.
          </p>
          <Button type="button" variant="outline" onClick={() => navigate(detailPath)}>
            Volver a la ficha
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Restablecer contraseña"
      lead="Define una nueva contraseña para el usuario."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Restablecer Contraseña"
          subtitle={
            user
              ? `Actualizar credenciales de acceso para ${user.name} (${user.email}).`
              : 'Asignar nueva contraseña de acceso.'
          }
          badge={
            <StatusBadge tone="warning" withDot>
              Seguridad
            </StatusBadge>
          }
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => navigate(detailPath)}>
                Volver a la Ficha
              </Button>
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
              />
            </>
          }
        />

        <PageLoadState loading={loading} error={error && !user ? error : null} empty={!user && !loading}>
          {user ? (
            <form className="ecu-companies-form" onSubmit={(e) => void onSubmit(e)} noValidate>
              {error ? (
                <p className="welcome-onboarding__error" role="alert">
                  {error}
                </p>
              ) : null}

              <SectionCard
                title={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <KeyRound size={18} strokeWidth={1.75} aria-hidden /> Nueva Clave de Acceso
                  </span>
                }
                subtitle="Mínimo 8 caracteres requeridos. Comunícasela al colaborador de forma segura."
              >
                <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                  <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                    <TextBox
                      id="rp-password"
                      label="Nueva contraseña"
                      labelPosition="outlined"
                      variant="outline"
                      type="password"
                      value={password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      required
                      disabled={busy || user.isDisabled}
                      fullWidth
                    />
                  </div>
                  <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                    <TextBox
                      id="rp-password-confirm"
                      label="Confirmar contraseña"
                      labelPosition="outlined"
                      variant="outline"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setPasswordConfirm(e.target.value)
                      }
                      required
                      disabled={busy || user.isDisabled}
                      fullWidth
                      error={passwordConfirm.length > 0 && password !== passwordConfirm}
                      errorMessage={
                        passwordConfirm.length > 0 && password !== passwordConfirm
                          ? 'No coincide con la contraseña'
                          : undefined
                      }
                    />
                  </div>
                </div>
                {user.isDisabled ? (
                  <p className="welcome-onboarding__error" role="status" style={{ marginTop: '1rem' }}>
                    El usuario está deshabilitado. Habilítalo antes de cambiar la contraseña.
                  </p>
                ) : null}
              </SectionCard>

              <div className="ecu-companies-form__actions">
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={busy || user.isDisabled}
                >
                  Guardar Contraseña
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => navigate(detailPath)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}
        </PageLoadState>
      </div>
    </TenantSessionGate>
  )
}

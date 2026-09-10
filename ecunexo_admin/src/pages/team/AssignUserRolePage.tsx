import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Select, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { Shield } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { assignUserRole, getTenantUser, listTenantRoles } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantUserDto, RoleListItemDto } from '@/types/identityApi'

export function AssignUserRolePage() {
  const { userId = '' } = useParams<{ userId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canAssign = useHasPermission('identity.roles.manage')

  const [user, setUser] = useState<GetTenantUserDto | null>(null)
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detailPath = `/equipo/usuarios/${userId}`

  const load = useCallback(async () => {
    if (!tenantId || !userId) return
    setLoading(true)
    try {
      const [u, r] = await Promise.all([getTenantUser(tenantId, userId), listTenantRoles(tenantId)])
      setUser(u)
      setRoles(r)
      setError(null)
    } catch (err: unknown) {
      const message = readApiError(err, 'No se pudo cargar la asignación de roles.')
      setError(message)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId, userId])

  useEffect(() => {
    void load()
  }, [load])

  const assignableRoles = useMemo(
    () => roles.filter((r) => !user?.roleIds.includes(r.id)),
    [roles, user?.roleIds]
  )

  const roleOptions = useMemo(
    () => assignableRoles.map((r) => ({ value: r.id, label: r.name })),
    [assignableRoles]
  )

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
        id: 'roles',
        label: 'Catálogo de roles',
        icon: 'shield',
        route: '/equipo/roles',
        disabled: false,
      },
    ],
    [detailPath]
  )

  const onSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()
      if (!tenantId || !selectedRoleId) return
      setBusy(true)
      setError(null)
      try {
        await assignUserRole(tenantId, userId, selectedRoleId)
        const roleName = assignableRoles.find((r) => r.id === selectedRoleId)?.name ?? 'Rol'
        toast.show({
          title: 'Rol asignado',
          message: `«${roleName}» quedó vinculado al usuario.`,
          variant: 'success',
        })
        void navigate(detailPath, { replace: true })
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo asignar el rol.')
        setError(message)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [assignableRoles, detailPath, navigate, selectedRoleId, tenantId, toast, userId]
  )

  if (!canAssign) {
    return (
      <TenantSessionGate title="Asignar rol" lead="Vincula un rol RBAC al usuario.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres identity.roles.manage para asignar roles.
          </p>
          <Button type="button" variant="outline" onClick={() => navigate(detailPath)}>
            Volver a la ficha
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  if (user?.isCompanyOwner) {
    return (
      <TenantSessionGate title="Asignar rol" lead="Vincula un rol RBAC al usuario.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Este es el administrador raíz de la empresa (correo del titular). Su rol no se puede
            cambiar.
          </p>
          <Button type="button" variant="outline" onClick={() => navigate(detailPath)}>
            Volver a la ficha
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Asignar rol" lead="Vincula un rol RBAC al usuario.">
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Asignar Rol"
          subtitle={
            user
              ? `Vincular un perfil de seguridad a ${user.name} (${user.email}).`
              : 'Selecciona un rol para heredar permisos.'
          }
          badge={
            <StatusBadge tone="primary" withDot>
              Permisos RBAC
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
                    <Shield size={18} strokeWidth={1.75} aria-hidden /> Selección de Rol
                  </span>
                }
                subtitle="Solo aparecen los roles que este usuario aún no tiene vinculados."
              >
                {assignableRoles.length === 0 ? (
                  <p className="app-shell__muted">
                    Este usuario ya tiene todos los roles del catálogo asignados.
                  </p>
                ) : (
                  <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                    <div className="ecu-companies-form__field ecu-companies-form__field--span-2">
                      <Select
                        id="assign-role"
                        label="Rol a asignar"
                        labelPosition="outlined"
                        variant="outline"
                        options={roleOptions}
                        value={selectedRoleId}
                        onChange={setSelectedRoleId}
                        placeholder="Selecciona un rol"
                        disabled={busy}
                        fullWidth
                      />
                    </div>
                  </div>
                )}
              </SectionCard>

              <div className="ecu-companies-form__actions">
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={busy || !selectedRoleId || assignableRoles.length === 0}
                >
                  Asignar Rol
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

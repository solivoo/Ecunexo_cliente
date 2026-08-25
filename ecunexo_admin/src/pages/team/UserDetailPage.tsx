import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Popup, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { UserRound } from 'lucide-react'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDateTime } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import { getTenantUser, listPermissions, listTenantRoles, setTenantUserDisabled, deleteTenantUser } from '@/services/identityApi'
import { selectTenantId, selectUserId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import {
  EffectivePermissionsGrid,
  type EffectivePermissionRow,
} from '@/pages/team/EffectivePermissionsGrid'
import type {
  GetTenantUserDto,
  PermissionListItemDto,
  RoleListItemDto,
} from '@/types/identityApi'

export function UserDetailPage() {
  const { userId = '' } = useParams<{ userId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const currentUserId = useAppSelector(selectUserId)
  const canAssignRole = useHasPermission('identity.roles.manage')
  const canUpdate = useHasPermission('identity.users.update')
  const canDelete = useHasPermission('identity.users.delete')
  const [user, setUser] = useState<GetTenantUserDto | null>(null)
  const [roles, setRoles] = useState<RoleListItemDto[]>([])
  const [catalog, setCatalog] = useState<PermissionListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId || !userId) return
      setLoading(true)
      try {
        const [u, r, perms] = await Promise.all([
          getTenantUser(tenantId, userId),
          listTenantRoles(tenantId),
          listPermissions(),
        ])
        setUser(u)
        setRoles(r)
        setCatalog(perms)
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Ficha de usuario sincronizada.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar el usuario.')
        setError(message)
        setUser(null)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast, userId]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  const roleNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const x of roles) m.set(x.id, x.name)
    return m
  }, [roles])

  const assignableCount = useMemo(
    () => roles.filter((r) => !user?.roleIds.includes(r.id)).length,
    [roles, user?.roleIds]
  )

  const permissionRows = useMemo((): EffectivePermissionRow[] => {
    if (!user) return []
    const byCode = new Map(catalog.map((p) => [p.code, p]))
    return user.effectivePermissionCodes
      .map((code) => {
        const p = byCode.get(code)
        return {
          id: p?.id ?? code,
          code,
          displayName: p?.displayName ?? null,
          description: p?.description ?? null,
          module: p?.module ?? null,
          permissionId: p?.id ?? null,
        }
      })
      .sort((a, b) => a.code.localeCompare(b.code, 'es'))
  }, [catalog, user])

  const actionItems = useMemo<PageActionItem[]>(() => {
    const isSelf = currentUserId === userId
    const items: PageActionItem[] = [
      {
        id: 'list',
        label: 'Listado de usuarios',
        icon: 'users',
        route: '/equipo/usuarios',
        disabled: false,
      },
    ]
    if (canUpdate) {
      items.push({
        id: 'edit',
        label: 'Editar',
        icon: 'pencil',
        route: `/equipo/usuarios/${userId}/editar`,
        disabled: false,
      })
      items.push({
        id: 'password',
        label: 'Restablecer contraseña',
        icon: 'key',
        route: `/equipo/usuarios/${userId}/contrasena`,
        disabled: Boolean(user?.isDisabled),
        disabledReason: user?.isDisabled
          ? 'Habilita el usuario antes de cambiar la contraseña'
          : null,
      })
      items.push({
        id: 'toggle-disabled',
        label: user?.isDisabled ? 'Habilitar' : 'Deshabilitar',
        icon: 'user-x',
        route: null,
        disabled: isSelf || actionBusy,
        disabledReason: isSelf ? 'No puedes deshabilitarte a ti mismo' : null,
      })
    }
    if (canDelete) {
      items.push({
        id: 'delete',
        label: 'Eliminar',
        icon: 'trash-2',
        route: null,
        disabled: isSelf || actionBusy,
        disabledReason: isSelf ? 'No puedes eliminarte a ti mismo' : null,
      })
    }
    if (canAssignRole) {
      items.push({
        id: 'assign',
        label: 'Asignar rol',
        icon: 'shield',
        route: `/equipo/usuarios/${userId}/roles/asignar`,
        disabled: user?.isCompanyOwner === true || assignableCount === 0,
        disabledReason:
          user?.isCompanyOwner === true
            ? 'El administrador raíz no puede cambiar de rol'
            : assignableCount === 0
              ? 'No hay roles disponibles para asignar'
              : null,
      })
    }
    items.push(
      {
        id: 'roles',
        label: 'Catálogo de roles',
        icon: 'shield-check',
        route: '/equipo/roles',
        disabled: false,
      },
      {
        id: 'refresh',
        label: 'Actualizar',
        icon: 'refresh-cw',
        route: null,
        disabled: loading,
      }
    )
    return items
  }, [
    actionBusy,
    assignableCount,
    canAssignRole,
    canDelete,
    canUpdate,
    currentUserId,
    loading,
    user?.isCompanyOwner,
    user?.isDisabled,
    userId,
  ])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
        return
      }
      if (item.id === 'toggle-disabled' && tenantId && user) {
        void (async () => {
          setActionBusy(true)
          try {
            const next = !user.isDisabled
            await setTenantUserDisabled(tenantId, userId, next)
            toast.show({
              title: next ? 'Usuario deshabilitado' : 'Usuario habilitado',
              message: `«${user.name}» quedó ${next ? 'sin acceso' : 'activo'}.`,
              variant: 'success',
            })
            await load({ silent: true })
          } catch (err: unknown) {
            toast.show({
              title: 'Error',
              message: readApiError(err, 'No se pudo cambiar el estado.'),
              variant: 'error',
            })
          } finally {
            setActionBusy(false)
          }
        })()
        return
      }
      if (item.id === 'delete') {
        setConfirmDelete(true)
      }
    },
    [load, tenantId, toast, user, userId]
  )

  const handleDelete = useCallback(async () => {
    if (!tenantId || !user) return
    setActionBusy(true)
    try {
      await deleteTenantUser(tenantId, userId)
      toast.show({
        title: 'Usuario eliminado',
        message: `«${user.name}» dado de baja.`,
        variant: 'success',
      })
      void navigate('/equipo/usuarios', { replace: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo eliminar el usuario.'),
        variant: 'error',
      })
      setActionBusy(false)
      setConfirmDelete(false)
    }
  }, [navigate, tenantId, toast, user, userId])

  return (
    <TenantSessionGate title="Usuario" lead="Ficha, roles y permisos efectivos.">
      <div className="ecu-companies-page">
        <PageLoadState loading={loading && !user} error={error} empty={!user && !loading}>
          {user ? (
            <>
              <div className="ecu-page-header">
                <div>
                  <p className="app-shell__page-lead">
                    <strong>{user.name}</strong> · {user.email}
                  </p>
                </div>
                <EcuPageActions
                  items={actionItems}
                  variant="outline"
                  triggerLabel="Acciones de usuario"
                  renderIcon={renderSidebarIcon}
                  onNavigate={(route: string) => navigate(route)}
                  onActionSelect={handleActionSelect}
                />
              </div>

              <div className="ecu-companies-page__metrics" aria-label="Resumen del usuario">
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Estado</p>
                  <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                    {user.isDisabled ? 'Deshabilitado' : 'Activo'}
                  </p>
                </article>
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Roles</p>
                  <p className="ecu-companies-page__metric-value">{user.roleIds.length}</p>
                </article>
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Permisos</p>
                  <p className="ecu-companies-page__metric-value">
                    {user.effectivePermissionCodes.length}
                  </p>
                </article>
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Último acceso</p>
                  <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                    {formatDateTime(user.lastLoginAt)}
                  </p>
                </article>
              </div>

              <section className="app-shell__card ecu-companies-form__card">
                <h2 className="app-shell__section-title">
                  <UserRound size={18} strokeWidth={1.75} aria-hidden /> Perfil
                </h2>
                <p className="ecu-companies-form__hint">Datos de contacto en esta empresa.</p>
                <div className="ecu-companies-form__grid ecu-companies-form__grid--4">
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-page__metric-label">Departamento</p>
                    <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                      {user.department ?? '—'}
                    </p>
                  </div>
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-page__metric-label">Teléfono</p>
                    <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                      {user.phone ?? '—'}
                    </p>
                  </div>
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-page__metric-label">Puesto</p>
                    <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                      {user.jobTitle ?? '—'}
                    </p>
                  </div>
                  <div className="ecu-companies-form__field">
                    <p className="ecu-companies-page__metric-label">Correo</p>
                    <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                      {user.email}
                    </p>
                  </div>
                </div>
              </section>

              <section className="app-shell__card ecu-companies-form__card">
                <h2 className="app-shell__section-title">Roles</h2>
                <p className="ecu-companies-form__hint">
                  Asigna roles para heredar permisos. Usa el menú de acciones para agregar otro.
                </p>
                {user.roleIds.length === 0 ? (
                  <p className="app-shell__muted">Sin roles asignados.</p>
                ) : (
                  <ul className="ecu-plan-page__chips" aria-label="Roles asignados">
                    {user.roleIds.map((rid) => (
                      <li key={rid}>
                        <Link to={`/equipo/roles/${rid}`} className="ecu-plan-page__chip">
                          {roleNameById.get(rid) ?? rid}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="app-shell__card ecu-companies-form__card">
                <h2 className="app-shell__section-title">Permisos efectivos</h2>
                <p className="ecu-companies-form__hint">
                  Unión de permisos de todos los roles (ABAC se evalúa en runtime).
                </p>
                {permissionRows.length === 0 ? (
                  <p className="app-shell__muted">Ninguno.</p>
                ) : (
                  <EffectivePermissionsGrid rows={permissionRows} loading={loading} />
                )}
              </section>
            </>
          ) : null}
        </PageLoadState>
      </div>

      <Popup
        open={confirmDelete}
        title="Eliminar usuario"
        onClose={() => setConfirmDelete(false)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDelete(false),
            disabled: actionBusy,
          },
          {
            id: 'confirm',
            label: 'Sí, eliminar',
            variant: 'primary',
            onClick: () => {
              void handleDelete()
            },
            disabled: actionBusy,
          },
        ]}
      >
        {user ? (
          <p className="app-shell__muted">
            ¿Dar de baja a <strong>{user.name}</strong> ({user.email})? No podrá iniciar sesión. Es
            una baja lógica.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}

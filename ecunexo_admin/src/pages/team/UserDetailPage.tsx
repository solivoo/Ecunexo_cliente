import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Popup, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  SectionCard,
  GridToolbarRefresh,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate, formatDateTime } from '@/lib/formatDate'
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
    items.push(
      {
        id: 'roles',
        label: 'Catálogo de roles',
        icon: 'shield-check',
        route: '/equipo/roles',
        disabled: false,
      }
    )
    return items
  }, [
    actionBusy,
    canDelete,
    canUpdate,
    currentUserId,
    user?.isDisabled,
    userId,
  ])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
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
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageLoadState loading={loading && !user} error={error} empty={!user && !loading}>
          {user ? (
            <>
              <PageHeader
                title={user.name}
                subtitle={user.email}
                actions={
                  <>
                    <GridToolbarRefresh
                      loading={loading}
                      onRefresh={() => void load()}
                      label="Actualizar ficha"
                    />
                    {canUpdate && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(`/equipo/usuarios/${userId}/editar`)}
                      >
                        Editar Ficha
                      </Button>
                    )}
                    {canAssignRole && !user.isCompanyOwner && assignableCount > 0 && (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => navigate(`/equipo/usuarios/${userId}/roles/asignar`)}
                      >
                        + Asignar Rol
                      </Button>
                    )}
                    <EcuPageActions
                      items={actionItems}
                      variant="outline"
                      triggerLabel="Acciones"
                      renderIcon={renderSidebarIcon}
                      onNavigate={(route: string) => navigate(route)}
                      onActionSelect={handleActionSelect}
                    />
                  </>
                }
              />

              <SectionCard title="Perfil" bodyClassName="ecu-section-card__body--padded">
                <div className="ecu-property-grid">
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Estado</span>
                    <span className="ecu-property-tile__value">
                      <span
                        className={`ecu-status ${
                          user.isDisabled ? 'ecu-status--inactive' : 'ecu-status--active'
                        }`}
                      >
                        <span className="ecu-status__dot" aria-hidden />
                        {user.isDisabled ? 'Deshabilitado' : 'Activo'}
                      </span>
                    </span>
                  </div>
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Departamento</span>
                    <span className="ecu-property-tile__value">{user.department ?? '—'}</span>
                  </div>
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Puesto o cargo</span>
                    <span className="ecu-property-tile__value">{user.jobTitle ?? '—'}</span>
                  </div>
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Teléfono</span>
                    <span className="ecu-property-tile__value">{user.phone ?? '—'}</span>
                  </div>
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Último acceso</span>
                    <span className="ecu-property-tile__value">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Sin registro'}
                    </span>
                  </div>
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Alta</span>
                    <span className="ecu-property-tile__value">{formatDate(user.createdAt)}</span>
                  </div>
                  <div className="ecu-property-tile ecu-property-tile--full">
                    <span className="ecu-property-tile__label">Perfil</span>
                    <span className="ecu-property-tile__value">
                      {user.isCompanyOwner ? 'Administrador principal' : 'Cuenta de usuario'}
                    </span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Roles de seguridad" bodyClassName="ecu-section-card__body--padded">
                {user.roleIds.length === 0 ? (
                  <span className="ecu-hint">Sin roles asignados.</span>
                ) : (
                  <ul className="ecu-plan-page__chips" aria-label="Roles asignados">
                    {user.roleIds.map((rid) => (
                      <li key={rid}>
                        <Link to={`/equipo/roles/${rid}`} className="ecu-chip ecu-chip--accent">
                          {roleNameById.get(rid) ?? rid}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Permisos efectivos">
                {permissionRows.length === 0 ? (
                  <div className="ecu-section-card__body--padded">
                    <span className="ecu-hint">No cuenta con directivas asignadas.</span>
                  </div>
                ) : (
                  <EffectivePermissionsGrid rows={permissionRows} loading={loading} />
                )}
              </SectionCard>
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { UsersGrid } from '@/pages/team/UsersGrid'
import {
  deleteTenantUser,
  listTenantUsers,
  setTenantUserDisabled,
} from '@/services/identityApi'
import { selectTenantId, selectUserId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { UserListItemDto } from '@/types/identityApi'

export function UsersListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const currentUserId = useAppSelector(selectUserId)
  const canCreate = useHasPermission('identity.users.create')
  const canUpdate = useHasPermission('identity.users.update')
  const canDelete = useHasPermission('identity.users.delete')
  const [rows, setRows] = useState<UserListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserListItemDto | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listTenantUsers(tenantId))
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Listado de usuarios sincronizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar la lista de usuarios.')
        setError(message)
        setRows([])
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  const setDisabled = useCallback(
    async (user: UserListItemDto, disabled: boolean) => {
      if (!tenantId) return
      setActionBusyId(user.id)
      try {
        await setTenantUserDisabled(tenantId, user.id, disabled)
        toast.show({
          title: disabled ? 'Usuario deshabilitado' : 'Usuario habilitado',
          message: `«${user.name}» quedó ${disabled ? 'sin acceso' : 'activo'}.`,
          variant: 'success',
        })
        await load({ silent: true })
      } catch (err: unknown) {
        toast.show({
          title: 'Error',
          message: readApiError(err, 'No se pudo cambiar el estado del usuario.'),
          variant: 'error',
        })
      } finally {
        setActionBusyId(null)
      }
    },
    [load, tenantId, toast]
  )

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirmDelete) return
    setActionBusyId(confirmDelete.id)
    try {
      await deleteTenantUser(tenantId, confirmDelete.id)
      toast.show({
        title: 'Usuario eliminado',
        message: `«${confirmDelete.name}» dado de baja.`,
        variant: 'success',
      })
      setConfirmDelete(null)
      await load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        message: readApiError(err, 'No se pudo eliminar el usuario.'),
        variant: 'error',
      })
    } finally {
      setActionBusyId(null)
    }
  }, [confirmDelete, load, tenantId, toast])

  const disabledCount = useMemo(() => rows.filter((r) => r.isDisabled).length, [rows])

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canCreate) {
      items.push({
        id: 'create',
        label: 'Nuevo usuario',
        icon: 'user-plus',
        route: '/equipo/usuarios/nueva',
        disabled: false,
      })
    }
    items.push(
      {
        id: 'roles',
        label: 'Roles',
        icon: 'shield',
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
  }, [canCreate, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
      }
    },
    [load]
  )

  const isEmpty = !loading && rows.length === 0 && !error

  return (
    <TenantSessionGate
      title="Usuarios"
      lead="Alta de personas en la empresa y asignación de roles."
    >
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Personas de esta empresa. Edita, deshabilita o elimina desde el listado o la ficha.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de usuarios"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={handleActionSelect}
          />
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de usuarios">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Usuarios</p>
            <p className="ecu-companies-page__metric-value">{rows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Activos</p>
            <p className="ecu-companies-page__metric-value">{rows.length - disabledCount}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Deshabilitados</p>
            <p className="ecu-companies-page__metric-value">{disabledCount}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Con acceso reciente</p>
            <p className="ecu-companies-page__metric-value">
              {rows.filter((r) => r.lastLoginAt).length}
            </p>
          </article>
        </div>

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ecu-companies-page__body">
          {isEmpty ? (
            <div className="ecu-companies-page__empty">
              <h2 className="app-shell__section-title">Aún no hay usuarios</h2>
              <p className="app-shell__muted app-shell__muted--pad-bottom">
                Crea el primero para asignar roles y operar en la empresa.
              </p>
              {canCreate ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/equipo/usuarios/nueva')}
                >
                  Nuevo usuario
                </Button>
              ) : (
                <p className="app-shell__muted">
                  Requieres el permiso identity.users.create para crear usuarios.
                </p>
              )}
            </div>
          ) : (
            <UsersGrid
              rows={rows}
              loading={loading}
              canUpdate={canUpdate}
              canDelete={canDelete}
              actionBusyId={actionBusyId}
              currentUserId={currentUserId}
              onDisable={(u) => void setDisabled(u, true)}
              onEnable={(u) => void setDisabled(u, false)}
              onDelete={setConfirmDelete}
            />
          )}
        </div>
      </div>

      <Popup
        open={confirmDelete !== null}
        title="Eliminar usuario"
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
            ¿Dar de baja a <strong>{confirmDelete.name}</strong> ({confirmDelete.email})? No podrá
            iniciar sesión. Es una baja lógica.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}

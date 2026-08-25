import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { RolesGrid } from '@/pages/team/RolesGrid'
import { listTenantRoles } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { RoleListItemDto } from '@/types/identityApi'

export function RolesListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('identity.roles.manage')
  const [rows, setRows] = useState<RoleListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listTenantRoles(tenantId))
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Listado de roles sincronizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar la lista de roles.')
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

  const systemCount = useMemo(() => rows.filter((r) => r.isSystem).length, [rows])

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canManage) {
      items.push({
        id: 'create',
        label: 'Nuevo rol',
        icon: 'shield',
        route: '/equipo/roles/nuevo',
        disabled: false,
      })
    }
    items.push(
      {
        id: 'users',
        label: 'Usuarios',
        icon: 'users',
        route: '/equipo/usuarios',
        disabled: false,
      },
      {
        id: 'permissions',
        label: 'Permisos',
        icon: 'key',
        route: '/seguridad/permisos',
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
  }, [canManage, loading])

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
      title="Roles"
      lead="Roles agrupan permisos y se asignan a usuarios."
    >
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <p className="app-shell__page-lead">
            Catálogo de roles de esta empresa. Abre un rol para otorgar permisos del catálogo.
          </p>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de roles"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={handleActionSelect}
          />
        </div>

        <div className="ecu-companies-page__metrics" aria-label="Resumen de roles">
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Roles</p>
            <p className="ecu-companies-page__metric-value">{rows.length}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">De sistema</p>
            <p className="ecu-companies-page__metric-value">{systemCount}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Personalizados</p>
            <p className="ecu-companies-page__metric-value">{rows.length - systemCount}</p>
          </article>
          <article className="ecu-companies-page__metric">
            <p className="ecu-companies-page__metric-label">Modelo</p>
            <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
              RBAC
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
              <h2 className="app-shell__section-title">Aún no hay roles</h2>
              <p className="app-shell__muted app-shell__muted--pad-bottom">
                Crea el primero para agrupar permisos y asignarlos a usuarios.
              </p>
              {canManage ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/equipo/roles/nuevo')}
                >
                  Nuevo rol
                </Button>
              ) : (
                <p className="app-shell__muted">
                  Requieres identity.roles.manage para crear roles.
                </p>
              )}
            </div>
          ) : (
            <RolesGrid rows={rows} loading={loading} />
          )}
        </div>
      </div>
    </TenantSessionGate>
  )
}

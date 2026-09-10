import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  EmptyState,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { RolesGrid } from '@/pages/team/RolesGrid'
import { deleteTenantRole, listTenantRoles } from '@/services/identityApi'
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
  const [confirmDelete, setConfirmDelete] = useState<RoleListItemDto | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

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

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirmDelete) return
    setDeleteBusy(true)
    try {
      await deleteTenantRole(tenantId, confirmDelete.id)
      toast.show({
        title: 'Rol eliminado',
        message: `Se eliminó el rol «${confirmDelete.name}».`,
        variant: 'success',
      })
      setConfirmDelete(null)
      await load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No se pudo eliminar el rol.'),
        variant: 'error',
      })
    } finally {
      setDeleteBusy(false)
    }
  }, [confirmDelete, load, tenantId, toast])

  const isEmpty = !loading && rows.length === 0 && !error

  return (
    <TenantSessionGate
      title="Roles"
      lead="Roles agrupan permisos y se asignan a usuarios."
    >
      <div className="ecu-dashboard-layout">
        <PageHeader
          title="Roles y Privilegios"
          subtitle="Catálogo de roles de esta empresa. Administra los roles predeterminados o crea perfiles a medida con permisos específicos."
          badge={
            <StatusBadge tone="primary" withDot>
              {rows.length} {rows.length === 1 ? 'Rol' : 'Roles'}
            </StatusBadge>
          }
          actions={
            <>
              {canManage && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/equipo/roles/nuevo')}
                >
                  + Nuevo Rol
                </Button>
              )}
              <EcuPageActions
                items={actionItems}
                variant="outline"
                triggerLabel="Acciones de roles"
                renderIcon={renderSidebarIcon}
                onNavigate={(route: string) => navigate(route)}
                onActionSelect={handleActionSelect}
              />
            </>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de roles">
          <StatCard
            label="Total Roles"
            value={rows.length}
            icon="shield"
            toneColor="#4f46e5"
            footerText="Perfiles de seguridad"
          />
          <StatCard
            label="Roles del Sistema"
            value={systemCount}
            icon="verified_user"
            toneColor="#059669"
            badge={<StatusBadge tone="success">Protegidos</StatusBadge>}
            footerText="Predefinidos por la plataforma"
          />
          <StatCard
            label="Personalizados"
            value={rows.length - systemCount}
            icon="tune"
            toneColor="#0284c7"
            badge={rows.length - systemCount > 0 ? <StatusBadge tone="info">A medida</StatusBadge> : undefined}
            footerText="Creados para la empresa"
          />
          <StatCard
            label="Modelo de Control"
            value="RBAC"
            icon="lock"
            toneColor="#7c3aed"
            badge={<StatusBadge tone="neutral">Granular</StatusBadge>}
            footerText="Basado en roles y directivas"
          />
        </div>

        {error ? (
          <p className="welcome-onboarding__error" role="alert">
            {error}
          </p>
        ) : null}

        <SectionCard
          title="Catálogo de Roles"
          subtitle="Configura y asigna permisos detallados a cada rol del sistema"
        >
          {isEmpty ? (
            <EmptyState
              icon="admin_panel_settings"
              title="Aún no hay roles configurados"
              description="Crea el primer rol personalizado para agrupar permisos operativos y asignarlos a colaboradores."
              action={
                canManage ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/equipo/roles/nuevo')}
                  >
                    Crear primer rol
                  </Button>
                ) : (
                  <p className="app-shell__muted">
                    Requieres el permiso identity.roles.manage para crear roles.
                  </p>
                )
              }
            />
          ) : (
            <RolesGrid
              rows={rows}
              loading={loading}
              actionBusyId={deleteBusy && confirmDelete ? confirmDelete.id : null}
              onDelete={setConfirmDelete}
            />
          )}
        </SectionCard>
      </div>

      <Popup
        open={confirmDelete !== null}
        title="Eliminar rol"
        onClose={() => setConfirmDelete(null)}
        width="min(92vw, 28rem)"
        actions={[
          {
            id: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            onClick: () => setConfirmDelete(null),
            disabled: deleteBusy,
          },
          {
            id: 'confirm',
            label: 'Sí, eliminar',
            variant: 'primary',
            onClick: () => {
              void handleDelete()
            },
            disabled: deleteBusy,
          },
        ]}
      >
        {confirmDelete ? (
          <p className="app-shell__muted">
            ¿Dar de baja el rol <strong>{confirmDelete.name}</strong>? Los usuarios que lo
            tuvieran asignado deben ser reasignados previamente.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}

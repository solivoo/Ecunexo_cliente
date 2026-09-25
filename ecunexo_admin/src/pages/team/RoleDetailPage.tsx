import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
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
import { formatDateTime } from '@/lib/formatDate'
import { readApiError } from '@/lib/readApiError'
import {
  EffectivePermissionsGrid,
  type EffectivePermissionRow,
} from '@/pages/team/EffectivePermissionsGrid'
import { getTenantRole, listPermissions, unassignRolePermission } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantRoleDto, PermissionListItemDto } from '@/types/identityApi'

export function RoleDetailPage() {
  const { roleId = '' } = useParams<{ roleId: string }>()
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('identity.roles.manage')
  const [role, setRole] = useState<GetTenantRoleDto | null>(null)
  const [perms, setPerms] = useState<PermissionListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId || !roleId) return
      setLoading(true)
      try {
        const [r, all] = await Promise.all([getTenantRole(tenantId, roleId), listPermissions()])
        setRole(r)
        setPerms(all)
        setError(null)
        if (!opts?.silent) {
          toast.show({ title: 'Actualizado', message: 'Ficha de rol sincronizada.', variant: 'success' })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar el rol.')
        setError(message)
        setRole(null)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [roleId, tenantId, toast]
  )

  useEffect(() => {
    void load({ silent: true })
  }, [load])

  const permissionRows = useMemo((): EffectivePermissionRow[] => {
    if (!role) return []
    const byId = new Map(perms.map((p) => [p.id, p]))
    return role.permissionIds
      .map((id) => {
        const p = byId.get(id)
        return {
          id,
          code: p?.code ?? id,
          displayName: p?.displayName ?? null,
          description: p?.description ?? null,
          module: p?.module ?? null,
          permissionId: p?.id ?? id,
        }
      })
      .sort((a, b) => a.code.localeCompare(b.code, 'es'))
  }, [perms, role])

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = [
      { id: 'list', label: 'Listado de roles', icon: 'shield', route: '/equipo/roles', disabled: false },
    ]
    items.push(
      { id: 'users', label: 'Usuarios', icon: 'users', route: '/equipo/usuarios', disabled: false },
      { id: 'catalog', label: 'Catálogo de permisos', icon: 'key', route: '/seguridad/permisos', disabled: false }
    )
    return items
  }, [])

  const handleRevoke = useCallback(
    async (row: EffectivePermissionRow) => {
      if (!tenantId || !row.permissionId) return
      setRevokeBusyId(row.id)
      try {
        await unassignRolePermission(tenantId, roleId, row.permissionId)
        toast.show({
          title: 'Permiso quitado',
          message: `«${row.code}» ya no está en este rol.`,
          variant: 'success',
        })
        await load({ silent: true })
      } catch (err: unknown) {
        toast.show({
          title: 'Error',
          message: readApiError(err, 'No se pudo quitar el permiso.'),
          variant: 'error',
        })
      } finally {
        setRevokeBusyId(null)
      }
    },
    [load, roleId, tenantId, toast]
  )

  return (
    <TenantSessionGate title="Rol" lead="Ficha del rol y permisos vinculados.">
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageLoadState loading={loading && !role} error={error} empty={!role && !loading}>
          {role ? (
            <>
              <PageHeader
                title={role.name}
                subtitle={role.description || 'Perfil de seguridad y directivas asignables.'}
                actions={
                  <>
                    <GridToolbarRefresh
                      loading={loading}
                      onRefresh={() => void load()}
                      label="Actualizar ficha"
                    />
                    {canManage && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate(`/equipo/roles/${roleId}/editar`)}
                        >
                          Editar Rol
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => navigate(`/equipo/roles/${roleId}/permisos`)}
                        >
                          Gestionar Permisos
                        </Button>
                      </>
                    )}
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

              <SectionCard title="Definición" bodyClassName="ecu-section-card__body--padded">
                <div className="ecu-property-grid">
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Origen</span>
                    <span className="ecu-property-tile__value">
                      {role.isSystem ? (
                        <span className="ecu-chip">Sistema</span>
                      ) : (
                        <span className="ecu-chip ecu-chip--muted">Empresa</span>
                      )}
                    </span>
                  </div>
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Permisos vinculados</span>
                    <span className="ecu-property-tile__value">
                      {role.permissionIds.length}
                    </span>
                  </div>
                  <div className="ecu-property-tile">
                    <span className="ecu-property-tile__label">Última actualización</span>
                    <span className="ecu-property-tile__value">
                      {role.updatedAt ? formatDateTime(role.updatedAt) : 'Sin cambios'}
                    </span>
                  </div>
                  <div className="ecu-property-tile ecu-property-tile--full">
                    <span className="ecu-property-tile__label">Descripción</span>
                    <span className="ecu-property-tile__value">
                      {role.description ?? 'Sin descripción.'}
                    </span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Permisos vinculados"
                action={
                  canManage ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate(`/equipo/roles/${roleId}/permisos`)}
                    >
                      + Modificar Permisos
                    </Button>
                  ) : null
                }
              >
                {permissionRows.length === 0 ? (
                  <div className="ecu-section-card__body--padded">
                    <span className="ecu-hint">Sin permisos en este rol.</span>
                  </div>
                ) : (
                  <EffectivePermissionsGrid
                    rows={permissionRows}
                    loading={loading}
                    canRevoke={canManage}
                    revokeBusyId={revokeBusyId}
                    onRevoke={(row) => void handleRevoke(row)}
                  />
                )}
              </SectionCard>
            </>
          ) : null}
        </PageLoadState>
      </div>
    </TenantSessionGate>
  )
}

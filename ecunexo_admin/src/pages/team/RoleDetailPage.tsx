import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
import { Shield } from 'lucide-react'
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
    if (canManage) {
      items.push({
        id: 'edit',
        label: 'Editar rol',
        icon: 'pencil',
        route: `/equipo/roles/${roleId}/editar`,
        disabled: false,
      })
      items.push({
        id: 'manage-perms',
        label: 'Gestionar permisos',
        icon: 'key',
        route: `/equipo/roles/${roleId}/permisos`,
        disabled: false,
      })
    }
    items.push(
      { id: 'users', label: 'Usuarios', icon: 'users', route: '/equipo/usuarios', disabled: false },
      { id: 'catalog', label: 'Catálogo de permisos', icon: 'key', route: '/seguridad/permisos', disabled: false },
      { id: 'refresh', label: 'Actualizar', icon: 'refresh-cw', route: null, disabled: loading }
    )
    return items
  }, [canManage, loading, roleId])

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
      <div className="ecu-dashboard-layout">
        <PageLoadState loading={loading && !role} error={error} empty={!role && !loading}>
          {role ? (
            <>
              <PageHeader
                title={role.name}
                subtitle={role.description || 'Perfil de seguridad y directivas asignables.'}
                badge={
                  <StatusBadge
                    tone={role.isSystem ? 'success' : 'info'}
                    withDot
                  >
                    {role.isSystem ? 'Rol de Sistema' : 'Personalizado'}
                  </StatusBadge>
                }
                actions={
                  <>
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
                      onActionSelect={(item) => {
                        if (item.id === 'refresh') void load()
                      }}
                    />
                  </>
                }
              />

              <div className="ecu-stat-grid" aria-label="Resumen del rol">
                <StatCard
                  label="Permisos Vinculados"
                  value={role.permissionIds.length}
                  icon="key"
                  toneColor="#4f46e5"
                  footerText="Directivas activas en el rol"
                />
                <StatCard
                  label="Naturaleza del Rol"
                  value={role.isSystem ? 'Sistema' : 'Personalizado'}
                  icon={role.isSystem ? 'verified_user' : 'tune'}
                  toneColor={role.isSystem ? '#059669' : '#0284c7'}
                  badge={
                    <StatusBadge tone={role.isSystem ? 'success' : 'info'}>
                      {role.isSystem ? 'Protegido' : 'Editable'}
                    </StatusBadge>
                  }
                  footerText={role.isSystem ? 'No puede eliminarse' : 'Definido por la empresa'}
                />
                <StatCard
                  label="Última Actualización"
                  value={formatDateTime(role.updatedAt) || 'Sin cambios'}
                  icon="update"
                  toneColor="#7c3aed"
                  footerText="Sincronización con catálogo"
                />
              </div>

              <SectionCard
                title={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={18} strokeWidth={1.75} aria-hidden /> Definición del Rol
                  </span>
                }
                subtitle="Alcance y responsabilidades asignadas a este perfil"
              >
                <p className="app-shell__text" style={{ margin: 0 }}>
                  {role.description ?? 'Sin descripción configurada para este rol.'}
                </p>
              </SectionCard>

              <SectionCard
                title="Permisos Vinculados al Rol"
                subtitle="Directivas habilitadas para cualquier usuario que tenga este rol asignado"
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
                  <p className="app-shell__muted">
                    Sin permisos en este rol.
                    {canManage
                      ? ' Pulsa «Modificar Permisos» para marcar las directivas del catálogo por módulo.'
                      : ''}
                  </p>
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

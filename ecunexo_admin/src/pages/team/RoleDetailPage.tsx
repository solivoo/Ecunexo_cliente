import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
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
      <div className="ecu-companies-page">
        <PageLoadState loading={loading && !role} error={error} empty={!role && !loading}>
          {role ? (
            <>
              <div className="ecu-page-header">
                <div>
                  <p className="app-shell__page-lead">
                    <strong>{role.name}</strong>
                    {role.description ? ` · ${role.description}` : ''}
                  </p>
                  <p className="ecu-companies-form__hint">
                    Las políticas se definen en el permiso, no en el rol. El rol solo elige qué
                    permisos hereda.
                  </p>
                </div>
                <EcuPageActions
                  items={actionItems}
                  variant="outline"
                  triggerLabel="Acciones de rol"
                  renderIcon={renderSidebarIcon}
                  onNavigate={(route: string) => navigate(route)}
                  onActionSelect={(item) => {
                    if (item.id === 'refresh') void load()
                  }}
                />
              </div>

              <div className="ecu-companies-page__metrics" aria-label="Resumen del rol">
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Permisos</p>
                  <p className="ecu-companies-page__metric-value">{role.permissionIds.length}</p>
                </article>
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Tipo</p>
                  <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                    {role.isSystem ? 'Sistema' : 'Personalizado'}
                  </p>
                </article>
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Actualizado</p>
                  <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                    {formatDateTime(role.updatedAt)}
                  </p>
                </article>
              </div>

              <section className="app-shell__card ecu-companies-form__card">
                <h2 className="app-shell__section-title">
                  <Shield size={18} strokeWidth={1.75} aria-hidden /> Perfil del rol
                </h2>
                <p className="ecu-companies-form__hint">{role.description ?? 'Sin descripción.'}</p>
              </section>

              <section className="app-shell__card ecu-companies-form__card">
                <div className="ecu-page-header">
                  <h2 className="app-shell__section-title">Permisos del rol</h2>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate(`/equipo/roles/${roleId}/permisos`)}
                    >
                      Gestionar permisos
                    </Button>
                  ) : null}
                </div>
                {permissionRows.length === 0 ? (
                  <p className="app-shell__muted">
                    Sin permisos en este rol.
                    {canManage
                      ? ' Usa «Gestionar permisos» para marcar los del catálogo por módulo.'
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
              </section>
            </>
          ) : null}
        </PageLoadState>
      </div>
    </TenantSessionGate>
  )
}

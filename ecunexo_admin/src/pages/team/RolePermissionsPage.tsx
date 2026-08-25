import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { RolePermissionsFilters } from '@/pages/team/RolePermissionsFilters'
import { RolePermissionsGrid } from '@/pages/team/RolePermissionsGrid'
import { useRolePermissionsEditor } from '@/pages/team/useRolePermissionsEditor'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

export function RolePermissionsPage() {
  const { roleId = '' } = useParams<{ roleId: string }>()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('identity.roles.manage')
  const detailPath = `/equipo/roles/${roleId}`
  const editor = useRolePermissionsEditor(tenantId, roleId)

  const actionItems = useMemo<PageActionItem[]>(
    () => [
      { id: 'detail', label: 'Ficha del rol', icon: 'shield', route: detailPath, disabled: false },
      {
        id: 'catalog',
        label: 'Catálogo de permisos',
        icon: 'key',
        route: '/seguridad/permisos',
        disabled: false,
      },
    ],
    [detailPath]
  )

  if (!canManage) {
    return (
      <TenantSessionGate title="Permisos del rol" lead="Marca qué permisos hereda este perfil.">
        <div className="ecu-companies-page">
          <p className="app-shell__page-lead">
            Requieres identity.roles.manage para gestionar permisos del rol.
          </p>
          <Button type="button" variant="outline" onClick={() => navigate(detailPath)}>
            Volver a la ficha
          </Button>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate title="Permisos del rol" lead="Marca qué permisos hereda este perfil.">
      <div className="ecu-companies-page">
        <div className="ecu-page-header">
          <div>
            <p className="app-shell__page-lead">
              {editor.role
                ? `Selecciona los permisos del rol «${editor.role.name}».`
                : 'Selecciona los permisos que hereda el rol.'}
            </p>
            <p className="ecu-companies-form__hint">
              Todos / Marcados / Sin marcar filtra esta pantalla; no cambia el rol hasta Guardar.
              Marcá filas con el checkbox de cada permiso (evitá «seleccionar todos» del grid).{' '}
              <Link to="/seguridad/permisos" className="login-page__link-muted">
                Ir al catálogo
              </Link>
            </p>
          </div>
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de permisos del rol"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
          />
        </div>

        <PageLoadState
          loading={editor.loading}
          error={editor.error && !editor.role ? editor.error : null}
          empty={!editor.role && !editor.loading}
        >
          {editor.role ? (
            <>
              <div className="ecu-companies-page__metrics" aria-label="Resumen de permisos">
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Catálogo</p>
                  <p className="ecu-companies-page__metric-value">{editor.perms.length}</p>
                </article>
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Asignados</p>
                  <p className="ecu-companies-page__metric-value">{editor.selectedIds.length}</p>
                </article>
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Visibles</p>
                  <p className="ecu-companies-page__metric-value">{editor.filteredRows.length}</p>
                </article>
                <article className="ecu-companies-page__metric">
                  <p className="ecu-companies-page__metric-label">Cambios</p>
                  <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
                    {editor.dirty ? 'Pendientes' : 'Sin cambios'}
                  </p>
                </article>
              </div>

              {editor.error ? (
                <p className="welcome-onboarding__error" role="alert">
                  {editor.error}
                </p>
              ) : null}

              {editor.perms.length === 0 && !editor.loading ? (
                <p className="app-shell__muted" role="status">
                  No hay permisos asignables con los módulos contratados de esta empresa. Revisa el
                  plan o el catálogo global.
                </p>
              ) : null}

              <section className="app-shell__card ecu-companies-form__card">
                <h2 className="app-shell__section-title ecu-role-perms-title">
                  Permisos
                </h2>
                <RolePermissionsGrid
                  rows={editor.filteredRows}
                  selectedRowIds={editor.selectedIds}
                  loading={editor.loading}
                  onSelectionChange={editor.handleSelectionChange}
                  toolbarRight={
                    <RolePermissionsFilters
                      moduleFilter={editor.moduleFilter}
                      onModuleChange={editor.setModuleFilter}
                      moduleOptions={editor.moduleOptions}
                      assignmentFilter={editor.assignmentFilter}
                      onAssignmentChange={editor.setAssignmentFilter}
                      disabled={editor.busy}
                    />
                  }
                />
              </section>

              <div className="ecu-companies-form__actions">
                <Button
                  type="button"
                  variant="primary"
                  loading={editor.busy}
                  disabled={editor.busy || !editor.dirty}
                  onClick={() => void editor.onSave()}
                >
                  Guardar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={editor.busy}
                  onClick={() => navigate(detailPath)}
                >
                  Atrás
                </Button>
              </div>
            </>
          ) : null}
        </PageLoadState>
      </div>
    </TenantSessionGate>
  )
}

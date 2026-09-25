import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
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
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title={editor.role ? `Permisos: ${editor.role.name}` : 'Permisos del Rol'}
          subtitle="Capacidades y directivas que heredan los usuarios de este rol."
          badge={
            <StatusBadge tone={editor.dirty ? 'warning' : 'neutral'} withDot>
              {editor.dirty ? 'Cambios pendientes' : 'Sincronizado'}
            </StatusBadge>
          }
        />

        <PageLoadState
          loading={editor.loading}
          error={editor.error && !editor.role ? editor.error : null}
          empty={!editor.role && !editor.loading}
        >
          {editor.role ? (
            <>
              <div className="ecu-stat-grid" aria-label="Resumen de permisos">
                <StatCard label="Catálogo" value={editor.perms.length} />
                <StatCard label="Asignados" value={editor.selectedIds.length} />
                <StatCard label="En pantalla" value={editor.filteredRows.length} />
              </div>

              <SectionCard title="Matriz de directivas">
                {editor.error ? (
                  <div className="ecu-form-error-banner" role="alert">
                    <span className="material-symbols-outlined">error</span>
                    <span>{editor.error}</span>
                  </div>
                ) : null}

                {editor.perms.length === 0 && !editor.loading ? (
                  <div className="ecu-section-card__body--padded">
                    <span className="ecu-hint" role="status">
                      No hay permisos asignables con los módulos contratados de esta empresa.
                    </span>
                  </div>
                ) : (
                  <RolePermissionsGrid
                    rows={editor.filteredRows}
                    selectedRowIds={editor.selectedIds}
                    loading={editor.loading}
                    onSelectionChange={editor.handleSelectionChange}
                    toolbarRight={
                      <div className="ecu-grid-toolbar-actions">
                        <RolePermissionsFilters
                          moduleFilter={editor.moduleFilter}
                          onModuleChange={editor.setModuleFilter}
                          moduleOptions={editor.moduleOptions}
                          assignmentFilter={editor.assignmentFilter}
                          onAssignmentChange={editor.setAssignmentFilter}
                          disabled={editor.busy}
                        />
                        <Button
                          type="button"
                          variant="primary"
                          loading={editor.busy}
                          disabled={editor.busy || !editor.dirty}
                          onClick={() => void editor.onSave()}
                        >
                          Guardar Permisos
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={editor.busy}
                          onClick={() => navigate(detailPath)}
                        >
                          Volver al Rol
                        </Button>
                        <EcuPageActions
                          items={actionItems}
                          variant="outline"
                          triggerLabel="Acciones"
                          renderIcon={renderSidebarIcon}
                          onNavigate={(route: string) => navigate(route)}
                        />
                      </div>
                    }
                  />
                )}
              </SectionCard>

              <div className="ecu-companies-form__actions">
                <Button
                  type="button"
                  variant="primary"
                  loading={editor.busy}
                  disabled={editor.busy || !editor.dirty}
                  onClick={() => void editor.onSave()}
                >
                  Guardar Permisos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={editor.busy}
                  onClick={() => navigate(detailPath)}
                >
                  Cancelar
                </Button>
              </div>
            </>
          ) : null}
        </PageLoadState>
      </div>
    </TenantSessionGate>
  )
}

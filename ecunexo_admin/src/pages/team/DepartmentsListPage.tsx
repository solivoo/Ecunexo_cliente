import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Popup, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  EmptyState,
  GridToolbarRefresh,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { DepartmentsGrid } from '@/pages/team/DepartmentsGrid'
import { deleteTenantDepartment, listTenantDepartments } from '@/services/identityApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { DepartmentListItemDto } from '@/types/identityApi'

export function DepartmentsListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const tenantId = useAppSelector(selectTenantId)
  const canManage = useHasPermission('identity.departments.manage')
  const [rows, setRows] = useState<DepartmentListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DepartmentListItemDto | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        setRows(await listTenantDepartments(tenantId))
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Listado de departamentos sincronizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar la lista de departamentos.')
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

  const actionItems: PageActionItem[] = [
    {
      id: 'users',
      label: 'Usuarios',
      icon: 'users',
      route: '/equipo/usuarios',
      disabled: false,
    },
    {
      id: 'roles',
      label: 'Roles',
      icon: 'shield',
      route: '/equipo/roles',
      disabled: false,
    },
  ]

  const handleDelete = useCallback(async () => {
    if (!tenantId || !confirmDelete) return
    setDeleteBusy(true)
    try {
      await deleteTenantDepartment(tenantId, confirmDelete.id)
      toast.show({
        title: 'Departamento eliminado',
        message: `Se eliminó el departamento «${confirmDelete.name}».`,
        variant: 'success',
      })
      setConfirmDelete(null)
      await load({ silent: true })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al eliminar',
        message: readApiError(err, 'No se pudo eliminar el departamento.'),
        variant: 'error',
      })
    } finally {
      setDeleteBusy(false)
    }
  }, [confirmDelete, load, tenantId, toast])

  const isEmpty = !loading && rows.length === 0 && !error

  return (
    <TenantSessionGate
      title="Departamentos"
      lead="Catálogo organizacional para asignar a usuarios."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Departamentos y Áreas"
          subtitle="Unidades organizacionales para asignar a los usuarios de la empresa."
        />

        <div className="ecu-stat-grid" aria-label="Resumen de departamentos">
          <StatCard label="Áreas" value={rows.length} />
          <StatCard label="Con detalle" value={rows.filter((r) => Boolean(r.description)).length} />
        </div>

        <SectionCard title="Catálogo">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {isEmpty ? (
            <EmptyState
              icon="corporate_fare"
              title="Aún no hay departamentos registrados"
              description="Crea el primer departamento para organizar a los usuarios por área."
              action={
                canManage ? (
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => navigate('/equipo/departamentos/nuevo')}
                  >
                    Crear departamento
                  </Button>
                ) : (
                  <p className="app-shell__muted">
                    Requieres el permiso identity.departments.manage para crear departamentos.
                  </p>
                )
              }
            />
          ) : (
            <DepartmentsGrid
              rows={rows}
              loading={loading}
              canManage={canManage}
              actionBusyId={deleteBusy && confirmDelete ? confirmDelete.id : null}
              onDelete={setConfirmDelete}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  {canManage && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => navigate('/equipo/departamentos/nuevo')}
                    >
                      + Nuevo Departamento
                    </Button>
                  )}
                  <EcuPageActions
                    items={actionItems}
                    variant="outline"
                    triggerLabel="Acciones de departamentos"
                    renderIcon={renderSidebarIcon}
                    onNavigate={(route: string) => navigate(route)}
                  />
                </div>
              }
            />
          )}
        </SectionCard>
      </div>

      <Popup
        open={confirmDelete !== null}
        title="Eliminar departamento"
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
            ¿Dar de baja el departamento <strong>{confirmDelete.name}</strong>? Los usuarios que lo
            tuvieran asignado deben ser reasignados previamente.
          </p>
        ) : null}
      </Popup>
    </TenantSessionGate>
  )
}

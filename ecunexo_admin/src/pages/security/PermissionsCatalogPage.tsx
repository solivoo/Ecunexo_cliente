import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select, useToast, type PageActionItem } from 'glubox'
import { EcuPageActions } from '@/components/ui/EcuPageActions'
import { renderSidebarIcon } from '@/config/sidebarIcons'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { moduleKey, uniqueModuleSelectOptions } from '@/lib/moduleLabels'
import { PermissionsGrid } from '@/pages/security/PermissionsGrid'
import { listPermissions } from '@/services/identityApi'
import type { PermissionListItemDto } from '@/types/identityApi'

export function PermissionsCatalogPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const canManage = useHasPermission('identity.permissions.manage')
  const size = useGluComponentSize()
  const [rows, setRows] = useState<PermissionListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moduleFilter, setModuleFilter] = useState('')

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      setLoading(true)
      try {
        setRows(await listPermissions())
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Catálogo de permisos sincronizado.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudo cargar el catálogo de permisos.')
        setError(message)
        setRows([])
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await listPermissions()
        if (cancelled) return
        setRows(data)
        setError(null)
      } catch (err: unknown) {
        if (cancelled) return
        const message = readApiError(err, 'No se pudo cargar el catálogo de permisos.')
        setError(message)
        setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const moduleOptions = useMemo(
    () => [
      { value: '', label: 'Todos los módulos' },
      ...uniqueModuleSelectOptions(rows.map((p) => p.module)),
    ],
    [rows]
  )

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (moduleFilter && moduleKey(row.module) !== moduleFilter) return false
      return true
    })
  }, [moduleFilter, rows])

  const activeCount = useMemo(() => rows.filter((r) => r.status === 0).length, [rows])

  const actionItems = useMemo<PageActionItem[]>(() => {
    const items: PageActionItem[] = []
    if (canManage) {
      items.push({
        id: 'create',
        label: 'Nuevo permiso',
        icon: 'key',
        route: '/seguridad/permisos/nuevo',
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
  }, [canManage, loading])

  const handleActionSelect = useCallback(
    (item: PageActionItem) => {
      if (item.id === 'refresh') {
        void load()
      }
    },
    [load]
  )

  return (
    <div className="ecu-companies-page">
      <div className="ecu-page-header">
        <div>
          <p className="app-shell__page-lead">
            Catálogo global. Las políticas ABAC van en la ficha de cada permiso; el rol solo hereda
            permisos.
          </p>
        </div>
        <EcuPageActions
          items={actionItems}
          variant="outline"
          triggerLabel="Acciones de permisos"
          renderIcon={renderSidebarIcon}
          onNavigate={(route: string) => navigate(route)}
          onActionSelect={handleActionSelect}
        />
      </div>

      <div className="ecu-companies-page__metrics" aria-label="Resumen de permisos">
        <article className="ecu-companies-page__metric">
          <p className="ecu-companies-page__metric-label">Permisos</p>
          <p className="ecu-companies-page__metric-value">{rows.length}</p>
        </article>
        <article className="ecu-companies-page__metric">
          <p className="ecu-companies-page__metric-label">Activos</p>
          <p className="ecu-companies-page__metric-value">{activeCount}</p>
        </article>
        <article className="ecu-companies-page__metric">
          <p className="ecu-companies-page__metric-label">Visibles</p>
          <p className="ecu-companies-page__metric-value">{filteredRows.length}</p>
        </article>
        <article className="ecu-companies-page__metric">
          <p className="ecu-companies-page__metric-label">Modelo</p>
          <p className="ecu-companies-page__metric-value ecu-companies-page__metric-value--sm">
            RBAC + ABAC
          </p>
        </article>
      </div>

      {error ? (
        <p className="welcome-onboarding__error" role="alert">
          {error}
        </p>
      ) : null}

      <PermissionsGrid
        rows={filteredRows}
        loading={loading}
        toolbarRight={
          <Select
            id="perms-module"
            aria-label="Módulo"
            variant="outline"
            options={moduleOptions}
            value={moduleFilter}
            onChange={setModuleFilter}
            placeholder="Módulo"
            width="15rem"
            size={size}
          />
        }
      />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select, useToast, type PageActionItem } from 'glubox'
import {
  EcuPageActions,
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
} from '@/components/ui'
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
    <div className="ecu-dashboard-layout">
      <PageHeader
        title="Catálogo de Permisos"
        subtitle="Directivas de autorización del sistema. Las políticas contextuales (ABAC) se definen en cada permiso; los roles agrupan y asignan estos permisos a los usuarios."
        badge={
          <StatusBadge tone="primary" withDot>
            RBAC + ABAC
          </StatusBadge>
        }
        actions={
          <EcuPageActions
            items={actionItems}
            variant="outline"
            triggerLabel="Acciones de permisos"
            renderIcon={renderSidebarIcon}
            onNavigate={(route: string) => navigate(route)}
            onActionSelect={handleActionSelect}
          />
        }
      />

      <div className="ecu-stat-grid" aria-label="Resumen de permisos">
        <StatCard
          label="Total Permisos"
          value={rows.length}
          icon="key"
          toneColor="#4f46e5"
          footerText="Capacidades en el catálogo"
        />
        <StatCard
          label="Permisos Activos"
          value={activeCount}
          icon="verified_user"
          toneColor="#10b981"
          footerText="Habilitados para roles"
        />
        <StatCard
          label="Visibles"
          value={filteredRows.length}
          icon="filter_list"
          toneColor="#0ea5e9"
          footerText={moduleFilter ? `Módulo: ${moduleFilter}` : 'Todos los módulos'}
        />
        <StatCard
          label="Modelo de Acceso"
          value="RBAC + ABAC"
          icon="admin_panel_settings"
          toneColor="#8b5cf6"
          footerText="Rol hereda + Regla evalúa"
        />
      </div>

      <SectionCard
        title="Directivas de Autorización"
        subtitle="Catálogo maestro de permisos y capacidades granulares de la plataforma"
      >
        {error ? (
          <div className="ecu-form-error-banner" role="alert">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
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
              placeholder="Filtrar por módulo"
              width="15rem"
              size={size}
            />
          }
        />
      </SectionCard>
    </div>
  )
}

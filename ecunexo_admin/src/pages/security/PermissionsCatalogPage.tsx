import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, useToast } from 'glubox'
import { PageHeader, StatCard, SectionCard, GridToolbarRefresh } from '@/components/ui'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { useHasPermission } from '@/hooks/useHasPermission'
import { readApiError } from '@/lib/readApiError'
import { moduleKey, uniqueModuleSelectOptions } from '@/lib/moduleLabels'
import { PermissionsGrid } from '@/pages/security/PermissionsGrid'
import { listPermissions } from '@/services/identityApi'
import type { PermissionListItemDto } from '@/types/identityApi'
import './securitySection.css'

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
    void load({ silent: true })
  }, [load])

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
  const moduleCount = useMemo(
    () => new Set(rows.map((r) => moduleKey(r.module)).filter(Boolean)).size,
    [rows]
  )

  return (
    <div className="ecu-dashboard-layout ecu-section-page">
      <PageHeader
        title="Catálogo de Permisos"
        subtitle="Directivas de autorización RBAC. Los roles las agrupan; cada directiva puede llevar políticas ABAC."
      />

      <div className="ecu-stat-grid" aria-label="Resumen de permisos">
        <StatCard label="Permisos" value={rows.length} />
        <StatCard label="Activos" value={activeCount} />
        <StatCard label="Módulos" value={moduleCount} />
      </div>

      <SectionCard title="Directivas de autorización">
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
            <div className="ecu-grid-toolbar-actions">
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
              <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
              {canManage && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate('/seguridad/permisos/nuevo')}
                >
                  + Nuevo Permiso
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/equipo/roles')}
              >
                Roles
              </Button>
            </div>
          }
        />
      </SectionCard>
    </div>
  )
}

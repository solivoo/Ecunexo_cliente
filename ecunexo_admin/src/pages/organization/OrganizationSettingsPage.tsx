import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { formatDateTime } from '@/lib/formatDate'
import {
  formatSettingValue,
  settingLabel,
  themeSettingLabel,
} from '@/lib/settingsDisplay'
import { getTenant } from '@/services/tenantApi'
import { readApiError } from '@/lib/readApiError'
import { selectSettings, selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantByIdDto } from '@/types/tenantApi'

export function OrganizationSettingsPage() {
  const tenantId = useAppSelector(selectTenantId)
  const settings = useAppSelector(selectSettings)
  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) {
      setError('No hay sesión activa.')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      setTenant(await getTenant(tenantId))
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo cargar la configuración.'))
      setTenant(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const settingEntries = useMemo(() => {
    const entries = Object.entries(settings)
    entries.sort(([a], [b]) => a.localeCompare(b))
    return entries
  }, [settings])

  return (
    <div className="ecu-dashboard-layout">
      <PageHeader
        title="Configuración de la Organización"
        subtitle="Metadatos de la organización y preferencias resueltas por la plataforma."
        badge={<StatusBadge tone="neutral">Sistema</StatusBadge>}
      />

      <PageLoadState loading={loading} error={error} empty={!tenant}>
        {tenant ? (
          <>
            <SectionCard
              title="Metadatos de la Organización"
              subtitle="Identificador único y marcas de tiempo del tenant"
            >
              <dl className="ecu-dl">
                <dt>Identificador</dt>
                <dd>
                  <code className="ecu-code">{tenant.id}</code>
                </dd>
                <dt>Nombre de la empresa</dt>
                <dd>{tenant.name}</dd>
                <dt>Creado</dt>
                <dd>{formatDateTime(tenant.createdAt)}</dd>
                <dt>Actualizado</dt>
                <dd>{formatDateTime(tenant.updatedAt)}</dd>
              </dl>
            </SectionCard>

            <SectionCard
              title="Preferencias Resueltas"
              subtitle="Parámetros efectivos activos para la sesión actual"
            >
              {settingEntries.length > 0 ? (
                <dl className="ecu-dl">
                  {settingEntries.map(([code, value]) => (
                    <SettingRow key={code} code={code} value={value} />
                  ))}
                </dl>
              ) : (
                <p className="app-shell__muted app-shell__muted--pad">
                  No hay ajustes resueltos para esta sesión.
                </p>
              )}
            </SectionCard>
          </>
        ) : null}
      </PageLoadState>

      <p className="app-shell__muted">
        Integraciones, notificaciones por correo y parámetros avanzados se habilitarán cuando existan
        endpoints de administración en la Api.
      </p>
    </div>
  )
}

function SettingRow({ code, value }: { code: string; value: unknown }) {
  const display =
    code === 'ui.theme.default' ? themeSettingLabel(value) : formatSettingValue(value)

  return (
    <>
      <dt>{settingLabel(code)}</dt>
      <dd>{display}</dd>
    </>
  )
}

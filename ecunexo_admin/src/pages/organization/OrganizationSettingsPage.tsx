import { useCallback, useEffect, useMemo, useState } from 'react'
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
    <>
      <h1 className="app-shell__page-title">Configuración</h1>
      <p className="app-shell__page-lead">
        Metadatos de la organización y preferencias resueltas por la plataforma.
      </p>

      <PageLoadState loading={loading} error={error} empty={!tenant}>
        {tenant ? (
          <>
            <h2 className="app-shell__section-title">Organización</h2>
            <div className="app-shell__card">
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
            </div>

            <h2 className="app-shell__section-title">Preferencias</h2>
            <div className="app-shell__card">
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
            </div>
          </>
        ) : null}
      </PageLoadState>

      <p className="app-shell__muted">
        Integraciones, notificaciones por correo y parámetros avanzados se habilitarán cuando existan
        endpoints de administración en la Api.
      </p>
    </>
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

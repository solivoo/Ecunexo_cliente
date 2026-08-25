import { useCallback, useEffect, useState } from 'react'
import { ColorSwatch } from '@/features/organization/components/ColorSwatch'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { resolveAssetUrl } from '@/features/organization/resolveTenantMark'
import { formatDateTime } from '@/lib/formatDate'
import { getTenantUser } from '@/services/identityApi'
import { getTenant } from '@/services/tenantApi'
import { readApiError } from '@/lib/readApiError'
import { selectTenantId, selectUserId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import type { GetTenantUserDto } from '@/types/identityApi'
import type { GetTenantByIdDto } from '@/types/tenantApi'

export function OrganizationProfilePage() {
  const tenantId = useAppSelector(selectTenantId)
  const userId = useAppSelector(selectUserId)
  const [tenant, setTenant] = useState<GetTenantByIdDto | null>(null)
  const [user, setUser] = useState<GetTenantUserDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenantId || !userId) {
      setError('No hay sesión activa.')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [t, u] = await Promise.all([getTenant(tenantId), getTenantUser(tenantId, userId)])
      setTenant(t)
      setUser(u)
      setError(null)
    } catch (err: unknown) {
      setError(readApiError(err, 'No se pudo cargar el perfil de la organización.'))
      setTenant(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId, userId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <h1 className="app-shell__page-title">Perfil y branding</h1>
      <p className="app-shell__page-lead">Identidad de la organización y datos de tu cuenta.</p>

      <PageLoadState loading={loading} error={error} empty={!tenant || !user}>
        {tenant && user ? (
          <>
            <h2 className="app-shell__section-title">Organización</h2>
            <div className="app-shell__card">
              <dl className="ecu-dl">
                <dt>Nombre de la empresa</dt>
                <dd>{tenant.name}</dd>
                <dt>Estado</dt>
                <dd>{tenantStatusLabel(tenant.status)}</dd>
                <dt>Zona horaria</dt>
                <dd>{tenant.timeZoneId ?? '—'}</dd>
                <dt>Locale</dt>
                <dd>{tenant.locale ?? '—'}</dd>
                <dt>Color de acento</dt>
                <dd>
                  <ColorSwatch hex={tenant.primaryColorHex} />
                </dd>
                <dt>Logo</dt>
                <dd>
                  {tenant.preferWordmark ? (
                    tenant.name.toUpperCase()
                  ) : tenant.logoLightUrl || tenant.logoDarkUrl || tenant.logoUrl ? (
                    <img
                      src={
                        resolveAssetUrl(
                          tenant.logoLightUrl || tenant.logoDarkUrl || tenant.logoUrl
                        ) ?? ''
                      }
                      alt={tenant.name}
                      style={{ maxHeight: '2.5rem', objectFit: 'contain' }}
                    />
                  ) : (
                    tenant.name.toUpperCase()
                  )}
                </dd>
                <dt>Actualizado</dt>
                <dd>{formatDateTime(tenant.updatedAt)}</dd>
              </dl>
            </div>

            <h2 className="app-shell__section-title">Tu cuenta</h2>
            <div className="app-shell__card">
              <dl className="ecu-dl">
                <dt>Nombre</dt>
                <dd>{user.name}</dd>
                <dt>Correo</dt>
                <dd>{user.email}</dd>
                <dt>Cargo</dt>
                <dd>{user.jobTitle ?? '—'}</dd>
                <dt>Departamento</dt>
                <dd>{user.department ?? '—'}</dd>
                <dt>Teléfono</dt>
                <dd>{user.phone ?? '—'}</dd>
                <dt>Último acceso</dt>
                <dd>{formatDateTime(user.lastLoginAt)}</dd>
                <dt>Roles asignados</dt>
                <dd>{user.roleIds.length > 0 ? user.roleIds.length : '—'}</dd>
              </dl>
            </div>
          </>
        ) : null}
      </PageLoadState>

      <p className="app-shell__muted">
        La edición de estos campos estará disponible cuando la Api exponga comandos de actualización.
      </p>
    </>
  )
}

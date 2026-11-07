import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  Button,
  DataGrid,
  Popup,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
} from 'glubox'
import { Copy, ExternalLink, KeyRound, Lock, Plus, Trash2 } from 'lucide-react'
import {
  EmptyState,
  GridToolbarRefresh,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { GridIconButton } from '@/components/ui/GridIconButton'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate, formatDateTime } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createTenantApiKey,
  listDeveloperApiScopes,
  listTenantApiKeys,
  revokeTenantApiKey,
  type CreatedTenantApiKeyDto,
  type DeveloperApiScopeItemDto,
  type TenantApiKeyItemDto,
} from '@/services/developerApiKeysApi'
import { PLATFORM_SETTINGS_READ, PLATFORM_SETTINGS_UPDATE } from '@/services/settingsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

type Row = TenantApiKeyItemDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('credencial API', 'credenciales API')

const EXPIRATION_OPTIONS = [
  { value: 'never', label: 'Sin fecha de expiración' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '180', label: '180 días' },
  { value: '365', label: '1 año (365 días)' },
]

export function DeveloperApiPage() {
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const canRead =
    useHasPermission(PLATFORM_SETTINGS_READ) ||
    useHasPermission('tenancy.tenant.read') ||
    useHasPermission('identity.roles.read')

  const canManage =
    useHasPermission(PLATFORM_SETTINGS_UPDATE) ||
    useHasPermission('tenancy.tenant.update') ||
    useHasPermission('identity.roles.manage')

  const [rows, setRows] = useState<TenantApiKeyItemDto[]>([])
  const [scopesCatalog, setScopesCatalog] = useState<DeveloperApiScopeItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [expirationDays, setExpirationDays] = useState('90')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [createdSecret, setCreatedSecret] = useState<CreatedTenantApiKeyDto | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<TenantApiKeyItemDto | null>(null)
  const [revoking, setRevoking] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      setLoading(true)
      try {
        const [keysData, scopesData] = await Promise.all([
          listTenantApiKeys(tenantId),
          listDeveloperApiScopes(tenantId),
        ])
        setRows(keysData)
        setScopesCatalog(scopesData)
        setError(null)
        if (!opts?.silent) {
          toast.show({
            title: 'Actualizado',
            message: 'Credenciales y scopes sincronizados.',
            variant: 'success',
          })
        }
      } catch (err: unknown) {
        const message = readApiError(err, 'No se pudieron cargar las credenciales de API.')
        setError(message)
        toast.show({ title: 'Error', message, variant: 'error' })
      } finally {
        setLoading(false)
      }
    },
    [tenantId, toast]
  )

  useEffect(() => {
    if (canRead) void load({ silent: true })
  }, [canRead, load])

  const copyToClipboard = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value)
        toast.show({
          title: 'Copiado',
          message: `${label} copiado al portapapeles.`,
          variant: 'success',
        })
      } catch {
        toast.show({
          title: 'Atención',
          message: 'No se pudo copiar automáticamente; selecciona el texto manualmente.',
          variant: 'warning',
        })
      }
    },
    [toast]
  )

  const scopesByModule = useMemo(() => {
    const groups = new Map<string, DeveloperApiScopeItemDto[]>()
    for (const item of scopesCatalog) {
      const list = groups.get(item.moduleLabel) ?? []
      list.push(item)
      groups.set(item.moduleLabel, list)
    }
    return Array.from(groups.entries())
  }, [scopesCatalog])

  const toggleScope = useCallback((code: string) => {
    setSelectedScopes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    )
  }, [])

  const handleOpenCreate = useCallback(() => {
    setKeyName('')
    setExpirationDays('90')
    const defaultReadScopes = scopesCatalog
      .filter((s) => s.isModuleEntitled && s.code.endsWith('.read'))
      .map((s) => s.code)
    setSelectedScopes(defaultReadScopes)
    setCreateOpen(true)
  }, [scopesCatalog])

  const handleCreateSubmit = useCallback(async () => {
    if (!tenantId) return
    if (!keyName.trim()) {
      toast.show({
        title: 'Validación',
        message: 'Ingresa un nombre descriptivo para la API Key.',
        variant: 'warning',
      })
      return
    }
    if (selectedScopes.length === 0) {
      toast.show({
        title: 'Validación',
        message: 'Selecciona al menos un permiso (scope).',
        variant: 'warning',
      })
      return
    }

    setSubmitting(true)
    try {
      let expiresAt: string | null = null
      if (expirationDays !== 'never') {
        const days = Number(expirationDays)
        if (Number.isFinite(days) && days > 0) {
          const d = new Date()
          d.setDate(d.getDate() + days)
          expiresAt = d.toISOString()
        }
      }

      const created = await createTenantApiKey(tenantId, {
        name: keyName.trim(),
        scopes: selectedScopes,
        expiresAt,
      })

      setCreateOpen(false)
      setCreatedSecret(created)
      await load({ silent: true })
      toast.show({
        title: 'API Key creada',
        message: 'Guarda la llave secreta ahora; no volverá a mostrarse.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al crear API Key',
        message: readApiError(err, 'No se pudo generar la credencial.'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }, [expirationDays, keyName, load, selectedScopes, tenantId, toast])

  const handleConfirmRevoke = useCallback(async () => {
    if (!tenantId || !revokeTarget) return
    setRevoking(true)
    try {
      await revokeTenantApiKey(tenantId, revokeTarget.id)
      setRevokeTarget(null)
      await load({ silent: true })
      toast.show({
        title: 'API Key revocada',
        message: `La credencial «${revokeTarget.name}» fue invalidada inmediatamente.`,
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al revocar',
        message: readApiError(err, 'No se pudo revocar la API Key.'),
        variant: 'error',
      })
    } finally {
      setRevoking(false)
    }
  }, [load, revokeTarget, tenantId, toast])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'name',
        header: 'Nombre / Integración',
        width: 210,
        sortable: true,
        renderCell: (_v: Row['name'], row: Row) => <strong>{row.name}</strong>,
      },
      {
        key: 'keyPrefix',
        header: 'Prefijo',
        width: 175,
        sortable: true,
        renderCell: (_v: Row['keyPrefix'], row: Row) => (
          <code className="ecu-code">{row.keyPrefix}_•••</code>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['status'], row: Row) => {
          const isActive = row.status === 'active'
          const label =
            row.status === 'active'
              ? 'Activa'
              : row.status === 'expired'
                ? 'Expirada'
                : 'Revocada'
          return (
            <span className={`ecu-status ${isActive ? 'ecu-status--active' : 'ecu-status--inactive'}`}>
              <span className="ecu-status__dot" aria-hidden />
              {label}
            </span>
          )
        },
      },
      {
        key: 'scopes',
        header: 'Scopes asignados',
        width: 280,
        sortable: false,
        renderCell: (_v: Row['scopes'], row: Row) => (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {row.scopes.slice(0, 3).map((scope) => (
              <span key={scope} className="ecu-chip">
                {scope}
              </span>
            ))}
            {row.scopes.length > 3 ? (
              <span className="ecu-chip ecu-chip--muted" title={row.scopes.join(', ')}>
                +{row.scopes.length - 3} más
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'lastUsedAt',
        header: 'Último uso',
        width: 155,
        sortable: true,
        renderCell: (_v: Row['lastUsedAt'], row: Row) =>
          row.lastUsedAt ? formatDateTime(row.lastUsedAt) : 'Nunca',
      },
      {
        key: 'expiresAt',
        header: 'Expira',
        width: 130,
        sortable: true,
        renderCell: (_v: Row['expiresAt'], row: Row) =>
          row.expiresAt ? formatDate(row.expiresAt) : 'Sin expiración',
      },
      {
        key: 'createdAt',
        header: 'Creada',
        width: 120,
        sortable: true,
        renderCell: (_v: Row['createdAt'], row: Row) => formatDate(row.createdAt),
      },
      ...(canManage
        ? ([
            {
              key: 'id',
              header: 'Acciones',
              sticky: 'right',
              width: 84,
              align: 'center' as const,
              sortable: false,
              renderCell: (_v: Row['id'], row: Row) =>
                row.status !== 'active' ? (
                  '—'
                ) : (
                  <div className="ecu-companies-grid__actions">
                    <GridIconButton
                      label="Revocar API Key"
                      icon={Trash2}
                      onClick={() => setRevokeTarget(row)}
                    />
                  </div>
                ),
            },
          ] satisfies ColumnDef<Row>[])
        : []),
    ],
    [canManage]
  )

  if (!canRead) {
    return (
      <TenantSessionGate title="API y Desarrolladores" lead="Integraciones M2M de tu organización.">
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Acceso Restringido"
            subtitle="No tienes permisos para consultar las credenciales de API de esta empresa."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
          />
        </div>
      </TenantSessionGate>
    )
  }

  const activeCount = rows.filter((r) => r.status === 'active').length
  const revokedOrExpiredCount = rows.length - activeCount
  const entitledScopesCount = scopesCatalog.filter((s) => s.isModuleEntitled).length

  const apiOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5088'
  const curlSnippet = `curl -X GET "${apiOrigin}/api/v1/tenants/${tenantId ?? '{tenantId}'}/catalog/items" \\
  -H "X-Api-Key: ecx_live_tu_prefijo_tu_secreto" \\
  -H "Accept: application/json"`

  return (
    <TenantSessionGate
      title="API y Desarrolladores"
      lead="Expón y consume los módulos contratados de tu empresa desde tu propia infraestructura."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="API y Portal de Desarrolladores"
          info="Genera credenciales Machine-to-Machine (API Keys) con scopes acotados y consulta la especificación OpenAPI v1 exclusiva para empresas."
          badge={<StatusBadge tone="primary">Developer API v1</StatusBadge>}
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a
                href="/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="sf-button sf-button--primary sf-button--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ExternalLink size={15} />
                Sitio de Documentación (/developers)
              </a>
              <a
                href="/scalar/external-v1"
                target="_blank"
                rel="noopener noreferrer"
                className="sf-button sf-button--outline sf-button--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ExternalLink size={15} />
                Portal Interactivo (Scalar)
              </a>
              <a
                href="/openapi/external-v1.json"
                target="_blank"
                rel="noopener noreferrer"
                className="sf-button sf-button--outline sf-button--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ExternalLink size={15} />
                OpenAPI JSON (v1)
              </a>
            </div>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de API">
          <StatCard label="API Keys Activas" value={activeCount} />
          <StatCard label="Revocadas / Expiradas" value={revokedOrExpiredCount} />
          <StatCard label="Scopes Habilitados" value={`${entitledScopesCount} / ${scopesCatalog.length}`} />
          <StatCard
            label="Especificación"
            value="OpenAPI 3.1"
          />
        </div>

        <SectionCard
          title="Datos de Conexión para tu Infraestructura Cliente"
          bodyClassName="ecu-section-card__body--padded"
        >
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-outline-variant, rgba(128,128,128,0.25))',
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                  Identificador de Organización (<code>tenantId</code>)
                </div>
                <code className="ecu-code" style={{ fontSize: '0.95rem' }}>
                  {tenantId ?? '—'}
                </code>
              </div>
              {tenantId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void copyToClipboard(tenantId, 'Tenant ID')}
                >
                  <Copy size={15} style={{ marginRight: '0.35rem' }} />
                  Copiar Tenant ID
                </Button>
              ) : null}
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.4rem',
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Ejemplo de consumo (cURL con cabecera <code>X-Api-Key</code>)
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void copyToClipboard(curlSnippet, 'Ejemplo cURL')}
                >
                  <Copy size={14} style={{ marginRight: '0.35rem' }} />
                  Copiar cURL
                </Button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '0.85rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'var(--color-surface-container-highest, rgba(0,0,0,0.06))',
                  overflowX: 'auto',
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                }}
              >
                <code>{curlSnippet}</code>
              </pre>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Credenciales API Key (Machine-to-Machine)">
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {rows.length === 0 && !loading ? (
            <EmptyState
              icon="key"
              title="Aún no has generado credenciales API Key"
              description="Crea una API Key con permisos (scopes) específicos para conectar tu e-commerce propio, ERP o aplicación móvil con EcuNexo."
              action={
                <Button
                  type="button"
                  variant="primary"
                  disabled={!canManage}
                  onClick={handleOpenCreate}
                >
                  <Plus size={16} style={{ marginRight: '0.35rem' }} />
                  Nueva API Key
                </Button>
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={rows as Row[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar por nombre o prefijo…"
              searchKeys={['name', 'keyPrefix']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canManage}
                    onClick={handleOpenCreate}
                  >
                    + Nueva API Key
                  </Button>
                </div>
              }
              paging={paging}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              pageSizeOptions={pageSizeOptions}
              layout="auto"
              loading={loading}
              messages={messages}
            />
          )}
        </SectionCard>

        {/* Modal Crear API Key */}
        <Popup
          open={createOpen}
          onClose={() => {
            if (!submitting) setCreateOpen(false)
          }}
          title="Generar Nueva API Key"
          width={680}
        >
          <div style={{ display: 'grid', gap: '1rem', padding: '0.25rem 0' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.85rem',
              }}
            >
              <TextBox
                label="Nombre de la integración"
                labelPosition="outlined"
                placeholder="Ej. ERP Interno, Tienda Web, App Móvil"
                value={keyName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyName(e.target.value)}
              />
              <Select
                label="Expiración"
                labelPosition="outlined"
                options={EXPIRATION_OPTIONS}
                value={expirationDays}
                onChange={(val) => setExpirationDays(String(val ?? '90'))}
              />
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Permisos autorizados (Scopes)
              </div>
              <div
                style={{
                  maxHeight: '320px',
                  overflowY: 'auto',
                  display: 'grid',
                  gap: '0.85rem',
                  paddingRight: '0.25rem',
                }}
              >
                {scopesByModule.map(([moduleLabel, moduleScopes]) => (
                  <div
                    key={moduleLabel}
                    style={{
                      border: '1px solid var(--color-outline-variant, rgba(128,128,128,0.25))',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{moduleLabel}</span>
                      {!moduleScopes[0]?.isModuleEntitled ? (
                        <span
                          className="ecu-chip ecu-chip--muted"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Lock size={12} />
                          Módulo no incluido en tu plan
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                      {moduleScopes.map((scope) => {
                        const checked = selectedScopes.includes(scope.code)
                        return (
                          <label
                            key={scope.code}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.55rem',
                              opacity: scope.isModuleEntitled ? 1 : 0.55,
                              cursor: scope.isModuleEntitled ? 'pointer' : 'not-allowed',
                              fontSize: '0.84rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!scope.isModuleEntitled}
                              onChange={() => toggleScope(scope.code)}
                              style={{ marginTop: '0.2rem' }}
                            />
                            <div>
                              <div>
                                <strong>{scope.title}</strong>{' '}
                                <code className="ecu-code">{scope.code}</code>
                              </div>
                              <div style={{ fontSize: '0.78rem', opacity: 0.78 }}>
                                {scope.description}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={submitting}
                onClick={() => void handleCreateSubmit()}
              >
                {submitting ? 'Generando…' : 'Generar API Key'}
              </Button>
            </div>
          </div>
        </Popup>

        {/* Modal Revelación Única del Secreto */}
        <Popup
          open={Boolean(createdSecret)}
          onClose={() => setCreatedSecret(null)}
          title="Copia tu nueva API Key ahora"
          width={580}
        >
          {createdSecret ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: '0.86rem',
                }}
              >
                <strong>Importante:</strong> Por seguridad, EcuNexo solo almacena el hash SHA-256 de
                esta credencial. <strong>No podrás volver a ver esta llave completa</strong> después
                de cerrar esta ventana.
              </div>

              <div>
                <div style={{ fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Credencial para <code>{createdSecret.name}</code>:
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--color-outline-variant, rgba(128,128,128,0.3))',
                  }}
                >
                  <KeyRound size={18} />
                  <code
                    className="ecu-code"
                    style={{ flex: 1, wordBreak: 'break-all', fontSize: '0.9rem' }}
                  >
                    {createdSecret.plainTextKey}
                  </code>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() =>
                      void copyToClipboard(createdSecret.plainTextKey, 'API Key secreta')
                    }
                  >
                    <Copy size={15} style={{ marginRight: '0.35rem' }} />
                    Copiar
                  </Button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={() => setCreatedSecret(null)}>
                  Ya guardé mi API Key
                </Button>
              </div>
            </div>
          ) : null}
        </Popup>

        {/* Modal Confirmar Revocación */}
        <Popup
          open={Boolean(revokeTarget)}
          onClose={() => {
            if (!revoking) setRevokeTarget(null)
          }}
          title="Revocar API Key"
          width={460}
        >
          {revokeTarget ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                ¿Estás seguro de revocar la credencial <strong>{revokeTarget.name}</strong> (
                <code>{revokeTarget.keyPrefix}</code>)? Cualquier sistema externo que la utilice
                recibirá <code>401 Unauthorized</code> de inmediato.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={revoking}
                  onClick={() => setRevokeTarget(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={revoking}
                  onClick={() => void handleConfirmRevoke()}
                >
                  {revoking ? 'Revocando…' : 'Sí, revocar'}
                </Button>
              </div>
            </div>
          ) : null}
        </Popup>
      </div>
    </TenantSessionGate>
  )
}

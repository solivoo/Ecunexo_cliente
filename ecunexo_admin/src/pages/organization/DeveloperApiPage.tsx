import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataGrid,
  Popup,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
} from 'glubox'
import {
  Activity,
  Copy,
  Download,
  ExternalLink,
  Eye,
  KeyRound,
  Layers,
  Play,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react'
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
  listDeveloperApiScopes,
  listTenantApiKeys,
  revokeTenantApiKey,
  type DeveloperApiScopeItemDto,
  type TenantApiKeyItemDto,
} from '@/services/developerApiKeysApi'
import { PLATFORM_SETTINGS_READ, PLATFORM_SETTINGS_UPDATE } from '@/services/settingsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import './developerApiPage.css'

type Row = TenantApiKeyItemDto & Record<string, unknown>

const messages = createSpanishDataGridMessages('credencial API', 'credenciales API')

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Solo activas' },
  { value: 'revoked', label: 'Revocadas' },
  { value: 'expired', label: 'Expiradas' },
]

interface LiveProbeEndpoint {
  readonly value: string
  readonly label: string
  readonly pathTemplate: string
  readonly requiredScope: string
}

const LIVE_PROBE_ENDPOINTS: readonly LiveProbeEndpoint[] = [
  {
    value: 'catalog',
    label: 'GET Catálogo de Productos (/catalog/items)',
    pathTemplate: '/api/v1/tenants/{tenantId}/catalog/items?pageNumber=1&pageSize=5',
    requiredScope: 'catalog.item.read',
  },
  {
    value: 'warehouses',
    label: 'GET Bodegas Operativas (/warehouses)',
    pathTemplate: '/api/v1/tenants/{tenantId}/warehouses?pageNumber=1&pageSize=5',
    requiredScope: 'warehousing.read',
  },
  {
    value: 'stock',
    label: 'GET Saldos de Stock (/inventory/stock)',
    pathTemplate: '/api/v1/tenants/{tenantId}/inventory/stock?pageNumber=1&pageSize=5',
    requiredScope: 'inventory.stock.read',
  },
  {
    value: 'customers',
    label: 'GET Directorio de Clientes (/customers)',
    pathTemplate: '/api/v1/tenants/{tenantId}/customers?pageNumber=1&pageSize=5',
    requiredScope: 'customers.read',
  },
  {
    value: 'orders',
    label: 'GET Pedidos E-commerce (/ecommerce/orders)',
    pathTemplate: '/api/v1/tenants/{tenantId}/ecommerce/orders?pageNumber=1&pageSize=5',
    requiredScope: 'ecommerce.orders.read',
  },
]

export function DeveloperApiPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const tenantId = useAppSelector(selectTenantId)

  const hasPlatformRead = useHasPermission(PLATFORM_SETTINGS_READ)
  const hasTenantRead = useHasPermission('tenancy.tenant.read')
  const hasRolesRead = useHasPermission('identity.roles.read')
  const canRead = hasPlatformRead || hasTenantRead || hasRolesRead

  const hasPlatformUpdate = useHasPermission(PLATFORM_SETTINGS_UPDATE)
  const hasTenantUpdate = useHasPermission('tenancy.tenant.update')
  const hasRolesManage = useHasPermission('identity.roles.manage')
  const canManage = hasPlatformUpdate || hasTenantUpdate || hasRolesManage

  const [rows, setRows] = useState<TenantApiKeyItemDto[]>([])
  const [scopesCatalog, setScopesCatalog] = useState<DeveloperApiScopeItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Centro de conectividad & Simulador M2M
  const [activeCenterTab, setActiveCenterTab] = useState<'env' | 'sandbox'>('env')
  const [probeApiKey, setProbeApiKey] = useState('')
  const [probeEndpointKey, setProbeEndpointKey] = useState<string>('catalog')
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState<{
    status: number
    statusText: string
    elapsedMs: number
    ok: boolean
    body: string
  } | null>(null)

  // Modales de inspección y revocación
  const [inspectTarget, setInspectTarget] = useState<TenantApiKeyItemDto | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<TenantApiKeyItemDto | null>(null)
  const [revoking, setRevoking] = useState(false)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!tenantId) return
      if (!opts?.silent) {
        setLoading(true)
      }
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
            title: 'Sincronizado',
            message: 'Credenciales M2M y catálogo de scopes actualizados.',
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
    if (!canRead || !tenantId) return
    let active = true
    void Promise.all([listTenantApiKeys(tenantId), listDeveloperApiScopes(tenantId)])
      .then(([keysData, scopesData]) => {
        if (!active) return
        setRows(keysData)
        setScopesCatalog(scopesData)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(readApiError(err, 'No se pudieron cargar las credenciales de API.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [canRead, tenantId])

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

  const downloadEnvFile = useCallback(
    (apiKeySecret: string, integrationName?: string) => {
      const apiOrigin =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5088'
      const content = [
        `# ============================================================================`,
        `# EcuNexo Enterprise Developer API — Configuración M2M`,
        `# Integración: ${integrationName ?? 'Cliente Externo'}`,
        `# Generado: ${new Date().toISOString()}`,
        `# ============================================================================`,
        `ECUNEXO_API_BASE_URL="${apiOrigin}"`,
        `ECUNEXO_TENANT_ID="${tenantId ?? ''}"`,
        `ECUNEXO_API_KEY="${apiKeySecret}"`,
        ``,
      ].join('\n')

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `.env.ecunexo`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    },
    [tenantId]
  )

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

  const handleRunLiveProbe = useCallback(async () => {
    if (!tenantId) return
    const trimmedKey = probeApiKey.trim()
    if (!trimmedKey) {
      toast.show({
        title: 'API Key requerida',
        message: 'Pega una llave completa (ecx_live_...) para ejecutar la prueba M2M.',
        variant: 'warning',
      })
      return
    }

    const endpoint =
      LIVE_PROBE_ENDPOINTS.find((e) => e.value === probeEndpointKey) ?? LIVE_PROBE_ENDPOINTS[0]
    const url = endpoint.pathTemplate.replace('{tenantId}', tenantId)

    setProbing(true)
    const start = performance.now()
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Api-Key': trimmedKey,
        },
      })
      const elapsedMs = Math.round(performance.now() - start)
      const rawText = await response.text()
      let formattedBody = rawText
      try {
        formattedBody = JSON.stringify(JSON.parse(rawText), null, 2)
      } catch {
        // Keep raw text if not JSON
      }

      setProbeResult({
        status: response.status,
        statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
        elapsedMs,
        ok: response.ok,
        body: formattedBody || '(Respuesta vacía)',
      })
    } catch (err: unknown) {
      const elapsedMs = Math.round(performance.now() - start)
      setProbeResult({
        status: 0,
        statusText: 'Network Error',
        elapsedMs,
        ok: false,
        body: readApiError(err, 'Error de red al conectar con el endpoint.'),
      })
    } finally {
      setProbing(false)
    }
  }, [probeApiKey, probeEndpointKey, tenantId, toast])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((r) => r.status === statusFilter)
  }, [rows, statusFilter])

  const columns = useMemo(
    (): ColumnDef<Row>[] => [
      {
        key: 'name',
        header: 'Integración / Cliente',
        width: 220,
        sortable: true,
        renderCell: (_v: Row['name'], row: Row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <strong>{row.name}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--c-text-muted, #64748b)' }}>
              ID: {row.id.slice(0, 8)}…
            </span>
          </div>
        ),
      },
      {
        key: 'keyPrefix',
        header: 'Prefijo Público',
        width: 185,
        sortable: true,
        renderCell: (_v: Row['keyPrefix'], row: Row) => (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <code className="ecu-code">{row.keyPrefix}_•••</code>
            <button
              type="button"
              onClick={() => void copyToClipboard(row.keyPrefix, 'Prefijo de llave')}
              title="Copiar prefijo"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--c-text-muted, #64748b)',
                cursor: 'pointer',
                padding: '0.15rem',
                display: 'inline-flex',
              }}
            >
              <Copy size={13} />
            </button>
          </div>
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
        header: 'Alcance (Scopes)',
        width: 290,
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
        header: 'Último Uso',
        width: 155,
        sortable: true,
        renderCell: (_v: Row['lastUsedAt'], row: Row) =>
          row.lastUsedAt ? formatDateTime(row.lastUsedAt) : 'Sin actividad aún',
      },
      {
        key: 'expiresAt',
        header: 'Vigencia',
        width: 135,
        sortable: true,
        renderCell: (_v: Row['expiresAt'], row: Row) =>
          row.expiresAt ? formatDate(row.expiresAt) : 'Permanente',
      },
      {
        key: 'createdAt',
        header: 'Emisión',
        width: 120,
        sortable: true,
        renderCell: (_v: Row['createdAt'], row: Row) => formatDate(row.createdAt),
      },
      {
        key: 'id',
        header: 'Acciones',
        sticky: 'right',
        width: 108,
        align: 'center' as const,
        sortable: false,
        renderCell: (_v: Row['id'], row: Row) => (
          <div className="ecu-companies-grid__actions">
            <GridIconButton
              label="Inspeccionar credencial y scopes"
              icon={Eye}
              onClick={() => setInspectTarget(row)}
            />
            {canManage && row.status === 'active' ? (
              <GridIconButton
                label="Revocar API Key"
                icon={Trash2}
                onClick={() => setRevokeTarget(row)}
              />
            ) : null}
          </div>
        ),
      },
    ],
    [canManage, copyToClipboard]
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
  const envBlockSnippet = [
    `ECUNEXO_API_BASE_URL="${apiOrigin}"`,
    `ECUNEXO_TENANT_ID="${tenantId ?? '{tenantId}'}"`,
    `ECUNEXO_API_KEY="ecx_live_tu_prefijo_tu_secreto"`,
  ].join('\n')

  const curlSnippet = `curl -X GET "${apiOrigin}/api/v1/tenants/${tenantId ?? '{tenantId}'}/catalog/items?pageNumber=1&pageSize=25" \\
  -H "X-Api-Key: ecx_live_tu_prefijo_tu_secreto" \\
  -H "Accept: application/json"`

  const selectedProbeEndpoint =
    LIVE_PROBE_ENDPOINTS.find((e) => e.value === probeEndpointKey) ?? LIVE_PROBE_ENDPOINTS[0]

  return (
    <TenantSessionGate
      title="API y Desarrolladores"
      lead="Gobierno de credenciales Machine-to-Machine (M2M), sandboxing y telemetría de acceso externo."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Centro de API y Portal de Desarrolladores"
          subtitle="Conecta tu propio e-commerce headless, ERP, POS o aplicación móvil con aislamiento criptográfico por Tenant."
          info="Las credenciales API Key autentican servidores externos mediante la cabecera X-Api-Key y aplican triple validación: aislamiento de Tenant, licencia activa del módulo y scopes asignados."
          badge={<StatusBadge tone="primary" withDot>Developer API v1</StatusBadge>}
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button
                type="button"
                size="sm"
                variant="primary"
                title="Portal de documentación para desarrolladores (/developers)"
                onClick={() => window.open('/developers', '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={15} />
                Docs /developers
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open('/scalar/external-v1', '_blank', 'noopener,noreferrer')}
              >
                <Terminal size={15} />
                Consola Scalar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open('/openapi/external-v1.json', '_blank', 'noopener,noreferrer')}
              >
                <Download size={15} />
                OpenAPI 3.1 JSON
              </Button>
            </div>
          }
        />

        <div className="ecu-stat-grid" aria-label="Resumen de API">
          <StatCard
            label="API Keys Activas"
            value={activeCount}
            icon={<KeyRound size={18} />}
            toneColor="#10b981"
            footerText="Credenciales M2M operativas"
          />
          <StatCard
            label="Revocadas / Expiradas"
            value={revokedOrExpiredCount}
            icon={<ShieldAlert size={18} />}
            toneColor="#f59e0b"
            footerText="Invalidadas por rotación o baja"
          />
          <StatCard
            label="Scopes Habilitados"
            value={`${entitledScopesCount} / ${scopesCatalog.length}`}
            icon={<Layers size={18} />}
            toneColor="#3b82f6"
            footerText="Según módulos contratados en tu plan"
          />
          <StatCard
            label="Seguridad Criptográfica"
            value="SHA-256"
            icon={<ShieldCheck size={18} />}
            toneColor="#6366f1"
            footerText="Comparación en tiempo constante"
          />
        </div>

        {/* Centro de Integración & Simulador M2M en Vivo */}
        <SectionCard
          title="Centro de Conectividad & Simulador M2M en Vivo"
          subtitle="Configura las variables de entorno de tu servidor o verifica en tiempo real una API Key contra los endpoints de tu organización."
          bodyClassName="ecu-section-card__body--padded"
          action={
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <Button
                type="button"
                size="sm"
                variant={activeCenterTab === 'env' ? 'primary' : 'outline'}
                onClick={() => setActiveCenterTab('env')}
              >
                <Terminal size={14} /> .env y cURL
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeCenterTab === 'sandbox' ? 'primary' : 'outline'}
                onClick={() => setActiveCenterTab('sandbox')}
                title="Probador M2M en Vivo"
              >
                <Activity size={14} /> Probar M2M
              </Button>
            </div>
          }
        >
          {activeCenterTab === 'env' ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="ecu-apikey-grid--4">
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Tenant ID (Organización)</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <code className="ecu-code" style={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tenantId ?? '—'}
                    </code>
                    {tenantId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void copyToClipboard(tenantId, 'Tenant ID')}
                      >
                        <Copy size={13} />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Header de Autenticación</span>
                  <span className="ecu-apikey-summary-tile__value">
                    <code className="ecu-code">X-Api-Key</code>
                  </span>
                </div>

                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Formato de Token</span>
                  <span className="ecu-apikey-summary-tile__value">
                    <code className="ecu-code">ecx_live_&lt;prefijo&gt;_&lt;secreto&gt;</code>
                  </span>
                </div>

                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Especificación Contrato</span>
                  <span className="ecu-apikey-summary-tile__value">OpenAPI 3.1 · JSON RFC 9457</span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                      Variables de Entorno (<code>.env</code>)
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void copyToClipboard(envBlockSnippet, 'Bloque .env')}
                      >
                        <Copy size={13} /> Copiar .env
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => downloadEnvFile('ecx_live_tu_prefijo_tu_secreto')}
                      >
                        <Download size={13} /> Descargar .env
                      </Button>
                    </div>
                  </div>
                  <pre className="ecu-apikey-terminal">
                    <code>{envBlockSnippet}</code>
                  </pre>
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
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                      Petición de Verificación Rápida (cURL)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void copyToClipboard(curlSnippet, 'Comando cURL')}
                    >
                      <Copy size={13} /> Copiar cURL
                    </Button>
                  </div>
                  <pre className="ecu-apikey-terminal">
                    <code>{curlSnippet}</code>
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '0.85rem',
                  alignItems: 'end',
                }}
              >
                <TextBox
                  label="API Key a verificar (X-Api-Key)"
                  labelPosition="outlined"
                  placeholder="ecx_live_a1b2c3d4_..."
                  value={probeApiKey}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setProbeApiKey(e.target.value)}
                />
                <Select
                  label="Endpoint de prueba en tu Tenant"
                  labelPosition="outlined"
                  options={LIVE_PROBE_ENDPOINTS.map((e) => ({ value: e.value, label: e.label }))}
                  value={probeEndpointKey}
                  onChange={(val) => setProbeEndpointKey(String(val ?? 'catalog'))}
                />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <Button
                    type="button"
                    variant="primary"
                    title="Probar conexión M2M en vivo"
                    disabled={probing}
                    onClick={() => void handleRunLiveProbe()}
                  >
                    <Play size={15} />
                    {probing ? 'Ejecutando…' : 'Probar M2M'}
                  </Button>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--c-text-muted, #64748b)' }}>
                Endpoint destino:{' '}
                <code className="ecu-code">
                  GET {selectedProbeEndpoint.pathTemplate.replace('{tenantId}', tenantId ?? '{tenantId}')}
                </code>{' '}
                · Scope requerido: <code className="ecu-code">{selectedProbeEndpoint.requiredScope}</code>
              </div>

              {probeResult ? (
                <div className="ecu-apikey-sandbox-result">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <StatusBadge tone={probeResult.ok ? 'success' : 'danger'} withDot>
                        HTTP {probeResult.status} {probeResult.statusText}
                      </StatusBadge>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        Latencia: {probeResult.elapsedMs} ms
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void copyToClipboard(probeResult.body, 'Respuesta JSON')}
                    >
                      <Copy size={13} /> Copiar respuesta
                    </Button>
                  </div>
                  <pre className="ecu-apikey-terminal" style={{ maxHeight: '260px' }}>
                    <code>{probeResult.body}</code>
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>

        {/* Tabla Principal de Credenciales */}
        <SectionCard
          title="Credenciales API Key Emitidas"
          subtitle="Cada integración externa debe contar con su propia API Key para facilitar la auditoría y rotación sin afectar otros sistemas."
        >
          {error ? (
            <div className="ecu-form-error-banner" role="alert">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          ) : null}

          {rows.length === 0 && !loading ? (
            <EmptyState
              icon="key"
              title="Aún no has emitido credenciales API Key"
              description="Accede a la vista de emisión para configurar la vigencia y seleccionar en la matriz las directivas de autorización."
              action={
                <Button
                  type="button"
                  variant="primary"
                  title="Emitir primera API Key"
                  disabled={!canManage}
                  onClick={() => navigate('/organizacion/api/nueva')}
                >
                  <Plus size={16} />
                  Primera API Key
                </Button>
              }
            />
          ) : (
            <DataGrid
              className="ecu-companies-grid"
              dataSource={filteredRows as Row[]}
              keyExpr="id"
              columns={columns}
              selectionMode="none"
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar por integración o prefijo…"
              searchKeys={['name', 'keyPrefix']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <Select
                    id="apikey-status-filter"
                    aria-label="Filtrar por estado"
                    variant="outline"
                    options={STATUS_FILTER_OPTIONS}
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(String(val ?? 'all'))}
                    width="12.5rem"
                  />
                  <GridToolbarRefresh loading={loading} onRefresh={() => void load()} />
                  <Button
                    type="button"
                    variant="primary"
                    title="Emitir nueva API Key"
                    disabled={!canManage}
                    onClick={() => navigate('/organizacion/api/nueva')}
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

        {/* Modal Inspeccionar Credencial */}
        <Popup
          open={Boolean(inspectTarget)}
          onClose={() => setInspectTarget(null)}
          title={
            inspectTarget
              ? `Ficha Técnica de Credencial: ${inspectTarget.name}`
              : 'Detalle de Credencial'
          }
          width={680}
        >
          {inspectTarget ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="ecu-apikey-grid--4">
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Prefijo</span>
                  <span className="ecu-apikey-summary-tile__value">
                    <code className="ecu-code">{inspectTarget.keyPrefix}</code>
                  </span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Estado</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {inspectTarget.status === 'active'
                      ? 'Activa'
                      : inspectTarget.status === 'expired'
                        ? 'Expirada'
                        : 'Revocada'}
                  </span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Último Uso</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {inspectTarget.lastUsedAt
                      ? formatDateTime(inspectTarget.lastUsedAt)
                      : 'Sin actividad'}
                  </span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Expira</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {inspectTarget.expiresAt
                      ? formatDate(inspectTarget.expiresAt)
                      : 'Permanente'}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.45rem' }}>
                  Scopes Autorizados ({inspectTarget.scopes.length})
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    padding: '0.75rem',
                    borderRadius: '0.6rem',
                    border: '1px solid var(--c-border, rgba(0,0,0,0.12))',
                    background: 'var(--c-surface-subtle, #f8fafc)',
                  }}
                >
                  {inspectTarget.scopes.map((scope) => (
                    <span key={scope} className="ecu-chip">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                {canManage && inspectTarget.status === 'active' ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      const target = inspectTarget
                      setInspectTarget(null)
                      setRevokeTarget(target)
                    }}
                  >
                    <Trash2 size={14} /> Revocar esta API Key
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" onClick={() => setInspectTarget(null)}>
                  Cerrar
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
          title="Revocar Credencial API Key"
          width={480}
        >
          {revokeTarget ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55 }}>
                ¿Confirmas la revocación inmediata de la credencial{' '}
                <strong>{revokeTarget.name}</strong> (<code>{revokeTarget.keyPrefix}</code>)?
                Cualquier servidor externo o tienda que la utilice recibirá{' '}
                <code>401 Unauthorized</code> en tiempo real.
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

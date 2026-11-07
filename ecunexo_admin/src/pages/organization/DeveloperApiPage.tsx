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
import {
  Activity,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  KeyRound,
  Layers,
  Lock,
  Play,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
import './developerApiPage.css'

type Row = TenantApiKeyItemDto & Record<string, unknown>

type IntegrationPresetId = 'ecommerce' | 'erp' | 'readonly' | 'full' | 'custom'

interface IntegrationPreset {
  readonly id: IntegrationPresetId
  readonly title: string
  readonly badge: string
  readonly description: string
  readonly matchScope: (scope: DeveloperApiScopeItemDto) => boolean
}

const INTEGRATION_PRESETS: readonly IntegrationPreset[] = [
  {
    id: 'ecommerce',
    title: 'E-commerce Headless',
    badge: 'Tienda / App',
    description: 'Catálogo, precios, stock, registro de clientes y creación de pedidos.',
    matchScope: (s) =>
      [
        'catalog.item.read',
        'catalog.pricing.read',
        'inventory.stock.read',
        'customers.read',
        'customers.manage',
        'ecommerce.orders.read',
        'ecommerce.orders.create',
      ].includes(s.code),
  },
  {
    id: 'erp',
    title: 'Sincronización ERP / POS',
    badge: 'Backoffice',
    description: 'Sincronización bidireccional de maestro de ítems, precios, stock y clientes.',
    matchScope: (s) =>
      s.code.startsWith('catalog.') ||
      s.code.startsWith('inventory.') ||
      s.code === 'warehousing.read' ||
      s.code.startsWith('customers.') ||
      s.code === 'ecommerce.orders.read',
  },
  {
    id: 'readonly',
    title: 'BI & Analítica (Lectura)',
    badge: 'Mínimo privilegio',
    description: 'Acceso exclusivo de consulta (.read) en todos los módulos contratados.',
    matchScope: (s) => s.code.endsWith('.read'),
  },
  {
    id: 'full',
    title: 'Acceso Total Operativo',
    badge: 'Full M2M',
    description: 'Habilita todos los scopes de lectura y escritura de tu licencia activa.',
    matchScope: () => true,
  },
]

const messages = createSpanishDataGridMessages('credencial API', 'credenciales API')

const EXPIRATION_OPTIONS = [
  { value: 'never', label: 'Sin fecha de expiración (Permanente)' },
  { value: '30', label: '30 días (Rotación mensual)' },
  { value: '90', label: '90 días (Recomendado trimestral)' },
  { value: '180', label: '180 días (Semestral)' },
  { value: '365', label: '1 año (365 días)' },
]

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

  // Modal de creación empresarial
  const [createOpen, setCreateOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [expirationDays, setExpirationDays] = useState('90')
  const [activePreset, setActivePreset] = useState<IntegrationPresetId>('readonly')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [scopeSearch, setScopeSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Modales de revelación, inspección y revocación
  const [createdSecret, setCreatedSecret] = useState<CreatedTenantApiKeyDto | null>(null)
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

  const scopesByModule = useMemo(() => {
    const normalizedQuery = scopeSearch.trim().toLowerCase()
    const groups = new Map<string, DeveloperApiScopeItemDto[]>()
    for (const item of scopesCatalog) {
      if (
        normalizedQuery &&
        !item.code.toLowerCase().includes(normalizedQuery) &&
        !item.title.toLowerCase().includes(normalizedQuery) &&
        !item.description.toLowerCase().includes(normalizedQuery) &&
        !item.moduleLabel.toLowerCase().includes(normalizedQuery)
      ) {
        continue
      }
      const list = groups.get(item.moduleLabel) ?? []
      list.push(item)
      groups.set(item.moduleLabel, list)
    }
    return Array.from(groups.entries())
  }, [scopeSearch, scopesCatalog])

  const applyPreset = useCallback(
    (presetId: IntegrationPresetId) => {
      setActivePreset(presetId)
      const preset = INTEGRATION_PRESETS.find((p) => p.id === presetId)
      if (!preset) return
      const nextScopes = scopesCatalog
        .filter((s) => s.isModuleEntitled && preset.matchScope(s))
        .map((s) => s.code)
      setSelectedScopes(nextScopes)
    },
    [scopesCatalog]
  )

  const toggleScope = useCallback((code: string) => {
    setActivePreset('custom')
    setSelectedScopes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    )
  }, [])

  const setModuleScopesMode = useCallback(
    (moduleScopes: DeveloperApiScopeItemDto[], mode: 'all' | 'read' | 'none') => {
      setActivePreset('custom')
      const entitledModuleCodes = moduleScopes
        .filter((s) => s.isModuleEntitled)
        .map((s) => s.code)
      const readModuleCodes = moduleScopes
        .filter((s) => s.isModuleEntitled && s.code.endsWith('.read'))
        .map((s) => s.code)

      setSelectedScopes((prev) => {
        const withoutModule = prev.filter((code) => !entitledModuleCodes.includes(code))
        if (mode === 'none') return withoutModule
        if (mode === 'read') return [...withoutModule, ...readModuleCodes]
        return [...withoutModule, ...entitledModuleCodes]
      })
    },
    []
  )

  const handleOpenCreate = useCallback(() => {
    setKeyName('')
    setExpirationDays('90')
    setScopeSearch('')
    setActivePreset('readonly')
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
        message: 'Ingresa un nombre descriptivo para identificar la integración.',
        variant: 'warning',
      })
      return
    }
    if (selectedScopes.length === 0) {
      toast.show({
        title: 'Validación',
        message: 'Selecciona al menos un permiso (scope) para emitir la API Key.',
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
      setProbeApiKey(created.plainTextKey)
      await load({ silent: true })
      toast.show({
        title: 'API Key emitida',
        message: 'Guarda la llave secreta ahora; solo se muestra por única vez.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al emitir API Key',
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

  const selectedReadCount = useMemo(
    () => selectedScopes.filter((code) => code.endsWith('.read')).length,
    [selectedScopes]
  )
  const selectedWriteCount = selectedScopes.length - selectedReadCount
  const selectedModulesCount = useMemo(() => {
    const mods = new Set(
      scopesCatalog.filter((s) => selectedScopes.includes(s.code)).map((s) => s.moduleCode)
    )
    return mods.size
  }, [scopesCatalog, selectedScopes])

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
              <a
                href="/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="sf-button sf-button--primary sf-button--sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--c-on-primary, #ffffff)',
                }}
              >
                <ExternalLink size={15} />
                Portal de Documentación (/developers)
              </a>
              <a
                href="/scalar/external-v1"
                target="_blank"
                rel="noopener noreferrer"
                className="sf-button sf-button--outline sf-button--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Terminal size={15} />
                Consola Scalar
              </a>
              <a
                href="/openapi/external-v1.json"
                target="_blank"
                rel="noopener noreferrer"
                className="sf-button sf-button--outline sf-button--sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Download size={15} />
                OpenAPI 3.1 JSON
              </a>
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
                <Terminal size={14} /> Variables .env y cURL
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeCenterTab === 'sandbox' ? 'primary' : 'outline'}
                onClick={() => setActiveCenterTab('sandbox')}
              >
                <Activity size={14} /> Probador M2M en Vivo
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
                    disabled={probing}
                    onClick={() => void handleRunLiveProbe()}
                  >
                    <Play size={15} />
                    {probing ? 'Ejecutando prueba…' : 'Probar Conexión M2M'}
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
              description="Genera tu primera API Key utilizando nuestras plantillas preconfiguradas para E-commerce Headless, ERP o BI."
              action={
                <Button
                  type="button"
                  variant="primary"
                  disabled={!canManage}
                  onClick={handleOpenCreate}
                >
                  <Plus size={16} style={{ marginRight: '0.35rem' }} />
                  Emitir Primera API Key
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
                    disabled={!canManage}
                    onClick={handleOpenCreate}
                  >
                    + Emitir Nueva API Key
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

        {/* Modal Empresarial: Emitir Nueva API Key */}
        <Popup
          open={createOpen}
          onClose={() => {
            if (!submitting) setCreateOpen(false)
          }}
          title="Emitir Credencial API Key (Machine-to-Machine)"
          width={840}
        >
          <div style={{ display: 'grid', gap: '1.15rem', padding: '0.25rem 0' }}>
            {/* Paso 1: Identificación y Vigencia */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '0.85rem',
              }}
            >
              <TextBox
                label="Nombre descriptivo de la integración"
                labelPosition="outlined"
                placeholder="Ej. E-commerce Next.js, SAP Sync, App Vendedores"
                value={keyName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyName(e.target.value)}
              />
              <Select
                label="Política de vigencia / expiración"
                labelPosition="outlined"
                options={EXPIRATION_OPTIONS}
                value={expirationDays}
                onChange={(val) => setExpirationDays(String(val ?? '90'))}
              />
            </div>

            {/* Paso 2: Plantillas de Integración Rápida */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={15} /> Plantillas de Integración (Selección Rápida)
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--c-text-muted, #64748b)' }}>
                  Preselecciona los permisos recomendados según tu arquitectura
                </span>
              </div>

              <div className="ecu-apikey-grid--4">
                {INTEGRATION_PRESETS.map((preset) => {
                  const isSelected = activePreset === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`ecu-apikey-preset-card ${
                        isSelected ? 'ecu-apikey-preset-card--active' : ''
                      }`}
                      onClick={() => applyPreset(preset.id)}
                    >
                      <div className="ecu-apikey-preset-card__title">
                        <span>{preset.title}</span>
                      </div>
                      <div className="ecu-apikey-preset-card__desc">{preset.description}</div>
                      <div>
                        <StatusBadge tone={isSelected ? 'primary' : 'neutral'}>
                          {preset.badge}
                        </StatusBadge>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Paso 3: Matriz de Permisos por Módulo */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.6rem',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  Matriz Granular de Scopes por Módulo
                </div>
                <div style={{ width: '250px' }}>
                  <TextBox
                    placeholder="Filtrar scopes por código o módulo…"
                    value={scopeSearch}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setScopeSearch(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  maxHeight: '280px',
                  overflowY: 'auto',
                  display: 'grid',
                  gap: '0.75rem',
                  paddingRight: '0.25rem',
                }}
              >
                {scopesByModule.map(([moduleLabel, moduleScopes]) => {
                  const isEntitled = Boolean(moduleScopes[0]?.isModuleEntitled)
                  const selectedInModule = moduleScopes.filter((s) =>
                    selectedScopes.includes(s.code)
                  ).length

                  return (
                    <div key={moduleLabel} className="ecu-apikey-module-box">
                      <div className="ecu-apikey-module-box__header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.86rem' }}>{moduleLabel}</strong>
                          <StatusBadge tone={selectedInModule > 0 ? 'primary' : 'neutral'}>
                            {selectedInModule} / {moduleScopes.length}
                          </StatusBadge>
                        </div>

                        {!isEntitled ? (
                          <span
                            className="ecu-chip ecu-chip--muted"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Lock size={12} />
                            Módulo no incluido en tu plan
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setModuleScopesMode(moduleScopes, 'read')}
                            >
                              Solo lectura
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setModuleScopesMode(moduleScopes, 'all')}
                            >
                              Todos
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setModuleScopesMode(moduleScopes, 'none')}
                            >
                              Limpiar
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="ecu-apikey-module-box__body">
                        {moduleScopes.map((scope) => {
                          const checked = selectedScopes.includes(scope.code)
                          const isRead = scope.code.endsWith('.read')
                          return (
                            <label
                              key={scope.code}
                              className={`ecu-apikey-scope-item ${
                                checked ? 'ecu-apikey-scope-item--checked' : ''
                              } ${!scope.isModuleEntitled ? 'ecu-apikey-scope-item--disabled' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!scope.isModuleEntitled}
                                onChange={() => toggleScope(scope.code)}
                                style={{ marginTop: '0.2rem' }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.35rem',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <strong style={{ fontSize: '0.82rem' }}>{scope.title}</strong>
                                  <StatusBadge tone={isRead ? 'info' : 'warning'}>
                                    {isRead ? 'Lectura' : 'Escritura'}
                                  </StatusBadge>
                                </div>
                                <div style={{ marginTop: '0.15rem' }}>
                                  <code className="ecu-code" style={{ fontSize: '0.75rem' }}>
                                    {scope.code}
                                  </code>
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.76rem',
                                    color: 'var(--c-text-muted, #64748b)',
                                    marginTop: '0.2rem',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {scope.description}
                                </div>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Paso 4: Resumen para emitir (4 columnas friendMobile) */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.45rem' }}>
                Resumen para Emitir Credencial
              </div>
              <div className="ecu-apikey-grid--4">
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Integración</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {keyName.trim() || 'Sin nombre aún'}
                  </span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Vigencia</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {expirationDays === 'never' ? 'Permanente' : `${expirationDays} días`}
                  </span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Módulos Alcanzados</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {selectedModulesCount} {selectedModulesCount === 1 ? 'módulo' : 'módulos'}
                  </span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Scopes Autorizados</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {selectedScopes.length} ({selectedReadCount} L / {selectedWriteCount} E)
                  </span>
                </div>
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
                {submitting ? 'Emitiendo credencial…' : 'Emitir API Key'}
              </Button>
            </div>
          </div>
        </Popup>

        {/* Modal Revelación Única del Secreto */}
        <Popup
          open={Boolean(createdSecret)}
          onClose={() => setCreatedSecret(null)}
          title="Credencial Emitida — Revelación Única de Secreto"
          width={660}
        >
          {createdSecret ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '0.6rem',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                }}
              >
                <strong>Aviso de Seguridad Criptográfica:</strong> EcuNexo únicamente persiste el
                hash <code>SHA-256</code> de esta llave en base de datos.{' '}
                <strong>Copia o descarga el secreto ahora</strong>; nunca volverá a mostrarse en el
                panel.
              </div>

              <div className="ecu-apikey-grid--4">
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Integración</span>
                  <span className="ecu-apikey-summary-tile__value">{createdSecret.name}</span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Prefijo</span>
                  <span className="ecu-apikey-summary-tile__value">
                    <code className="ecu-code">{createdSecret.keyPrefix}</code>
                  </span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Scopes</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {createdSecret.scopes.length} permisos
                  </span>
                </div>
                <div className="ecu-apikey-summary-tile">
                  <span className="ecu-apikey-summary-tile__label">Vigencia</span>
                  <span className="ecu-apikey-summary-tile__value">
                    {createdSecret.expiresAt ? formatDate(createdSecret.expiresAt) : 'Permanente'}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Llave Secreta M2M (<code>X-Api-Key</code>):
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.6rem',
                    border: '1px solid var(--c-border, rgba(128,128,128,0.3))',
                    background: 'var(--c-surface-subtle, #f8fafc)',
                  }}
                >
                  <KeyRound size={18} />
                  <code
                    className="ecu-code"
                    style={{ flex: 1, wordBreak: 'break-all', fontSize: '0.88rem' }}
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
                    Copiar Llave
                  </Button>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadEnvFile(createdSecret.plainTextKey, createdSecret.name)
                    }
                  >
                    <Download size={14} /> Descargar .env.ecunexo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProbeApiKey(createdSecret.plainTextKey)
                      setActiveCenterTab('sandbox')
                      setCreatedSecret(null)
                    }}
                  >
                    <Play size={14} /> Probar llave en el Simulador
                  </Button>
                </div>

                <Button type="button" variant="secondary" onClick={() => setCreatedSecret(null)}>
                  <CheckCircle2 size={15} /> Ya guardé mi API Key
                </Button>
              </div>
            </div>
          ) : null}
        </Popup>

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
                  {revoking ? 'Revocando…' : 'Sí, revocar credencial'}
                </Button>
              </div>
            </div>
          ) : null}
        </Popup>
      </div>
    </TenantSessionGate>
  )
}

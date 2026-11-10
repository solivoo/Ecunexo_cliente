import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataGrid,
  OptionGroup,
  Select,
  TextBox,
  useToast,
  type ColumnDef,
} from 'glubox'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Layers,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { TenantSessionGate } from '@/features/auth/TenantSessionGate'
import { PageLoadState } from '@/features/organization/components/PageLoadState'
import { useGluComponentSize } from '@/hooks/useGluComponentSize'
import { useGluDataGridPaging } from '@/hooks/useGluDataGridPaging'
import { useHasPermission } from '@/hooks/useHasPermission'
import { formatDate } from '@/lib/formatDate'
import { createSpanishDataGridMessages } from '@/lib/gluDataGridMessages'
import { readApiError } from '@/lib/readApiError'
import {
  createTenantApiKey,
  listDeveloperApiScopes,
  type CreatedTenantApiKeyDto,
  type DeveloperApiScopeItemDto,
} from '@/services/developerApiKeysApi'
import { PLATFORM_SETTINGS_UPDATE } from '@/services/settingsApi'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import './developerApiPage.css'

type AssignmentFilter = 'all' | 'assigned' | 'unassigned'
type PresetMode = 'readonly' | 'ecommerce' | 'erp' | 'full' | 'custom'

type ScopeGridRow = {
  id: string
  code: string
  title: string
  description: string
  moduleCode: string
  moduleLabel: string
  isRead: boolean
  assigned: boolean
} & Record<string, unknown>

const gridMessages = createSpanishDataGridMessages('directiva de alcance', 'directivas de alcance')

const EXPIRATION_OPTIONS = [
  { value: 'never', label: 'Sin fecha de expiración (Permanente)' },
  { value: '30', label: '30 días (Rotación mensual)' },
  { value: '90', label: '90 días (Recomendado trimestral)' },
  { value: '180', label: '180 días (Semestral)' },
  { value: '365', label: '1 año (365 días)' },
]

const PRESET_OPTIONS: { value: PresetMode; label: string }[] = [
  { value: 'readonly', label: 'BI & Analítica — Solo Lectura (.read)' },
  { value: 'ecommerce', label: 'E-commerce Headless — Catálogo, Stock, Clientes y Pedidos' },
  { value: 'erp', label: 'Sincronización ERP / POS — Maestro de Ítems, Precios e Inventario' },
  { value: 'full', label: 'Acceso Total Operativo — Todos los scopes contratados' },
  { value: 'custom', label: 'Selección Personalizada en Matriz' },
]

const ASSIGNMENT_OPTIONS: { value: AssignmentFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'assigned', label: 'Marcados' },
  { value: 'unassigned', label: 'Sin marcar' },
]

function toAssignmentFilter(value: string): AssignmentFilter | null {
  if (value === 'all' || value === 'assigned' || value === 'unassigned') return value
  return null
}

function matchPresetScope(preset: PresetMode, code: string): boolean {
  if (preset === 'readonly') return code.endsWith('.read')
  if (preset === 'full') return true
  if (preset === 'ecommerce') {
    return [
      'catalog.item.read',
      'catalog.pricing.read',
      'inventory.stock.read',
      'customers.read',
      'customers.manage',
      'ecommerce.orders.read',
      'ecommerce.orders.create',
    ].includes(code)
  }
  if (preset === 'erp') {
    return (
      code.startsWith('catalog.') ||
      code.startsWith('inventory.') ||
      code === 'warehousing.read' ||
      code.startsWith('customers.') ||
      code === 'ecommerce.orders.read'
    )
  }
  return false
}

export function CreateDeveloperApiKeyPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const size = useGluComponentSize()
  const tenantId = useAppSelector(selectTenantId)

  const hasPlatformUpdate = useHasPermission(PLATFORM_SETTINGS_UPDATE)
  const hasTenantUpdate = useHasPermission('tenancy.tenant.update')
  const hasRolesManage = useHasPermission('identity.roles.manage')
  const canManage = hasPlatformUpdate || hasTenantUpdate || hasRolesManage

  const [scopesCatalog, setScopesCatalog] = useState<DeveloperApiScopeItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [keyName, setKeyName] = useState('')
  const [expirationDays, setExpirationDays] = useState('90')
  const [presetMode, setPresetMode] = useState<PresetMode>('readonly')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])

  const [moduleFilter, setModuleFilter] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all')
  const [submitting, setSubmitting] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<CreatedTenantApiKeyDto | null>(null)

  const { paging, pageSizeOptions, onPageChange, onPageSizeChange } = useGluDataGridPaging()

  useEffect(() => {
    if (!tenantId) return
    let active = true
    void listDeveloperApiScopes(tenantId)
      .then((data) => {
        if (!active) return
        const entitled = data.filter((s) => s.isModuleEntitled)
        setScopesCatalog(entitled)
        setSelectedScopes(entitled.filter((s) => s.code.endsWith('.read')).map((s) => s.code))
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(readApiError(err, 'No se pudo cargar el catálogo de directivas M2M.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [tenantId])

  const handlePresetChange = useCallback(
    (value: string) => {
      const nextPreset = (value || 'custom') as PresetMode
      setPresetMode(nextPreset)
      if (nextPreset === 'custom') return
      const nextSelected = scopesCatalog
        .filter((s) => matchPresetScope(nextPreset, s.code))
        .map((s) => s.code)
      setSelectedScopes(nextSelected)
    },
    [scopesCatalog]
  )

  const moduleOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of scopesCatalog) {
      map.set(s.moduleCode, s.moduleLabel)
    }
    return [
      { value: '', label: 'Todos los módulos' },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ]
  }, [scopesCatalog])

  const allRows = useMemo((): ScopeGridRow[] => {
    const marked = new Set(selectedScopes)
    return scopesCatalog
      .map((s) => ({
        id: s.code,
        code: s.code,
        title: s.title,
        description: s.description,
        moduleCode: s.moduleCode,
        moduleLabel: s.moduleLabel,
        isRead: s.code.endsWith('.read'),
        assigned: marked.has(s.code),
      }))
      .sort((a, b) => a.code.localeCompare(b.code, 'es'))
  }, [scopesCatalog, selectedScopes])

  const filteredRows = useMemo(() => {
    const marked = new Set(selectedScopes)
    return allRows.filter((row) => {
      if (moduleFilter && row.moduleCode !== moduleFilter) return false
      if (assignmentFilter === 'assigned' && !marked.has(row.id)) return false
      if (assignmentFilter === 'unassigned' && marked.has(row.id)) return false
      return true
    })
  }, [allRows, assignmentFilter, moduleFilter, selectedScopes])

  const handleSelectionChange = useCallback(
    (selectedRows: ScopeGridRow[]) => {
      setPresetMode('custom')
      const visibleIds = new Set(filteredRows.map((r) => r.id))
      const next = new Set(selectedScopes)
      for (const id of visibleIds) next.delete(id)
      for (const row of selectedRows) next.add(row.id)
      setSelectedScopes([...next])
    },
    [filteredRows, selectedScopes]
  )

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
          message: 'No se pudo copiar automáticamente.',
          variant: 'warning',
        })
      }
    },
    [toast]
  )

  const downloadEnvFile = useCallback(
    (apiKeySecret: string, integrationName: string) => {
      const apiOrigin =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5088'
      const content = [
        `# ============================================================================`,
        `# EcuNexo Enterprise Developer API — Credencial M2M`,
        `# Integración: ${integrationName}`,
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

  const handleEmitKey = useCallback(async () => {
    if (!tenantId) return
    if (!keyName.trim()) {
      toast.show({
        title: 'Nombre requerido',
        message: 'Ingresa un nombre descriptivo para identificar la integración externa.',
        variant: 'warning',
      })
      return
    }
    if (selectedScopes.length === 0) {
      toast.show({
        title: 'Directivas requeridas',
        message: 'Marca al menos una directiva de autorización en la tabla.',
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

      setCreatedSecret(created)
      toast.show({
        title: 'Credencial API Key emitida',
        message: 'Copia o descarga la llave secreta ahora; solo se revela por única vez.',
        variant: 'success',
      })
    } catch (err: unknown) {
      toast.show({
        title: 'Error al emitir API Key',
        message: readApiError(err, 'No se pudo emitir la credencial M2M.'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }, [expirationDays, keyName, selectedScopes, tenantId, toast])

  const columns = useMemo((): ColumnDef<ScopeGridRow>[] => {
    return [
      {
        key: 'code',
        header: 'Código de Directiva',
        width: 250,
        sortable: true,
        renderCell: (_val: ScopeGridRow['code'], row: ScopeGridRow) => (
          <code className="ecu-code ecu-perm-code">{row.code}</code>
        ),
      },
      {
        key: 'title',
        header: 'Directiva',
        width: 210,
        sortable: true,
        renderCell: (_val: ScopeGridRow['title'], row: ScopeGridRow) => (
          <strong>{row.title}</strong>
        ),
      },
      {
        key: 'moduleLabel',
        header: 'Módulo',
        width: 170,
        sortable: true,
        renderCell: (_val: ScopeGridRow['moduleLabel'], row: ScopeGridRow) => (
          <span className="ecu-chip">{row.moduleLabel}</span>
        ),
      },
      {
        key: 'isRead',
        header: 'Operación',
        width: 130,
        sortable: true,
        renderCell: (_val: ScopeGridRow['isRead'], row: ScopeGridRow) => (
          <StatusBadge tone={row.isRead ? 'info' : 'warning'}>
            {row.isRead ? 'Lectura' : 'Escritura'}
          </StatusBadge>
        ),
      },
      {
        key: 'description',
        header: 'Descripción Técnica',
        width: 360,
        sortable: true,
        renderCell: (_val: ScopeGridRow['description'], row: ScopeGridRow) => (
          <span className="ecu-clip ecu-clip--wide" title={row.description}>
            {row.description}
          </span>
        ),
      },
    ]
  }, [])

  const readCount = useMemo(
    () => selectedScopes.filter((c) => c.endsWith('.read')).length,
    [selectedScopes]
  )
  const writeCount = selectedScopes.length - readCount

  if (!canManage) {
    return (
      <TenantSessionGate
        title="Emitir Credencial API Key"
        lead="Gobierno de integraciones Machine-to-Machine."
      >
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title="Permisos Insuficientes"
            subtitle="Requieres permisos de administración de organización o seguridad para emitir credenciales API Key."
            badge={<StatusBadge tone="danger">Restringido</StatusBadge>}
            actions={
              <Button variant="outline" onClick={() => navigate('/organizacion/api')}>
                <ArrowLeft size={15} /> Volver a API Keys
              </Button>
            }
          />
        </div>
      </TenantSessionGate>
    )
  }

  // Vista posterior a la emisión: Certificado de Revelación Única
  if (createdSecret) {
    return (
      <TenantSessionGate
        title="Credencial API Key Emitida"
        lead="Revelación única de secreto criptográfico M2M."
      >
        <div className="ecu-dashboard-layout ecu-section-page">
          <PageHeader
            title={`Credencial Emitida: ${createdSecret.name}`}
            subtitle="Por seguridad criptográfica, EcuNexo solo almacena el hash SHA-256 de esta credencial. Guarda el secreto antes de salir de esta vista."
            badge={
              <StatusBadge tone="success" withDot>
                Emitida y Activa
              </StatusBadge>
            }
            actions={
              <Button
                variant="outline"
                title="Volver al listado de API Keys"
                onClick={() => navigate('/organizacion/api')}
              >
                <ArrowLeft size={15} /> Volver al listado
              </Button>
            }
          />

          <div className="ecu-stat-grid" aria-label="Resumen de credencial emitida">
            <StatCard
              label="Integración"
              value={createdSecret.name}
              icon={<Terminal size={18} />}
              toneColor="#3b82f6"
            />
            <StatCard
              label="Prefijo Público"
              value={createdSecret.keyPrefix}
              icon={<KeyRound size={18} />}
              toneColor="#10b981"
            />
            <StatCard
              label="Directivas Asignadas"
              value={`${createdSecret.scopes.length} scopes`}
              icon={<Layers size={18} />}
              toneColor="#6366f1"
            />
            <StatCard
              label="Vigencia"
              value={createdSecret.expiresAt ? formatDate(createdSecret.expiresAt) : 'Permanente'}
              icon={<ShieldCheck size={18} />}
              toneColor="#f59e0b"
            />
          </div>

          <SectionCard
            title="Secreto de Autenticación M2M (Cabecera X-Api-Key)"
            subtitle="Esta llave completa no volverá a mostrarse jamás una vez que abandones esta pantalla."
            bodyClassName="ecu-section-card__body--padded"
          >
            <div style={{ display: 'grid', gap: '1.15rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  padding: '0.9rem 1.1rem',
                  borderRadius: '0.65rem',
                  border: '1px solid var(--c-border, rgba(128,128,128,0.3))',
                  background: 'var(--c-surface-subtle, #f8fafc)',
                }}
              >
                <KeyRound size={20} />
                <code
                  className="ecu-code"
                  style={{ flex: 1, fontSize: '0.96rem', wordBreak: 'break-all' }}
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
                  <Copy size={15} /> Copiar API Key
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  title="Descargar archivo .env.ecunexo"
                  onClick={() =>
                    downloadEnvFile(createdSecret.plainTextKey, createdSecret.name)
                  }
                >
                  <Download size={15} /> Descargar .env
                </Button>
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.45rem' }}>
                  Directivas Autorizadas ({createdSecret.scopes.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {createdSecret.scopes.map((scope) => (
                    <span key={scope} className="ecu-chip">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>

              <div className="ecu-companies-form__actions">
                <Button
                  type="button"
                  variant="primary"
                  title="He guardado la credencial de forma segura"
                  onClick={() => navigate('/organizacion/api')}
                >
                  <CheckCircle2 size={16} /> Ir al listado
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      </TenantSessionGate>
    )
  }

  return (
    <TenantSessionGate
      title="Emitir Credencial API Key"
      lead="Configura la identidad de la integración y marca las directivas de autorización en la matriz."
    >
      <div className="ecu-dashboard-layout ecu-section-page">
        <PageHeader
          title="Emitir Credencial API Key"
          info="Define el alcance exacto de permisos Machine-to-Machine (M2M) que heredará el sistema externo al autenticarse con X-Api-Key."
          badge={
            <StatusBadge tone={selectedScopes.length > 0 ? 'primary' : 'warning'} withDot>
              {selectedScopes.length} directivas marcadas
            </StatusBadge>
          }
          actions={
            <Button variant="outline" onClick={() => navigate('/organizacion/api')}>
              <ArrowLeft size={15} /> Volver a API Keys
            </Button>
          }
        />

        <PageLoadState
          loading={loading}
          error={error && scopesCatalog.length === 0 ? error : null}
          empty={scopesCatalog.length === 0 && !loading}
        >
          <div className="ecu-stat-grid" aria-label="Resumen de directivas">
            <StatCard
              label="Catálogo Habilitado"
              value={scopesCatalog.length}
              icon={<Layers size={18} />}
              toneColor="#3b82f6"
              footerText="Directivas según tu licencia"
            />
            <StatCard
              label="Directivas Marcadas"
              value={selectedScopes.length}
              icon={<KeyRound size={18} />}
              toneColor="#10b981"
              footerText="Alcance asignado a la llave"
            />
            <StatCard
              label="Lectura / Escritura"
              value={`${readCount} L · ${writeCount} E`}
              icon={<ShieldCheck size={18} />}
              toneColor="#6366f1"
              footerText="Balance de privilegios"
            />
            <StatCard
              label="En Pantalla"
              value={filteredRows.length}
              icon={<Terminal size={18} />}
              toneColor="#f59e0b"
              footerText="Filas visibles en matriz"
            />
          </div>

          <SectionCard
            title="Parámetros de Identificación y Vigencia"
            bodyClassName="ecu-section-card__body--padded"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
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
              <Select
                label="Perfil rápido de preselección"
                labelPosition="outlined"
                options={PRESET_OPTIONS}
                value={presetMode}
                onChange={(val) => handlePresetChange(String(val ?? 'custom'))}
              />
            </div>
          </SectionCard>

          <SectionCard title="Matriz de directivas de autorización (Scopes)">
            {error ? (
              <div className="ecu-form-error-banner" role="alert">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            ) : null}

            <DataGrid
              className="ecu-companies-grid"
              dataSource={filteredRows}
              keyExpr="id"
              columns={columns}
              selectionMode="multiple"
              selectedRowIds={selectedScopes}
              onSelectionChange={handleSelectionChange}
              showSearch
              searchPosition="left"
              searchWidth={280}
              searchPlaceholder="Buscar código, directiva o módulo…"
              searchKeys={['code', 'title', 'description', 'moduleLabel']}
              toolbarRight={
                <div className="ecu-grid-toolbar-actions">
                  <Select
                    id="apikey-perms-module"
                    aria-label="Módulo"
                    variant="outline"
                    options={moduleOptions}
                    value={moduleFilter}
                    onChange={(val) => setModuleFilter(String(val ?? ''))}
                    placeholder="Módulo"
                    disabled={submitting}
                    width="15rem"
                    size={size}
                  />
                  <div role="group" aria-label="Asignación">
                    <OptionGroup
                      id="apikey-perms-assignment"
                      name="apikey-perms-assignment"
                      options={ASSIGNMENT_OPTIONS}
                      value={assignmentFilter}
                      onChange={(value: string) => {
                        const next = toAssignmentFilter(value)
                        if (next) setAssignmentFilter(next)
                      }}
                      layout="segmented"
                      variant="outline"
                      disabled={submitting}
                      size={size}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    loading={submitting}
                    disabled={submitting || selectedScopes.length === 0}
                    onClick={() => void handleEmitKey()}
                  >
                    Emitir API Key
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => navigate('/organizacion/api')}
                  >
                    Volver a API Keys
                  </Button>
                </div>
              }
              paging={paging}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              paginationMode="client"
              pageSizeOptions={pageSizeOptions}
              layout="auto"
              cardBreakpoint={720}
              virtualized
              virtualThreshold={40}
              showRowCount
              fullWidth
              loading={loading}
              messages={gridMessages}
              stickyFirstColumn
            />
          </SectionCard>

          <div className="ecu-companies-form__actions">
            <Button
              type="button"
              variant="primary"
              loading={submitting}
              disabled={submitting || selectedScopes.length === 0}
              onClick={() => void handleEmitKey()}
            >
              Emitir API Key
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => navigate('/organizacion/api')}
            >
              Cancelar
            </Button>
          </div>
        </PageLoadState>
      </div>
    </TenantSessionGate>
  )
}

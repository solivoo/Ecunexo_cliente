import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, useToast } from 'glubox'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  KeyRound,
  Layers,
  ShieldAlert,
  Terminal,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'

type PortalTab = 'quickstart' | 'scopes' | 'recipes' | 'errors' | 'reference'
type CodeLang = 'curl' | 'typescript' | 'csharp' | 'python'
type UseCaseId = 'catalog' | 'inventory' | 'customers' | 'orders' | 'storefront'

interface ScopeDocRow {
  readonly code: string
  readonly moduleLabel: string
  readonly moduleCode: string
  readonly access: 'Lectura' | 'Escritura'
  readonly description: string
}

const SCOPES_DOCS: readonly ScopeDocRow[] = [
  {
    code: 'catalog.item.read',
    moduleLabel: 'Catálogo y Precios',
    moduleCode: 'catalog',
    access: 'Lectura',
    description: 'Listar y consultar productos, variantes, atributos y plantillas.',
  },
  {
    code: 'catalog.item.create',
    moduleLabel: 'Catálogo y Precios',
    moduleCode: 'catalog',
    access: 'Escritura',
    description: 'Crear productos simples, matrices de variantes y subir multimedia.',
  },
  {
    code: 'catalog.item.update',
    moduleLabel: 'Catálogo y Precios',
    moduleCode: 'catalog',
    access: 'Escritura',
    description: 'Actualizar datos de productos, reordenar variantes y gestionar imágenes.',
  },
  {
    code: 'catalog.item.delete',
    moduleLabel: 'Catálogo y Precios',
    moduleCode: 'catalog',
    access: 'Escritura',
    description: 'Dar de baja lógica (soft-delete) ítems del catálogo.',
  },
  {
    code: 'catalog.pricing.read',
    moduleLabel: 'Catálogo y Precios',
    moduleCode: 'catalog',
    access: 'Lectura',
    description: 'Consultar listas de precios, precios por producto, promociones y simulador.',
  },
  {
    code: 'catalog.pricing.create',
    moduleLabel: 'Catálogo y Precios',
    moduleCode: 'catalog',
    access: 'Escritura',
    description: 'Crear listas de precios y registrar precios de forma individual o masiva.',
  },
  {
    code: 'catalog.pricing.update',
    moduleLabel: 'Catálogo y Precios',
    moduleCode: 'catalog',
    access: 'Escritura',
    description: 'Actualizar precios vigentes, listas y escalas de descuento.',
  },
  {
    code: 'inventory.stock.read',
    moduleLabel: 'Inventario',
    moduleCode: 'inventory',
    access: 'Lectura',
    description: 'Consultar saldos de stock por bodega y documentos de inventario.',
  },
  {
    code: 'inventory.movement.read',
    moduleLabel: 'Inventario',
    moduleCode: 'inventory',
    access: 'Lectura',
    description: 'Consultar el kárdex histórico de movimientos de inventario.',
  },
  {
    code: 'inventory.documents.create',
    moduleLabel: 'Inventario',
    moduleCode: 'inventory',
    access: 'Escritura',
    description: 'Crear documentos de ingreso, egreso o transferencia en borrador.',
  },
  {
    code: 'inventory.documents.approve',
    moduleLabel: 'Inventario',
    moduleCode: 'inventory',
    access: 'Escritura',
    description: 'Aprobar documentos de inventario, recibir transferencias y definir stock mínimo.',
  },
  {
    code: 'warehousing.read',
    moduleLabel: 'Bodegas',
    moduleCode: 'warehousing',
    access: 'Lectura',
    description: 'Listar y consultar el detalle de las bodegas operativas de la empresa.',
  },
  {
    code: 'warehousing.warehouse.manage',
    moduleLabel: 'Bodegas',
    moduleCode: 'warehousing',
    access: 'Escritura',
    description: 'Crear y actualizar bodegas dentro del cupo del plan contratado.',
  },
  {
    code: 'customers.read',
    moduleLabel: 'Clientes',
    moduleCode: 'customers',
    access: 'Lectura',
    description: 'Listar clientes y consultar por ID o por RUC/Cédula (/by-tax-id/{taxId}).',
  },
  {
    code: 'customers.manage',
    moduleLabel: 'Clientes',
    moduleCode: 'customers',
    access: 'Escritura',
    description: 'Registrar nuevos clientes y actualizar su ficha comercial.',
  },
  {
    code: 'ecommerce.orders.read',
    moduleLabel: 'Pedidos y E-commerce',
    moduleCode: 'orders',
    access: 'Lectura',
    description: 'Listar pedidos, consultar detalle de orden y métricas de ventas.',
  },
  {
    code: 'ecommerce.orders.create',
    moduleLabel: 'Pedidos y E-commerce',
    moduleCode: 'orders',
    access: 'Escritura',
    description: 'Registrar pedidos desde tiendas externas, apps móviles o integraciones.',
  },
  {
    code: 'ecommerce.orders.manage',
    moduleLabel: 'Pedidos y E-commerce',
    moduleCode: 'orders',
    access: 'Escritura',
    description: 'Confirmar pago, procesar, despachar, entregar o cancelar pedidos.',
  },
]

const ERROR_CODES_DOCS = [
  {
    http: '401 Unauthorized',
    code: 'auth.unauthorized',
    cause: 'No se envió la cabecera X-Api-Key, el formato es inválido o la credencial fue revocada/expiró.',
    solution: 'Verifica que envías el header X-Api-Key: ecx_live_<prefijo>_<secreto> con una llave activa.',
  },
  {
    http: '403 Forbidden',
    code: 'auth.tenant.mismatch',
    cause: 'El {tenantId} de la URL no coincide con la organización propietaria de la API Key.',
    solution: 'Usa exclusivamente el Tenant ID de la organización donde generaste la API Key.',
  },
  {
    http: '403 Forbidden',
    code: 'module.not_entitled',
    cause: 'La organización no tiene contratado en su licencia el módulo asociado al endpoint.',
    solution: 'Activa o amplía el módulo correspondiente en el plan comercial de la empresa.',
  },
  {
    http: '403 Forbidden',
    code: 'auth.api_key.scope_denied',
    cause: 'La API Key es válida pero no tiene asignado el permiso (scope) requerido por este endpoint.',
    solution: 'Genera una nueva API Key en Configuración → API y Desarrolladores incluyendo el scope necesario.',
  },
  {
    http: '404 Not Found',
    code: '*.not_found',
    cause: 'El recurso solicitado (producto, bodega, cliente o pedido) no existe en el tenant.',
    solution: 'Verifica el UUID del recurso y que pertenezca a tu organización.',
  },
  {
    http: '429 Too Many Requests',
    code: 'rate_limit.exceeded',
    cause: 'Se superó la ventana de peticiones por minuto permitida.',
    solution: 'Implementa reintentos con exponential backoff y cachea catálogos o listas de precios.',
  },
]

function buildCodeSnippet(
  lang: CodeLang,
  useCase: UseCaseId,
  baseUrl: string,
  tenantId: string
): { endpoint: string; requiredScope: string; code: string } {
  const endpoints: Record<
    UseCaseId,
    { method: 'GET' | 'POST'; path: string; scope: string; body?: Record<string, unknown> }
  > = {
    catalog: {
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/catalog/items`,
      scope: 'catalog.item.read',
    },
    inventory: {
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/inventory/stock`,
      scope: 'inventory.stock.read',
    },
    customers: {
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/customers/by-tax-id/1790012345001`,
      scope: 'customers.read',
    },
    orders: {
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/ecommerce/orders`,
      scope: 'ecommerce.orders.read',
    },
    storefront: {
      method: 'GET',
      path: `/api/v1/public/tenants/${tenantId}/storefront/products`,
      scope: 'Público (Anónimo con Rate Limit)',
    },
  }

  const target = endpoints[useCase]
  const fullUrl = `${baseUrl}${target.path}`
  const isPublic = useCase === 'storefront'

  if (lang === 'curl') {
    const authHeader = isPublic
      ? ''
      : ` \\\n  -H "X-Api-Key: ecx_live_a1b2c3d4_tu_secreto_aqui"`
    return {
      endpoint: `${target.method} ${target.path}`,
      requiredScope: target.scope,
      code: `curl -X ${target.method} "${fullUrl}"${authHeader} \\\n  -H "Accept: application/json"`,
    }
  }

  if (lang === 'typescript') {
    const headersBlock = isPublic
      ? `    Accept: 'application/json',`
      : `    'X-Api-Key': process.env.ECUNEXO_API_KEY!,\n    Accept: 'application/json',`
    return {
      endpoint: `${target.method} ${target.path}`,
      requiredScope: target.scope,
      code: `const response = await fetch('${fullUrl}', {
  method: '${target.method}',
  headers: {
${headersBlock}
  },
});

if (!response.ok) {
  const problem = await response.json();
  throw new Error(\`EcuNexo API Error (\${response.status}): \${JSON.stringify(problem)}\`);
}

const data = await response.json();
console.log(data);`,
    }
  }

  if (lang === 'csharp') {
    const headerLine = isPublic
      ? ''
      : `httpClient.DefaultRequestHeaders.Add("X-Api-Key", Environment.GetEnvironmentVariable("ECUNEXO_API_KEY"));\n`
    return {
      endpoint: `${target.method} ${target.path}`,
      requiredScope: target.scope,
      code: `using var httpClient = new HttpClient { BaseAddress = new Uri("${baseUrl}") };
${headerLine}using var response = await httpClient.GetAsync("${target.path}");
response.EnsureSuccessStatusCode();

var json = await response.Content.ReadAsStringAsync();
Console.WriteLine(json);`,
    }
  }

  // python
  const pyHeaders = isPublic
    ? `{"Accept": "application/json"}`
    : `{\n    "X-Api-Key": os.environ["ECUNEXO_API_KEY"],\n    "Accept": "application/json",\n}`
  return {
    endpoint: `${target.method} ${target.path}`,
    requiredScope: target.scope,
    code: `import os
import requests

response = requests.get(
    "${fullUrl}",
    headers=${pyHeaders},
    timeout=10,
)
response.raise_for_status()
print(response.json())`,
  }
}

export function PublicDevelopersPortalPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const sessionTenantId = useAppSelector(selectTenantId)

  const [activeTab, setActiveTab] = useState<PortalTab>('quickstart')
  const [selectedLang, setSelectedLang] = useState<CodeLang>('curl')
  const [selectedUseCase, setSelectedUseCase] = useState<UseCaseId>('catalog')

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://api.ecunexo.com'
  const effectiveTenantId = sessionTenantId ?? '01a082f0-b204-7aae-b7d5-ede5dd9a477a'

  const snippet = useMemo(
    () => buildCodeSnippet(selectedLang, selectedUseCase, baseUrl, effectiveTenantId),
    [baseUrl, effectiveTenantId, selectedLang, selectedUseCase]
  )

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
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
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--glb-background, #f8fafc)',
        color: 'var(--glb-text, #0f172a)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header Público */}
      <header
        style={{
          borderBottom: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
          backgroundColor: 'var(--glb-surface, #ffffff)',
          padding: '0.85rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(sessionTenantId ? '/organizacion/api' : '/')}
          >
            <ArrowLeft size={14} /> {sessionTenantId ? 'Volver a mis API Keys' : 'Ir al Panel Admin'}
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/favicon.svg" alt="EcuNexo" width={24} height={24} />
            <strong style={{ fontSize: '0.98rem' }}>EcuNexo Developers</strong>
            <StatusBadge tone="primary">OpenAPI v1</StatusBadge>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a
            href="/scalar/external-v1"
            target="_blank"
            rel="noopener noreferrer"
            className="sf-button sf-button--outline sf-button--sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ExternalLink size={14} /> Playground Scalar
          </a>
          <a
            href="/openapi/external-v1.json"
            target="_blank"
            rel="noopener noreferrer"
            className="sf-button sf-button--outline sf-button--sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={14} /> OpenAPI JSON
          </a>
          <ThemeToggleButton variant="icon" />
        </div>
      </header>

      {/* Contenedor Principal */}
      <main
        style={{
          maxWidth: '1160px',
          width: '100%',
          margin: '1.75rem auto',
          padding: '0 1.25rem 3rem',
          flex: 1,
          display: 'grid',
          gap: '1.5rem',
        }}
      >
        {/* Hero */}
        <section
          style={{
            backgroundColor: 'var(--glb-surface, #ffffff)',
            borderRadius: '0.85rem',
            border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
            padding: '1.75rem 2rem',
            display: 'grid',
            gap: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ maxWidth: '720px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <StatusBadge tone="success" withDot>
                  API v1 Estable
                </StatusBadge>
                <span style={{ fontSize: '0.82rem', color: 'var(--glb-muted, #64748b)' }}>
                  Arquitectura Multi-Tenant · Machine-to-Machine (M2M)
                </span>
              </div>
              <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.65rem', fontWeight: 700 }}>
                Construye la infraestructura de tu empresa sobre EcuNexo
              </h1>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--glb-muted, #64748b)', lineHeight: 1.55 }}>
                Conecta tu propio e-commerce headless, ERP, aplicación móvil o sistema de BI
                consumiendo directamente el catálogo, precios, inventario, bodegas, clientes y
                pedidos de tu organización con aislamiento criptográfico por <code>TenantId</code> y{' '}
                <code>X-Api-Key</code>.
              </p>
            </div>

            {sessionTenantId ? (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.6rem',
                  border: '1px solid var(--shell-border, rgba(0,0,0,0.12))',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ color: 'var(--glb-muted, #64748b)', marginBottom: '0.2rem' }}>
                  Tu <code>tenantId</code> activo en sesión:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <code className="ecu-code">{sessionTenantId}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void copyText(sessionTenantId, 'Tenant ID')}
                  >
                    <Copy size={13} />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Barra de Navegación del Portal */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              borderTop: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
              paddingTop: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant={activeTab === 'quickstart' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('quickstart')}
            >
              <Terminal size={14} /> 1. Inicio Rápido y Ejemplos
            </Button>
            <Button
              variant={activeTab === 'scopes' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('scopes')}
            >
              <KeyRound size={14} /> 2. Scopes y Módulos ({SCOPES_DOCS.length})
            </Button>
            <Button
              variant={activeTab === 'recipes' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('recipes')}
            >
              <Layers size={14} /> 3. Arquitecturas y Recetas
            </Button>
            <Button
              variant={activeTab === 'errors' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('errors')}
            >
              <ShieldAlert size={14} /> 4. Códigos de Error
            </Button>
            <Button
              variant={activeTab === 'reference' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('reference')}
            >
              <BookOpen size={14} /> 5. Referencia OpenAPI Interactiva
            </Button>
          </div>
        </section>

        {/* TAB 1: INICIO RÁPIDO */}
        {activeTab === 'quickstart' ? (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* 3 Pasos */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--glb-surface, #ffffff)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <CheckCircle2 size={18} />
                  <strong>Paso 1: Genera tu API Key</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--glb-muted, #64748b)', lineHeight: 1.5 }}>
                  Ingresa a <strong>Configuración → API y Desarrolladores</strong> (
                  <code>/organizacion/api</code>) y crea una credencial con los <em>scopes</em> que
                  necesita tu sistema. Copia la llave <code>ecx_live_...</code> (solo se muestra al
                  crearla).
                </p>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--glb-surface, #ffffff)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <CheckCircle2 size={18} />
                  <strong>Paso 2: Envía el Header X-Api-Key</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--glb-muted, #64748b)', lineHeight: 1.5 }}>
                  Incluye la cabecera <code>X-Api-Key: ecx_live_...</code> en tus peticiones HTTPS
                  hacia <code>/api/v1/tenants/&#123;tenantId&#125;/...</code>. Nunca expongas una API Key
                  privada en código navegador público; úsala desde tu backend.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--glb-surface, #ffffff)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <CheckCircle2 size={18} />
                  <strong>Paso 3: Triple Validación Automática</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--glb-muted, #64748b)', lineHeight: 1.5 }}>
                  En cada request, EcuNexo verifica en tiempo constante el hash SHA-256, comprueba
                  que el <code>tenantId</code> coincida con la llave, valida que el módulo esté en tu
                  licencia y confirma el <em>scope</em> requerido.
                </p>
              </div>
            </div>

            {/* Explorador de Ejemplos de Código */}
            <section
              style={{
                backgroundColor: 'var(--glb-surface, #ffffff)',
                borderRadius: '0.85rem',
                border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                padding: '1.5rem',
                display: 'grid',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                    Ejemplos de Integración por Lenguaje y Módulo
                  </h2>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--glb-muted, #64748b)' }}>
                    Selecciona el módulo que deseas consumir y el lenguaje de tu infraestructura:
                  </p>
                </div>

                {/* Selector de Lenguaje */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {(
                    [
                      ['curl', 'cURL'],
                      ['typescript', 'TypeScript / Node'],
                      ['csharp', 'C# / .NET'],
                      ['python', 'Python'],
                    ] as const
                  ).map(([id, label]) => (
                    <Button
                      key={id}
                      variant={selectedLang === id ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedLang(id)}
                    >
                      <Code2 size={13} /> {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Selector de Caso de Uso */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {(
                  [
                    ['catalog', 'Catálogo e Ítems'],
                    ['inventory', 'Stock de Inventario'],
                    ['customers', 'Clientes por RUC/Cédula'],
                    ['orders', 'Pedidos E-commerce'],
                    ['storefront', 'Vitrina Pública (Anónima)'],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    variant={selectedUseCase === id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedUseCase(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--glb-background, #f8fafc)',
                  fontSize: '0.83rem',
                }}
              >
                <div>
                  <strong>Endpoint:</strong> <code className="ecu-code">{snippet.endpoint}</code>
                </div>
                <div>
                  <strong>Scope requerido:</strong>{' '}
                  <code className="ecu-code">{snippet.requiredScope}</code>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(snippet.code, 'Snippet de código')}
                >
                  <Copy size={13} /> Copiar código
                </Button>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: '1rem 1.25rem',
                  borderRadius: '0.6rem',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  overflowX: 'auto',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                }}
              >
                <code>{snippet.code}</code>
              </pre>
            </section>
          </div>
        ) : null}

        {/* TAB 2: SCOPES Y MÓDULOS */}
        {activeTab === 'scopes' ? (
          <section
            style={{
              backgroundColor: 'var(--glb-surface, #ffffff)',
              borderRadius: '0.85rem',
              border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                Catálogo de Scopes Permitidos para Integraciones Externas
              </h2>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--glb-muted, #64748b)' }}>
                Por seguridad, las API Keys externas siguen el principio de mínimo privilegio: solo
                pueden recibir permisos operativos de negocio y nunca permisos internos de
                administración de usuarios, roles o licencias.
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '2px solid var(--shell-border, rgba(0,0,0,0.1))',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '0.65rem' }}>Scope (Permiso)</th>
                    <th style={{ padding: '0.65rem' }}>Módulo de Licencia</th>
                    <th style={{ padding: '0.65rem' }}>Tipo</th>
                    <th style={{ padding: '0.65rem' }}>Operaciones que habilita</th>
                  </tr>
                </thead>
                <tbody>
                  {SCOPES_DOCS.map((row) => (
                    <tr
                      key={row.code}
                      style={{
                        borderBottom: '1px solid var(--shell-border, rgba(0,0,0,0.06))',
                      }}
                    >
                      <td style={{ padding: '0.65rem' }}>
                        <code className="ecu-code">{row.code}</code>
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        <strong>{row.moduleLabel}</strong>{' '}
                        <span style={{ opacity: 0.65 }}>({row.moduleCode})</span>
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        <StatusBadge tone={row.access === 'Lectura' ? 'info' : 'warning'}>
                          {row.access}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: '0.65rem', color: 'var(--glb-muted, #64748b)' }}>
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* TAB 3: RECETAS DE ARQUITECTURA */}
        {activeTab === 'recipes' ? (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <section
              style={{
                backgroundColor: 'var(--glb-surface, #ffffff)',
                borderRadius: '0.85rem',
                border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                padding: '1.5rem',
                display: 'grid',
                gap: '0.75rem',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                Receta 1: Tienda E-commerce Propia (Headless Storefront)
              </h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--glb-muted, #64748b)', lineHeight: 1.55 }}>
                Si tu empresa desea construir su propio sitio web en Next.js, Astro, Remix o una App
                Móvil en Flutter/React Native:
              </p>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.86rem', lineHeight: 1.7 }}>
                <li>
                  <strong>Catálogo Público y Facetas:</strong> Consume directamente desde el cliente{' '}
                  <code>GET /api/v1/public/tenants/&#123;tenantId&#125;/storefront/products</code> y{' '}
                  <code>/facets</code> (no requiere API Key y cuenta con Rate Limiting público).
                </li>
                <li>
                  <strong>Opciones de Checkout y Envío:</strong> Consulta{' '}
                  <code>GET /api/v1/public/tenants/&#123;tenantId&#125;/storefront/checkout-options</code>{' '}
                  para obtener métodos de envío, tarifas y cuentas bancarias configuradas.
                </li>
                <li>
                  <strong>Creación y Gestión de Pedidos desde tu Backend:</strong> Usa una API Key en
                  tu servidor con los scopes <code>ecommerce.orders.create</code>,{' '}
                  <code>ecommerce.orders.read</code> y <code>ecommerce.orders.manage</code> para
                  registrar órdenes confirmadas por tu pasarela de pagos y actualizar su estado.
                </li>
              </ol>
            </section>

            <section
              style={{
                backgroundColor: 'var(--glb-surface, #ffffff)',
                borderRadius: '0.85rem',
                border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                padding: '1.5rem',
                display: 'grid',
                gap: '0.75rem',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                Receta 2: Integración con ERP, POS o Sistema Externo
              </h2>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--glb-muted, #64748b)', lineHeight: 1.55 }}>
                Para mantener sincronizado el maestro de productos, precios, clientes y existencias
                entre el sistema interno de tu empresa y EcuNexo:
              </p>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.86rem', lineHeight: 1.7 }}>
                <li>
                  <strong>Sincronización de Catálogo y Precios:</strong> Otorga{' '}
                  <code>catalog.item.read</code>, <code>catalog.item.create</code>,{' '}
                  <code>catalog.item.update</code> y <code>catalog.pricing.update</code>. Usa{' '}
                  <code>POST /api/v1/tenants/&#123;tenantId&#125;/catalog/pricing/prices/bulk</code> para
                  actualizar listas de precios en bloque.
                </li>
                <li>
                  <strong>Consulta de Stock y Ajustes:</strong> Otorga{' '}
                  <code>warehousing.read</code>, <code>inventory.stock.read</code> e{' '}
                  <code>inventory.documents.create</code> para consultar existencias por bodega y
                  registrar ingresos/egresos de mercadería.
                </li>
                <li>
                  <strong>Directorio de Clientes:</strong> Otorga <code>customers.read</code> y{' '}
                  <code>customers.manage</code>. Antes de crear un cliente, verifica si ya existe
                  mediante <code>GET /api/v1/tenants/&#123;tenantId&#125;/customers/by-tax-id/&#123;ruc&#125;</code>.
                </li>
              </ol>
            </section>
          </div>
        ) : null}

        {/* TAB 4: CÓDIGOS DE ERROR */}
        {activeTab === 'errors' ? (
          <section
            style={{
              backgroundColor: 'var(--glb-surface, #ffffff)',
              borderRadius: '0.85rem',
              border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                Manejo de Errores y Códigos de Diagnóstico
              </h2>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.86rem', color: 'var(--glb-muted, #64748b)' }}>
                Todos los endpoints devuelven respuestas de error estructuradas (RFC 9457{' '}
                <code>ProblemDetails</code>) con un código de dominio estable para que tu
                infraestructura pueda reaccionar programáticamente:
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '2px solid var(--shell-border, rgba(0,0,0,0.1))',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '0.65rem' }}>Estado HTTP</th>
                    <th style={{ padding: '0.65rem' }}>Código de Error</th>
                    <th style={{ padding: '0.65rem' }}>Causa</th>
                    <th style={{ padding: '0.65rem' }}>Cómo resolverlo</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_CODES_DOCS.map((err) => (
                    <tr
                      key={err.code}
                      style={{
                        borderBottom: '1px solid var(--shell-border, rgba(0,0,0,0.06))',
                      }}
                    >
                      <td style={{ padding: '0.65rem', fontWeight: 600 }}>{err.http}</td>
                      <td style={{ padding: '0.65rem' }}>
                        <code className="ecu-code">{err.code}</code>
                      </td>
                      <td style={{ padding: '0.65rem' }}>{err.cause}</td>
                      <td style={{ padding: '0.65rem', color: 'var(--glb-muted, #64748b)' }}>
                        {err.solution}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* TAB 5: REFERENCIA INTERACTIVA SCALAR */}
        {activeTab === 'reference' ? (
          <section
            style={{
              backgroundColor: 'var(--glb-surface, #ffffff)',
              borderRadius: '0.85rem',
              border: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
              overflow: 'hidden',
              display: 'grid',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--shell-border, rgba(0,0,0,0.08))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <strong>Explorador Interactivo OpenAPI v1 (Scalar)</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--glb-muted, #64748b)' }}>
                  Prueba endpoints en vivo ingresando tu <code>X-Api-Key</code> en la sección
                  Authentication.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href="/scalar/external-v1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sf-button sf-button--outline sf-button--sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <ExternalLink size={14} /> Abrir en pantalla completa
                </a>
              </div>
            </div>
            <iframe
              src="/scalar/external-v1"
              title="EcuNexo Developer API Reference (Scalar)"
              style={{
                width: '100%',
                height: '78vh',
                border: 'none',
                backgroundColor: '#ffffff',
              }}
            />
          </section>
        ) : null}
      </main>
    </div>
  )
}

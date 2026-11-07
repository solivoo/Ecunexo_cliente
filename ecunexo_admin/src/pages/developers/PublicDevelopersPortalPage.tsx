import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, TextBox, useToast } from 'glubox'
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Code2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Globe,
  KeyRound,
  Layers,
  Play,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui'
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton'
import { readApiError } from '@/lib/readApiError'
import { selectTenantId } from '@/store/authSlice'
import { useAppSelector } from '@/store/hooks'
import './publicDevelopersPortal.css'

type PortalTab =
  | 'quickstart'
  | 'endpoints'
  | 'scopes'
  | 'recipes'
  | 'sandbox'
  | 'errors'
  | 'reference'

type CodeLang = 'curl' | 'typescript' | 'csharp' | 'python'

interface ScopeDocRow {
  readonly code: string
  readonly moduleLabel: string
  readonly moduleCode: string
  readonly access: 'Lectura' | 'Escritura'
  readonly description: string
}

interface EndpointSpec {
  readonly id: string
  readonly domain: string
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  readonly path: string
  readonly scope: string
  readonly summary: string
  readonly sampleQueryOrBody?: string
  readonly sampleResponse: string
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

const ENDPOINT_CATALOG: readonly EndpointSpec[] = [
  {
    id: 'catalog-list',
    domain: 'Catálogo y Precios',
    method: 'GET',
    path: '/api/v1/tenants/{tenantId}/catalog/items?pageNumber=1&pageSize=25',
    scope: 'catalog.item.read',
    summary: 'Lista paginada de productos, servicios y matrices con SKU, código de barras y estado.',
    sampleResponse: JSON.stringify(
      {
        items: [
          {
            id: '0195f3a0-8b12-7c90-a111-445566778899',
            sku: 'CAM-OXF-AZ-M',
            name: 'Camisa Oxford Azul Talla M',
            itemType: 'Product',
            basePrice: 34.99,
            taxRatePercent: 15.0,
            isActive: true,
          },
        ],
        pageNumber: 1,
        pageSize: 25,
        totalCount: 142,
      },
      null,
      2
    ),
  },
  {
    id: 'catalog-create',
    domain: 'Catálogo y Precios',
    method: 'POST',
    path: '/api/v1/tenants/{tenantId}/catalog/items',
    scope: 'catalog.item.create',
    summary: 'Registra un nuevo producto o servicio en el catálogo maestro de la organización.',
    sampleQueryOrBody: JSON.stringify(
      {
        sku: 'ZAP-RUN-PRO-42',
        name: 'Zapatilla Running Pro 42',
        description: 'Calzado deportivo con suela de carbono',
        basePrice: 89.5,
        trackInventory: true,
      },
      null,
      2
    ),
    sampleResponse: JSON.stringify(
      {
        id: '0195f3a9-1122-7d00-b222-998877665544',
        sku: 'ZAP-RUN-PRO-42',
        name: 'Zapatilla Running Pro 42',
        createdAt: '2026-11-07T15:30:00Z',
      },
      null,
      2
    ),
  },
  {
    id: 'pricing-bulk',
    domain: 'Catálogo y Precios',
    method: 'POST',
    path: '/api/v1/tenants/{tenantId}/catalog/pricing/prices/bulk',
    scope: 'catalog.pricing.create',
    summary: 'Sincronización masiva de precios por lista de precios (ideal para ERPs).',
    sampleQueryOrBody: JSON.stringify(
      {
        priceListId: '0195f100-0000-7000-8000-000000000001',
        items: [
          { catalogItemId: '0195f3a0-8b12-7c90-a111-445566778899', unitPrice: 32.5, minQuantity: 1 },
        ],
      },
      null,
      2
    ),
    sampleResponse: JSON.stringify({ updatedCount: 1, status: 'synchronized' }, null, 2),
  },
  {
    id: 'inventory-stock',
    domain: 'Inventario y Bodegas',
    method: 'GET',
    path: '/api/v1/tenants/{tenantId}/inventory/stock?pageNumber=1&pageSize=50',
    scope: 'inventory.stock.read',
    summary: 'Consulta saldos disponibles, comprometidos y en tránsito por bodega e ítem.',
    sampleResponse: JSON.stringify(
      {
        items: [
          {
            warehouseId: '0195e001-1234-7000-9000-abcdef123456',
            warehouseName: 'Bodega Matriz Quito',
            catalogItemId: '0195f3a0-8b12-7c90-a111-445566778899',
            sku: 'CAM-OXF-AZ-M',
            onHandQuantity: 120,
            reservedQuantity: 8,
            availableQuantity: 112,
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'warehouses-list',
    domain: 'Inventario y Bodegas',
    method: 'GET',
    path: '/api/v1/tenants/{tenantId}/warehouses',
    scope: 'warehousing.read',
    summary: 'Obtiene todas las bodegas y centros de distribución activos de la empresa.',
    sampleResponse: JSON.stringify(
      [
        {
          id: '0195e001-1234-7000-9000-abcdef123456',
          code: 'BOD-UIO-01',
          name: 'Bodega Matriz Quito',
          isMain: true,
          isActive: true,
        },
      ],
      null,
      2
    ),
  },
  {
    id: 'customers-by-taxid',
    domain: 'Clientes',
    method: 'GET',
    path: '/api/v1/tenants/{tenantId}/customers/by-tax-id/1790012345001',
    scope: 'customers.read',
    summary: 'Búsqueda instantánea de cliente por RUC, Cédula o Pasaporte para checkout o POS.',
    sampleResponse: JSON.stringify(
      {
        id: '0195c900-4321-7000-8000-112233445566',
        taxId: '1790012345001',
        taxIdType: 'RUC',
        legalName: 'CORPORACIÓN COMERCIAL ANDINA S.A.',
        email: 'facturacion@andina.ec',
        phone: '+593991234567',
      },
      null,
      2
    ),
  },
  {
    id: 'orders-create',
    domain: 'Pedidos E-commerce',
    method: 'POST',
    path: '/api/v1/tenants/{tenantId}/ecommerce/orders',
    scope: 'ecommerce.orders.create',
    summary: 'Crea una orden de venta desde una tienda externa o app móvil reservando stock.',
    sampleQueryOrBody: JSON.stringify(
      {
        customerTaxId: '1790012345001',
        customerName: 'CORPORACIÓN COMERCIAL ANDINA S.A.',
        customerEmail: 'compras@andina.ec',
        paymentMethod: 'BankTransfer',
        lines: [
          {
            catalogItemId: '0195f3a0-8b12-7c90-a111-445566778899',
            quantity: 2,
            unitPrice: 34.99,
          },
        ],
      },
      null,
      2
    ),
    sampleResponse: JSON.stringify(
      {
        orderId: '0195f888-9999-7a00-8000-fedcba987654',
        orderNumber: 'ORD-2026-00412',
        status: 'PendingPayment',
        totalAmount: 80.48,
      },
      null,
      2
    ),
  },
  {
    id: 'storefront-public',
    domain: 'Vitrina Pública (Anónima)',
    method: 'GET',
    path: '/api/v1/public/tenants/{tenantId}/storefront/products?pageNumber=1&pageSize=12',
    scope: 'Público (Rate Limited)',
    summary: 'Catálogo público optimizado para clientes finales (navegadores/apps sin API Key).',
    sampleResponse: JSON.stringify(
      {
        items: [
          {
            id: '0195f3a0-8b12-7c90-a111-445566778899',
            slug: 'camisa-oxford-azul',
            name: 'Camisa Oxford Azul',
            priceWithTax: 40.24,
            inStock: true,
          },
        ],
      },
      null,
      2
    ),
  },
]

const ERROR_CODES_DOCS = [
  {
    http: '401 Unauthorized',
    code: 'auth.unauthorized',
    cause:
      'No se envió la cabecera X-Api-Key, el formato es inválido o la credencial fue revocada/expiró.',
    solution:
      'Verifica que envías el header X-Api-Key: ecx_live_<prefijo>_<secreto> con una llave activa.',
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
    cause:
      'La API Key es válida pero no tiene asignado el permiso (scope) requerido por este endpoint.',
    solution:
      'Genera una nueva API Key en Configuración → API y Desarrolladores incluyendo el scope necesario.',
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
    solution:
      'Implementa reintentos con exponential backoff y cachea catálogos o listas de precios.',
  },
]

function buildSdkCode(
  lang: CodeLang,
  spec: EndpointSpec,
  baseUrl: string,
  tenantId: string
): string {
  const resolvedPath = spec.path.replace('{tenantId}', tenantId)
  const fullUrl = `${baseUrl}${resolvedPath}`
  const isPublic = spec.path.includes('/public/')
  const hasBody = Boolean(spec.sampleQueryOrBody && (spec.method === 'POST' || spec.method === 'PUT'))

  if (lang === 'curl') {
    const authHeader = isPublic
      ? ''
      : ` \\\n  -H "X-Api-Key: ecx_live_a1b2c3d4_tu_secreto_aqui"`
    const bodyPart = hasBody
      ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${spec.sampleQueryOrBody}'`
      : ''
    return `curl -X ${spec.method} "${fullUrl}"${authHeader} \\\n  -H "Accept: application/json"${bodyPart}`
  }

  if (lang === 'typescript') {
    return `// Cliente TypeScript / Node.js 20+ con manejo RFC 9457 ProblemDetails
const ECUNEXO_BASE_URL = process.env.ECUNEXO_API_BASE_URL ?? '${baseUrl}';
const ECUNEXO_TENANT_ID = process.env.ECUNEXO_TENANT_ID ?? '${tenantId}';
const ECUNEXO_API_KEY = process.env.ECUNEXO_API_KEY ?? 'ecx_live_a1b2c3d4_tu_secreto_aqui';

export async function callEcuNexoApi() {
  const response = await fetch(\`\${ECUNEXO_BASE_URL}${spec.path.replace('{tenantId}', '${ECUNEXO_TENANT_ID}')}\`, {
    method: '${spec.method}',
    headers: {
      'Accept': 'application/json',${hasBody ? "\n      'Content-Type': 'application/json'," : ''}${
        isPublic ? '' : "\n      'X-Api-Key': ECUNEXO_API_KEY,"
      }
    },${hasBody ? `\n    body: JSON.stringify(${spec.sampleQueryOrBody}),` : ''}
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(\`EcuNexo API Error [\${response.status}]: \${problem.title ?? response.statusText}\`);
  }

  return await response.json();
}`
  }

  if (lang === 'csharp') {
    return `// Cliente C# / .NET 10 (IHttpClientFactory / Resiliencia empresarial)
using System.Net.Http.Headers;
using System.Text;

using var http = new HttpClient { BaseAddress = new Uri("${baseUrl}") };
http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));${
      isPublic
        ? ''
        : '\nhttp.DefaultRequestHeaders.Add("X-Api-Key", Environment.GetEnvironmentVariable("ECUNEXO_API_KEY"));'
    }

${
  hasBody
    ? `var jsonBody = """\n${spec.sampleQueryOrBody}\n""";\nusing var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");\nusing var response = await http.${
        spec.method === 'POST' ? 'PostAsync' : 'PutAsync'
      }("${resolvedPath}", content);`
    : `using var response = await http.GetAsync("${resolvedPath}");`
}
response.EnsureSuccessStatusCode();

var payload = await response.Content.ReadAsStringAsync();
Console.WriteLine(payload);`
  }

  return `# Cliente Python 3.11+ (httpx / Sincronización ERP & BI)
import os
import requests

BASE_URL = os.getenv("ECUNEXO_API_BASE_URL", "${baseUrl}")
API_KEY = os.getenv("ECUNEXO_API_KEY", "ecx_live_a1b2c3d4_tu_secreto_aqui")

headers = {
    "Accept": "application/json",${isPublic ? '' : '\n    "X-Api-Key": API_KEY,'}
}

response = requests.request(
    "${spec.method}",
    f"{BASE_URL}${resolvedPath}",
    headers=headers,${hasBody ? `\n    json=${spec.sampleQueryOrBody},` : ''}
    timeout=15,
)
response.raise_for_status()
print(response.json())`
}

export function PublicDevelopersPortalPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const sessionTenantId = useAppSelector(selectTenantId)

  const [activeTab, setActiveTab] = useState<PortalTab>('quickstart')
  const [selectedLang, setSelectedLang] = useState<CodeLang>('typescript')
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>(ENDPOINT_CATALOG[0].id)
  const [scopeQuery, setScopeQuery] = useState('')

  // Sandbox interactivo en el portal
  const [sandboxTenantId, setSandboxTenantId] = useState(
    sessionTenantId ?? '01a082f0-b204-7aae-b7d5-ede5dd9a477a'
  )
  const [sandboxApiKey, setSandboxApiKey] = useState('')
  const [sandboxEndpointId, setSandboxEndpointId] = useState<string>(ENDPOINT_CATALOG[0].id)
  const [sandboxRunning, setSandboxRunning] = useState(false)
  const [sandboxResponse, setSandboxResponse] = useState<{
    status: number
    statusText: string
    elapsedMs: number
    ok: boolean
    body: string
  } | null>(null)

  const baseUrl = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : 'https://api.ecunexo.com'),
    []
  )

  const effectiveTenantId = sessionTenantId ?? '01a082f0-b204-7aae-b7d5-ede5dd9a477a'

  const selectedEndpoint = useMemo(
    () => ENDPOINT_CATALOG.find((e) => e.id === selectedEndpointId) ?? ENDPOINT_CATALOG[0],
    [selectedEndpointId]
  )

  const sdkSnippet = useMemo(
    () => buildSdkCode(selectedLang, selectedEndpoint, baseUrl, effectiveTenantId),
    [baseUrl, effectiveTenantId, selectedEndpoint, selectedLang]
  )

  const filteredScopes = useMemo(() => {
    const q = scopeQuery.trim().toLowerCase()
    if (!q) return SCOPES_DOCS
    return SCOPES_DOCS.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.moduleLabel.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    )
  }, [scopeQuery])

  const copyText = useCallback(
    async (text: string, label: string) => {
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
    },
    [toast]
  )

  const handleRunSandbox = useCallback(async () => {
    const spec = ENDPOINT_CATALOG.find((e) => e.id === sandboxEndpointId) ?? ENDPOINT_CATALOG[0]
    const isPublic = spec.path.includes('/public/')
    const tid = sandboxTenantId.trim()
    if (!tid) {
      toast.show({
        title: 'Tenant ID requerido',
        message: 'Ingresa el UUID del Tenant para construir la ruta.',
        variant: 'warning',
      })
      return
    }
    if (!isPublic && !sandboxApiKey.trim()) {
      toast.show({
        title: 'X-Api-Key requerida',
        message: 'Este endpoint requiere una API Key activa (ecx_live_...).',
        variant: 'warning',
      })
      return
    }

    const path = spec.path.replace('{tenantId}', tid)
    setSandboxRunning(true)
    const start = performance.now()
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (!isPublic && sandboxApiKey.trim()) {
        headers['X-Api-Key'] = sandboxApiKey.trim()
      }

      const response = await fetch(path, {
        method: 'GET',
        headers,
      })
      const elapsedMs = Math.round(performance.now() - start)
      const raw = await response.text()
      let formatted = raw
      try {
        formatted = JSON.stringify(JSON.parse(raw), null, 2)
      } catch {
        // leave raw
      }
      setSandboxResponse({
        status: response.status,
        statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
        elapsedMs,
        ok: response.ok,
        body: formatted || '(Sin contenido)',
      })
    } catch (err: unknown) {
      const elapsedMs = Math.round(performance.now() - start)
      setSandboxResponse({
        status: 0,
        statusText: 'Network Error',
        elapsedMs,
        ok: false,
        body: readApiError(err, 'No se pudo conectar con el servidor API.'),
      })
    } finally {
      setSandboxRunning(false)
    }
  }, [sandboxApiKey, sandboxEndpointId, sandboxTenantId, toast])

  return (
    <div className="ecu-dev-portal">
      {/* Header Público Sticky */}
      <header className="ecu-dev-portal__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(sessionTenantId ? '/organizacion/api' : '/')}
          >
            <ArrowLeft size={14} />{' '}
            {sessionTenantId ? 'Volver a mis API Keys' : 'Ir al Panel Admin'}
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/favicon.svg" alt="EcuNexo" width={24} height={24} />
            <strong style={{ fontSize: '1rem' }}>EcuNexo Developers</strong>
            <StatusBadge tone="primary" withDot>
              OpenAPI v1
            </StatusBadge>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button
            variant={activeTab === 'sandbox' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('sandbox')}
          >
            <Play size={13} /> Consola API en Vivo
          </Button>
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

      {/* Workspace de 2 columnas (Sidebar + Contenido Principal) */}
      <div className="ecu-dev-portal__workspace">
        {/* Sidebar de Navegación Técnica */}
        <aside className="ecu-dev-portal__sidebar" aria-label="Navegación de documentación">
          <div>
            <div className="ecu-dev-portal__nav-group-title">Fundamentos M2M</div>
            <button
              type="button"
              className={`ecu-dev-portal__nav-btn ${
                activeTab === 'quickstart' ? 'ecu-dev-portal__nav-btn--active' : ''
              }`}
              onClick={() => setActiveTab('quickstart')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Terminal size={15} /> 1. Inicio Rápido y SDKs
              </span>
            </button>
            <button
              type="button"
              className={`ecu-dev-portal__nav-btn ${
                activeTab === 'scopes' ? 'ecu-dev-portal__nav-btn--active' : ''
              }`}
              onClick={() => setActiveTab('scopes')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <KeyRound size={15} /> 2. Scopes y Módulos ({SCOPES_DOCS.length})
              </span>
            </button>
          </div>

          <div>
            <div className="ecu-dev-portal__nav-group-title">Contratos & Arquitectura</div>
            <button
              type="button"
              className={`ecu-dev-portal__nav-btn ${
                activeTab === 'endpoints' ? 'ecu-dev-portal__nav-btn--active' : ''
              }`}
              onClick={() => setActiveTab('endpoints')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Cpu size={15} /> Catálogo de Endpoints
              </span>
              <StatusBadge tone="info">v1</StatusBadge>
            </button>
            <button
              type="button"
              className={`ecu-dev-portal__nav-btn ${
                activeTab === 'recipes' ? 'ecu-dev-portal__nav-btn--active' : ''
              }`}
              onClick={() => setActiveTab('recipes')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Layers size={15} /> 3. Arquitecturas y Recetas
              </span>
            </button>
            <button
              type="button"
              className={`ecu-dev-portal__nav-btn ${
                activeTab === 'errors' ? 'ecu-dev-portal__nav-btn--active' : ''
              }`}
              onClick={() => setActiveTab('errors')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <ShieldAlert size={15} /> 4. Códigos de Error
              </span>
            </button>
          </div>

          <div>
            <div className="ecu-dev-portal__nav-group-title">Herramientas en Vivo</div>
            <button
              type="button"
              className={`ecu-dev-portal__nav-btn ${
                activeTab === 'sandbox' ? 'ecu-dev-portal__nav-btn--active' : ''
              }`}
              onClick={() => setActiveTab('sandbox')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Activity size={15} /> Simulador HTTP en Vivo
              </span>
              <StatusBadge tone="success">Live</StatusBadge>
            </button>
            <button
              type="button"
              className={`ecu-dev-portal__nav-btn ${
                activeTab === 'reference' ? 'ecu-dev-portal__nav-btn--active' : ''
              }`}
              onClick={() => setActiveTab('reference')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <BookOpen size={15} /> 5. Referencia OpenAPI Interactiva
              </span>
            </button>
          </div>

          <div
            className="ecu-dev-portal__subtle-box"
            style={{ padding: '0.75rem', fontSize: '0.76rem', lineHeight: 1.45 }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
              Especificación Spec-Driven
            </div>
            <div className="ecu-dev-portal__muted">
              Contrato OpenAPI 3.1 autogenerado desde los endpoints autorizados de{' '}
              <code>EcuNexo.Api</code>.
            </div>
          </div>
        </aside>

        {/* Contenedor Principal */}
        <main className="ecu-dev-portal__main">
          {/* Hero Empresarial */}
          <section className="ecu-dev-portal__section ecu-dev-portal__section--hero">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ maxWidth: '760px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.45rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <StatusBadge tone="success" withDot>
                    API v1 Estable
                  </StatusBadge>
                  <span className="ecu-dev-portal__muted" style={{ fontSize: '0.82rem' }}>
                    Arquitectura Multi-Tenant · Machine-to-Machine (M2M) · SHA-256 Auth
                  </span>
                </div>
                <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.65rem', fontWeight: 700 }}>
                  Construye la infraestructura de tu empresa sobre EcuNexo
                </h1>
                <p
                  className="ecu-dev-portal__muted"
                  style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.55 }}
                >
                  Conecta tu propio e-commerce headless, ERP corporativo, POS, aplicación móvil o
                  pipeline de BI consumiendo directamente el catálogo, listas de precios, stock
                  multi-bodega, clientes y pedidos de tu organización.
                </p>
              </div>

              {sessionTenantId ? (
                <div
                  className="ecu-dev-portal__subtle-box"
                  style={{ padding: '0.75rem 1rem', fontSize: '0.82rem' }}
                >
                  <div className="ecu-dev-portal__muted" style={{ marginBottom: '0.2rem' }}>
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

            {/* 4 Pilares de Arquitectura (4 columnas friendMobile) */}
            <div className="ecu-dev-portal__grid--4">
              <div className="ecu-dev-portal__card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <KeyRound size={16} />
                  <strong style={{ fontSize: '0.84rem' }}>Autenticación X-Api-Key</strong>
                </div>
                <span className="ecu-dev-portal__muted" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                  Tokens <code>ecx_live_...</code> de 192 bits de entropía verificados con SHA-256 en
                  tiempo constante.
                </span>
              </div>

              <div className="ecu-dev-portal__card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <ShieldCheck size={16} />
                  <strong style={{ fontSize: '0.84rem' }}>Aislamiento por Tenant</strong>
                </div>
                <span className="ecu-dev-portal__muted" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                  Imposibilidad criptográfica de lectura cruzada entre empresas; cada llave está
                  atada a su <code>TenantId</code>.
                </span>
              </div>

              <div className="ecu-dev-portal__card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Layers size={16} />
                  <strong style={{ fontSize: '0.84rem' }}>18 Scopes Granulares</strong>
                </div>
                <span className="ecu-dev-portal__muted" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                  Principio de mínimo privilegio sincronizado en vivo con los módulos de tu licencia
                  comercial.
                </span>
              </div>

              <div className="ecu-dev-portal__card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Globe size={16} />
                  <strong style={{ fontSize: '0.84rem' }}>OpenAPI 3.1 & RFC 9457</strong>
                </div>
                <span className="ecu-dev-portal__muted" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                  Contratos tipados para generación de SDKs y respuestas de error deterministas{' '}
                  <code>ProblemDetails</code>.
                </span>
              </div>
            </div>
          </section>

          {/* TAB 1: INICIO RÁPIDO Y GENERADOR DE SDKs */}
          {activeTab === 'quickstart' ? (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <section className="ecu-dev-portal__section">
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
                      Generador de Cliente SDK y Ejemplos de Integración
                    </h2>
                    <p
                      className="ecu-dev-portal__muted"
                      style={{ margin: '0.2rem 0 0', fontSize: '0.84rem' }}
                    >
                      Selecciona una operación real del catálogo y copia el cliente listo para
                      producción en tu lenguaje:
                    </p>
                  </div>

                  {/* Selector de Lenguaje */}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {(
                      [
                        ['typescript', 'TypeScript / Node'],
                        ['csharp', 'C# / .NET 10'],
                        ['python', 'Python'],
                        ['curl', 'cURL'],
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

                {/* Selector de Endpoint */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {ENDPOINT_CATALOG.map((ep) => (
                    <Button
                      key={ep.id}
                      variant={selectedEndpoint.id === ep.id ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setSelectedEndpointId(ep.id)}
                    >
                      <span
                        className={`ecu-dev-portal__method-badge ecu-dev-portal__method-badge--${ep.method.toLowerCase()}`}
                        style={{ marginRight: '0.35rem' }}
                      >
                        {ep.method}
                      </span>
                      {ep.domain}: {ep.id.split('-')[1]}
                    </Button>
                  ))}
                </div>

                <div
                  className="ecu-dev-portal__subtle-box"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    padding: '0.65rem 0.95rem',
                    fontSize: '0.83rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      className={`ecu-dev-portal__method-badge ecu-dev-portal__method-badge--${selectedEndpoint.method.toLowerCase()}`}
                    >
                      {selectedEndpoint.method}
                    </span>
                    <code className="ecu-code">{selectedEndpoint.path}</code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span>
                      <strong>Scope:</strong>{' '}
                      <code className="ecu-code">{selectedEndpoint.scope}</code>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyText(sdkSnippet, 'Código SDK')}
                    >
                      <Copy size={13} /> Copiar cliente
                    </Button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        marginBottom: '0.35rem',
                        textTransform: 'uppercase',
                      }}
                      className="ecu-dev-portal__muted"
                    >
                      Implementación Cliente ({selectedLang.toUpperCase()})
                    </div>
                    <pre className="ecu-dev-portal__code-pre">
                      <code>{sdkSnippet}</code>
                    </pre>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        marginBottom: '0.35rem',
                        textTransform: 'uppercase',
                      }}
                      className="ecu-dev-portal__muted"
                    >
                      Respuesta JSON Esperada (200 OK)
                    </div>
                    <pre className="ecu-dev-portal__code-pre">
                      <code>{selectedEndpoint.sampleResponse}</code>
                    </pre>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {/* TAB: CATÁLOGO DE ENDPOINTS POR DOMINIO */}
          {activeTab === 'endpoints' ? (
            <section className="ecu-dev-portal__section">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                  Catálogo de Endpoints Empresariales por Dominio
                </h2>
                <p
                  className="ecu-dev-portal__muted"
                  style={{ margin: '0.3rem 0 0', fontSize: '0.86rem' }}
                >
                  Haz clic en cualquier endpoint para inspeccionar su contrato JSON o probarlo en el
                  Simulador HTTP en Vivo:
                </p>
              </div>

              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {ENDPOINT_CATALOG.map((ep) => (
                  <div
                    key={ep.id}
                    className={`ecu-dev-portal__endpoint-row ${
                      selectedEndpointId === ep.id ? 'ecu-dev-portal__endpoint-row--selected' : ''
                    }`}
                    onClick={() => setSelectedEndpointId(ep.id)}
                  >
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                        <span
                          className={`ecu-dev-portal__method-badge ecu-dev-portal__method-badge--${ep.method.toLowerCase()}`}
                        >
                          {ep.method}
                        </span>
                        <code className="ecu-code" style={{ fontWeight: 600 }}>
                          {ep.path}
                        </code>
                        <StatusBadge tone="neutral">{ep.domain}</StatusBadge>
                      </div>
                      <div className="ecu-dev-portal__muted" style={{ fontSize: '0.82rem' }}>
                        {ep.summary}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <code className="ecu-code" style={{ fontSize: '0.76rem' }}>
                        {ep.scope}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSandboxEndpointId(ep.id)
                          setActiveTab('sandbox')
                        }}
                      >
                        <Play size={13} /> Probar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* TAB 2: SCOPES Y MÓDULOS */}
          {activeTab === 'scopes' ? (
            <section className="ecu-dev-portal__section">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                    Catálogo de Scopes Permitidos para Integraciones Externas
                  </h2>
                  <p
                    className="ecu-dev-portal__muted"
                    style={{ margin: '0.35rem 0 0', fontSize: '0.86rem' }}
                  >
                    Las API Keys externas siguen el principio de mínimo privilegio: solo pueden
                    recibir permisos operativos de negocio y nunca permisos internos de
                    administración de plataforma.
                  </p>
                </div>
                <div style={{ width: '260px' }}>
                  <TextBox
                    placeholder="Buscar scope o módulo…"
                    value={scopeQuery}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setScopeQuery(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="ecu-dev-portal__table">
                  <thead>
                    <tr>
                      <th>Scope (Permiso)</th>
                      <th>Módulo de Licencia</th>
                      <th>Tipo</th>
                      <th>Operaciones que habilita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScopes.map((row) => (
                      <tr key={row.code}>
                        <td>
                          <code className="ecu-code">{row.code}</code>
                        </td>
                        <td>
                          <strong>{row.moduleLabel}</strong>{' '}
                          <span style={{ opacity: 0.65 }}>({row.moduleCode})</span>
                        </td>
                        <td>
                          <StatusBadge tone={row.access === 'Lectura' ? 'info' : 'warning'}>
                            {row.access}
                          </StatusBadge>
                        </td>
                        <td className="ecu-dev-portal__muted">{row.description}</td>
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
              <section className="ecu-dev-portal__section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                    Receta 1: Tienda E-commerce Propia (Headless Storefront)
                  </h2>
                  <StatusBadge tone="primary">Next.js / Astro / Mobile</StatusBadge>
                </div>
                <p
                  className="ecu-dev-portal__muted"
                  style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55 }}
                >
                  Arquitectura recomendada cuando tu empresa construye su propio escaparate web o
                  aplicación móvil nativa manteniendo a EcuNexo como motor transaccional:
                </p>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.86rem', lineHeight: 1.7 }}>
                  <li>
                    <strong>Catálogo Público y Facetas:</strong> Consume directamente desde el
                    cliente{' '}
                    <code>GET /api/v1/public/tenants/&#123;tenantId&#125;/storefront/products</code>{' '}
                    y <code>/facets</code> (no requiere API Key y cuenta con Rate Limiting público).
                  </li>
                  <li>
                    <strong>Opciones de Checkout y Envío:</strong> Consulta{' '}
                    <code>
                      GET /api/v1/public/tenants/&#123;tenantId&#125;/storefront/checkout-options
                    </code>{' '}
                    para obtener métodos de envío, tarifas y cuentas bancarias configuradas.
                  </li>
                  <li>
                    <strong>Creación y Gestión de Pedidos desde tu Backend (BFF):</strong> Usa una
                    API Key en tu servidor con los scopes <code>ecommerce.orders.create</code>,{' '}
                    <code>ecommerce.orders.read</code> y <code>ecommerce.orders.manage</code> para
                    registrar órdenes confirmadas por tu pasarela de pagos y actualizar su estado.
                  </li>
                </ol>
              </section>

              <section className="ecu-dev-portal__section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                    Receta 2: Integración con ERP, POS o Sistema Externo
                  </h2>
                  <StatusBadge tone="info">SAP / Odoo / Custom ERP</StatusBadge>
                </div>
                <p
                  className="ecu-dev-portal__muted"
                  style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55 }}
                >
                  Para mantener sincronizado el maestro de productos, precios, clientes y
                  existencias entre el sistema interno de tu empresa y EcuNexo:
                </p>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.86rem', lineHeight: 1.7 }}>
                  <li>
                    <strong>Sincronización de Catálogo y Precios:</strong> Otorga{' '}
                    <code>catalog.item.read</code>, <code>catalog.item.create</code>,{' '}
                    <code>catalog.item.update</code> y <code>catalog.pricing.update</code>. Usa{' '}
                    <code>POST /api/v1/tenants/&#123;tenantId&#125;/catalog/pricing/prices/bulk</code>{' '}
                    para actualizar listas de precios en bloque.
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
                    mediante{' '}
                    <code>
                      GET /api/v1/tenants/&#123;tenantId&#125;/customers/by-tax-id/&#123;ruc&#125;
                    </code>
                    .
                  </li>
                </ol>
              </section>
            </div>
          ) : null}

          {/* TAB: SIMULADOR HTTP EN VIVO (SANDBOX) */}
          {activeTab === 'sandbox' ? (
            <section className="ecu-dev-portal__section">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                  Simulador HTTP M2M en Vivo (Live API Runner)
                </h2>
                <p
                  className="ecu-dev-portal__muted"
                  style={{ margin: '0.3rem 0 0', fontSize: '0.86rem' }}
                >
                  Ejecuta peticiones reales contra el servidor API ingresando tu{' '}
                  <code>Tenant ID</code> y tu llave <code>X-Api-Key</code> para verificar permisos,
                  latencia y estructura JSON:
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '0.85rem',
                  alignItems: 'end',
                }}
              >
                <TextBox
                  label="Tenant ID (UUID de la empresa)"
                  labelPosition="outlined"
                  value={sandboxTenantId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSandboxTenantId(e.target.value)}
                />
                <TextBox
                  label="Cabecera X-Api-Key (Opcional en rutas públicas)"
                  labelPosition="outlined"
                  placeholder="ecx_live_a1b2c3d4_..."
                  value={sandboxApiKey}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSandboxApiKey(e.target.value)}
                />
                <Select
                  label="Endpoint GET a consultar"
                  labelPosition="outlined"
                  options={ENDPOINT_CATALOG.filter((e) => e.method === 'GET').map((e) => ({
                    value: e.id,
                    label: `${e.domain} — ${e.path.split('/tenants/{tenantId}')[1] ?? e.path}`,
                  }))}
                  value={sandboxEndpointId}
                  onChange={(val) => setSandboxEndpointId(String(val ?? ENDPOINT_CATALOG[0].id))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem' }} className="ecu-dev-portal__muted">
                  Ruta efectiva:{' '}
                  <code className="ecu-code">
                    GET{' '}
                    {(
                      ENDPOINT_CATALOG.find((e) => e.id === sandboxEndpointId) ??
                      ENDPOINT_CATALOG[0]
                    ).path.replace('{tenantId}', sandboxTenantId || '{tenantId}')}
                  </code>
                </div>
                <Button
                  variant="primary"
                  disabled={sandboxRunning}
                  onClick={() => void handleRunSandbox()}
                >
                  <Play size={15} />{' '}
                  {sandboxRunning ? 'Ejecutando request…' : 'Ejecutar Petición Real'}
                </Button>
              </div>

              {sandboxResponse ? (
                <div
                  className="ecu-dev-portal__subtle-box"
                  style={{ padding: '1rem', display: 'grid', gap: '0.65rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <StatusBadge tone={sandboxResponse.ok ? 'success' : 'danger'} withDot>
                        HTTP {sandboxResponse.status} {sandboxResponse.statusText}
                      </StatusBadge>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        Tiempo: {sandboxResponse.elapsedMs} ms
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void copyText(sandboxResponse.body, 'Respuesta JSON')}
                    >
                      <Copy size={13} /> Copiar JSON
                    </Button>
                  </div>
                  <pre className="ecu-dev-portal__code-pre" style={{ maxHeight: '340px' }}>
                    <code>{sandboxResponse.body}</code>
                  </pre>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* TAB 4: CÓDIGOS DE ERROR */}
          {activeTab === 'errors' ? (
            <section className="ecu-dev-portal__section">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                  Manejo de Errores y Códigos de Diagnóstico
                </h2>
                <p
                  className="ecu-dev-portal__muted"
                  style={{ margin: '0.35rem 0 0', fontSize: '0.86rem' }}
                >
                  Todos los endpoints devuelven respuestas de error estructuradas (RFC 9457{' '}
                  <code>ProblemDetails</code>) con un código de dominio estable para que tu
                  infraestructura pueda reaccionar programáticamente:
                </p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="ecu-dev-portal__table">
                  <thead>
                    <tr>
                      <th>Estado HTTP</th>
                      <th>Código de Error</th>
                      <th>Causa</th>
                      <th>Cómo resolverlo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ERROR_CODES_DOCS.map((err) => (
                      <tr key={err.code}>
                        <td style={{ fontWeight: 600 }}>{err.http}</td>
                        <td>
                          <code className="ecu-code">{err.code}</code>
                        </td>
                        <td>{err.cause}</td>
                        <td className="ecu-dev-portal__muted">{err.solution}</td>
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
              className="ecu-dev-portal__section"
              style={{ overflow: 'hidden', padding: 0, gap: 0 }}
            >
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid var(--c-border, rgba(0,0,0,0.12))',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <strong>Explorador Interactivo OpenAPI v1 (Scalar)</strong>
                  <div className="ecu-dev-portal__muted" style={{ fontSize: '0.8rem' }}>
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
                className="ecu-dev-portal__iframe"
              />
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}

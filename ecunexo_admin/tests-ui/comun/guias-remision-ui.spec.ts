import { expect, test, type Page } from '@playwright/test'
import type {
  ListRemisionGuidesResponse,
  RemisionGuideDetailDto,
  RemisionGuideSummaryDto,
} from '../../src/types/remisionGuidesApi'

const MOCK_GUIDES: RemisionGuideSummaryDto[] = [
  {
    id: 'guide-001',
    documentNumber: '001-001-000000101',
    accessKey: '1409202606179001234500120010010000001011234567812',
    issueDate: '2026-09-14',
    status: 3, // Authorized
    carrierName: 'Transportes Andinos Cía. Ltda.',
    licensePlate: 'PBA-1234',
    recipientName: 'Distribuidora Guayas S.A.',
    routeDescription: 'Quito - Santo Domingo - Guayaquil',
    startDate: '2026-09-14',
    endDate: '2026-09-15',
    itemsCount: 3,
    authorizationNumber: '1409202606179001234500120010010000001011234567812',
    authorizationDate: '2026-09-14T10:30:00Z',
  },
  {
    id: 'guide-002',
    documentNumber: '001-001-000000102',
    accessKey: '1409202606179001234500120010010000001021234567813',
    issueDate: '2026-09-14',
    status: 4, // InTransit
    carrierName: 'Fletes Rápidos del Austro',
    licensePlate: 'ABC-5678',
    recipientName: 'Supermercados del Sur Cía.',
    routeDescription: 'Quito - Cuenca',
    startDate: '2026-09-14',
    endDate: '2026-09-16',
    itemsCount: 1,
    authorizationNumber: '1409202606179001234500120010010000001021234567813',
    authorizationDate: '2026-09-14T11:00:00Z',
  },
]

const MOCK_GUIDE_DETAIL: RemisionGuideDetailDto = {
  id: 'guide-001',
  tenantId: 'tnt-transport-1',
  establishment: '001',
  emissionPoint: '001',
  sequential: '000000101',
  documentNumber: '001-001-000000101',
  accessKey: '1409202606179001234500120010010000001011234567812',
  issueDate: '2026-09-14',
  status: 3,
  authorizationNumber: '1409202606179001234500120010010000001011234567812',
  authorizationDate: '2026-09-14T10:30:00Z',
  carrierIdentificationType: '04',
  carrierIdentification: '1790011223001',
  carrierName: 'Transportes Andinos Cía. Ltda.',
  carrierEmail: 'despacho@andinos.ec',
  carrierPhone: '0998877665',
  licensePlate: 'PBA-1234',
  startingAddress: 'Av. 10 de Agosto y Orellana, Quito',
  startDate: '2026-09-14',
  endDate: '2026-09-15',
  recipientIdentificationType: '04',
  recipientIdentification: '0990001234001',
  recipientName: 'Distribuidora Guayas S.A.',
  recipientAddress: 'Av. Juan Tanca Marengo Km 3.5, Guayaquil',
  transferReason: 'Venta de mercadería',
  routeDescription: 'Quito - Santo Domingo - Guayaquil',
  supportDocumentType: '01',
  supportDocumentNumber: '001-001-000045678',
  supportDocumentAuth: '1409202601179001234500120010010000456781234567819',
  items: [
    {
      id: 'item-1',
      itemCode: 'ITEM-01',
      description: 'Cajas de componentes automotrices',
      quantity: 50,
      unitOfMeasure: 'UNID',
    },
    {
      id: 'item-2',
      itemCode: 'ITEM-02',
      description: 'Kits de lubricantes y fluidos hidráulicos',
      quantity: 20,
      unitOfMeasure: 'BULTOS',
    },
  ],
  createdAt: '2026-09-14T10:00:00Z',
}

async function mockRemisionGuideSession(page: Page) {
  const guides: RemisionGuideSummaryDto[] = [...MOCK_GUIDES]

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-transport-token',
        expiresAt: '2030-01-01T00:00:00Z',
        userId: 'usr-transport-1',
        tenantId: 'tnt-transport-1',
        isSubscriptionHolder: false,
      }),
    })
  })

  await page.route('**/api/v1/tenants/*/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'usr-transport-1',
          email: 'logistica@ecunexo.test',
          name: 'Jefe de Operaciones y Logística',
          department: 'Transporte',
          phone: '0993334455',
          jobTitle: 'Coordinador de Flota',
          roleIds: ['role-logistica'],
        },
        tenant: {
          id: 'tnt-transport-1',
          name: 'Transportes y Carga Ecuador S.A.',
          timeZoneId: 'America/Guayaquil',
          locale: 'es-EC',
          logoUrl: null,
          status: 1,
          servicePlanName: 'Empresa',
          maxUsers: 10,
          maxWarehouses: 5,
          subscriptionMaxTenants: 1,
          enabledModules: ['billing'],
        },
        permissions: [
          'facturacion.guias.remision.read',
          'facturacion.guias.remision.create',
          'facturacion.read',
          'facturacion.comprobantes.read',
        ],
        navigation: [
          {
            id: 'facturacion',
            label: 'Facturación',
            icon: 'file-text',
            children: [
              {
                id: 'facturacion-guias',
                label: 'Guías de Remisión',
                route: '/facturacion/guias-remision',
                children: [],
              },
            ],
          },
        ],
        settings: {},
        permVersion: '1',
      }),
    })
  })

  await page.route('**/api/v1/tenants/tnt-transport-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'tnt-transport-1',
        name: 'Transportes y Carga Ecuador S.A.',
        taxId: '1790012345001',
        address: 'Av. Galo Plaza Lasso N60-12 y Capelo, Quito',
        establishmentCode: '001',
      }),
    })
  })

  await page.route('**/api/v1/tenants/*/signing-certificate/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        isConfigured: true,
        subject: 'CN=TRANSPORTES Y CARGA ECUADOR S.A., OU=OPERACIONES',
        issuer: 'SECURITY DATA S.A.',
        validFrom: '2025-01-01T00:00:00Z',
        validTo: '2027-12-31T23:59:59Z',
        serialNumber: '5920392819',
        daysRemaining: 400,
        isExpired: false,
        originalFileName: 'transportes_firma.p12',
        updatedAt: '2025-01-02T10:00:00Z',
      }),
    })
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+\/billing\/remision-guides\/guide-001\/xml(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: '<?xml version="1.0" encoding="UTF-8"?><guiaRemision id="comprobante" version="1.1.0"><infoTributaria><claveAcceso>1409202606179001234500120010010000001011234567812</claveAcceso></infoTributaria></guiaRemision>',
    })
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+\/billing\/remision-guides\/guide-001(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GUIDE_DETAIL),
      })
      return
    }
    await route.fulfill({ status: 200, body: '{}' })
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+\/billing\/remision-guides(\?.*)?$/, async (route) => {
    const method = route.request().method()
    const url = route.request().url()

    if (method === 'GET') {
      let filtered = [...guides]
      if (url.includes('status=4')) {
        filtered = filtered.filter((g) => g.status === 4)
      } else if (url.includes('status=3')) {
        filtered = filtered.filter((g) => g.status === 3)
      }

      const response: ListRemisionGuidesResponse = {
        guides: filtered,
        totalCount: guides.length,
        authorizedCount: guides.filter((g) => g.status === 3).length,
        inTransitCount: guides.filter((g) => g.status === 4).length,
        deliveredCount: guides.filter((g) => g.status === 5).length,
        draftCount: guides.filter((g) => g.status === 1).length,
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
      return
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON()
      const newGuide: RemisionGuideSummaryDto = {
        id: `guide-${Date.now()}`,
        documentNumber: `001-001-${String(Date.now()).slice(-9)}`,
        accessKey: '1409202606179001234500120010019999999991234567819',
        issueDate: body.issueDate,
        status: body.emitSri ? 3 : 1,
        carrierName: body.carrierName,
        licensePlate: body.licensePlate,
        recipientName: body.recipientName,
        routeDescription: body.routeDescription,
        startDate: body.startDate,
        endDate: body.endDate,
        itemsCount: body.items?.length ?? 1,
        authorizationNumber: body.emitSri ? '1409202606179001234500120010019999999991234567819' : null,
      }
      guides.unshift(newGuide)

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          guideId: newGuide.id,
          documentNumber: newGuide.documentNumber,
          accessKey: newGuide.accessKey,
          status: newGuide.status,
          authorizationNumber: newGuide.authorizationNumber,
        }),
      })
      return
    }

    await route.fallback()
  })

  // Perform login
  await page.goto('/')
  await page.locator('#login-email').fill('logistica@ecunexo.test')
  await page.locator('#login-password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('persist:ecunexo-tenant-auth'))))
    .toBeTruthy()
}

async function openRemisionGuides(page: Page) {
  const facturacionBtn = page.getByRole('button', { name: /^Facturación$/i })
  if (await facturacionBtn.isVisible()) {
    await facturacionBtn.click()
  }
  const guiasBtn = page.getByRole('button', { name: /Guías de Remisión/i })
  if (await guiasBtn.isVisible()) {
    await guiasBtn.click()
  } else {
    const link = page.getByRole('link', { name: /Guías de Remisión/i })
    if (await link.isVisible()) {
      await link.click()
    } else {
      await page.goto('/facturacion/guias-remision')
    }
  }
  await expect(page.getByRole('heading', { name: /Guías de Remisión SRI/i })).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('Guías de Remisión UI (SRI Comprobante Tipo 06)', () => {
  test.beforeEach(async ({ page }) => {
    await mockRemisionGuideSession(page)
  })

  test('Listado: Carga PageHeader, StatCards de KPI y DataGrid con guías registradas', async ({ page }) => {
    await openRemisionGuides(page)

    // PageHeader canónico
    await expect(page.getByRole('heading', { name: /Guías de Remisión SRI/i })).toBeVisible({
      timeout: 15_000,
    })

    // StatCards de KPI dentro de .ecu-stat-grid
    await expect(page.getByLabel('Métricas de guías de remisión')).toBeVisible()
    await expect(page.getByText('Total Guías Registradas')).toBeVisible()
    await expect(page.getByText('Autorizadas por el SRI')).toBeVisible()
    await expect(page.getByText('En Tránsito / Ruta')).toBeVisible()
    await expect(page.getByText('Entregadas con Éxito')).toBeVisible()

    // DataGrid con guías mockeadas
    await expect(page.getByText('001-001-000000101')).toBeVisible()
    await expect(page.getByText('Transportes Andinos Cía. Ltda.').first()).toBeVisible()
    await expect(page.getByText('Distribuidora Guayas S.A.').first()).toBeVisible()
    await expect(page.getByText('PBA-1234').first()).toBeVisible()

    // Botón de emisión primaria
    await expect(page.getByRole('button', { name: /\+ Nueva Guía de Remisión/i })).toBeVisible()
  })

  test('Filtros de estado: Permite alternar opciones en OptionGroup', async ({ page }) => {
    await openRemisionGuides(page)

    await expect(page.getByRole('radio', { name: /Todas/i })).toBeVisible()
    await expect(page.getByRole('radio', { name: /En Tránsito/i })).toBeVisible()

    // Clic en filtro "En Tránsito"
    await page.getByRole('radio', { name: /En Tránsito/i }).click()
    await expect(page.getByText('Fletes Rápidos del Austro').first()).toBeVisible()
  })

  test('Previsualización RIDE: Abre modal con datos completos del comprobante SRI', async ({ page }) => {
    await openRemisionGuides(page)

    // Clic en botón "Ver detalle completo"
    const viewButton = page.getByRole('button', { name: /Ver detalle completo/i }).first()
    await expect(viewButton).toBeVisible()
    await viewButton.click()

    // Verificar apertura del Popup
    await expect(page.getByRole('heading', { name: /Detalle Guía/i })).toBeVisible()
    await expect(page.getByText('1409202606179001234500120010010000001011234567812')).toBeVisible()
    await expect(page.getByText('Cajas de componentes automotrices')).toBeVisible()

    // Cerrar modal
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Detalle Guía/i })).not.toBeVisible()
  })

  test('Vista dedicada de emisión: Carga formulario completo sin modales (Regla 9)', async ({ page }) => {
    await openRemisionGuides(page)
    await page.getByRole('button', { name: /\+ Nueva Guía de Remisión/i }).click()

    await expect(page).toHaveURL(/\/facturacion\/guias-remision\/nueva/)

    // PageHeader dedicado
    await expect(page.getByRole('heading', { name: /Emitir Guía de Remisión SRI/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('SRI Tipo 06')).toBeVisible()

    // Acciones dedicadas
    await expect(page.getByRole('button', { name: /Volver/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Guardar Borrador/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Emitir Guía SRI/i })).toBeVisible()

    // Verificación de las 5 secciones estructuradas
    await expect(page.getByRole('heading', { name: /1\. Datos de Emisión y Logística/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /2\. Datos del Transportista \/ Conductor/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /3\. Destinatario y Ruta de Entrega/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /4\. Documento de Sustento Tributario/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /5\. Bienes Transportados/i })).toBeVisible()

    // Probar navegación de retorno "Volver"
    await page.getByRole('button', { name: /Volver/i }).click()
    await expect(page).toHaveURL(/\/facturacion\/guias-remision/)
  })

  test('Emisión de Guía: Valida campos requeridos y registra exitosamente', async ({ page }) => {
    await openRemisionGuides(page)
    await page.getByRole('button', { name: /\+ Nueva Guía de Remisión/i }).click()
    await expect(page.getByRole('heading', { name: /Emitir Guía de Remisión SRI/i })).toBeVisible()

    // 1. Emisión y Logística
    await page.getByPlaceholder('Ej. PBA-1234').fill('PBA-9988')

    // 2. Transportista
    await page.getByPlaceholder('1790011223001').fill('1792345678001')
    await page.getByPlaceholder('Transportes Andinos Cía. Ltda.').fill('Logística Sierra y Costa S.A.')

    // 3. Destinatario y Ruta
    await page.getByPlaceholder('0990001234001').fill('0992345678001')
    await page.getByPlaceholder('Distribuidora del Litoral S.A.').fill('Almacenes y Carga Guayaquil')
    await page.getByPlaceholder('Av. 9 de Octubre y Boyacá, Guayaquil').fill('Av. Las Lomas 300, Samborondón')
    await page.getByPlaceholder('Quito - Santo Domingo - Guayaquil').fill('Quito - Santo Domingo - Guayaquil')

    // 5. Bienes transportados (completar descripción)
    await page.getByPlaceholder('Ej. Cajas de repuestos de motor').fill('Pallets de mercadería en tránsito')

    // Guardar borrador
    await page.getByRole('button', { name: /Guardar Borrador/i }).click()

    // Redirección y confirmación
    await expect(page).toHaveURL(/\/facturacion\/guias-remision/, { timeout: 15_000 })
    await expect(page.getByText('Logística Sierra y Costa S.A.').first()).toBeVisible({
      timeout: 10_000,
    })
  })
})

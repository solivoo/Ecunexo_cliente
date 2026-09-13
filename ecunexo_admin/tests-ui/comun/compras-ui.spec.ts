import { expect, test, type Page } from '@playwright/test'
import {
  validateCedula,
  validateRuc,
  validatePassport,
  validateTaxId,
} from '../../src/utils/ecuadorTaxIdValidator'
import type {
  SupplierDto,
  ExpenseTypeDto,
  PurchaseProformaDto,
  PurchaseSummaryDto,
  PurchaseDetailDto,
  ParseSriPurchaseXmlResponse,
} from '../../src/types/purchasesApi'
import type { WarehouseListItemDto } from '../../src/types/inventoryApi'
import type { CatalogItemListItemDto } from '../../src/types/catalogApi'

// ---------------------------------------------------------------------------
// UNIT TESTS: Ecuador Tax ID Validator (Cédula & RUC Módulo 10 & 11)
// ---------------------------------------------------------------------------
test.describe('Ecuador Tax ID Validator — Algoritmos SRI Módulo 10 y 11', () => {
  test('Cédula de identidad ecuatoriana válida (10 dígitos)', () => {
    // Cédula válida de Pichincha
    const res = validateCedula('1710034065')
    expect(res.isValid).toBe(true)
    expect(res.identificationType).toBe('cedula')
  })

  test('Cédula con dígito verificador inválido falla', () => {
    const res = validateCedula('1710034069')
    expect(res.isValid).toBe(false)
    expect(res.error).toBeDefined()
  })

  test('Cédula con código de provincia inválido (fuera de 01-24 y 30) falla', () => {
    const res = validateCedula('9910034065')
    expect(res.isValid).toBe(false)
  })

  test('RUC Persona Natural válido (13 dígitos, termina en 001)', () => {
    const res = validateRuc('1710034065001')
    expect(res.isValid).toBe(true)
    expect(res.identificationType).toBe('ruc_natural')
  })

  test('RUC Persona Jurídica / Sociedad Privada válido (tercer dígito = 9, módulo 11)', () => {
    // RUC Sociedad Privada común
    const res = validateRuc('1790016919001')
    expect(res.isValid).toBe(true)
    expect(res.identificationType).toBe('ruc_privada')
  })

  test('RUC Sector Público válido (tercer dígito = 6, módulo 11)', () => {
    // RUC Empresa Pública común
    const res = validateRuc('1760001550001')
    expect(res.isValid).toBe(true)
    expect(res.identificationType).toBe('ruc_publica')
  })

  test('RUC con longitud incorrecta falla', () => {
    const res = validateRuc('1790016919')
    expect(res.isValid).toBe(false)
    expect(res.error).toContain('13 dígitos')
  })

  test('Pasaporte acepta códigos alfanuméricos válidos', () => {
    const res = validatePassport('A12345678')
    expect(res.isValid).toBe(true)
    expect(res.identificationType).toBe('pasaporte')
  })

  test('validateTaxId despacha correctamente según tipo', () => {
    expect(validateTaxId('1790016919001', 'ruc').isValid).toBe(true)
    expect(validateTaxId('1710034065', 'cedula').isValid).toBe(true)
    expect(validateTaxId('P987654321', 'pasaporte').isValid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// E2E UI TESTS: Módulo de Compras (Proveedores, Proformas y Tipos de Gasto)
// ---------------------------------------------------------------------------

const MOCK_SUPPLIERS: SupplierDto[] = [
  {
    id: 'supp-001',
    tenantId: 'tnt-test-1',
    businessName: 'Distribuidora Tecnológica del Pacífico S.A.',
    tradeName: 'TechPacific',
    taxId: '1790016919001',
    identificationType: 1,
    taxRegime: 1, // General
    isRetentionAgent: true,
    address: 'Av. Amazonas N24-100 y Colón, Quito',
    contactEmail: 'ventas@techpacific.ec',
    contactPhone: '022987654',
    creditDays: 30,
    creditLimit: 15000,
    isActive: true,
    notes: 'Proveedor mayorista principal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'supp-002',
    tenantId: 'tnt-test-1',
    businessName: 'Juan Carlos Morales Importaciones',
    tradeName: 'JCM Import',
    taxId: '1710034065001',
    identificationType: 1,
    taxRegime: 2, // RIMPE Negocio Popular
    isRetentionAgent: false,
    address: 'Calle Guayaquil 500',
    contactEmail: 'jcm@importaciones.ec',
    contactPhone: '0998877665',
    creditDays: 0,
    creditLimit: 0,
    isActive: true,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const MOCK_EXPENSES: ExpenseTypeDto[] = [
  {
    id: 'exp-001',
    tenantId: 'tnt-test-1',
    code: 'MERC',
    name: 'Mercaderías e Insumos para la Venta',
    description: 'Adquisición de productos e insumos para comercialización en tiendas físicas y e-commerce',
    sriSustentoCode: '01',
    affectsInventory: true,
    suggestedRetentionCode: '312',
    isSystem: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'exp-002',
    tenantId: 'tnt-test-1',
    code: 'EMPQ',
    name: 'Empaque, Embalaje y Despacho Courier',
    description: 'Cajas, sobres térmicos, burbujas y envíos e-commerce',
    sriSustentoCode: '02',
    affectsInventory: false,
    suggestedRetentionCode: '312',
    isSystem: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const MOCK_PROFORMAS: PurchaseProformaDto[] = [
  {
    id: 'prof-001',
    tenantId: 'tnt-test-1',
    supplierId: 'supp-001',
    supplierBusinessName: 'Distribuidora Tecnológica del Pacífico S.A.',
    proformaNumber: 'PRF-2026-001',
    issueDate: '2026-09-10',
    expirationDate: '2026-09-30',
    status: 1, // Draft
    subtotal: 1000.0,
    taxAmount: 150.0,
    totalAmount: 1150.0,
    notes: 'Cotización de laptops e impresoras térmicas',
    attachmentUrl: null,
    attachmentFileName: null,
    convertedPurchaseId: null,
    items: [
      {
        id: 'item-001',
        description: 'Laptops Corporativas Intel i7',
        quantity: 2,
        unitPrice: 500.0,
        subtotal: 1000.0,
        taxRate: 15.0,
        taxAmount: 150.0,
        total: 1150.0,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const MOCK_WAREHOUSES: WarehouseListItemDto[] = [
  {
    id: 'wh-001',
    tenantId: 'tnt-test-1',
    code: 'BOD-CENTRAL',
    name: 'Bodega Central Quito',
    description: 'Bodega principal de almacenamiento',
    isActive: true,
    isDefault: true,
    stockItemsCount: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const MOCK_CATALOG_ITEMS: CatalogItemListItemDto[] = [
  {
    id: 'cat-001',
    tenantId: 'tnt-test-1',
    sku: 'RAM-16GB',
    name: 'Memoria RAM DDR4 16GB Kingston',
    categoryId: 'cat-cat-1',
    categoryName: 'Hardware',
    kind: 1, // Physical
    status: 1, // Active
    basePrice: 50.0,
    mainImageUrl: null,
    totalStock: 20,
    hasTaxExempt: false,
    taxPercentage: 15,
  },
  {
    id: 'cat-002',
    tenantId: 'tnt-test-1',
    sku: 'SSD-1TB',
    name: 'Disco SSD NVMe 1TB Kingston',
    categoryId: 'cat-cat-1',
    categoryName: 'Hardware',
    kind: 1, // Physical
    status: 1, // Active
    basePrice: 65.0,
    mainImageUrl: null,
    totalStock: 15,
    hasTaxExempt: false,
    taxPercentage: 15,
  },
]

const MOCK_PURCHASES: PurchaseSummaryDto[] = [
  {
    id: 'purch-001',
    tenantId: 'tnt-test-1',
    supplierId: 'supp-001',
    supplierBusinessName: 'Distribuidora Tecnológica del Pacífico S.A.',
    supplierTaxId: '1790016919001',
    documentType: '01',
    invoiceNumber: '001-002-000000456',
    authorizationNumber: '1209202601179001691900120010020000004561234567818',
    issueDate: '2026-09-12',
    sriSustentoCode: '01',
    subtotalZero: 0,
    subtotalTaxed: 1000.0,
    taxRate: 15,
    taxAmount: 150.0,
    totalDiscount: 0,
    totalAmount: 1150.0,
    status: 1, // Draft
    inventoryDocumentId: null,
    itemsCount: 2,
    createdAt: new Date().toISOString(),
  },
]

const MOCK_PURCHASE_DETAIL: PurchaseDetailDto = {
  ...MOCK_PURCHASES[0],
  subtotalNoSubject: 0,
  subtotalExempt: 0,
  paymentMethodCode: '20',
  creditDays: 30,
  expenseTypeId: 'exp-001',
  expenseTypeName: 'Mercaderías e Insumos para la Venta',
  proformaId: null,
  rawXml: '<factura></factura>',
  notes: 'Compra de inventario mensual de hardware',
  items: [
    {
      id: 'item-p1',
      purchaseId: 'purch-001',
      catalogItemId: 'cat-001',
      warehouseId: 'wh-001',
      itemCode: 'RAM-16GB',
      description: 'Memoria RAM DDR4 16GB Kingston',
      quantity: 10,
      unitPrice: 50.0,
      discount: 0,
      subtotal: 500.0,
      taxRate: 15,
      taxAmount: 75.0,
      total: 575.0,
      affectsInventory: true,
    },
    {
      id: 'item-p2',
      purchaseId: 'purch-001',
      catalogItemId: 'cat-002',
      warehouseId: 'wh-001',
      itemCode: 'SSD-1TB',
      description: 'Disco SSD NVMe 1TB Kingston',
      quantity: 10,
      unitPrice: 50.0,
      discount: 0,
      subtotal: 500.0,
      taxRate: 15,
      taxAmount: 75.0,
      total: 575.0,
      affectsInventory: true,
    },
  ],
}

const MOCK_PARSED_XML_RESPONSE: ParseSriPurchaseXmlResponse = {
  supplier: {
    existingSupplierId: 'supp-001',
    taxId: '1790016919001',
    businessName: 'Distribuidora Tecnológica del Pacífico S.A.',
    tradeName: 'TechPacific',
    address: 'Av. Amazonas N24-100 y Colón, Quito',
    isRegistered: true,
  },
  invoiceNumber: '001-002-000000789',
  authorizationNumber: '1209202601179001691900120010020000007891234567818',
  issueDate: '2026-09-12',
  documentType: '01',
  subtotalZero: 0,
  subtotalTaxed: 500.0,
  subtotalNoSubject: 0,
  subtotalExempt: 0,
  taxRate: 15,
  taxAmount: 75.0,
  totalDiscount: 0,
  totalAmount: 575.0,
  paymentMethodCode: '20',
  creditDays: 15,
  rawXml: '<factura id="comprobante" version="1.1.0"></factura>',
  lines: [
    {
      itemCode: 'RAM-16GB',
      description: 'Memoria RAM DDR4 16GB Kingston',
      quantity: 10,
      unitPrice: 50.0,
      discount: 0,
      subtotal: 500.0,
      taxRate: 15,
      taxAmount: 75.0,
      total: 575.0,
      matchedCatalogItemId: 'cat-001',
      matchedCatalogItemName: 'Memoria RAM DDR4 16GB Kingston',
      canAffectInventory: true,
    },
  ],
}

async function mockPurchasesSession(page: Page) {
  const suppliers = [...MOCK_SUPPLIERS]
  const expenses = [...MOCK_EXPENSES]
  const proformas = [...MOCK_PROFORMAS]
  const purchases = [...MOCK_PURCHASES]
  const warehouses = [...MOCK_WAREHOUSES]
  const catalogItems = [...MOCK_CATALOG_ITEMS]

  const permissions = [
    'purchases.suppliers.read',
    'purchases.suppliers.manage',
    'purchases.proformas.read',
    'purchases.proformas.manage',
    'purchases.expenses.read',
    'purchases.expenses.manage',
    'purchases.documents.read',
    'purchases.documents.manage',
    'purchases.read',
    'purchases.manage',
  ]

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-purchases-token',
        expiresAt: '2030-01-01T00:00:00Z',
        userId: 'usr-purchases-1',
        tenantId: 'tnt-purchases-1',
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
          id: 'usr-purchases-1',
          email: 'compras@ecunexo.test',
          name: 'Jefe de Compras E2E',
          department: 'Compras',
          phone: '0991112233',
          jobTitle: 'Supervisor de Compras',
          roleIds: ['role-compras'],
        },
        tenant: {
          id: 'tnt-purchases-1',
          name: 'EcuNexo Retail E2E',
          timeZoneId: 'America/Guayaquil',
          locale: 'es-EC',
          logoUrl: null,
          status: 1,
          servicePlanName: 'Empresa',
          maxUsers: 10,
          maxWarehouses: 5,
          subscriptionMaxTenants: 1,
          enabledModules: ['purchases'],
        },
        permissions,
        navigation: [
          {
            id: 'purchases',
            label: 'Compras',
            icon: 'shopping-cart',
            children: [
              {
                id: 'compras-documentos',
                label: 'Documentos de Compra',
                route: '/compras/documentos',
                children: [],
              },
              {
                id: 'compras-proveedores',
                label: 'Directorio de Proveedores',
                route: '/compras/proveedores',
                children: [],
              },
              {
                id: 'compras-proformas',
                label: 'Proformas y Cotizaciones',
                route: '/compras/proformas',
                children: [],
              },
              {
                id: 'compras-gastos',
                label: 'Tipos de Gasto SRI',
                route: '/compras/gastos',
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

  // Suppliers API routes
  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/suppliers(\/.*|\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(suppliers),
      })
      return
    }
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON()
      const created: SupplierDto = {
        id: `supp-${Date.now()}`,
        tenantId: 'tnt-purchases-1',
        businessName: data.businessName,
        tradeName: data.tradeName || null,
        taxId: data.taxId,
        identificationType: data.identificationType,
        taxRegime: data.taxRegime,
        isRetentionAgent: Boolean(data.isRetentionAgent),
        address: data.address || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        creditDays: data.creditDays || 0,
        creditLimit: data.creditLimit || 0,
        isActive: true,
        notes: data.notes || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      suppliers.push(created)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      })
      return
    }
    await route.fallback()
  })

  // Expense Types API routes
  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/expense-types(\/.*|\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(expenses),
      })
      return
    }
    await route.fallback()
  })

  // Purchase Proformas API routes
  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/proformas(\/.*|\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(proformas),
      })
      return
    }
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON()
      const created: PurchaseProformaDto = {
        id: `prof-${Date.now()}`,
        tenantId: 'tnt-purchases-1',
        supplierId: data.supplierId,
        supplierBusinessName: 'Distribuidora Tecnológica del Pacífico S.A.',
        proformaNumber: data.proformaNumber,
        issueDate: data.issueDate,
        expirationDate: data.expirationDate || null,
        status: 1,
        subtotal: 500,
        taxAmount: 75,
        totalAmount: 575,
        notes: data.notes || null,
        attachmentUrl: null,
        attachmentFileName: null,
        convertedPurchaseId: null,
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      proformas.push(created)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      })
      return
    }
    await route.fallback()
  })

  // Warehouses API route
  await page.route(/\/api\/v1\/tenants\/[^/]+\/warehouses(\/.*|\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(warehouses),
      })
      return
    }
    await route.fallback()
  })

  // Catalog items API route
  await page.route(/\/api\/v1\/tenants\/[^/]+\/catalog\/items(\/.*|\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(catalogItems),
      })
      return
    }
    await route.fallback()
  })

  // Purchases Documents - General List & Create route (strict pattern without slash suffix)
  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/documents(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      const kpis = {
        totalPurchases: purchases.length,
        totalReceived: purchases.filter((p) => p.status === 2).length,
        totalDraft: purchases.filter((p) => p.status === 1).length,
        totalBilledAmount: purchases.reduce((acc, curr) => acc + curr.totalAmount, 0),
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kpis, purchases }),
      })
      return
    }
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON()
      const created: PurchaseSummaryDto = {
        id: `purch-${Date.now()}`,
        tenantId: 'tnt-purchases-1',
        supplierId: data.supplierId || 'supp-001',
        supplierBusinessName: 'Distribuidora Tecnológica del Pacífico S.A.',
        supplierTaxId: '1790016919001',
        documentType: data.documentType || '01',
        invoiceNumber: data.invoiceNumber || '001-002-000000789',
        authorizationNumber: data.authorizationNumber || '1209202601179001691900120010020000007891234567818',
        issueDate: data.issueDate || '2026-09-12',
        sriSustentoCode: data.sriSustentoCode || '01',
        subtotalZero: data.subtotalZero || 0,
        subtotalTaxed: data.subtotalTaxed || 500,
        taxRate: data.taxRate || 15,
        taxAmount: data.taxAmount || 75,
        totalDiscount: data.totalDiscount || 0,
        totalAmount: data.totalAmount || 575,
        status: 1,
        inventoryDocumentId: null,
        itemsCount: (data.items || []).length || 1,
        createdAt: new Date().toISOString(),
      }
      purchases.push(created)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          purchaseId: created.id,
          invoiceNumber: created.invoiceNumber,
        }),
      })
      return
    }
    await route.fallback()
  })

  // Specific routes
  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/documents\/parse-xml$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PARSED_XML_RESPONSE),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/documents\/([^/]+)\/receive$/, async (route) => {
    if (route.request().method() === 'POST') {
      const p = purchases.find((x) => x.id === 'purch-001')
      if (p) p.status = 2
      MOCK_PURCHASE_DETAIL.status = 2
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          purchaseId: 'purch-001',
          status: 2,
          itemsReceivedInStock: 2,
        }),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/documents\/([^/]+)$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PURCHASE_DETAIL),
      })
      return
    }
    await route.fallback()
  })

  // Login
  await page.goto('/')
  await page.locator('#login-email').fill('compras@ecunexo.test')
  await page.locator('#login-password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('persist:ecunexo-tenant-auth'))))
    .toBeTruthy()

  return { suppliers, expenses, proformas, purchases }
}

async function openPurchases(page: Page) {
  const comprasBtn = page.getByRole('button', { name: /^Compras$/i })
  if (await comprasBtn.isVisible()) {
    await comprasBtn.click()
  }
  await page.getByRole('button', { name: /Documentos de Compra/i }).click()
  await expect(page.getByRole('heading', { name: /Documentos y Facturas de Compra/i })).toBeVisible({
    timeout: 15_000,
  })
}

async function openSuppliers(page: Page) {
  const comprasBtn = page.getByRole('button', { name: /^Compras$/i })
  if (await comprasBtn.isVisible()) {
    await comprasBtn.click()
  }
  await page.getByRole('button', { name: /Directorio de Proveedores/i }).click()
  await expect(page.getByRole('heading', { name: /Directorio de Proveedores/i })).toBeVisible({
    timeout: 15_000,
  })
}

async function openProformas(page: Page) {
  const comprasBtn = page.getByRole('button', { name: /^Compras$/i })
  if (await comprasBtn.isVisible()) {
    await comprasBtn.click()
  }
  await page.getByRole('button', { name: /Proformas y Cotizaciones/i }).click()
  await expect(page.getByRole('heading', { name: /Proformas y Cotizaciones/i })).toBeVisible({
    timeout: 15_000,
  })
}

async function openExpenseTypes(page: Page) {
  const comprasBtn = page.getByRole('button', { name: /^Compras$/i })
  if (await comprasBtn.isVisible()) {
    await comprasBtn.click()
  }
  await page.getByRole('button', { name: /Tipos de Gasto SRI/i }).click()
  await expect(page.getByRole('heading', { name: /Tipos de Gasto y Sustentos SRI/i })).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('Compras UI — Directorio de Proveedores', () => {
  test.beforeEach(async ({ page }) => {
    await mockPurchasesSession(page)
  })

  test('Proveedores: carga PageHeader, métricas KPI y listado DataGrid', async ({ page }) => {
    await openSuppliers(page)

    // Tira de métricas (KPIs)
    await expect(page.getByLabel('Resumen de proveedores')).toBeVisible()
    await expect(page.getByText('Total Proveedores')).toBeVisible()
    await expect(page.getByText('Agentes de Retención')).toBeVisible()

    // DataGrid filas
    await expect(page.getByText('Distribuidora Tecnológica del Pacífico S.A.')).toBeVisible()
    await expect(page.getByText('1790016919001')).toBeVisible()
    await expect(page.getByText('Agente SRI')).toBeVisible()
  })

  test('Proveedores: abrir modal de nuevo proveedor y validar RUC en tiempo real', async ({ page }) => {
    await openSuppliers(page)
    await expect(page.getByRole('button', { name: /Nuevo Proveedor/i })).toBeVisible()

    await page.getByRole('button', { name: /Nuevo Proveedor/i }).click()
    await expect(page.getByRole('heading', { name: /Nuevo Proveedor/i })).toBeVisible()

    // Escribir RUC inválido (dígito verificador 8 en lugar de 9)
    const taxIdInput = page.locator('#supplier-tax-id')
    await taxIdInput.fill('1790016918001')
    await expect(page.getByText(/El dígito verificador del RUC/i)).toBeVisible()

    // Corregir a RUC válido
    await taxIdInput.fill('1790016919001')
    await expect(page.getByText(/Identificación válida ante SRI/i)).toBeVisible()

    // Cerrar modal
    await page.getByRole('button', { name: /Cancelar/i }).click()
  })
})

test.describe('Compras UI — Proformas y Cotizaciones', () => {
  test.beforeEach(async ({ page }) => {
    await mockPurchasesSession(page)
  })

  test('Proformas: carga PageHeader, KPI cards y cotizaciones', async ({ page }) => {
    await openProformas(page)

    // Tira de métricas (KPIs)
    await expect(page.getByLabel('Resumen de proformas')).toBeVisible()
    await expect(page.getByText('En Borrador')).toBeVisible()

    // Fila DataGrid
    await expect(page.getByText('PRF-2026-001')).toBeVisible()
    await expect(page.getByText('$1150.00')).toBeVisible()
  })
})

test.describe('Compras UI — Tipos de Gasto SRI', () => {
  test.beforeEach(async ({ page }) => {
    await mockPurchasesSession(page)
  })

  test('Tipos de Gasto: carga catálogo ATS y sustentos tributarios', async ({ page }) => {
    await openExpenseTypes(page)

    // Tira de métricas
    await expect(page.getByLabel('Resumen de tipos de gasto')).toBeVisible()
    await expect(page.getByText('Afectan Inventario')).toBeVisible()

    // Tabla con códigos de gasto
    await expect(page.getByText('MERC', { exact: true })).toBeVisible()
    await expect(page.getByText('EMPQ', { exact: true })).toBeVisible()
    await expect(page.getByText('Catálogo SRI').first()).toBeVisible()
  })
})

test.describe('Compras UI — Documentos de Compra & Parseo XML SRI', () => {
  test.beforeEach(async ({ page }) => {
    await mockPurchasesSession(page)
  })

  test('Documentos: carga PageHeader, métricas KPI y facturas en DataGrid', async ({ page }) => {
    await openPurchases(page)

    // PageHeader y Badge
    await expect(page.getByRole('heading', { name: /Documentos y Facturas de Compra/i })).toBeVisible()
    await expect(page.getByText('Módulo Compras')).toBeVisible()

    // Tira de métricas (KPIs)
    await expect(page.getByLabel('Resumen de facturas de compra')).toBeVisible()
    await expect(page.getByText('Total Facturas')).toBeVisible()
    await expect(page.getByText('Mercadería Recibida')).toBeVisible()
    await expect(page.getByText('En Borrador')).toBeVisible()
    await expect(page.getByText('Total Facturado')).toBeVisible()

    // Fila DataGrid de la factura mock
    await expect(page.getByText('001-002-000000456')).toBeVisible()
    await expect(page.getByText('Distribuidora Tecnológica del Pacífico S.A.')).toBeVisible()
    await expect(page.locator('.ecu-companies-grid').getByText('$1150.00')).toBeVisible()
    await expect(page.getByText('Borrador', { exact: true })).toBeVisible()
  })

  test('Documentos: abrir modal XML, procesar comprobante y registrar compra', async ({ page }) => {
    await openPurchases(page)

    // Abrir modal de carga XML
    const uploadBtn = page.getByRole('button', { name: /Cargar Factura XML SRI/i }).first()
    await expect(uploadBtn).toBeVisible()
    await uploadBtn.click()

    // Verificar modal abierto
    await expect(page.getByRole('heading', { name: /Cargar Factura Electrónica SRI/i })).toBeVisible()

    // Pegar contenido XML en el textarea
    const xmlTextarea = page.locator('textarea')
    await xmlTextarea.fill('<factura id="comprobante" version="1.1.0"><infoTributaria></infoTributaria></factura>')

    // Procesar XML
    await page.getByRole('button', { name: /Analizar XML SRI/i }).click()

    // Previsualización de compra parseada
    await expect(page.getByText('001-002-000000789', { exact: true })).toBeVisible()
    await expect(page.getByText('Memoria RAM DDR4 16GB Kingston').first()).toBeVisible()
    await expect(page.getByText('Proveedor Registrado')).toBeVisible()

    // Registrar la factura de compra
    await page.getByRole('button', { name: /Registrar Factura de Compra/i }).click()

    // Toast de éxito
    await expect(page.getByText(/Factura registrada/i)).toBeVisible()
  })

  test('Documentos: recepcionar mercadería en bodega y actualizar kárdex', async ({ page }) => {
    await openPurchases(page)

    // Botón de recepción de mercadería (PackageCheck icon) dentro de la grilla
    const receiveBtn = page.locator('.ecu-companies-grid').getByRole('button', { name: /Recepcionar en bodega/i }).first()
    await expect(receiveBtn).toBeVisible()
    await receiveBtn.click()

    // Verificar modal de recepción
    await expect(page.getByRole('heading', { name: /Recepcionar Mercadería/i })).toBeVisible()
    await expect(page.getByText('Ingreso automático al Kárdex y Stock Físico')).toBeVisible()

    // Confirmar recepción en bodega
    await page.getByRole('button', { name: /Confirmar Ingreso a Bodega/i }).click()

    // Notificación de éxito
    await expect(page.getByText(/Mercadería ingresada a inventario/i)).toBeVisible()
  })

  test('Documentos: consultar detalle completo de factura', async ({ page }) => {
    await openPurchases(page)

    // Abrir detalle con el icono de ojo dentro de la grilla
    const detailBtn = page.locator('.ecu-companies-grid').getByRole('button', { name: /Ver detalle de factura/i }).first()
    await expect(detailBtn).toBeVisible()
    await detailBtn.click()

    // Modal de detalle
    await expect(page.getByRole('heading', { name: /Factura de Compra: 001-002-000000456/i })).toBeVisible()
    await expect(page.locator('.glb-popup').getByText('RUC: 1790016919001')).toBeVisible()
    await expect(page.getByText('Líneas de la Factura')).toBeVisible()

    // Cerrar modal
    await page.getByLabel('Cerrar', { exact: true }).click()
  })
})

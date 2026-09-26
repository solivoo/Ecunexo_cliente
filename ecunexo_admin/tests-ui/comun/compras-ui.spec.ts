import { expect, test, type Page } from '@playwright/test'
import {
  validateCedula,
  validateRuc,
  validatePassport,
  validateTaxId,
} from '../../src/utils/ecuadorTaxIdValidator'
import {
  computeLineValues,
  computeInvoiceTotalsFromLines,
} from '../../src/utils/purchaseCalculations'
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
  {
    id: 'supp-003',
    tenantId: 'tnt-test-1',
    businessName: 'María Carmen Guanoluisa',
    tradeName: 'Servicios de Artesanía y Limpieza',
    taxId: '1710034065',
    identificationType: 2,
    taxRegime: 1,
    isRetentionAgent: false,
    address: 'Calderón, Quito',
    contactEmail: 'maria.guanoluisa@test.ec',
    contactPhone: '0987654321',
    creditDays: 0,
    creditLimit: 0,
    isActive: true,
    notes: 'Persona natural sin RUC',
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
    'facturacion.liquidacion.compra.read',
    'facturacion.liquidacion.compra.issue',
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
              {
                id: 'compras-liquidaciones',
                label: 'Liquidaciones de Compra',
                route: '/compras/liquidaciones',
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
    const url = route.request().url()
    if (route.request().method() === 'GET') {
      const byTaxMatch = url.match(/\/by-tax-id\/([^/?]+)/)
      if (byTaxMatch) {
        const taxId = decodeURIComponent(byTaxMatch[1]).trim()
        const found = suppliers.find((s) => s.taxId.trim() === taxId)
        if (found) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(found) })
        } else {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) })
        }
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(suppliers),
      })
      return
    }
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON()
      const existing = suppliers.find((s) => s.taxId.trim() === (data.taxId || '').trim())
      if (existing && data.returnExistingIfExists) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(existing),
        })
        return
      }

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

  // Purchases Settlements (SRI Tipo 03) routes
  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/settlements(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      const settlements = purchases.filter((p) => p.documentType === '03')
      const kpis = {
        totalPurchases: settlements.length,
        totalReceived: settlements.filter((p) => p.status === 2).length,
        totalDraft: settlements.filter((p) => p.status === 1).length,
        totalBilledAmount: settlements.reduce((acc, curr) => acc + curr.totalAmount, 0),
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kpis, purchases: settlements }),
      })
      return
    }
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON()
      const created: PurchaseSummaryDto = {
        id: `settle-${Date.now()}`,
        tenantId: 'tnt-purchases-1',
        supplierId: data.supplierId || 'supp-003',
        supplierBusinessName: 'María Carmen Guanoluisa',
        supplierTaxId: '1710034065',
        documentType: '03',
        invoiceNumber: data.invoiceNumber || '001-001-000000001',
        authorizationNumber: '1309202603179001691900110010010000000011234567812',
        issueDate: data.issueDate || '2026-09-13',
        sriSustentoCode: data.sriSustentoCode || '01',
        subtotalZero: data.subtotalZero || 0,
        subtotalTaxed: data.subtotalTaxed || 100,
        taxRate: 15,
        taxAmount: data.taxAmount || 15,
        totalDiscount: 0,
        totalAmount: data.totalAmount || 115,
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

  // Signing Certificate Status and Tenant details
  await page.route(/\/api\/v1\/tenants\/[^/]+\/signing-certificate\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        isConfigured: true,
        subject: 'CN=ECUNEXO S.A.S., O=SECURITY DATA S.A.',
        issuer: 'SECURITY DATA S.A.',
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2028-01-01T00:00:00Z',
        isExpired: false,
        daysRemaining: 475,
      }),
    })
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'tnt-purchases-1',
          name: 'EcuNexo Retail E2E',
          legalName: 'ECUNEXO RETAIL S.A.S.',
          taxId: '1790016919001',
          establishmentCode: '001',
          address: 'Av. 10 de Agosto y Colón, Quito',
          phone: '022998877',
          email: 'info@ecunexo.test',
          timeZoneId: 'America/Guayaquil',
          locale: 'es-EC',
          currency: 'USD',
          status: 1,
          createdAt: new Date().toISOString(),
        }),
      })
      return
    }
    await route.fallback()
  })

  // Specific routes
  await page.route(/\/api\/v1\/tenants\/[^/]+\/purchases\/documents\/parse-xml$/, async (route) => {
    if (route.request().method() === 'POST') {
      const data = route.request().postDataJSON()
      const xmlStr = data?.xmlContent || ''
      const invMatch = xmlStr.match(/numFactura="([^"]+)"/) || xmlStr.match(/<secuencial>([^<]+)<\/secuencial>/)
      const invoiceNumber = invMatch ? `001-002-${invMatch[1].padStart(9, '0')}` : MOCK_PARSED_XML_RESPONSE.invoiceNumber
      const authorizationNumber = invMatch ? `120920260117900169190012001002${invMatch[1].padStart(9, '0')}1234567818` : MOCK_PARSED_XML_RESPONSE.authorizationNumber

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_PARSED_XML_RESPONSE,
          invoiceNumber,
          authorizationNumber,
        }),
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
  await expect(page.getByRole('heading', { name: /Categorías de Compra|Tipos de Gasto/i })).toBeVisible({
    timeout: 15_000,
  })
}

async function openSettlements(page: Page) {
  const comprasBtn = page.getByRole('button', { name: /^Compras$/i })
  if (await comprasBtn.isVisible()) {
    await comprasBtn.click()
  }
  const btn = page.getByRole('button', { name: /Liquidaciones de Compra/i })
  if (await btn.isVisible()) {
    await btn.click()
  } else {
    await page.goto('/compras/liquidaciones')
  }
  await expect(page.getByRole('heading', { name: /Liquidaciones de Compra SRI/i })).toBeVisible({
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

  test('Proformas: navega a vista dedicada /compras/proformas/nueva y muestra modos híbridos', async ({ page }) => {
    await openProformas(page)

    // Clic en Nueva Cotización
    const newBtn = page.getByRole('button', { name: /Nueva Cotización/i })
    await expect(newBtn).toBeVisible()
    await newBtn.click()

    // Verificar que estamos en la nueva vista dedicada
    await expect(page).toHaveURL(/.*\/compras\/proformas\/nueva/)
    await expect(page.getByRole('heading', { name: /Registrar Proforma \/ Cotización/i })).toBeVisible()

    // Verificar selector de modo híbrido
    await expect(page.getByText('Por Documento / Enlace Externo (PDF)')).toBeVisible()
    await expect(page.getByText('Desglose Detallado por Ítems')).toBeVisible()

    // En modo documento, la sección de URL y montos directos está visible y no el grid de ítems
    await expect(page.getByText('Enlace / URL de la Cotización (PDF / Imagen / Cloud)')).toBeVisible()
    await expect(page.getByText('Subtotal Neto ($ USD)')).toBeVisible()
    await expect(page.getByText('Tarifa de IVA Aplicable')).toBeVisible()
    await expect(page.getByText('Total General ($ USD)')).toBeVisible()
  })
})

test.describe('Compras UI — Tipos de Gasto SRI', () => {
  test.beforeEach(async ({ page }) => {
    await mockPurchasesSession(page)
  })

  test('Tipos de Gasto: carga catálogo ATS y sustentos tributarios', async ({ page }) => {
    await openExpenseTypes(page)

    // Tira de métricas
    await expect(page.getByLabel(/Resumen de (tipos de gasto|categorías de compra)/i)).toBeVisible()
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

  test('Documentos: abrir vista de importación, procesar comprobante y registrar compra', async ({ page }) => {
    await openPurchases(page)

    // Navegar a vista dedicada de importación
    const uploadBtn = page.getByRole('button', { name: /Importar Facturas SRI/i }).first()
    await expect(uploadBtn).toBeVisible()
    await uploadBtn.click()

    // Verificar vista de importación
    await expect(page.getByRole('heading', { name: /Importación y Auditoría SRI de Compras/i })).toBeVisible()

    // Abrir modal de pegar XML
    await page.getByRole('button', { name: /Pegar XML en texto/i }).click()
    const xmlTextarea = page.locator('textarea')
    await xmlTextarea.fill('<factura id="comprobante" version="1.1.0"><infoTributaria></infoTributaria></factura>')

    // Procesar XML
    await page.getByRole('button', { name: /Procesar XML/i }).click()

    // Previsualización de compra parseada en la cola
    await expect(page.getByText('001-002-000000789', { exact: true })).toBeVisible()

    // Registrar facturas seleccionadas
    await page.getByRole('button', { name: /Registrar Facturas Seleccionadas/i }).click()

    // Toast de éxito
    await expect(page.getByText(/Importación Exitosa/i)).toBeVisible()
  })

  test('Documentos: importar múltiples facturas del mismo proveedor en cola sin rechazo ni duplicidad de proveedor', async ({ page }) => {
    await openPurchases(page)

    // Navegar a vista de importación
    const uploadBtn = page.getByRole('button', { name: /Importar Facturas SRI/i }).first()
    await expect(uploadBtn).toBeVisible()
    await uploadBtn.click()

    await expect(page.getByRole('heading', { name: /Importación y Auditoría SRI de Compras/i })).toBeVisible()

    // Cargar primera factura del proveedor TechPacific (789)
    await page.getByRole('button', { name: /Pegar XML en texto/i }).click()
    const xmlTextarea = page.locator('textarea')
    await xmlTextarea.fill('<factura id="comprobante" version="1.1.0"><infoTributaria><secuencial>000000789</secuencial></infoTributaria></factura>')
    await page.getByRole('button', { name: /Procesar XML/i }).click()

    await expect(page.getByText('001-002-000000789', { exact: true })).toBeVisible()

    // Cargar segunda factura DIFERENTE del MISMO proveedor TechPacific (790)
    await page.getByRole('button', { name: /Pegar XML/i }).click()
    await xmlTextarea.fill('<factura id="comprobante" version="1.1.0"><infoTributaria><secuencial>000000790</secuencial></infoTributaria></factura>')
    await page.getByRole('button', { name: /Procesar XML/i }).click()

    // Ambas facturas deben estar en la cola de importación sin haber sido rechazadas
    await expect(page.getByText('001-002-000000789', { exact: true })).toBeVisible()
    await expect(page.getByText('001-002-000000790', { exact: true })).toBeVisible()

    // Registrar facturas seleccionadas
    await page.getByRole('button', { name: /Registrar Facturas Seleccionadas/i }).click()

    // Debe completar exitosamente sin rechazo por proveedor duplicado
    await expect(page.getByText(/Importación Exitosa/i)).toBeVisible()
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

  // -------------------------------------------------------------------------
  // LIQUIDACIONES DE COMPRA (SRI TIPO 03) — ART. 48 RCVR & RETENCIÓN 100% IVA
  // -------------------------------------------------------------------------

  test('Liquidaciones: renderizar vista con KPIs, emisor fiscal y firma electrónica activa', async ({ page }) => {
    await openSettlements(page)
    await expect(page.getByRole('heading', { name: /Liquidaciones de Compra SRI/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('SRI Tipo 03')).toBeVisible()
    await expect(page.getByText('ECUNEXO RETAIL S.A.S.')).toBeVisible()
    await expect(page.getByText('Firma Digital Activa')).toBeVisible()
    await expect(page.getByText('Total Liquidaciones')).toBeVisible()
    await expect(page.getByText('Monto Liquidado')).toBeVisible()
  })

  test('Liquidaciones: validación preventiva Art. 48 RCVR bloquea emisión si proveedor tiene RUC', async ({ page }) => {
    await openSettlements(page)

    const createBtn = page.getByRole('button', { name: 'Nueva Liquidación' })
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    await expect(page.getByRole('heading', { name: /Nueva Liquidación de Compra/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('1. Sujeto Pasivo / Proveedor (Art. 48 RCVR)')).toBeVisible()

    // Si seleccionamos a un proveedor con RUC (TechPacific)
    const select = page.locator('select')
    if (await select.count() > 0) {
      await select.first().selectOption({ label: /Distribuidora Tecnológica del Pacífico/i })
      // Debe aparecer el aviso de incompatibilidad legal Art. 48 RCVR
      await expect(page.getByText(/Incompatibilidad Legal - Art. 48 RCVR/i)).toBeVisible()
      // El botón de emitir debe estar deshabilitado
      const emitBtn = page.getByRole('button', { name: /Emitir Liquidación/i })
      await expect(emitBtn).toBeDisabled()
    }
  })

  test('Liquidaciones: cálculo de retención 100% IVA y emisión exitosa para persona natural sin RUC', async ({ page }) => {
    await openSettlements(page)

    const createBtn = page.getByRole('button', { name: 'Nueva Liquidación' })
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    await expect(page.getByRole('heading', { name: /Nueva Liquidación de Compra/i })).toBeVisible({ timeout: 15_000 })

    // Seleccionar proveedor sin RUC (María Carmen Guanoluisa)
    const select = page.locator('select')
    if (await select.count() > 0) {
      await select.first().selectOption({ label: /María Carmen Guanoluisa/i })
      await expect(page.getByText(/Proveedor habilitado para Liquidación Tipo 03/i)).toBeVisible()
    }

    // Llenar descripción de la línea
    const descInput = page.locator('input[placeholder*="Servicio de albañilería"]').first()
    await descInput.fill('Mantenimiento y pintura de oficinas')

    // Llenar precio
    const priceInput = page.locator('input[type="number"][step="0.01"]').first()
    await priceInput.fill('100.00')

    // Verificar desglose económico y retención 100% IVA ($15.00)
    await expect(page.getByText('Retención de IVA (Art. 48 RCVR):')).toBeVisible()
    await expect(page.getByText('100% IVA', { exact: true })).toBeVisible()

    // Emitir liquidación
    const emitBtn = page.getByRole('button', { name: /Emitir Liquidación/i })
    await expect(emitBtn).toBeEnabled()
    await emitBtn.click()

    // Toast de éxito y redirección a la lista
    await expect(page.getByText(/Liquidación Registrada/i)).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/.*\/compras\/liquidaciones/)
  })
})

// ---------------------------------------------------------------------------
// UNIT TESTS: Edición y Recálculo Dinámico de Facturas de Proveedores en Grid / Lote
// ---------------------------------------------------------------------------
test.describe('Importación XML — Edición de Facturas de Proveedores en Cola / Grid', () => {
  test('computeLineValues calcula subtotal, IVA y total con precisión centesimal y descuento', () => {
    // 3 unidades a $25.50 con $5.00 de descuento y 15% IVA
    // Subtotal: 3 * 25.50 - 5.00 = 76.50 - 5.00 = 71.50
    // IVA: 71.50 * 0.15 = 10.725 -> 10.73
    // Total: 71.50 + 10.73 = 82.23
    const res1 = computeLineValues(3, 25.5, 5, 15)
    expect(res1.subtotal).toBe(71.5)
    expect(res1.taxAmount).toBe(10.73)
    expect(res1.total).toBe(82.23)

    // Tarifa 0% IVA
    const res0 = computeLineValues(10, 12, 0, 0)
    expect(res0.subtotal).toBe(120)
    expect(res0.taxAmount).toBe(0)
    expect(res0.total).toBe(120)

    // Tarifa 5% IVA (Materiales de construcción)
    const res5 = computeLineValues(2, 50, 0, 5)
    expect(res5.subtotal).toBe(100)
    expect(res5.taxAmount).toBe(5)
    expect(res5.total).toBe(105)
  })

  test('computeInvoiceTotalsFromLines desglosa subtotales 0%, gravados, descuentos e IVA total', () => {
    const lines = [
      {
        itemCode: 'ITEM-01',
        description: 'Servicio con IVA 15%',
        quantity: 2,
        unitPrice: 50,
        discount: 10,
        subtotal: 90, // 2 * 50 - 10
        taxRate: 15,
        taxAmount: 13.5, // 90 * 0.15
        total: 103.5,
        matchedCatalogItemId: null,
        matchedCatalogItemName: null,
        selectedCatalogItemId: '',
        selectedWarehouseId: '',
        affectsStock: false,
        canAffectInventory: false,
      },
      {
        itemCode: 'ITEM-02',
        description: 'Bienes con tarifa 0%',
        quantity: 5,
        unitPrice: 20,
        discount: 0,
        subtotal: 100,
        taxRate: 0,
        taxAmount: 0,
        total: 100,
        matchedCatalogItemId: null,
        matchedCatalogItemName: null,
        selectedCatalogItemId: '',
        selectedWarehouseId: 'wh-01',
        affectsStock: true,
        canAffectInventory: true,
      },
    ]

    const totals = computeInvoiceTotalsFromLines(lines)
    expect(totals.subtotalZero).toBe(100)
    expect(totals.subtotalTaxed).toBe(90)
    expect(totals.totalDiscount).toBe(10)
    expect(totals.taxAmount).toBe(13.5)
    expect(totals.totalAmount).toBe(203.5)
  })
})


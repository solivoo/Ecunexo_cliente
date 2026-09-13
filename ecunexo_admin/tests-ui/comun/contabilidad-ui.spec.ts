import { expect, test, type Page } from '@playwright/test'
import type { AccountDto } from '../../src/types/accountingApi'

const MOCK_ACCOUNTS: AccountDto[] = [
  {
    id: 'acc-1',
    tenantId: 'tnt-accounting-1',
    code: '1',
    name: 'ACTIVO',
    type: 'Asset',
    typeId: 1,
    nature: 'Debit',
    natureId: 1,
    level: 1,
    allowsMovement: false,
    isSystem: true,
    isActive: true,
    description: 'Total activo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-11',
    tenantId: 'tnt-accounting-1',
    code: '1.1',
    name: 'ACTIVO CORRIENTE',
    type: 'Asset',
    typeId: 1,
    nature: 'Debit',
    natureId: 1,
    level: 2,
    parentAccountId: 'acc-1',
    parentCode: '1',
    allowsMovement: false,
    isSystem: true,
    isActive: true,
    description: 'Activo líquido',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-1101',
    tenantId: 'tnt-accounting-1',
    code: '1.1.01',
    name: 'EFECTIVO Y EQUIVALENTES AL EFECTIVO',
    type: 'Asset',
    typeId: 1,
    nature: 'Debit',
    natureId: 1,
    level: 3,
    parentAccountId: 'acc-11',
    parentCode: '1.1',
    allowsMovement: false,
    isSystem: true,
    isActive: true,
    description: 'Disponibilidades',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-110101',
    tenantId: 'tnt-accounting-1',
    code: '1.1.01.01',
    name: 'Caja General',
    type: 'Asset',
    typeId: 1,
    nature: 'Debit',
    natureId: 1,
    level: 4,
    parentAccountId: 'acc-1101',
    parentCode: '1.1.01',
    allowsMovement: true,
    isSystem: true,
    isActive: true,
    description: 'Fondo operativo de caja',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-2',
    tenantId: 'tnt-accounting-1',
    code: '2',
    name: 'PASIVO',
    type: 'Liability',
    typeId: 2,
    nature: 'Credit',
    natureId: 2,
    level: 1,
    allowsMovement: false,
    isSystem: true,
    isActive: true,
    description: 'Total pasivo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-210101',
    tenantId: 'tnt-accounting-1',
    code: '2.1.01.01',
    name: 'Proveedores Locales',
    type: 'Liability',
    typeId: 2,
    nature: 'Credit',
    natureId: 2,
    level: 4,
    parentCode: '2.1.01',
    allowsMovement: true,
    isSystem: true,
    isActive: true,
    description: 'Cuentas comerciales por pagar',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-5',
    tenantId: 'tnt-accounting-1',
    code: '5',
    name: 'COSTOS Y GASTOS',
    type: 'Expense',
    typeId: 5,
    nature: 'Debit',
    natureId: 1,
    level: 1,
    allowsMovement: false,
    isSystem: true,
    isActive: true,
    description: 'Costos y gastos',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-520301',
    tenantId: 'tnt-accounting-1',
    code: '5.2.03.01',
    name: 'Publicidad, Marketing y Pauta Digital',
    type: 'Expense',
    typeId: 5,
    nature: 'Debit',
    natureId: 1,
    level: 4,
    parentCode: '5.2.03',
    allowsMovement: true,
    isSystem: true,
    isActive: true,
    description: 'Pauta en redes y medios',
    createdAt: new Date().toISOString(),
  },
]

async function mockAccountingSession(page: Page, initialAccounts: AccountDto[] = MOCK_ACCOUNTS) {
  const accounts = [...initialAccounts]

  const permissions = [
    'contabilidad.read',
    'contabilidad.plan.contable.read',
    'contabilidad.plan.contable.manage',
    'contabilidad.cuentas.read',
    'contabilidad.cuentas.manage',
  ]

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-accounting-token',
        expiresAt: '2030-01-01T00:00:00Z',
        userId: 'usr-accounting-1',
        tenantId: 'tnt-accounting-1',
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
          id: 'usr-accounting-1',
          email: 'contador@ecunexo.test',
          name: 'Contador General E2E',
          department: 'Contabilidad',
          phone: '0991114455',
          jobTitle: 'Contador CPA',
          roleIds: ['role-contabilidad'],
        },
        tenant: {
          id: 'tnt-accounting-1',
          name: 'EcuNexo Accounting E2E',
          timeZoneId: 'America/Guayaquil',
          locale: 'es-EC',
          logoUrl: null,
          status: 1,
          servicePlanName: 'Empresa',
          maxUsers: 10,
          maxWarehouses: 5,
          subscriptionMaxTenants: 1,
          enabledModules: ['contabilidad', 'purchases'],
        },
        permissions,
        navigation: [
          {
            id: 'contabilidad',
            label: 'Contabilidad',
            icon: 'calculator',
            children: [
              {
                id: 'contabilidad-plan-contable',
                label: 'Plan Contable',
                route: '/contabilidad/plan-contable',
                children: [],
              },
              {
                id: 'contabilidad-cuentas',
                label: 'Cuentas',
                route: '/contabilidad/cuentas',
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

  await page.route(/\/api\/v1\/tenants\/[^/]+\/accounting\/accounts(\?.*)?$/, async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      const url = new URL(route.request().url())
      let filtered = [...accounts]
      const typeParam = url.searchParams.get('type')
      const allowsMov = url.searchParams.get('allowsMovementOnly')

      if (typeParam) {
        filtered = filtered.filter((a) => a.typeId === Number(typeParam))
      }
      if (allowsMov === 'true') {
        filtered = filtered.filter((a) => a.allowsMovement)
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filtered),
      })
      return
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON()
      const newAcc: AccountDto = {
        id: `acc-${Date.now()}`,
        tenantId: 'tnt-accounting-1',
        code: payload.code,
        name: payload.name,
        type: payload.accountType === 2 ? 'Liability' : 'Asset',
        typeId: payload.accountType || 1,
        nature: 'Debit',
        natureId: 1,
        level: payload.code.split('.').length,
        allowsMovement: payload.allowsMovement ?? true,
        isSystem: false,
        isActive: true,
        description: payload.description,
        createdAt: new Date().toISOString(),
      }
      accounts.push(newAcc)
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newAcc),
      })
      return
    }

    await route.fallback()
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+\/accounting\/accounts\/seed$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(45),
      })
      return
    }
    await route.fallback()
  })

  // Login flow
  await page.goto('/')
  await page.locator('#login-email').fill('contador@ecunexo.test')
  await page.locator('#login-password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('persist:ecunexo-tenant-auth'))))
    .toBeTruthy()
}

test.describe('Módulo Contabilidad — Plan General de Cuentas NIIF / SCVS Ecuador', () => {
  test('Renderiza encabezado, badge oficial Ecuador y strip de StatCards M3', async ({ page }) => {
    await mockAccountingSession(page)
    await page.goto('/contabilidad/plan-contable')
    await expect(page.locator('h1')).toContainText('Plan General de Cuentas', { timeout: 15_000 })

    // Validar Badge con exact: true
    await expect(page.getByText('NIIF / SCVS Ecuador', { exact: true })).toBeVisible()

    // Validar StatCard strip en .ecu-stat-grid
    const statGrid = page.locator('.ecu-stat-grid')
    await expect(statGrid).toBeVisible()
    await expect(statGrid.getByText('Total Cuentas')).toBeVisible()
    await expect(statGrid.getByText('1. Activos')).toBeVisible()
    await expect(statGrid.getByText('2. Pasivos')).toBeVisible()
    await expect(statGrid.getByText('5. Costos y Gastos')).toBeVisible()
    await expect(statGrid.getByText('Imputables')).toBeVisible()
  })

  test('Muestra árbol de cuentas jerárquico con formato y naturaleza en el DataGrid', async ({ page }) => {
    await mockAccountingSession(page)
    await page.goto('/contabilidad/plan-contable')
    await expect(page.locator('h1')).toContainText('Plan General de Cuentas', { timeout: 15_000 })

    // Esperar a que cargue el DataGrid
    await expect(page.getByText('1.1.01.01')).toBeVisible()
    await expect(page.getByText('Caja General')).toBeVisible()
    await expect(page.getByText('2.1.01.01')).toBeVisible()
    await expect(page.getByText('Proveedores Locales')).toBeVisible()
    await expect(page.getByText('Publicidad, Marketing y Pauta Digital')).toBeVisible()

    // Badges de naturaleza
    await expect(page.getByText('Deudora (Debe)').first()).toBeVisible()
    await expect(page.getByText('Acreedora (Haber)').first()).toBeVisible()
  })

  test('Abre modal para crear nueva cuenta contable y valida campos', async ({ page }) => {
    await mockAccountingSession(page)
    await page.goto('/contabilidad/plan-contable')
    await expect(page.locator('h1')).toContainText('Plan General de Cuentas', { timeout: 15_000 })

    // Clic en "Nueva Cuenta"
    const newBtn = page.getByRole('button', { name: /Nueva Cuenta/i })
    await expect(newBtn).toBeVisible()
    await newBtn.click()

    // Validar que se abrió el Popup
    await expect(page.getByText('Nueva Cuenta Contable')).toBeVisible()

    // Ingresar código y nombre
    const codeInput = page.locator('input[placeholder*="1.1.01.05"]')
    await codeInput.fill('1.1.01.99')

    const nameInput = page.locator('input[placeholder*="Caja Moneda Extranjera"]')
    await nameInput.fill('Caja Operativa Aeropuerto')

    // Guardar
    await page.getByRole('button', { name: 'Crear Cuenta' }).click()

    // Validar toast de éxito
    await expect(page.getByText('La cuenta contable se registró en el catálogo.')).toBeVisible()
  })

  test('Permite sembrar el catálogo estándar SCVS Ecuador cuando está vacío', async ({ page }) => {
    await mockAccountingSession(page, [])
    await page.goto('/contabilidad/plan-contable')
    await expect(page.locator('h1')).toContainText('Plan General de Cuentas', { timeout: 15_000 })

    // Validar estado vacío
    await expect(page.getByText('Plan de cuentas sin inicializar')).toBeVisible()

    // Botón sembrar catálogo oficial
    const seedBtn = page.getByRole('button', { name: /Sembrar Catálogo Estándar SCVS/i })
    await expect(seedBtn).toBeVisible()
    await seedBtn.click()

    // Validar confirmación
    await expect(page.getByText(/Se inicializaron 45 cuentas según catálogo oficial/i)).toBeVisible()
  })
})

import { expect, test, type Page } from '@playwright/test'
import { selectGluOption } from '../helpers/gluSelect'
import type { AccountDto } from '../../src/types/accountingApi'
import type { JournalEntrySummaryDto, ListJournalEntriesResponse } from '../../src/types/journalEntriesApi'

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
    id: 'acc-410101',
    tenantId: 'tnt-accounting-1',
    code: '4.1.01.01',
    name: 'Ventas de Mercaderías',
    type: 'Revenue',
    typeId: 4,
    nature: 'Credit',
    natureId: 2,
    level: 4,
    allowsMovement: true,
    isSystem: true,
    isActive: true,
    description: 'Ingresos operacionales',
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

const MOCK_JOURNAL_ENTRIES: JournalEntrySummaryDto[] = [
  {
    id: 'entry-1',
    tenantId: 'tnt-accounting-1',
    entryNumber: 'AS-2026-000001',
    date: '2026-09-13',
    description: 'Liquidación de compra 001-002-000000045 - Juan Artesano',
    status: 'Posted',
    source: 'PurchaseSettlement',
    sourceId: 'settlement-45',
    sourceReference: '001-002-000000045',
    totalDebit: 345.0,
    totalCredit: 345.0,
    isBalanced: true,
    linesCount: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'entry-2',
    tenantId: 'tnt-accounting-1',
    entryNumber: 'AS-2026-000002',
    date: '2026-09-13',
    description: 'Apertura de caja operativa y banco',
    status: 'Posted',
    source: 'Manual',
    sourceId: null,
    sourceReference: null,
    totalDebit: 1500.0,
    totalCredit: 1500.0,
    isBalanced: true,
    linesCount: 2,
    createdAt: new Date().toISOString(),
  },
]

async function mockAccountingSession(
  page: Page,
  initialAccounts: AccountDto[] = MOCK_ACCOUNTS,
  initialEntries: JournalEntrySummaryDto[] = MOCK_JOURNAL_ENTRIES
) {
  const accounts = [...initialAccounts]
  const entries = [...initialEntries]

  const permissions = [
    'contabilidad.read',
    'contabilidad.asientos.read',
    'contabilidad.asientos.manage',
    'contabilidad.plan.contable.read',
    'contabilidad.plan.contable.manage',
    'contabilidad.cuentas.read',
    'contabilidad.cuentas.manage',
    'contabilidad.balances.read',
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
                id: 'contabilidad-asientos',
                label: 'Asientos',
                route: '/contabilidad/asientos',
                children: [],
              },
              {
                id: 'contabilidad-plan-contable',
                label: 'Plan Contable',
                route: '/contabilidad/plan-contable',
                children: [],
              },
              {
                id: 'contabilidad-balances',
                label: 'Balances',
                route: '/contabilidad/balances',
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

  // Mock Journal Entries
  await page.route(/\/api\/v1\/tenants\/[^/]+\/accounting\/journal-entries(\?.*)?$/, async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      const postedCount = entries.filter((e) => e.status === 'Posted' || e.status === 2).length
      const draftCount = entries.filter((e) => e.status === 'Draft' || e.status === 1).length
      const debitVol = entries.reduce((acc, curr) => acc + curr.totalDebit, 0)

      const response: ListJournalEntriesResponse = {
        kpis: {
          totalEntries: entries.length,
          totalPosted: postedCount,
          totalDraft: draftCount,
          totalDebitVolume: debitVol,
        },
        entries,
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
      return
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON()
      const totalDebit = payload.lines.reduce((acc: number, l: { debit: number }) => acc + l.debit, 0)
      const totalCredit = payload.lines.reduce((acc: number, l: { credit: number }) => acc + l.credit, 0)

      const newEntry: JournalEntrySummaryDto = {
        id: `entry-${Date.now()}`,
        tenantId: 'tnt-accounting-1',
        entryNumber: `AS-2026-00000${entries.length + 1}`,
        date: payload.date,
        description: payload.description,
        status: payload.autoPost ? 'Posted' : 'Draft',
        source: 'Manual',
        sourceId: null,
        sourceReference: null,
        totalDebit,
        totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        linesCount: payload.lines.length,
        createdAt: new Date().toISOString(),
      }

      entries.push(newEntry)

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newEntry),
      })
      return
    }

    await route.fallback()
  })

  // Mock Tax Declarations (F104, F103, Conciliación SAS)
  await page.route(/\/api\/v1\/tenants\/[^/]+\/accounting\/tax-declarations\/monthly(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tnt-accounting-1',
        year: 2026,
        month: 9,
        periodName: 'Septiembre 2026',
        formulario104: {
          ventas: {
            casillero401BaseGravada: 5000.0,
            casillero411IvaGenerado: 750.0,
            casillero403BaseTarifaCero: 0,
            casillero429TotalVentas: 5000.0,
            casillero499TotalImpuestoGenerado: 750.0,
          },
          compras: {
            casillero500BaseGravada: 2000.0,
            casillero510IvaPagado: 300.0,
            casillero507BaseTarifaCero: 0,
            casillero529TotalAdquisiciones: 2000.0,
            casillero564FactorProporcionalidad: 1.0,
            casillero569CreditoTributarioAplicable: 300.0,
          },
          liquidacion: {
            casillero601ImpuestoCausado: 450.0,
            casillero609RetencionesIvaRecibidas: 0,
            casillero615CreditoTributarioMesSiguiente: 0,
            saldoNetoAPagar: 450.0,
            generaImpuestoAPagar: true,
          },
        },
        formulario103: {
          lineas: [
            {
              codigoRetencion: '312',
              descripcion: 'Transferencia de bienes muebles de naturaleza corporal (1.75%)',
              porcentaje: 1.75,
              baseImponible: 1000.0,
              montoRetenido: 17.5,
            },
            {
              codigoRetencion: '343',
              descripcion: 'Liquidaciones de compra a personas naturales sin RUC (1%)',
              porcentaje: 1.0,
              baseImponible: 500.0,
              montoRetenido: 5.0,
            },
          ],
          totalBaseImponible: 1500.0,
          totalRetenidoAPagar: 22.5,
        },
        conciliacion: {
          totalFacturasCompra: 5,
          totalLiquidacionesCompra: 1,
          totalAsientosContabilizados: 12,
          totalVentasNetas: 5000.0,
          totalComprasNetas: 2000.0,
          margenBrutoOperativo: 3000.0,
          flujoTributarioNetoEstimado: 472.5,
          todoCuadradoNIIF: true,
        },
      }),
    })
  })

  // Mock Financial Statements NIIF (Balance General y Estado de Resultados)
  await page.route(/\/api\/v1\/tenants\/[^/]+\/accounting\/financial-statements(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: 'tnt-accounting-1',
        year: 2026,
        month: 9,
        periodName: 'Septiembre 2026',
        cutoffDate: '30/09/2026',
        balanceGeneral: {
          activoCorriente: [
            {
              groupCode: '1.1.01',
              groupName: 'Efectivo y Equivalentes de Efectivo',
              total: 5200.0,
              accounts: [
                {
                  code: '1.1.01.01',
                  name: 'Caja General',
                  level: 4,
                  balance: 1500.0,
                  nature: 'Debit',
                },
                {
                  code: '1.1.01.02',
                  name: 'Bancos e Instituciones Financieras',
                  level: 4,
                  balance: 3700.0,
                  nature: 'Debit',
                },
              ],
            },
            {
              groupCode: '1.1.03',
              groupName: 'Inventarios / Mercaderías',
              total: 8000.0,
              accounts: [],
            },
          ],
          totalActivoCorriente: 13200.0,
          activoNoCorriente: [],
          totalActivoNoCorriente: 0.0,
          totalActivos: 13200.0,
          pasivoCorriente: [
            {
              groupCode: '2.1.01',
              groupName: 'Cuentas y Documentos por Pagar Locales',
              total: 2500.0,
              accounts: [],
            },
          ],
          totalPasivoCorriente: 2500.0,
          pasivoNoCorriente: [],
          totalPasivoNoCorriente: 0.0,
          totalPasivos: 2500.0,
          patrimonio: [
            {
              groupCode: '3.1.01',
              groupName: 'Capital Social Suscrito y Pagado',
              total: 8000.0,
              accounts: [],
            },
          ],
          totalPatrimonioSinUtilidad: 8000.0,
          utilidadDelEjercicio: 2700.0,
          totalPatrimonioNeto: 10700.0,
          totalPasivoYPatrimonio: 13200.0,
          diferenciaCuadre: 0.0,
          estaEquilibrado: true,
        },
        estadoResultados: {
          ventasNetasTarifa15: 5000.0,
          ventasNetasTarifa0: 0.0,
          totalIngresosOperacionales: 5000.0,
          costoDeVentas: 1000.0,
          utilidadBruta: 4000.0,
          gastosAdministracion: 400.0,
          gastosVentasYMarketing: 0.0,
          totalGastosOperacionales: 400.0,
          utilidadOperativa: 3600.0,
          participacionTrabajadores15: 540.0,
          utilidadAntesDeImpuestos: 3060.0,
          impuestoRentaEstimado25: 765.0,
          utilidadNetaEjercicio: 2295.0,
          desgloseGastos: [],
        },
      }),
    })
  })

  // Login flow
  await page.goto('/')
  await page.locator('#login-email').fill('contador@ecunexo.test')
  await page.locator('#login-password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
}

async function openChartOfAccounts(page: Page) {
  const contabilidadBtn = page.getByRole('button', { name: /^Contabilidad$/i })
  if (await contabilidadBtn.isVisible()) {
    await contabilidadBtn.click()
  }
  const planBtn = page.getByRole('button', { name: /Plan Contable/i })
  if (await planBtn.isVisible()) {
    await planBtn.click()
  } else {
    await page.goto('/contabilidad/plan-contable')
  }
  await expect(page.locator('h1')).toContainText('Plan General de Cuentas', { timeout: 20_000 })
}

async function openJournalEntries(page: Page) {
  const contabilidadBtn = page.getByRole('button', { name: /^Contabilidad$/i })
  if (await contabilidadBtn.isVisible()) {
    await contabilidadBtn.click()
  }
  const asientosBtn = page.getByRole('button', { name: /Asientos/i })
  if (await asientosBtn.isVisible()) {
    await asientosBtn.click()
  } else {
    await page.goto('/contabilidad/asientos')
  }
  await expect(page.locator('h1')).toContainText('Libro Diario', { timeout: 20_000 })
}

test.describe('Módulo Contabilidad — Plan General de Cuentas NIIF / SCVS Ecuador', () => {
  test('Renderiza encabezado, badge oficial Ecuador y strip de StatCards M3', async ({ page }) => {
    await mockAccountingSession(page)
    await openChartOfAccounts(page)

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
    await openChartOfAccounts(page)

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
    await openChartOfAccounts(page)

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
    await openChartOfAccounts(page)

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

test.describe('Módulo Contabilidad — Libro Diario y Asientos Contables NIIF', () => {
  test('Renderiza Libro Diario con KPIs de volumen y listado de asientos contables', async ({ page }) => {
    await mockAccountingSession(page)
    await openJournalEntries(page)

    // Validar encabezado y badge
    await expect(page.getByText('NIIF / SCVS Ecuador', { exact: true })).toBeVisible()

    // Validar StatCard strip
    const statGrid = page.locator('.ecu-stat-grid')
    await expect(statGrid).toBeVisible()
    await expect(statGrid.getByText('Total Asientos')).toBeVisible()
    await expect(statGrid.getByText('Contabilizados')).toBeVisible()
    await expect(statGrid.getByText('En Borrador')).toBeVisible()
    await expect(statGrid.getByText('Volumen Contabilizado')).toBeVisible()

    // Validar tabla de asientos registrados
    await expect(page.getByText('AS-2026-000001')).toBeVisible()
    await expect(page.getByText('Liquidación de compra 001-002-000000045 - Juan Artesano')).toBeVisible()
    await expect(page.getByText('Liquidación Compra (03)')).toBeVisible()
    await expect(page.getByText('Cuadrado').first()).toBeVisible()
    await expect(page.getByText('Contabilizado').first()).toBeVisible()
  })

  test('Navega a la vista dedicada de Nuevo Asiento (sin modales) y valida partida doble', async ({ page }) => {
    await mockAccountingSession(page)
    await openJournalEntries(page)

    // Clic en "Nuevo Asiento"
    const newBtn = page.getByRole('button', { name: /Nuevo Asiento/i })
    await expect(newBtn).toBeVisible()
    await newBtn.click()

    // Validar que se encuentra en la URL dedicada /contabilidad/asientos/nuevo (Skill ui-vistas-sobre-modales)
    await expect(page).toHaveURL(/.*\/contabilidad\/asientos\/nuevo/)
    await expect(page.locator('h1')).toContainText('Nuevo Asiento Contable', { timeout: 15_000 })
    await expect(page.getByText('Partida Doble NIIF', { exact: true })).toBeVisible()

    // Llenar glosa general
    const glosaInput = page.locator('input[placeholder*="Ej: Registro de pago"]')
    await glosaInput.fill('Venta y cobro de mercadería local en efectivo')

    // Seleccionar cuenta para línea 1 (Caja General - Debe $500) usando el helper gluSelect
    await selectGluOption(page, 'entry-line-account-0', /Caja General/i)
    await page.locator('#entry-line-debit-0').fill('500.00')

    // Seleccionar cuenta para línea 2 (Ventas - Haber $500)
    await selectGluOption(page, 'entry-line-account-1', /Ventas de Mercaderías/i)
    await page.locator('#entry-line-credit-1').fill('500.00')

    // Validar mensaje de cuadre de partida doble
    await expect(page.getByText(/Partida Doble Cuadrada/i)).toBeVisible()

    // Enviar y contabilizar
    const saveBtn = page.getByRole('button', { name: /Contabilizar Asiento/i })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Validar redirección y confirmación
    await expect(page).toHaveURL(/.*\/contabilidad\/asientos/)
    await expect(page.getByText('Asiento contable registrado')).toBeVisible()
  })
})

test.describe('Módulo Contabilidad — Pre-declaración SRI F104 / F103 y Conciliación S.A.S.', () => {
  test('Renderiza pantalla de pre-declaración con selector de período, KPIs y pestañas interactivas', async ({ page }) => {
    await mockAccountingSession(page)
    await page.goto('/contabilidad/declaraciones')

    // Validar encabezado y badge
    await expect(page.locator('h1')).toContainText('Pre-Declaración Tributaria y Cierre Fiscal', { timeout: 20_000 })
    await expect(page.getByText('SRI F104 & F103', { exact: true })).toBeVisible()

    // Validar StatCard strip
    const statGrid = page.locator('.ecu-stat-grid')
    await expect(statGrid).toBeVisible()
    await expect(statGrid.getByText('IVA Cobrado en Ventas')).toBeVisible()
    await expect(statGrid.getByText(/\$750/)).toBeVisible()
    await expect(statGrid.getByText('IVA Compras Soportado')).toBeVisible()
    await expect(statGrid.getByText(/\$300/)).toBeVisible()
    await expect(statGrid.getByText('Retenciones en Fuente IR')).toBeVisible()
    await expect(statGrid.getByText(/\$22/)).toBeVisible()
    await expect(statGrid.getByText('Saldo IVA a Pagar')).toBeVisible()
    await expect(statGrid.getByText(/\$450/)).toBeVisible()

    // Validar casilleros del Formulario 104 (activo por defecto)
    await expect(page.locator('table').getByText('401').first()).toBeVisible()
    await expect(page.locator('table').getByText('411').first()).toBeVisible()
    await expect(page.locator('table').getByText('500').first()).toBeVisible()
    await expect(page.locator('table').getByText('510').first()).toBeVisible()
    await expect(page.getByText(/Casillero 601/i)).toBeVisible()

    // Cambiar a pestaña F103
    await page.getByRole('button', { name: /Formulario 103/i }).click()
    await expect(page.locator('table').getByText('312').first()).toBeVisible()
    await expect(page.locator('table').getByText('343').first()).toBeVisible()
    await expect(page.getByText(/Liquidaciones de compra/i).first()).toBeVisible()

    // Cambiar a pestaña Conciliación S.A.S.
    await page.getByRole('button', { name: /Conciliación S\.A\.S\./i }).click()
    await expect(page.getByText('Ajuste de Cuentas Integral para la Contadora')).toBeVisible()
    await expect(page.getByText('Libro Diario 100% Cuadrado y Conciliado bajo NIIF')).toBeVisible()
  })
})

test.describe('Módulo Contabilidad — Estados Financieros NIIF & Balances S.A.S.', () => {
  test('Renderiza pantalla de balances con selector de período, StatCards y ecuación contable cuadrada', async ({ page }) => {
    await mockAccountingSession(page)
    await page.goto('/contabilidad/balances')

    // Validar encabezado y badge
    await expect(page.locator('h1')).toContainText('Estados Financieros NIIF & Balances S.A.S.', { timeout: 20_000 })
    await expect(page.getByText('NIIF PYMES / SCVS Ecuador', { exact: true })).toBeVisible()

    // Validar StatCard strip en .ecu-stat-grid
    const statGrid = page.locator('.ecu-stat-grid')
    await expect(statGrid).toBeVisible()
    await expect(statGrid.getByText('Total Activos (Inversión)')).toBeVisible()
    await expect(statGrid.getByText(/\$13[.,]200/)).toBeVisible()
    await expect(statGrid.getByText('Total Pasivos (Obligaciones)')).toBeVisible()
    await expect(statGrid.getByText(/\$2[.,]500/)).toBeVisible()
    await expect(statGrid.getByText('Patrimonio Neto')).toBeVisible()
    await expect(statGrid.getByText(/\$10[.,]700/)).toBeVisible()

    // Validar Banner de Ecuación Fundamental NIIF Cuadrada
    await expect(page.getByText(/Ecuación Fundamental NIIF Cuadrada/i)).toBeVisible()
    await expect(page.getByText(/Total Activo .* coincide con Total Pasivo \+ Patrimonio/i)).toBeVisible()

    // Validar secciones de Balance General
    await expect(page.getByText('1. ACTIVOS')).toBeVisible()
    await expect(page.getByText('1.1 Activo Corriente')).toBeVisible()
    await expect(page.getByText('Efectivo y Equivalentes de Efectivo')).toBeVisible()
    await expect(page.getByText('2. PASIVOS')).toBeVisible()
    await expect(page.getByText('3. PATRIMONIO NETO')).toBeVisible()
    await expect(page.getByText('TOTAL PASIVO Y PATRIMONIO')).toBeVisible()

    // Cambiar a pestaña Estado de Resultados Integral (P&G)
    await page.getByRole('button', { name: /Estado de Resultados Integral/i }).click()

    // Validar P&G
    await expect(page.getByText('(+) INGRESOS DE ACTIVIDADES ORDINARIAS')).toBeVisible()
    await expect(page.getByText('(=) UTILIDAD BRUTA EN VENTAS')).toBeVisible()
    await expect(page.getByText('(=) UTILIDAD OPERACIONAL (EBITDA)')).toBeVisible()
    await expect(page.getByText('(-) 15% Participación de Trabajadores (Art. 97 C.T. Ecuador)')).toBeVisible()
    await expect(page.getByText('(-) 25% Provisión Impuesto a la Renta Sociedades (SRI)')).toBeVisible()
    await expect(page.getByText('(=) UTILIDAD NETA DEL EJERCICIO')).toBeVisible()
  })
})



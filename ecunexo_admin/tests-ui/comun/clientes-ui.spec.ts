import { expect, test, type Page } from '@playwright/test'

type MockCustomer = {
  id: string
  name: string
  taxId: string | null
  customerType: number
  identificationType: number
  contactEmail: string | null
  contactPhone: string | null
  contactPerson: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
}

type MockCustomerType = {
  id: string
  code: number
  name: string
  shortLabel: string
  tone: string
  sortOrder: number
  isSystem: boolean
  isActive: boolean
}

const SYSTEM_TYPES: MockCustomerType[] = [
  {
    id: 'ctype-1',
    code: 1,
    name: 'Corporativo B2B / Fabricante',
    shortLabel: 'Corporativo B2B',
    tone: 'primary',
    sortOrder: 1,
    isSystem: true,
    isActive: true,
  },
  {
    id: 'ctype-2',
    code: 2,
    name: 'Persona Natural / Particular',
    shortLabel: 'Persona Natural',
    tone: 'success',
    sortOrder: 2,
    isSystem: true,
    isActive: true,
  },
  {
    id: 'ctype-100',
    code: 100,
    name: 'Retail / Cadena',
    shortLabel: 'Retail',
    tone: 'info',
    sortOrder: 100,
    isSystem: false,
    isActive: true,
  },
]

async function mockCustomerSession(
  page: Page,
  opts: { canManage: boolean }
): Promise<{ customers: MockCustomer[]; types: MockCustomerType[] }> {
  const customers: MockCustomer[] = [
    {
      id: 'cust-001',
      name: 'Whirlpool del Ecuador S.A.',
      taxId: '1790012345001',
      customerType: 1,
      identificationType: 1,
      contactEmail: 'servicio@whirlpool.ec',
      contactPhone: '042999888',
      contactPerson: 'Ing. Carlos Mendoza',
      address: 'Av. Juan Tanca Marengo Km 4.5',
      notes: 'Contrato corporativo oficial',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ]
  const types: MockCustomerType[] = SYSTEM_TYPES.map((t) => ({ ...t }))

  const permissions = opts.canManage
    ? ['customers.read', 'customers.manage']
    : ['customers.read']

  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-customers-token',
        expiresAt: '2030-01-01T00:00:00Z',
        userId: 'usr-cust-1',
        tenantId: 'tnt-cust-1',
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
          id: 'usr-cust-1',
          email: 'clientes@ecunexo.test',
          name: 'Operador Comercial E2E',
          department: 'Comercial',
          phone: '0991112233',
          jobTitle: 'Analista',
          roleIds: ['role-comercial'],
        },
        tenant: {
          id: 'tnt-cust-1',
          name: 'Comercial E2E',
          timeZoneId: 'America/Guayaquil',
          locale: 'es-EC',
          logoUrl: null,
          status: 1,
          servicePlanName: 'Independiente',
          maxUsers: 5,
          maxWarehouses: 2,
          subscriptionMaxTenants: 1,
          enabledModules: ['customers'],
        },
        permissions,
        navigation: [
          {
            id: 'customers',
            label: 'Clientes',
            icon: 'users',
            children: [
              {
                id: 'customers-directory',
                label: 'Directorio de Clientes',
                route: '/clientes',
                children: [],
              },
              {
                id: 'customers-types',
                label: 'Tipos de cliente',
                route: '/clientes/tipos',
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

  await page.route(/\/api\/v1\/tenants\/[^/]+\/customers\/types(\/[^/?]+)?(\?.*)?$/, async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(types),
      })
      return
    }

    if (!opts.canManage) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Forbidden"}' })
      return
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON()
      const created: MockCustomerType = {
        id: `ctype-${Date.now()}`,
        code: 100 + types.filter((t) => !t.isSystem).length + 1,
        name: body.name,
        shortLabel: body.shortLabel || body.name,
        tone: body.tone || 'primary',
        sortOrder: body.sortOrder ?? 100,
        isSystem: false,
        isActive: true,
      }
      types.push(created)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      })
      return
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON()
      const type = types.find((t) => url.includes(t.id))
      if (type) {
        Object.assign(type, {
          name: body.name ?? type.name,
          shortLabel: body.shortLabel ?? type.shortLabel,
          tone: body.tone ?? type.tone,
          sortOrder: body.sortOrder ?? type.sortOrder,
          isActive: body.isActive ?? type.isActive,
        })
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(type || {}),
      })
      return
    }

    if (method === 'DELETE') {
      const idx = types.findIndex((t) => url.includes(t.id) && !t.isSystem)
      if (idx >= 0) types.splice(idx, 1)
      await route.fulfill({ status: 204, body: '' })
      return
    }

    await route.fulfill({ status: 405, body: '' })
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+\/customers\/(?!types)[^/?]+/, async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (!opts.canManage && (method === 'PUT' || method === 'PATCH' || method === 'POST')) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Forbidden"}' })
      return
    }

    if (url.includes('/status') && method === 'PATCH') {
      const body = route.request().postDataJSON()
      const cust = customers.find((c) => url.includes(c.id))
      if (cust) cust.isActive = Boolean(body.isActive)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cust || {}),
      })
      return
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON()
      const cust = customers.find((c) => url.includes(c.id))
      if (cust) Object.assign(cust, body)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cust || {}),
      })
      return
    }

    if (method === 'GET') {
      const cust = customers.find((c) => url.includes(c.id))
      if (cust) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(cust),
        })
        return
      }
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not found"}' })
  })

  await page.route(/\/api\/v1\/tenants\/[^/]+\/customers(\?.*)?$/, async (route) => {
    const method = route.request().method()

    if (method === 'POST') {
      if (!opts.canManage) {
        await route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Forbidden"}' })
        return
      }
      const body = route.request().postDataJSON()
      const created: MockCustomer = {
        id: `cust-${Date.now()}`,
        name: body.name,
        taxId: body.taxId || null,
        customerType: body.customerType ?? 1,
        identificationType: body.identificationType ?? 1,
        contactPerson: body.contactPerson || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
        address: body.address || null,
        notes: body.notes || null,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      customers.push(created)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(created),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(customers),
    })
  })

  await page.goto('/')
  await page.locator('#login-email').fill('clientes@ecunexo.test')
  await page.locator('#login-password').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('persist:ecunexo-tenant-auth'))))
    .toBeTruthy()

  return { customers, types }
}

async function openDirectory(page: Page) {
  await page.getByRole('button', { name: /^Clientes$/i }).click()
  await page.getByRole('button', { name: /Directorio de Clientes/i }).click()
  await expect(page.getByRole('heading', { name: /Directorio de Clientes/i })).toBeVisible({
    timeout: 15_000,
  })
  const emptyFiltered = page.getByRole('heading', {
    name: /No se encontraron clientes con los filtros seleccionados/i,
  })
  if (await emptyFiltered.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Ver Todos los Clientes/i }).click()
  }
}

async function openCustomerTypes(page: Page) {
  await page.getByRole('button', { name: /^Clientes$/i }).click()
  await page.getByRole('button', { name: /Tipos de cliente/i }).click()
  await expect(page.getByRole('heading', { name: /Tipos de Cliente/i })).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('Módulo Clientes UI', () => {
  test.describe('Con customers.manage', () => {
    test.beforeEach(async ({ page }) => {
      await mockCustomerSession(page, { canManage: true })
    })

    test('Directorio: editar ficha de cliente existente', async ({ page }) => {
      test.setTimeout(60_000)
      await openDirectory(page)
      await expect(page.getByRole('button', { name: /Nuevo Cliente/i })).toBeVisible()
      await expect(page.getByText('Whirlpool del Ecuador S.A.').first()).toBeVisible({
        timeout: 10_000,
      })

      await page.getByRole('button', { name: /Editar cliente/i }).first().click()
      await expect(page.getByRole('heading', { name: /Editar Ficha de Cliente/i })).toBeVisible()

      await page.locator('#customer-name').fill('Whirlpool Ecuador Actualizado S.A.')
      await page.locator('#customer-person').fill('Lic. Ana Torres')
      // Asegurar validaciones SRI/contacto válidas para habilitar Guardar
      await page.locator('#customer-tax-id').fill('1790010937001')
      await page.locator('#customer-email').fill('servicio@whirlpool.ec')
      await page.locator('#customer-phone').fill('0998765432')

      const saveBtn = page.getByRole('button', { name: /Guardar Cambios/i })
      await expect(saveBtn).toBeEnabled({ timeout: 10_000 })
      await saveBtn.click()
      await expect(page.getByText('Whirlpool Ecuador Actualizado S.A.').first()).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.getByText('Lic. Ana Torres').first()).toBeVisible()
    })

    test('Tipos: listar, crear tipo personalizado y reflejarlo en el directorio', async ({ page }) => {
      await openCustomerTypes(page)
      await expect(page.getByLabel('Resumen de tipos de cliente')).toBeVisible()
      await expect(page.getByText('Corporativo B2B / Fabricante').first()).toBeVisible()
      await expect(page.getByText('Retail / Cadena').first()).toBeVisible()

      await page.getByRole('button', { name: /Nuevo Tipo/i }).click()
      await expect(page.getByRole('heading', { name: /Nuevo tipo de cliente/i })).toBeVisible()

      const createBtn = page.getByRole('button', { name: /Crear tipo/i })
      await expect(createBtn).toBeDisabled()

      await page.locator('#customer-type-name').fill('Hospitalidad / Hoteles')
      await page.locator('#customer-type-short').fill('Hoteles')
      await page.locator('#customer-type-sort').fill('110')
      await expect(createBtn).toBeEnabled()
      await createBtn.click()

      await expect(page.getByText('Hospitalidad / Hoteles').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('Hoteles').first()).toBeVisible()

      await openDirectory(page)
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click()
      await page.locator('#customer-type-select').click()
      await expect(page.getByRole('option', { name: /Hospitalidad \/ Hoteles/i })).toBeVisible()
    })
  })

  test.describe('Solo customers.read', () => {
    test.beforeEach(async ({ page }) => {
      await mockCustomerSession(page, { canManage: false })
    })

    test('Directorio: consulta permitida sin acciones de edición', async ({ page }) => {
      await openDirectory(page)
      await expect(page.getByText('Whirlpool del Ecuador S.A.').first()).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.getByRole('button', { name: /Nuevo Cliente/i })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Editar cliente/i })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Desactivar cliente|Activar cliente/i })).toHaveCount(0)
    })

    test('Tipos: listado visible sin crear ni eliminar', async ({ page }) => {
      await openCustomerTypes(page)
      await expect(page.getByText('Corporativo B2B / Fabricante').first()).toBeVisible()
      await expect(page.getByRole('button', { name: /Nuevo Tipo/i })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Editar tipo/i })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Eliminar tipo/i })).toHaveCount(0)
    })
  })
})

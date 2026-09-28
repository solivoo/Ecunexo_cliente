import { expect, test, type Page } from '@playwright/test'

const API = process.env.E2E_API_URL?.trim() || 'http://localhost:5088'
const ADMIN = process.env.E2E_ADMIN_URL?.trim() || 'http://localhost:5193'
const TENANT = process.env.E2E_TENANT_ID?.trim() || '01a082f0-b204-7aae-b7d5-ede5dd9a477a'
const USER = process.env.E2E_USER_ID?.trim() || '01a082f0-b20f-7c04-a635-a3a9892a72c9'

const EMITTER_RUC = '0993397804001'
const SKU = 'CLA001'
const SKU_NAME = 'Calcetín Clásicas'
const DESC10 = 'DESC10'
const MAYORISTA_CUSTOMER_NAME = 'Cliente Mayorista Demo'
const MAYORISTA_TAX_ID = '1790012345001'
const CONSUMIDOR_FINAL_ID = '9999999999999'

const EMIT_PROFILE_KEY = `ecunexo.billing.emitProfile.${TENANT}`

type TokenBundle = { token: string; session: Record<string, unknown> }

let bundle: TokenBundle
let publicoListId = ''
let mayoristaListId = ''
let claItemId = ''

const tenantHeaders = () => ({
  Authorization: `Bearer ${bundle.token}`,
  'X-EcuNexo-User-Id': USER,
  'X-EcuNexo-Tenant-Id': TENANT,
})

async function tenantApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api/v1/tenants/${TENANT}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...tenantHeaders(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${res.status}`)
  return (await res.json()) as T
}

async function billingApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ADMIN}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': TENANT,
      'X-User-Id': USER,
      'X-Invoice-Read-Scope': 'all',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`billing ${init?.method ?? 'GET'} ${path} -> ${res.status}`)
  return (await res.json()) as T
}

async function billingAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${ADMIN}/api/v1/emitters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT, 'X-User-Id': USER },
      body: JSON.stringify({
        ruc: EMITTER_RUC,
        businessName: 'EVERCHIC',
        mainAddress: 'GUAYAQUIL',
        tradeName: 'EVERCHIC',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function newestInvoice(
  emitterId: string,
  identification: string,
  minCreatedAt: string
): Promise<{ invoiceId: string; grandTotal: number; sequential: string } | null> {
  const list = await billingApi<{
    items: {
      invoiceId: string
      counterpartyIdentification: string
      grandTotal: number
      sequential: string
      createdAt: string
      documentType: string
    }[]
  }>(`/emitters/${emitterId}/invoices?page=1&pageSize=20`)
  const minTime = new Date(minCreatedAt).getTime()
  const match = list.items.find(
    (i) =>
      i.counterpartyIdentification === identification &&
      i.documentType === '01' &&
      new Date(i.createdAt).getTime() >= minTime
  )
  return match
    ? { invoiceId: match.invoiceId, grandTotal: match.grandTotal, sequential: match.sequential }
    : null
}

function buildPersistedBag(): Record<string, string> {
  const session = bundle.session as {
    user?: { email?: string; name?: string }
    tenant?: unknown
    permissions?: unknown
    navigation?: unknown
    settings?: unknown
  }
  return {
    accessToken: JSON.stringify(bundle.token),
    tenantId: JSON.stringify(TENANT),
    userId: JSON.stringify(USER),
    userEmail: JSON.stringify(session.user?.email ?? ''),
    userName: JSON.stringify(session.user?.name ?? ''),
    isSubscriptionHolder: JSON.stringify(false),
    subscription: JSON.stringify(null),
    tenant: JSON.stringify(session.tenant ?? {}),
    enabledModules: JSON.stringify(null),
    moduleEntitlements: JSON.stringify(null),
    permissions: JSON.stringify(session.permissions ?? []),
    navigation: JSON.stringify(session.navigation ?? []),
    settings: JSON.stringify(session.settings ?? {}),
    holderResume: JSON.stringify(null),
    _persist: JSON.stringify({ version: 5, rehydrated: true }),
  }
}

async function installSession(page: Page): Promise<void> {
  await page.goto(`${ADMIN}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ({ bag, profileKey, bagKey }) => {
      localStorage.setItem(bagKey, JSON.stringify(bag))
      localStorage.setItem(profileKey, 'dev_validate')
    },
    { bag: buildPersistedBag(), profileKey: EMIT_PROFILE_KEY, bagKey: 'persist:ecunexo-tenant-auth' }
  )
}

test.beforeAll(async () => {
  const tokenRes = await fetch(`${API}/api/v1/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: USER, tenantId: TENANT }),
  })
  if (!tokenRes.ok) throw new Error(`dev-token -> ${tokenRes.status}`)
  const token = (await tokenRes.json()).accessToken as string

  const sessionRes = await fetch(`${API}/api/v1/tenants/${TENANT}/session`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EcuNexo-User-Id': USER,
      'X-EcuNexo-Tenant-Id': TENANT,
    },
  })
  bundle = { token, session: (await sessionRes.json()) as Record<string, unknown> }

  const lists = await tenantApi<{ id: string; code: string }[]>(
    '/catalog/pricing/price-lists?onlyActive=true'
  )
  publicoListId = lists.find((l) => l.code === 'PUBLICO')?.id ?? ''
  mayoristaListId = lists.find((l) => l.code === 'MAYORISTA')?.id ?? ''

  const items = await tenantApi<{ id: string; sku?: string }[]>(
    `/catalog/items?search=${encodeURIComponent(SKU)}&includeParents=false`
  )
  claItemId = items.find((i) => i.sku === SKU)?.id ?? ''
})

test.describe('Catálogo / precios / facturación — E2E local', () => {
  test.describe.configure({ mode: 'serial' })

  test('1) Matriz de precios guarda celda PUBLICO sin error 500', async ({ page }) => {
    test.skip(!claItemId, 'No se encontró el SKU replicado CLA001 en local.')
    await installSession(page)
    await page.goto(`${ADMIN}/catalogo/precios/matriz`, { waitUntil: 'networkidle' })

    await expect(page.getByRole('heading', { name: /Matriz de precios/i })).toBeVisible({
      timeout: 30_000,
    })

    const search = page.getByPlaceholder(/Buscar por SKU, nombre o descripción/i).first()
    await search.fill(SKU)
    await page.waitForTimeout(1200)

    const row = page.locator('tbody tr', { hasText: SKU }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const headers = page.locator('thead th')
    const headerCount = await headers.count()
    let publicoIndex = -1
    for (let i = 0; i < headerCount; i += 1) {
      const text = await headers.nth(i).innerText()
      if (text.includes('PUBLICO')) {
        publicoIndex = i
        break
      }
    }
    expect(publicoIndex, 'columna PUBLICO visible en la matriz').toBeGreaterThan(0)

    const cell = row.locator('td').nth(publicoIndex).getByRole('button').first()
    await cell.click()
    const editor = page.locator('[id^="matrix-cell-"]').first()
    await editor.fill('2.01')
    await editor.press('Enter')

    await expect(page.getByText(/Precio guardado/i).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('$2.01').first()).toBeVisible({ timeout: 15_000 })

    const cellAgain = row.locator('td').nth(publicoIndex).getByRole('button').first()
    await cellAgain.click()
    const editor2 = page.locator('[id^="matrix-cell-"]').first()
    await editor2.fill('2.00')
    await editor2.press('Enter')
    await expect(page.getByText('$2.00').first()).toBeVisible({ timeout: 15_000 })

    const resolved = await tenantApi<{ unitPrice: number; appliedRules: string[] }>(
      '/catalog/pricing/resolve',
      {
        method: 'POST',
        body: JSON.stringify({
          catalogItemId: claItemId,
          quantity: 1,
          date: '2026-09-28',
          priceListId: publicoListId,
        }),
      }
    )
    expect(resolved.unitPrice).toBeCloseTo(2.0, 2)
    expect(resolved.appliedRules).toContain(`LISTA_PUBLICO`)
  })

  test('2) Motor de precios: PUBLICO vs MAYORISTA y promoción DESC10', async ({ page }) => {
    test.skip(!claItemId || !mayoristaListId, 'Faltan SKU replicado o lista MAYORISTA.')

    const publico = await tenantApi<{
      unitPrice: number
      discountAmount: number
      finalPrice: number
      appliedRules: string[]
      priceListId: string
    }>('/catalog/pricing/resolve', {
      method: 'POST',
      body: JSON.stringify({ catalogItemId: claItemId, quantity: 1, date: '2026-09-28' }),
    })
    const mayorista = await tenantApi<{
      unitPrice: number
      discountAmount: number
      finalPrice: number
      appliedRules: string[]
      priceListId: string
    }>('/catalog/pricing/resolve', {
      method: 'POST',
      body: JSON.stringify({
        catalogItemId: claItemId,
        quantity: 1,
        date: '2026-09-28',
        priceListId: mayoristaListId,
      }),
    })

    expect(publico.priceListId).toBe(publicoListId)
    expect(mayorista.priceListId).toBe(mayoristaListId)
    expect(publico.unitPrice).toBeCloseTo(2.0, 2)
    expect(mayorista.unitPrice).toBeCloseTo(publico.unitPrice * 0.9, 2)
    expect(publico.appliedRules).toContain(`PROMO_${DESC10}`)
    expect(mayorista.appliedRules).toContain(`PROMO_${DESC10}`)
    expect(publico.discountAmount).toBeCloseTo(0.2, 2)

    await installSession(page)
    await page.goto(`${ADMIN}/catalogo/precios/simulador`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /Simulador de Precios/i })).toBeVisible({
      timeout: 30_000,
    })
  })

  test('3) Factura a Consumidor Final usa lista predeterminada + promoción', async ({ page }) => {
    test.skip(!claItemId, 'No se encontró el SKU replicado CLA001 en local.')
    test.skip(!(await billingAvailable()), 'Billing API (:5203) no disponible; se omite emisión.')

    const before = new Date().toISOString()
    await installSession(page)
    await page.goto(`${ADMIN}/facturacion/facturas/emitir`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /Emitir Factura/i })).toBeVisible({
      timeout: 30_000,
    })

    await page.locator('#inv-id-type').click()
    await page.getByRole('option', { name: 'Consumidor final' }).click()
    await expect(page.locator('#inv-id')).toHaveValue(CONSUMIDOR_FINAL_ID)

    await addProduct(page)

    const unitPrice = await lineNumber(page, 'Precio unitario línea 1')
    const discount = await lineNumber(page, 'Descuento línea 1')
    expect(unitPrice).toBeCloseTo(2.0, 2)
    expect(discount).toBeCloseTo(0.2, 2)

    await page.getByRole('button', { name: 'Validar XML' }).click()
    await expect(page.getByText(/RIDE de esta factura/i)).toBeVisible({ timeout: 60_000 })

    const emitter = await resolveEmitterId()
    await expect
      .poll(async () => (await newestInvoice(emitter, CONSUMIDOR_FINAL_ID, before)) !== null, {
        timeout: 30_000,
        message: 'factura a consumidor final registrada en Billing',
      })
      .toBe(true)
    const invoice = await newestInvoice(emitter, CONSUMIDOR_FINAL_ID, before)

    expect(invoice?.grandTotal).toBeCloseTo(2.07, 2)
  })

  test('4) Factura a Cliente Mayorista Demo usa la lista MAYORISTA', async ({ page }) => {
    test.skip(!claItemId || !mayoristaListId, 'Faltan SKU replicado o lista MAYORISTA.')
    test.skip(!(await billingAvailable()), 'Billing API (:5203) no disponible; se omite emisión.')

    const before = new Date().toISOString()
    await installSession(page)
    await page.goto(`${ADMIN}/facturacion/facturas/emitir`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /Emitir Factura/i })).toBeVisible({
      timeout: 30_000,
    })

    await page.locator('#inv-directory-customer').click()
    await page.getByRole('option', { name: new RegExp(MAYORISTA_CUSTOMER_NAME) }).click()
    await expect(page.locator('#inv-id')).toHaveValue(MAYORISTA_TAX_ID)
    await expect(page.locator('#inv-price-list')).toContainText('MAYORISTA')

    await addProduct(page)

    const unitPrice = await lineNumber(page, 'Precio unitario línea 1')
    const discount = await lineNumber(page, 'Descuento línea 1')
    expect(unitPrice).toBeCloseTo(1.8, 2)
    expect(discount).toBeCloseTo(0.18, 2)

    await page.getByRole('button', { name: 'Validar XML' }).click()
    await expect(page.getByText(/RIDE de esta factura/i)).toBeVisible({ timeout: 60_000 })

    const emitter = await resolveEmitterId()
    await expect
      .poll(async () => (await newestInvoice(emitter, MAYORISTA_TAX_ID, before)) !== null, {
        timeout: 30_000,
        message: 'factura al cliente mayorista registrada en Billing',
      })
      .toBe(true)
    const invoice = await newestInvoice(emitter, MAYORISTA_TAX_ID, before)

    expect(invoice?.grandTotal).toBeCloseTo(1.86, 2)
  })
})

async function addProduct(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ver catálogo y stock' }).first().click()
  const search = page.getByPlaceholder(/Buscar por SKU, nombre, descripción o talla/i).first()
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill(SKU)
  await page.waitForTimeout(1000)

  const checkbox = page.getByRole('checkbox', { name: new RegExp(`Seleccionar ${SKU_NAME}`) }).first()
  await expect(checkbox).toBeEnabled({ timeout: 15_000 })
  await checkbox.check()
  await page.getByRole('button', { name: /Aceptar y agregar \(1\)/ }).click()

  await expect
    .poll(() => lineNumber(page, 'Precio unitario línea 1'), { timeout: 15_000 })
    .toBeGreaterThan(0)
}

async function lineNumber(page: Page, label: string): Promise<number> {
  const input = page.getByLabel(label).first()
  const raw = await input.inputValue()
  return Number(raw.replace(',', '.'))
}

async function resolveEmitterId(): Promise<string> {
  const res = await fetch(`${ADMIN}/api/v1/emitters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT, 'X-User-Id': USER },
    body: JSON.stringify({
      ruc: EMITTER_RUC,
      businessName: 'EVERCHIC',
      mainAddress: 'GUAYAQUIL',
      tradeName: 'EVERCHIC',
    }),
  })
  const data = (await res.json()) as { emitterId: string }
  return data.emitterId
}

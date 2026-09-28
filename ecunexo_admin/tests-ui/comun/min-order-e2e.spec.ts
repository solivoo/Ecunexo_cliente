import { expect, test, type Page } from '@playwright/test'

const API = process.env.E2E_API_URL?.trim() || 'http://localhost:5088'
const ADMIN = process.env.E2E_ADMIN_URL?.trim() || 'http://localhost:5193'
const TENANT = process.env.E2E_TENANT_ID?.trim() || '01a082f0-b204-7aae-b7d5-ede5dd9a477a'
const USER = process.env.E2E_USER_ID?.trim() || '01a082f0-b20f-7c04-a635-a3a9892a72c9'

const MIN_QTY = 4

type TokenBundle = { token: string; session: Record<string, unknown> }

interface StorefrontListItem {
  id: string
  name: string
  price: number | null
  hasVariants: boolean
  inStock: boolean
}

interface StorefrontDetail {
  id: string
  name: string
  price: number | null
  minOrderQuantity?: number
  variants: { id: string; minOrderQuantity?: number }[] | null
}

interface AdminItemDetail {
  id: string
  kind: number
  name: string
  description?: string | null
  sku?: string | null
  basePrice?: number | null
  customAttributesJson?: string | null
  status: number
  familyId?: string | null
  hierarchyPathJson?: string | null
  barcode?: string | null
  minOrderQuantity?: number
}

interface StorefrontSettings {
  paymentMethods: string[]
  shippingMethods: { code: string; cost: number }[]
  bankTransferInstructions?: string | null
  paymentHoldHours: number
  reserveOnOrder: boolean
  contactWhatsapp?: string | null
  ordersNotificationEmail?: string | null
  maxPendingOrders: number
  maintenanceEnabled: boolean
  maintenanceMessage?: string | null
  minOrderAmount: number
}

let bundle: TokenBundle
let item: StorefrontListItem
let initialItemMin = 1
let initialMinOrderAmount = 0

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

async function getAdminItem(): Promise<AdminItemDetail> {
  return tenantApi<AdminItemDetail>(`/catalog/items/${item.id}`)
}

async function publicApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/v1/public/tenants/${TENANT}/storefront${path}`)
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`)
  return (await res.json()) as T
}

interface OrderAttempt {
  status: number
  body: Record<string, unknown>
}

async function createStorefrontOrder(
  quantity: number,
  tag: string
): Promise<OrderAttempt> {
  const requestId = `e2e-min-order-${tag}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const res = await fetch(`${API}/api/v1/public/tenants/${TENANT}/storefront/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId,
      customer: {
        name: 'E2E Compra Mínima',
        email: `${requestId}@example.com`,
        phone: '0999999999',
        taxId: null,
      },
      shipping: { address: 'Calle E2E 123', city: 'Guayaquil', reference: null },
      paymentMethod: 'BankTransfer',
      shippingMethod: 'Courier',
      items: [{ catalogItemId: item.id, quantity }],
      notes: null,
      contactFax: null,
      formElapsedMs: 3000,
      turnstileToken: null,
      acceptPrivacyPolicy: true,
    }),
  })

  const text = await res.text()
  let body: Record<string, unknown> = {}
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    body = { raw: text }
  }
  return { status: res.status, body }
}

async function updateGlobalMinOrderAmount(minOrderAmount: number): Promise<void> {
  const current = await tenantApi<StorefrontSettings>('/ecommerce/storefront/settings')
  await tenantApi('/ecommerce/storefront/settings', {
    method: 'PUT',
    body: JSON.stringify({
      paymentMethods: current.paymentMethods,
      shippingMethods: current.shippingMethods,
      bankTransferInstructions: current.bankTransferInstructions ?? '',
      paymentHoldHours: current.paymentHoldHours,
      reserveOnOrder: current.reserveOnOrder,
      contactWhatsapp: current.contactWhatsapp ?? '',
      ordersNotificationEmail: current.ordersNotificationEmail ?? '',
      maxPendingOrders: current.maxPendingOrders,
      maintenanceEnabled: current.maintenanceEnabled,
      maintenanceMessage: current.maintenanceMessage ?? '',
      minOrderAmount,
    }),
  })
}

async function setItemMinOrderQuantity(minOrderQuantity: number): Promise<void> {
  const detail = await getAdminItem()
  await tenantApi(`/catalog/items/${item.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: detail.name,
      description: detail.description ?? null,
      sku: detail.sku ?? null,
      basePrice: detail.basePrice ?? null,
      customAttributesJson: detail.customAttributesJson ?? null,
      status: detail.status,
      kind: detail.kind,
      familyId: detail.familyId ?? null,
      hierarchyPathJson: detail.hierarchyPathJson ?? null,
      barcode: detail.barcode ?? null,
      minOrderQuantity,
    }),
  })
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
    ({ bag, bagKey }) => {
      localStorage.setItem(bagKey, JSON.stringify(bag))
    },
    { bag: buildPersistedBag(), bagKey: 'persist:ecunexo-tenant-auth' }
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

  const page = await publicApi<{ items: StorefrontListItem[] }>(
    '/products?page=1&pageSize=50'
  )
  const candidates = page.items.filter(
    (p) => !p.hasVariants && p.inStock && p.price !== null
  )
  if (candidates.length === 0) {
    throw new Error('No hay producto simple disponible en la vitrina local.')
  }

  let best: { list: StorefrontListItem; available: number } | null = null
  for (const candidate of candidates) {
    const detail = await publicApi<{ availableQuantity?: number }>(
      `/products/${candidate.id}`
    )
    const available = detail.availableQuantity ?? 0
    if (!best || available > best.available) {
      best = { list: candidate, available }
    }
  }
  item = best!.list

  const detail = await getAdminItem()
  initialItemMin = detail.minOrderQuantity ?? 1

  const settings = await tenantApi<StorefrontSettings>('/ecommerce/storefront/settings')
  initialMinOrderAmount = settings.minOrderAmount ?? 0

  await setItemMinOrderQuantity(1)
  await updateGlobalMinOrderAmount(0)
})

test.afterAll(async () => {
  if (item) {
    await setItemMinOrderQuantity(initialItemMin)
  }
  if (bundle) {
    await updateGlobalMinOrderAmount(initialMinOrderAmount)
  }
})

test.describe('Compra mínima — E2E local', () => {
  test.describe.configure({ mode: 'serial' })

  test('1) La compra mínima por producto se configura en el admin y persiste', async ({
    page,
  }) => {
    await installSession(page)
    await page.goto(`${ADMIN}/catalogo/items/${item.id}`, { waitUntil: 'domcontentloaded' })

    const minInput = page.locator('#ei-min-order-qty')
    await expect(minInput).toBeVisible({ timeout: 30_000 })
    await minInput.fill(String(MIN_QTY))

    const saveBtn = page.getByRole('button', { name: /Guardar Cambios/i })
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 })
    await saveBtn.click()

    await expect
      .poll(async () => (await getAdminItem()).minOrderQuantity ?? 1, {
        timeout: 20_000,
        message: 'el admin guardó minOrderQuantity=4',
      })
      .toBe(MIN_QTY)
  })

  test('2) La API rechaza la línea por debajo del mínimo y acepta la cantidad mínima', async () => {
    await expect.poll(async () => (await getAdminItem()).minOrderQuantity ?? 1).toBe(MIN_QTY)

    const rejected = await createStorefrontOrder(MIN_QTY - 2, 'sku-below')
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(400)
    expect(String(rejected.body.type)).toContain('ecommerce.checkout.min_order_quantity')

    const accepted = await createStorefrontOrder(MIN_QTY, 'sku-ok')
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(201)
    expect(accepted.body.orderId).toBeTruthy()
  })

  test('3) El pedido mínimo global rechaza por debajo y acepta por encima', async () => {
    const unitPrice = item.price ?? 0
    const belowQty = MIN_QTY
    const belowSubtotal = Math.round(unitPrice * belowQty * 100) / 100
    const globalMinAmount = Math.round((belowSubtotal + 1) * 100) / 100
    const aboveQty = Math.min(10, Math.ceil((globalMinAmount + 0.01) / unitPrice))
    expect(aboveQty).toBeGreaterThan(belowQty)

    await updateGlobalMinOrderAmount(globalMinAmount)

    const rejected = await createStorefrontOrder(belowQty, 'amount-below')
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(400)
    expect(String(rejected.body.type)).toContain('ecommerce.order.min_order_amount')

    const accepted = await createStorefrontOrder(aboveQty, 'amount-ok')
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(201)
    expect(accepted.body.orderId).toBeTruthy()

    await updateGlobalMinOrderAmount(0)
  })

  test('4) La ficha pública de la vitrina refleja la compra mínima', async () => {
    const detail = await publicApi<StorefrontDetail>(`/products/${item.id}`)
    expect(detail.id).toBe(item.id)
    expect(detail.minOrderQuantity).toBe(MIN_QTY)
    for (const variant of detail.variants ?? []) {
      expect(variant.minOrderQuantity ?? detail.minOrderQuantity).toBe(MIN_QTY)
    }
  })
})

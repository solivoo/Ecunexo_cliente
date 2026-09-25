import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Catálogo UI — Ítems y Categorías', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Ítems: carga PageHeader, métricas KPI y menú de acciones', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(page.getByRole('heading', { name: /Ítems del Catálogo/i })).toBeVisible({
      timeout: 20_000,
    })

    // Menú de acciones
    await expect(page.getByRole('button', { name: /Acciones de catálogo/i })).toBeVisible()

    // Tira de métricas (StatCard strip)
    await expect(page.getByLabel('Resumen de catálogo')).toBeVisible()
    const statCards = page.locator('.ecu-stat-card')
    expect(await statCards.count()).toBeGreaterThanOrEqual(1)
  })

  test('Categorías: carga PageHeader, métricas y listado taxonómico', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/categorias')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(page.getByRole('heading', { name: /Categorías del Catálogo/i })).toBeVisible({
      timeout: 20_000,
    })

    // Menú de acciones
    await expect(page.getByRole('button', { name: /Acciones de categorías/i })).toBeVisible()

    // Tira de métricas
    await expect(page.getByLabel('Resumen de categorías')).toBeVisible()
  })

  test('Nuevo producto servicio: muestra la sección de fotografías', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(page.getByRole('heading', { name: /Nuevo producto/i })).toBeVisible({
      timeout: 20_000,
    })

    // Los servicios no generan variantes de inventario: se habilita la galería
    await page.getByRole('button', { name: /Servicio/i }).click()
    await expect(page.getByRole('heading', { name: /Datos del producto/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Fotografías/i })).toBeVisible()
    await expect(page.getByText(/Arrastra tus fotografías aquí/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Seleccionar archivos/i })).toBeVisible()
  })

  test('Nuevo producto con un solo código: no genera constructor de variantes', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Nuevo producto/i })).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: /Producto con un solo código/i }).click()
    await expect(page.locator('#ci-name')).toBeVisible()
    await expect(page.locator('#ci-sku')).toBeVisible()
    await expect(page.locator('.ecu-matrix-builder')).toHaveCount(0)
  })

  test('Nuevo producto: sin bucle de render y el sidebar navega', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    const loopErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Maximum update depth')) {
        loopErrors.push(msg.text())
      }
    })

    await page.goto('/catalogo/items/nuevo')
    await expect(page.getByRole('heading', { name: /Nuevo producto/i })).toBeVisible({
      timeout: 20_000,
    })
    await page.getByRole('button', { name: /Producto con un solo código/i }).click()
    await expect(page.locator('#ci-name')).toBeVisible()
    await page.waitForTimeout(1500)

    await page.locator('.sidebar__link--option', { hasText: 'Atributos' }).first().click()
    await expect(page).toHaveURL(/\/catalogo\/atributos$/, { timeout: 15_000 })
    expect(loopErrors).toEqual([])
  })
})

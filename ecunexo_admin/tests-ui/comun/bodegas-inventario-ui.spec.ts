import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Bodegas e Inventario UI — Almacenes, Stock y Documentos', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Bodegas: carga PageHeader, métricas KPI y menú de acciones', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/bodegas'), 'Este plan no incluye Bodegas.')

    await page.goto('/bodegas')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Bodegas y Sucursales/i })
    ).toBeVisible({ timeout: 20_000 })

    // Acciones de bodegas
    await expect(page.getByRole('button', { name: /Acciones de bodegas/i })).toBeVisible()

    // Tira de métricas (StatCard strip)
    await expect(page.getByLabel('Resumen de bodegas')).toBeVisible()
  })

  test('Stock: carga PageHeader, métricas de existencias y selector de bodega', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/inventario'), 'Este plan no incluye Inventario.')

    await page.goto('/inventario/stock')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Control de Stock y Existencias/i })
    ).toBeVisible({ timeout: 20_000 })

    // Tira de métricas
    await expect(page.getByLabel('Resumen de stock')).toBeVisible()
  })

  test('Documentos de Inventario: carga PageHeader y resumen analítico', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/inventario'), 'Este plan no incluye Inventario.')

    await page.goto('/inventario/documentos')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Documentos de Inventario/i })
    ).toBeVisible({ timeout: 20_000 })

    // Tira de métricas
    await expect(page.getByLabel('Resumen de documentos')).toBeVisible()
  })

  test('Kardex: carga PageHeader y filtros temporales de movimiento', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/inventario'), 'Este plan no incluye Inventario.')

    await page.goto('/inventario/kardex')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Kardex de Movimientos Físicos/i })
    ).toBeVisible({ timeout: 20_000 })
  })
})

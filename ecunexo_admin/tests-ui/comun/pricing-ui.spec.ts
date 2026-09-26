import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Gestión de Precios UI — Listas, Precios y Simulador', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Listas de precios: carga PageHeader, métricas y listado', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo/precios'), 'Este plan no incluye Gestión de precios.')

    await page.goto('/catalogo/precios/listas')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Listas de Precios/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByLabel('Resumen de listas')).toBeVisible()
  })

  test('Precios de productos: muestra filtros por lista y categoría', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo/precios'), 'Este plan no incluye Gestión de precios.')

    await page.goto('/catalogo/precios/productos')
    await expect(page.getByRole('heading', { name: /Precios de Productos/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByLabel('Resumen de precios')).toBeVisible()
    await expect(page.getByLabel('Filtrar por lista')).toBeVisible()
    await expect(page.getByLabel('Filtrar por categoría')).toBeVisible()
  })

  test('Simulador: resuelve un precio con el motor', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo/precios'), 'Este plan no incluye Gestión de precios.')

    await page.goto('/catalogo/precios/simulador')
    await expect(page.getByRole('heading', { name: /Simulador de Precios/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByRole('button', { name: /^Simular$/i })).toBeVisible()
  })
})

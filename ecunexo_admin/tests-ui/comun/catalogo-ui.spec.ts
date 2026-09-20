import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Catálogo UI — Productos y Categorías', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Items: carga PageHeader, métricas KPI y menú de acciones', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Catálogo de Productos y Servicios/i })
    ).toBeVisible({ timeout: 20_000 })

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
    await expect(
      page.getByRole('heading', { name: /Categorías de Catálogo/i })
    ).toBeVisible({ timeout: 20_000 })

    // Menú de acciones
    await expect(page.getByRole('button', { name: /Acciones de categorías/i })).toBeVisible()

    // Tira de métricas
    await expect(page.getByLabel('Resumen de categorías')).toBeVisible()
  })

  test('Nuevo Ítem: carga formulario con sección de fotografías del producto', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Nuevo Ítem/i })
    ).toBeVisible({ timeout: 20_000 })

    // Sección de fotos
    await expect(page.getByText(/Fotografías del Ítem/i)).toBeVisible()
    await expect(page.getByText(/Sin fotografías anexadas todavía/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Añadir Fotos/i })).toBeVisible()
  })

  test('Nuevo Ítem: activa sección de Variantes con selector de color y foto por variante', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()

    // Cambiar a producto físico
    await page.selectOption('#ci-kind', '0')

    // Verificar sección Variantes
    await expect(page.getByText('¿Tiene variantes (tallas, colores, etc.)?')).toBeVisible()
    await page.locator('#ci-has-variants').check()

    // Constructor de Variantes
    await expect(page.locator('.ecu-matrix-builder')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Variantes' })).toBeVisible()

    // Añadir segunda dimensión (Color)
    const addColorBtn = page.getByRole('button', { name: /Añadir Color/i })
    if (await addColorBtn.isVisible()) {
      await addColorBtn.click()
      await expect(page.locator('#mat-color-picker-2')).toBeVisible()
    }

    // Columna de Foto en la tabla de variantes
    await expect(page.locator('.ecu-matrix-table th', { hasText: 'Foto' })).toBeVisible()
  })
})


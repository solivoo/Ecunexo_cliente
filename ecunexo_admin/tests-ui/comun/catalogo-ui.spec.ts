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

  test('Nuevo Ítem servicio: muestra la sección de fotografías del producto', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(page.getByRole('heading', { name: /Nuevo Ítem/i })).toBeVisible({
      timeout: 20_000,
    })

    // Los servicios no generan variantes de inventario: se habilita la galería
    await page.getByRole('combobox', { name: 'Tipo de ítem' }).click()
    await page.getByRole('option', { name: /Servicio/i }).click()
    await expect(page.getByText(/Fotografías del Producto/i)).toBeVisible()
    await expect(page.getByText(/Arrastra tus fotografías aquí/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Añadir Fotos/i })).toBeVisible()
  })

  test('Nuevo Ítem físico: despliega el constructor de variantes con tarjetas por dimensión', async ({
    page,
  }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Nuevo Ítem/i })).toBeVisible({
      timeout: 20_000,
    })

    // Para productos físicos (tipo por defecto) el constructor de variantes aparece automáticamente
    const matrix = page.locator('.ecu-matrix-builder')
    await expect(matrix).toBeVisible()
    await expect(matrix.getByRole('heading', { name: 'Variantes' })).toBeVisible()

    // Arranca con una variante inicial agrupada por su dimensión principal
    await expect(matrix.locator('.ecu-variant-group-card')).toHaveCount(1)

    // Cada variante/SKU gestiona su propia fotografía
    await expect(matrix.getByTitle('Subir foto exclusiva para esta variante').first()).toBeVisible()

    // Agregar una segunda talla desde la barra de acciones
    await matrix.locator('.ecu-matrix-bulk-bar').getByRole('button', { name: /Añadir|Agregar/ }).click()
    await expect(matrix.locator('.ecu-variant-sub-item-row')).toHaveCount(2)
    await expect(matrix.locator('.ecu-matrix-bulk-bar__count')).toContainText(/variante/i)
  })
})

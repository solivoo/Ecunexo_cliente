import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Catálogo UI — Variantes Físicas y Ficha de Ítem', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Constructor de variantes: tarjetas por dimensión, fotos compartidas y segundo grupo', async ({
    page,
  }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Nuevo Ítem/i })).toBeVisible({
      timeout: 20_000,
    })

    const matrix = page.locator('.ecu-matrix-builder')
    await expect(matrix).toBeVisible()

    // Variante inicial con su fila interna y acciones de grupo
    const firstGroup = matrix.locator('.ecu-variant-group-card').first()
    await expect(firstGroup).toBeVisible()
    await expect(firstGroup.locator('.ecu-variant-sub-item-row').first()).toBeVisible()
    await expect(firstGroup.getByText(/Subir Fotos|Gestionar Fotos/i)).toBeVisible()
    await expect(firstGroup.getByRole('button', { name: /Duplicar/i })).toBeVisible()

    // Agregar un segundo grupo (color/talla) desde la barra de acciones superior
    await matrix.locator('.ecu-matrix-bulk-bar').getByRole('button', { name: /Añadir|Agregar/ }).click()
    await expect(matrix.locator('.ecu-variant-group-card')).toHaveCount(2)
  })

  test('Ficha de ítem: abre la vista de edición desde el listado', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items')
    await expect(page.locator('.app-shell')).toBeVisible()

    await expect(page.getByRole('heading', { name: /Ítems del Catálogo/i })).toBeVisible({
      timeout: 20_000,
    })

    // Si existen filas en el catálogo, hacer click en la primera fila para inspeccionar edición
    const firstRow = page.locator('.glb-datagrid__row, .glb-datagrid__card').first()
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstRow.click()
      await expect(page.getByRole('heading', { name: /Ficha del Ítem/i })).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.locator('#ei-name')).toBeVisible()
    }
  })
})

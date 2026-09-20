import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Catálogo UI — Producto Matriz y Configurador de Variantes', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Despliega configurador de Producto Matriz al activar tallas y genera variantes cartesianas', async ({
    page,
  }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/catalogo'), 'Este plan no incluye Catálogo.')

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('.app-shell')).toBeVisible()

    // Encabezado de alta
    await expect(page.getByRole('heading', { name: /Nuevo Ítem/i })).toBeVisible({
      timeout: 20_000,
    })

    // Seleccionar tipo Físico
    const kindSelect = page.locator('#ci-kind')
    await kindSelect.selectOption({ label: 'Físico (con inventario)' })

    // La casilla de tallas/colores debe hacerse visible
    const variantsCheckbox = page.locator('#ci-has-variants')
    await expect(variantsCheckbox).toBeVisible()

    // Inicialmente el configurador de matriz no está presente
    await expect(page.locator('.ecu-matrix-builder')).not.toBeVisible()

    // Activar checkbox de tallas/variantes
    await variantsCheckbox.check()

    // Ahora el configurador de matriz debe ser visible
    const matrixBuilder = page.locator('.ecu-matrix-builder')
    await expect(matrixBuilder).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /Configurador de Variantes \(Producto Matriz\)/i })
    ).toBeVisible()

    // Comprobar la presencia de la Dimensión 1 y sus píldoras de valores (ej. Medias)
    await expect(page.getByText(/Tallas \/ Medidas \(Dimensión 1\)/i)).toBeVisible()
    const pills = matrixBuilder.locator('.ecu-matrix-pill')
    expect(await pills.count()).toBeGreaterThanOrEqual(1)

    // La tabla de variantes debe renderizarse con filas generadas
    const rows = matrixBuilder.locator('.ecu-matrix-table tbody tr')
    expect(await rows.count()).toBeGreaterThanOrEqual(1)

    // Probar herencia reactiva del SKU: escribir SKU base en el producto padre
    const skuInput = page.locator('#ci-sku')
    await skuInput.fill('AND-001')

    // El SKU de la primera variante debe heredar AND-001 automáticamente
    const firstRowSku = matrixBuilder.locator('.ecu-table-sku').first()
    await expect(firstRowSku).toHaveValue(/AND-001-/i)

    // Probar herencia reactiva del precio: escribir precio base en el producto padre
    const priceInput = page.locator('#ci-price')
    await priceInput.fill('1.50')

    // El precio de la primera variante debe heredar 1.50 automáticamente
    const firstRowPrice = matrixBuilder.locator('tbody tr input[type="number"]').first()
    await expect(firstRowPrice).toHaveValue('1.50')

    // Probar activación de 2da dimensión (Colores)
    const dualDimBtn = page.getByRole('button', { name: /\+ Añadir Color/i })
    await expect(dualDimBtn).toBeVisible()
    await dualDimBtn.click()

    // Debe desplegarse la tarjeta de Dimensión 2 (Colores)
    await expect(page.getByText(/Colores \/ Combinación \(Dimensión 2\)/i)).toBeVisible()

    // El conteo de filas debe incrementarse por el producto cartesiano
    const dualRowsCount = await matrixBuilder.locator('.ecu-matrix-table tbody tr').count()
    expect(dualRowsCount).toBeGreaterThan(1)

    // Botones de acción masiva
    await expect(page.getByRole('button', { name: /Copiar precio base/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Regenerar SKUs/i })).toBeVisible()
  })
})

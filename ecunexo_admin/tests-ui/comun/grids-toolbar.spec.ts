import { expect, test, type Page } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

async function expectGridToolbar(page: Page, typeFilterName: string): Promise<void> {
  await expect(page.getByRole('searchbox').or(page.getByPlaceholder(/Buscar/))).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('group', { name: 'Rango de fechas' })).toBeVisible()
  await expect(page.getByRole('group', { name: typeFilterName })).toBeVisible()
}

test.describe('Cabecera de grids masivos', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Comprobantes: rango de fechas y tipo SRI en el toolbar', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/facturacion'), 'Este plan no incluye Facturación.')
    await page.goto('/facturacion/comprobantes')
    await expect(page.getByRole('heading', { name: 'Comprobantes' })).toBeVisible()
    await expectGridToolbar(page, 'Tipo de comprobante de venta')
  })

  test('Monitoreo SRI: rango de fechas y estado en el toolbar', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/facturacion'), 'Este plan no incluye Facturación.')
    await page.goto('/facturacion/sri')
    await expect(page.getByRole('heading', { name: 'Monitoreo SRI' })).toBeVisible()
    await expectGridToolbar(page, 'Estado SRI')
  })

  test('Compras: rango de fechas y tipo de documento en el toolbar', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/compras'), 'Este plan no incluye Compras.')
    await page.goto('/compras/documentos')
    await expect(page.getByRole('heading', { name: 'Compras' })).toBeVisible()
    await expectGridToolbar(page, 'Tipo de documento de compra')
  })
})

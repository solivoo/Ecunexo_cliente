import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Configuración de listados', () => {
  test('expone registros por página y ventana de fechas', async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
    await page.goto('/app/configuracion')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Listados' })).toBeVisible()
    await expect(page.getByLabel('Registros por página')).toBeVisible()
    await expect(page.getByLabel('Ventana de fechas')).toBeVisible()
  })
})

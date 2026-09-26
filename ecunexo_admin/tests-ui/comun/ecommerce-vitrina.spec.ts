import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { hasRoute, readPersistedSession } from '../helpers/readPersistedSession'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Ecommerce UI — Vitrina y dominios', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('carga PageHeader, métricas y acción de agregar dominio', async ({ page }) => {
    const session = await readPersistedSession(page)
    test.skip(!hasRoute(session.routes, '/ecommerce/vitrina'), 'Este plan no incluye Ecommerce.')

    await page.goto('/ecommerce/vitrina')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Vitrina y Dominios/i })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByLabel('Resumen de dominios')).toBeVisible()
    await expect(page.getByRole('button', { name: /Agregar dominio/i }).first()).toBeVisible()
  })
})

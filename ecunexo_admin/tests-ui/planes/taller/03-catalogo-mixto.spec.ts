/**
 * Taller: servicio + físico. El servicio no entra en recepción.
 */
import { expect, test } from '@playwright/test'
import { ENSAYO_TALLER, ensureTallerCatalog } from '../../helpers/ensayoTaller'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

test.describe('Taller — catálogo mixto', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('taller-mixto')
    await loginAsSeedUser(page, 'taller-mixto')
  })

  test('Diagnóstico (servicio) y Filtro de aceite (físico)', async ({ page }) => {
    await ensureTallerCatalog(page)
    await page.goto('/catalogo/items')
    await expect(page.getByText(ENSAYO_TALLER.serviceName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(ENSAYO_TALLER.sku).first()).toBeVisible()

    await page.goto('/inventario/documentos/nuevo')
    await expect(page.locator('#inv-item-0')).toBeVisible({ timeout: 20_000 })
    await page.locator('#inv-item-0').click()
    await expect(page.getByRole('option', { name: new RegExp(ENSAYO_TALLER.sku) })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('option', { name: new RegExp(ENSAYO_TALLER.serviceName) })).toHaveCount(0)
  })
})

/**
 * Local: una sola bodega operativa (queda base). Sin En tránsito automático.
 */
import { expect, test } from '@playwright/test'
import { ENSAYO_LOCAL, ensureLocalWarehouse } from '../../helpers/ensayoLocal'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

test.describe('Local — bodega única', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('local-comercio')
    await loginAsSeedUser(page, 'local-comercio')
  })

  test('alta El Perno / 001; queda principal; sin tránsito', async ({ page }) => {
    await ensureLocalWarehouse(page)
    await page.goto('/bodegas')
    await expect(page.getByLabel('Resumen de bodegas')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.ecu-companies-grid').getByText(ENSAYO_LOCAL.warehouseName, { exact: true }).first()).toBeVisible()
    await expect(page.locator('.ecu-companies-grid').getByText(ENSAYO_LOCAL.warehouseCode, { exact: true }).first()).toBeVisible()

    const metrics = page.getByLabel('Resumen de bodegas')
    await expect(metrics.locator('.ecu-companies-page__metric').filter({ hasText: 'En tránsito' }).locator('.ecu-companies-page__metric-value')).toHaveText('0')
    await expect(metrics.locator('.ecu-companies-page__metric').filter({ hasText: 'Principal' }).locator('.ecu-companies-page__metric-value')).toHaveText('1')
    await expect(metrics.locator('.ecu-companies-page__metric').filter({ hasText: 'Operativas' }).locator('.ecu-companies-page__metric-value')).toHaveText('1')
  })
})

/**
 * Taller: Principal + En tránsito nacen solos (cupo > 1). El usuario da de alta Patio.
 */
import { expect, test } from '@playwright/test'
import { ENSAYO_TALLER, ensureTallerWarehouses } from '../../helpers/ensayoTaller'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

test.describe('Taller — bodegas y tránsito', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('taller-mixto')
    await loginAsSeedUser(page, 'taller-mixto')
  })

  test('Principal y En tránsito automáticos; Patio operativa; tránsito no se edita', async ({ page }) => {
    await ensureTallerWarehouses(page)
    await page.goto('/bodegas')
    await expect(page.getByLabel('Resumen de bodegas')).toBeVisible({ timeout: 20_000 })

    const grid = page.locator('.ecu-companies-grid')
    await expect(grid.getByText('PRINCIPAL', { exact: true }).first()).toBeVisible()
    await expect(grid.getByText('TRANSITO', { exact: true }).first()).toBeVisible()
    await expect(grid.getByText(ENSAYO_TALLER.branchWarehouse, { exact: true }).first()).toBeVisible()
    await expect(grid.getByText(ENSAYO_TALLER.branchCode, { exact: true }).first()).toBeVisible()

    const metrics = page.getByLabel('Resumen de bodegas')
    await expect(
      metrics.locator('.ecu-companies-page__metric').filter({ hasText: 'Bodegas' }).locator('.ecu-companies-page__metric-value')
    ).toHaveText('3')
    await expect(
      metrics.locator('.ecu-companies-page__metric').filter({ hasText: 'En tránsito' }).locator('.ecu-companies-page__metric-value')
    ).toHaveText('1')
    await expect(
      metrics.locator('.ecu-companies-page__metric').filter({ hasText: 'Principal' }).locator('.ecu-companies-page__metric-value')
    ).toHaveText('1')
    await expect(
      metrics.locator('.ecu-companies-page__metric').filter({ hasText: 'Operativas' }).locator('.ecu-companies-page__metric-value')
    ).toHaveText('2')

    await expect(grid.getByRole('button', { name: 'Editar' })).toHaveCount(2)
  })
})

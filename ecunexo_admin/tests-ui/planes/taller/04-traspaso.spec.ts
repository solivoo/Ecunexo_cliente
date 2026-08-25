/**
 * Taller: recepción en Principal, traspaso a Patio (pasa por En tránsito). Sin SRI.
 */
import { expect, test } from '@playwright/test'
import {
  ENSAYO_TALLER,
  ensureOpeningOnPrincipal,
  ensureTallerCatalog,
  ensureTallerWarehouses,
  ensureTransferToPatio,
} from '../../helpers/ensayoTaller'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

test.describe('Taller — recepción y traspaso', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('taller-mixto')
    await loginAsSeedUser(page, 'taller-mixto')
  })

  test('recepción en Principal y traspaso despachar/recibir en Patio', async ({ page }) => {
    await ensureTallerWarehouses(page)
    await ensureTallerCatalog(page)
    await ensureOpeningOnPrincipal(page)
    await ensureTransferToPatio(page)
    await page.goto('/inventario/stock')
    const grid = page.locator('.ecu-companies-grid')
    await expect(grid.getByText(ENSAYO_TALLER.sku).first()).toBeVisible()
    await expect(grid.getByText(ENSAYO_TALLER.branchWarehouse, { exact: true }).first()).toBeVisible()
  })
})

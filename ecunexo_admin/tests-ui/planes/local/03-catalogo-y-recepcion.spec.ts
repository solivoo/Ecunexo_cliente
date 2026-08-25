/**
 * Local: categoría física + SKU + recepción Inventario inicial. No emite al SRI.
 */
import { expect, test } from '@playwright/test'
import {
  ENSAYO_LOCAL,
  ensureFerreteriaCategory,
  ensureLocalWarehouse,
  ensureOpeningReceipt,
  ensureTornilloItem,
} from '../../helpers/ensayoLocal'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

test.describe('Local — catálogo físico y recepción', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('local-comercio')
    await loginAsSeedUser(page, 'local-comercio')
  })

  test('categoría Ferretería e ítem Tornillo M8', async ({ page }) => {
    await ensureFerreteriaCategory(page)
    await ensureTornilloItem(page)
    await expect(page.getByText(ENSAYO_LOCAL.sku).first()).toBeVisible()
  })

  test('recepción Inventario inicial deja saldo en Stock', async ({ page }) => {
    await ensureLocalWarehouse(page)
    await ensureFerreteriaCategory(page)
    await ensureTornilloItem(page)
    await ensureOpeningReceipt(page)
    await expect(page.getByText(ENSAYO_LOCAL.sku).first()).toBeVisible()
    await expect(page.getByText(ENSAYO_LOCAL.warehouseName).first()).toBeVisible()
  })
})

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

  test('no elimina ítem físico con stock/documentos; avisa el motivo', async ({ page }) => {
    await ensureLocalWarehouse(page)
    await ensureFerreteriaCategory(page)
    await ensureTornilloItem(page)
    await ensureOpeningReceipt(page)

    await page.goto('/catalogo/items')
    await expect(page.getByLabel('Resumen de catálogo')).toBeVisible({ timeout: 20_000 })
    const row = page.getByRole('row', { name: new RegExp(ENSAYO_LOCAL.sku) })
    await expect(row).toBeVisible({ timeout: 20_000 })

    const deleteBtn = row.getByRole('button', { name: 'Eliminar' })
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 })
    page.once('dialog', (dialog) => {
      void dialog.accept()
    })
    await deleteBtn.click()

    await expect(page.getByText(/No se pudo eliminar|registros asociados|stock|documentos/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(row).toBeVisible({ timeout: 10_000 })
  })

  test('no elimina categoría Ferretería si tiene ítems; avisa el motivo', async ({ page }) => {
    await ensureFerreteriaCategory(page)
    await ensureTornilloItem(page)

    await page.goto('/catalogo/categorias')
    await expect(page.getByLabel('Resumen de categorías')).toBeVisible({ timeout: 20_000 })
    const row = page.getByRole('row', { name: new RegExp(ENSAYO_LOCAL.category) })
    await expect(row).toBeVisible({ timeout: 20_000 })

    const deleteBtn = row.getByRole('button', { name: 'Eliminar' })
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 })
    page.once('dialog', (dialog) => {
      void dialog.accept()
    })
    await deleteBtn.click()

    await expect(
      page.getByText(/No se pudo eliminar|ítems asociados|subcategorías/i).first()
    ).toBeVisible({ timeout: 20_000 })
    await expect(row).toBeVisible({ timeout: 10_000 })
  })
})

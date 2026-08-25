import { expect, type Page } from '@playwright/test'
import { selectGluOption } from './gluSelect'

export const ENSAYO_LOCAL = {
  companyName: 'Ferretería El Perno',
  warehouseName: 'El Perno',
  warehouseCode: '001',
  category: 'Ferretería',
  itemName: 'Tornillo M8',
  sku: 'PER-TOR-M8',
  qty: '20',
} as const

export async function ensureLocalWarehouse(page: Page): Promise<void> {
  await page.goto('/bodegas')
  await expect(page.getByLabel('Resumen de bodegas')).toBeVisible({ timeout: 20_000 })

  const inGrid = page.locator('.ecu-companies-grid').getByText(ENSAYO_LOCAL.warehouseName, { exact: true })
  if (await inGrid.first().isVisible().catch(() => false)) {
    return
  }

  await page.goto('/bodegas/nueva')
  await expect(page.locator('#wh-name')).toBeVisible({ timeout: 20_000 })
  await page.locator('#wh-name').fill(ENSAYO_LOCAL.warehouseName)
  await page.locator('#wh-code').fill(ENSAYO_LOCAL.warehouseCode)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page).toHaveURL(/\/bodegas$/, { timeout: 20_000 })
  await expect(
    page.locator('.ecu-companies-grid').getByText(ENSAYO_LOCAL.warehouseName, { exact: true }).first()
  ).toBeVisible({ timeout: 20_000 })
}

export async function ensureFerreteriaCategory(page: Page): Promise<void> {
  await page.goto('/catalogo/categorias')
  await expect(page.getByLabel('Resumen de categorías')).toBeVisible({ timeout: 20_000 })

  const inGrid = page.locator('.ecu-companies-grid').getByText(ENSAYO_LOCAL.category, { exact: true })
  if (await inGrid.first().isVisible().catch(() => false)) {
    return
  }

  await page.goto('/catalogo/categorias/nueva')
  await expect(page.locator('#cc-name')).toBeVisible({ timeout: 20_000 })
  await page.locator('#cc-name').fill(ENSAYO_LOCAL.category)
  await page.locator('#cc-desc').fill('Tornillería y ferretería — ensayo Local')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page).toHaveURL(/\/catalogo\/categorias/, { timeout: 20_000 })
  await expect(
    page.locator('.ecu-companies-grid').getByText(ENSAYO_LOCAL.category, { exact: true }).first()
  ).toBeVisible({ timeout: 20_000 })
}

export async function ensureTornilloItem(page: Page): Promise<void> {
  await page.goto('/catalogo/items')
  await expect(page.getByLabel('Resumen de catálogo')).toBeVisible({ timeout: 20_000 })

  if (await page.getByText(ENSAYO_LOCAL.sku).first().isVisible().catch(() => false)) {
    return
  }

  await page.goto('/catalogo/items/nuevo')
  await expect(page.locator('#ci-name')).toBeVisible({ timeout: 20_000 })
  await selectGluOption(page, 'ci-kind', 'Físico')
  await page.locator('#ci-cat').click()
  await expect(page.getByRole('option', { name: 'Sin categoría' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('option', { name: ENSAYO_LOCAL.category })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('option', { name: ENSAYO_LOCAL.category }).click()
  await page.locator('#ci-name').fill(ENSAYO_LOCAL.itemName)
  await page.locator('#ci-sku').fill(ENSAYO_LOCAL.sku)
  await page.locator('#ci-price').fill('0.15')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page).toHaveURL(/\/catalogo\/items/, { timeout: 20_000 })
  await expect(page.getByText(ENSAYO_LOCAL.sku)).toBeVisible({ timeout: 20_000 })
}

export async function ensureOpeningReceipt(page: Page): Promise<void> {
  await page.goto('/inventario/stock')
  await expect(page.getByLabel('Resumen de stock')).toBeVisible({ timeout: 20_000 })

  if (await page.getByText(ENSAYO_LOCAL.sku).first().isVisible().catch(() => false)) {
    return
  }

  await page.goto('/inventario/documentos/nuevo')
  await expect(page.locator('#inv-type')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#inv-item-0')).toBeVisible({ timeout: 20_000 })
  await selectGluOption(page, 'inv-item-0', `Tornillo M8 (${ENSAYO_LOCAL.sku})`)
  await expect(page.locator('td.ecu-doc-lines__sku').first()).toHaveText(ENSAYO_LOCAL.sku, {
    timeout: 10_000,
  })
  const qty = page.getByRole('spinbutton', { name: /Cantidad línea 1/ })
  await qty.fill(ENSAYO_LOCAL.qty)
  await page.getByRole('button', { name: 'Guardar y aprobar' }).click()
  await expect(page).toHaveURL(/\/inventario\/documentos\/?$/, { timeout: 20_000 })

  await page.goto('/inventario/stock')
  await expect(page.getByLabel('Resumen de stock')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(ENSAYO_LOCAL.sku).first()).toBeVisible({ timeout: 20_000 })
}

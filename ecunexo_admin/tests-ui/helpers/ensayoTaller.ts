import { expect, type Page } from '@playwright/test'
import { selectGluOption } from './gluSelect'

export const ENSAYO_TALLER = {
  companyName: 'Taller El Eje',
  mainWarehouse: 'Principal',
  branchWarehouse: 'Patio',
  branchCode: '002',
  categoryParts: 'Repuestos',
  categoryServices: 'Servicios',
  serviceName: 'Diagnóstico',
  partName: 'Filtro de aceite',
  sku: 'FIL-EJE-01',
  receiptQty: '20',
  transferQty: '5',
} as const

function warehouseGrid(page: Page) {
  return page.locator('.ecu-companies-grid')
}

export async function ensureTallerWarehouses(page: Page): Promise<void> {
  await page.goto('/bodegas')
  const metrics = page.getByLabel('Resumen de bodegas')
  await expect(metrics).toBeVisible({ timeout: 20_000 })

  const transitCount = metrics
    .locator('.ecu-companies-page__metric')
    .filter({ hasText: 'En tránsito' })
    .locator('.ecu-companies-page__metric-value')
  await expect(transitCount, 'Taller necesita cupo 2 bodegas para que nazca En tránsito').toHaveText(
    '1',
    { timeout: 20_000 }
  )

  const grid = warehouseGrid(page)
  await expect(grid.getByText('TRANSITO', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  await expect(grid.getByText('PRINCIPAL', { exact: true }).first()).toBeVisible({ timeout: 20_000 })

  if (
    await warehouseGrid(page)
      .getByText(ENSAYO_TALLER.branchWarehouse, { exact: true })
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return
  }

  await page.goto('/bodegas/nueva')
  await expect(page.locator('#wh-name')).toBeVisible({ timeout: 20_000 })
  await page.locator('#wh-name').fill(ENSAYO_TALLER.branchWarehouse)
  await page.locator('#wh-code').fill(ENSAYO_TALLER.branchCode)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page).toHaveURL(/\/bodegas$/, { timeout: 20_000 })
  await expect(
    warehouseGrid(page).getByText(ENSAYO_TALLER.branchWarehouse, { exact: true }).first()
  ).toBeVisible({ timeout: 20_000 })
}

async function ensureCategory(page: Page, name: string, description: string): Promise<void> {
  await page.goto('/catalogo/categorias')
  await expect(page.getByLabel('Resumen de categorías')).toBeVisible({ timeout: 20_000 })
  const inGrid = page.locator('.ecu-companies-grid').getByText(name, { exact: true })
  if (await inGrid.first().isVisible().catch(() => false)) return

  await page.goto('/catalogo/categorias/nueva')
  await expect(page.locator('#cc-name')).toBeVisible({ timeout: 20_000 })
  await page.locator('#cc-name').fill(name)
  await page.locator('#cc-desc').fill(description)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page).toHaveURL(/\/catalogo\/categorias/, { timeout: 20_000 })
  await expect(page.locator('.ecu-companies-grid').getByText(name, { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  })
}

export async function ensureTallerCatalog(page: Page): Promise<void> {
  await ensureCategory(page, ENSAYO_TALLER.categoryServices, 'Mano de obra — ensayo Taller')
  await ensureCategory(page, ENSAYO_TALLER.categoryParts, 'Piezas y filtros — ensayo Taller')

  await page.goto('/catalogo/items')
  await expect(page.getByLabel('Resumen de catálogo')).toBeVisible({ timeout: 20_000 })

  if (!(await page.getByText(ENSAYO_TALLER.serviceName, { exact: true }).first().isVisible().catch(() => false))) {
    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('#ci-name')).toBeVisible({ timeout: 20_000 })
    await page.locator('#ci-cat').click()
    await expect(page.getByRole('option', { name: ENSAYO_TALLER.categoryServices })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('option', { name: ENSAYO_TALLER.categoryServices }).click()
    await page.locator('#ci-name').fill(ENSAYO_TALLER.serviceName)
    await page.locator('#ci-price').fill('25.00')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page).toHaveURL(/\/catalogo\/items/, { timeout: 20_000 })
    await expect(page.getByText(ENSAYO_TALLER.serviceName, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    })
  }

  if (!(await page.getByText(ENSAYO_TALLER.sku).first().isVisible().catch(() => false))) {
    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('#ci-name')).toBeVisible({ timeout: 20_000 })
    await selectGluOption(page, 'ci-kind', 'Físico')
    await page.locator('#ci-cat').click()
    await expect(page.getByRole('option', { name: ENSAYO_TALLER.categoryParts })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('option', { name: ENSAYO_TALLER.categoryParts }).click()
    await page.locator('#ci-name').fill(ENSAYO_TALLER.partName)
    await page.locator('#ci-sku').fill(ENSAYO_TALLER.sku)
    await page.locator('#ci-price').fill('8.50')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page).toHaveURL(/\/catalogo\/items/, { timeout: 20_000 })
    await expect(page.getByText(ENSAYO_TALLER.sku)).toBeVisible({ timeout: 20_000 })
  }
}

export async function ensureOpeningOnPrincipal(page: Page): Promise<void> {
  await page.goto('/inventario/stock')
  await expect(page.getByLabel('Resumen de stock')).toBeVisible({ timeout: 20_000 })
  if (await page.getByText(ENSAYO_TALLER.sku).first().isVisible().catch(() => false)) return

  await page.goto('/inventario/documentos/nuevo')
  await expect(page.locator('#inv-type')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('#inv-item-0')).toBeVisible({ timeout: 20_000 })
  await selectGluOption(page, 'inv-wh', /Principal/)
  await selectGluOption(page, 'inv-item-0', `${ENSAYO_TALLER.partName} (${ENSAYO_TALLER.sku})`)
  await expect(page.locator('td.ecu-doc-lines__sku').first()).toHaveText(ENSAYO_TALLER.sku, {
    timeout: 10_000,
  })
  await page.getByRole('spinbutton', { name: /Cantidad línea 1/ }).fill(ENSAYO_TALLER.receiptQty)
  await page.getByRole('button', { name: 'Guardar y aprobar' }).click()
  await expect(page).toHaveURL(/\/inventario\/documentos\/?$/, { timeout: 20_000 })
  await page.goto('/inventario/stock')
  await expect(page.getByLabel('Resumen de stock')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(ENSAYO_TALLER.sku).first()).toBeVisible({ timeout: 20_000 })
}

export async function ensureTransferToPatio(page: Page): Promise<void> {
  await page.goto('/inventario/stock')
  await expect(page.getByLabel('Resumen de stock')).toBeVisible({ timeout: 20_000 })
  const grid = page.locator('.ecu-companies-grid')
  const hasPatio = await grid
    .getByText(ENSAYO_TALLER.branchWarehouse, { exact: true })
    .first()
    .isVisible()
    .catch(() => false)
  if (hasPatio) return

  await page.goto('/inventario/documentos/nuevo?tipo=2')
  await expect(page.locator('#inv-type')).toBeVisible({ timeout: 20_000 })
  await selectGluOption(page, 'inv-wh', /Principal/)
  await selectGluOption(page, 'inv-wh-dest', new RegExp(ENSAYO_TALLER.branchWarehouse))
  await selectGluOption(page, 'inv-item-0', `${ENSAYO_TALLER.partName} (${ENSAYO_TALLER.sku})`)
  await expect(page.locator('td.ecu-doc-lines__sku').first()).toHaveText(ENSAYO_TALLER.sku, {
    timeout: 10_000,
  })
  await page.getByRole('spinbutton', { name: /Cantidad línea 1/ }).fill(ENSAYO_TALLER.transferQty)
  await page.getByRole('button', { name: 'Guardar y despachar' }).click()
  await expect(page).toHaveURL(/cola=recibir/, { timeout: 20_000 })
  await expect(page.getByLabel('Resumen de documentos')).toBeVisible({ timeout: 20_000 })
  const confirm = page.getByRole('button', { name: 'Confirmar recepción' })
  await expect(confirm.first()).toBeVisible({ timeout: 20_000 })
  await confirm.first().click()
  await expect(confirm).toHaveCount(0, { timeout: 20_000 })

  await page.goto('/inventario/stock')
  await expect(page.getByLabel('Resumen de stock')).toBeVisible({ timeout: 20_000 })
  await expect(grid.getByText(ENSAYO_TALLER.sku).first()).toBeVisible({ timeout: 20_000 })
  await expect(grid.getByText(ENSAYO_TALLER.branchWarehouse, { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  })
}

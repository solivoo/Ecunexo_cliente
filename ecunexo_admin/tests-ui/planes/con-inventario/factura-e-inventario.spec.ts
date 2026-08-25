/**
 * Planes con stock (Local, Taller, Empresa, Cadena, Grupo).
 * Independiente se salta: no tiene inventario.
 * No emite al SRI salvo E2E_FASE4_EMIT=1.
 */
import { expect, test, type Page } from '@playwright/test'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { hasModule, readPersistedSession } from '../../helpers/readPersistedSession'
import { requireFixedCredentials } from '../../helpers/requirePlan'

async function selectGluOption(page: Page, selectId: string, optionText: RegExp | string): Promise<void> {
  const trigger = page.locator(`#${selectId}`)
  await expect(trigger).toBeVisible({ timeout: 20_000 })
  await trigger.click()
  const option = page.getByRole('option', { name: optionText }).first()
  await expect(option).toBeVisible({ timeout: 15_000 })
  await option.click()
}

test.describe('Facturación ↔ inventario (UI)', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
    const session = await readPersistedSession(page)
    test.skip(
      !hasModule(session.modules, 'inventory'),
      'Este usuario no tiene inventario (p. ej. Independiente).'
    )
  })

  test('Catálogo, stock y emitir factura cargan', async ({ page }) => {
    await page.goto('/catalogo/items')
    await expect(page.getByLabel('Resumen de catálogo')).toBeVisible({ timeout: 20_000 })

    await page.goto('/inventario/stock')
    await expect(page.getByLabel('Resumen de stock')).toBeVisible({ timeout: 20_000 })

    await page.goto('/facturacion/facturas/emitir')
    await expect(page.getByRole('heading', { name: 'Emitir factura' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.factura-emitir__table')).toBeVisible()
    await expect(page.locator('[id^="inv-line-sku-"]').first()).toBeVisible()
  })

  test('Alta de ítem físico y aparece en el selector de emitir', async ({ page }) => {
    const sku = `PW-F4-${Date.now().toString().slice(-8)}`
    const name = `Playwright stock ${sku}`

    await page.goto('/catalogo/items/nuevo')
    await expect(page.locator('#ci-name')).toBeVisible({ timeout: 20_000 })
    await selectGluOption(page, 'ci-kind', 'Físico')
    await page.locator('#ci-name').fill(name)
    await page.locator('#ci-sku').fill(sku)
    await page.locator('#ci-price').fill('2.50')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()

    await expect(page).toHaveURL(/\/catalogo\/items/, { timeout: 20_000 })
    await expect(page.getByText(sku)).toBeVisible({ timeout: 20_000 })

    await page.goto('/facturacion/facturas/emitir')
    await expect(page.getByRole('heading', { name: 'Emitir factura' })).toBeVisible({
      timeout: 20_000,
    })

    const lineSelect = page.locator('[id^="inv-line-sku-"]').first()
    await expect(lineSelect).toBeVisible()
    const selectId = await lineSelect.getAttribute('id')
    if (!selectId) throw new Error('No se encontró el Select de línea')

    await selectGluOption(page, selectId, new RegExp(sku))
    await expect(page.locator('[id^="inv-line-desc-"]').first()).toHaveValue(new RegExp(name), {
      timeout: 10_000,
    })
  })

  test('Emitir con ítem de catálogo (opcional SRI)', async ({ page }) => {
    test.skip(
      process.env.E2E_FASE4_EMIT !== '1',
      'Define E2E_FASE4_EMIT=1 para emitir de verdad (APIs Billing + tenant + stock).'
    )

    await page.goto('/facturacion/facturas/emitir')
    await expect(page.getByRole('heading', { name: 'Emitir factura' })).toBeVisible({
      timeout: 20_000,
    })

    const lineSelect = page.locator('[id^="inv-line-sku-"]').first()
    const selectId = await lineSelect.getAttribute('id')
    if (!selectId) throw new Error('No se encontró el Select de línea')

    await lineSelect.click()
    const e2eOption = page.getByRole('option', { name: /E2E-FASE4-SKU/ }).first()
    if (await e2eOption.isVisible().catch(() => false)) {
      await e2eOption.click()
    } else {
      const any = page.getByRole('option').nth(1)
      await expect(any).toBeVisible({ timeout: 15_000 })
      await any.click()
    }

    await page.locator('#inv-id').fill('0999999999001')
    await page.locator('#inv-name').fill('Cliente Playwright stock')

    const emitBtn = page.getByRole('button', {
      name: /Emitir \(SRI pruebas\)|Emitir \(producción\)|Firmar|Validar XML/,
    })
    await expect(emitBtn).toBeVisible()
    await emitBtn.click()

    await expect(
      page.getByText(/autorizad|firmad|enviad|éxito|validado|cola|SRI|recibid/i).first()
    ).toBeVisible({ timeout: 60_000 })
  })
})

/**
 * Independiente factura servicios. No emite al SRI (secuencial de pruebas).
 */
import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

test.describe('Independiente — facturación', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('pro-independiente')
    await loginAsSeedUser(page, 'pro-independiente')
  })

  test('comprobantes carga', async ({ page }) => {
    await page.goto('/facturacion/comprobantes')
    await expect(page.getByLabel('Resumen de comprobantes')).toBeVisible({ timeout: 20_000 })
  })

  test('pantalla emitir abre (sin enviar al SRI)', async ({ page }) => {
    await page.goto('/facturacion/facturas/emitir')
    await expect(
      page.getByRole('heading', { name: /Emitir factura|Nota de venta/i }).first()
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.factura-emitir__table')).toBeVisible({ timeout: 20_000 })
  })
})

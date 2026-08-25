/**
 * Taller factura el físico. No emite al SRI (secuencial de pruebas).
 */
import { expect, test } from '@playwright/test'
import {
  ENSAYO_TALLER,
  ensureOpeningOnPrincipal,
  ensureTallerCatalog,
  ensureTallerWarehouses,
} from '../../helpers/ensayoTaller'
import { selectGluOption } from '../../helpers/gluSelect'
import { loginAsSeedUser } from '../../helpers/loginAsSeedUser'
import { requirePlan } from '../../helpers/requirePlan'

test.describe('Taller — facturación', () => {
  test.beforeEach(async ({ page }) => {
    requirePlan('taller-mixto')
    await loginAsSeedUser(page, 'taller-mixto')
  })

  test('comprobantes carga', async ({ page }) => {
    await page.goto('/facturacion/comprobantes')
    await expect(page.getByLabel('Resumen de comprobantes')).toBeVisible({ timeout: 20_000 })
  })

  test('emitir abre y el SKU físico está en el selector (sin SRI)', async ({ page }) => {
    await ensureTallerWarehouses(page)
    await ensureTallerCatalog(page)
    await ensureOpeningOnPrincipal(page)

    await page.goto('/facturacion/facturas/emitir')
    await expect(
      page.getByRole('heading', { name: /Emitir factura|Nota de venta/i }).first()
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.factura-emitir__table')).toBeVisible({ timeout: 20_000 })

    const lineSelect = page.locator('[id^="inv-line-sku-"]').first()
    await expect(lineSelect).toBeVisible({ timeout: 20_000 })
    const selectId = await lineSelect.getAttribute('id')
    if (!selectId) throw new Error('No se encontró el Select de línea')
    await selectGluOption(page, selectId, new RegExp(ENSAYO_TALLER.sku))
    await expect(page.locator('[id^="inv-line-desc-"]').first()).toHaveValue(/Filtro/i, {
      timeout: 10_000,
    })
  })
})

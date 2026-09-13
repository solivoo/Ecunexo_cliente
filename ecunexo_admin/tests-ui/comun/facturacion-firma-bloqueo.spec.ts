import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Facturación — Bloqueo de emisión sin .p12 y Previsualización RIDE', () => {
  test.beforeEach(async () => {
    requireFixedCredentials()
  })

  test('bloquea botón emitir si no tiene firma y permite previsualizar RIDE', async ({ page }) => {
    // Mock signing-certificate/status as not configured
    await page.route('**/api/v1/tenants/*/signing-certificate/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isConfigured: false,
          subject: null,
          issuer: null,
          validFrom: null,
          validTo: null,
          serialNumber: null,
          daysRemaining: 0,
          isExpired: false,
          originalFileName: null,
          updatedAt: null,
        }),
      })
    })

    await loginAsSeedUser(page, 'pro-independiente')
    await page.goto('/facturacion/facturas/emitir')

    // Verify warning alert is shown
    const alert = page.locator('.factura-emitir__cert-alert')
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await expect(alert).toContainText('Firma electrónica no configurada')

    // Verify Emitir button is disabled
    const emitButton = page.locator('button[type="submit"]')
    await expect(emitButton).toBeDisabled()

    // Verify Previsualizar RIDE button is enabled
    const previewButton = page.getByRole('button', { name: /Previsualizar RIDE/i })
    await expect(previewButton).toBeEnabled()
  })
})

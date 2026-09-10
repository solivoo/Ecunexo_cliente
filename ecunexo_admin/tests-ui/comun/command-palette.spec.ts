import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Buscador Global / Command Palette (Ctrl + K)', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
    await page.goto('/inicio')
    await expect(page.locator('.app-shell')).toBeVisible()
  })

  test('el botón disparador se muestra en la barra superior con su atajo', async ({ page }) => {
    const trigger = page.locator('.ecu-cmd-trigger')
    await expect(trigger).toBeVisible()
    await expect(trigger).toContainText('Buscar páginas o acciones...')
  })

  test('abre y cierra el buscador con clic y tecla Escape', async ({ page }) => {
    const trigger = page.locator('.ecu-cmd-trigger')
    await trigger.click()

    const modal = page.locator('.ecu-cmd-modal')
    await expect(modal).toBeVisible()

    const input = page.locator('.ecu-cmd-modal__input')
    await expect(input).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })

  test('abre con el atajo de teclado global Ctrl + K', async ({ page }) => {
    await page.keyboard.press('Control+k')
    const modal = page.locator('.ecu-cmd-modal')
    await expect(modal).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
  })

  test('filtra acciones y páginas por palabras clave y permite navegar con flechas', async ({ page }) => {
    await page.locator('.ecu-cmd-trigger').click()
    const input = page.locator('.ecu-cmd-modal__input')

    // Búsqueda de tema / apariencia
    await input.fill('tema')
    const themeItem = page.locator('.ecu-cmd-item', { hasText: 'Modo' })
    await expect(themeItem).toBeVisible()

    // Búsqueda de facturación
    await input.fill('factura')
    const invoiceResults = page.locator('.ecu-cmd-item')
    expect(await invoiceResults.count()).toBeGreaterThan(0)

    // Navegación con teclado
    await page.keyboard.press('ArrowDown')
    const activeItem = page.locator('.ecu-cmd-item--active')
    await expect(activeItem).toBeVisible()
  })
})

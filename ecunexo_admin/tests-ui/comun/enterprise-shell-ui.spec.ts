import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'))

test.describe('Enterprise Shell UI — Header, Tema y Modal Acerca de', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
    await page.goto('/inicio')
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
  })

  test('la cabecera muestra título, buscador global, alternador de tema y menú de usuario', async ({
    page,
  }) => {
    const header = page.locator('.app-shell__header')
    await expect(header).toBeVisible()

    // Título de la vista actual
    await expect(header.locator('.app-shell__header-title')).toBeVisible()

    // Disparador del Buscador Global (Command Palette)
    const searchTrigger = header.locator('.ecu-cmd-trigger')
    await expect(searchTrigger).toBeVisible()
    await expect(searchTrigger).toContainText('Buscar')

    // Botón de alternancia de tema (Modo Claro / Oscuro)
    const themeBtn = header.locator('.ecu-theme-toggle')
    await expect(themeBtn).toBeVisible()

    // Menú de usuario con avatar / iniciales
    const userMenu = header.locator('.app-shell-user-menu')
    await expect(userMenu).toBeVisible()
  })

  test('el botón de tema conmuta la clase sf-dark-mode en el elemento raíz', async ({ page }) => {
    const themeBtn = page.locator('.ecu-theme-toggle')
    const initialIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains('sf-dark-mode')
    )

    // Clic para alternar modo
    await themeBtn.click()
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.classList.contains('sf-dark-mode'))
      )
      .toBe(!initialIsDark)

    // Clic nuevamente para restaurar modo original
    await themeBtn.click()
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.classList.contains('sf-dark-mode'))
      )
      .toBe(initialIsDark)
  })

  test('el botón de versión del sidebar abre el modal Acerca de EcuNexo con changelog', async ({
    page,
  }) => {
    const versionBtn = page.locator('.app-shell__version-btn')
    await expect(versionBtn).toBeVisible()
    await versionBtn.click()

    // Modal Acerca de
    const modal = page.locator('.ecu-about-modal')
    await expect(modal).toBeVisible()

    // Información de release
    await expect(modal.locator('.ecu-about-modal__badge')).toContainText(`v${pkg.version}`)
    await expect(modal.locator('.ecu-about-modal__changelog')).toBeVisible()
    await expect(modal).toContainText('Taller y Lotes B2B')
    await expect(modal).toContainText('Actas de Despacho Criptográficas con QR')

    // Botón de copiado de soporte
    const copyBtn = modal.locator('.ecu-about-modal__copy-btn')
    await expect(copyBtn).toBeVisible()

    // Cierre del modal
    const closeBtn = page.getByRole('button', { name: 'Entendido' })
    await closeBtn.click()
    await expect(modal).not.toBeVisible()
  })

  test('el botón hamburguesa se muestra en viewport móvil/tablet y abre el menú lateral con backdrop', async ({
    page,
  }) => {
    // Redimensionar viewport a tablet (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 })

    const hamburgerBtn = page.locator('.app-shell__hamburger-btn')
    await expect(hamburgerBtn).toBeVisible()

    // Inicialmente el cajón lateral no tiene la clase app-shell--mobile-open
    await expect(page.locator('.app-shell--mobile-open')).not.toBeVisible()

    // Abrir menú con el botón hamburguesa
    await hamburgerBtn.click()
    await expect(page.locator('.app-shell--mobile-open')).toBeVisible()
    await expect(page.locator('.app-shell__mobile-backdrop')).toBeVisible()

    // Cerrar tocando el backdrop
    await page.locator('.app-shell__mobile-backdrop').click()
    await expect(page.locator('.app-shell--mobile-open')).not.toBeVisible()
  })
})


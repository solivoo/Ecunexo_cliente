import { expect, test } from '@playwright/test'
import { selectGluOption } from '../helpers/gluSelect'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Preferencias del Sistema (UI)', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
    await page.goto('/app/configuracion')
    await expect(page.locator('.app-shell')).toBeVisible()
  })

  test('Configuración de listados: expone registros por página y ventana de fechas', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: 'Listados' })).toBeVisible()
    await expect(page.getByLabel('Registros por página')).toBeVisible()
    await expect(page.getByLabel('Ventana de fechas')).toBeVisible()
  })

  test('Aspecto y Experiencia Visual: controles de tema, tamaño, modo oscuro y ubicación de avisos', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: 'Aspecto y Experiencia Visual' })
    ).toBeVisible()
    await expect(page.getByLabel('Tema')).toBeVisible()
    await expect(page.getByLabel('Tamaño')).toBeVisible()
    await expect(page.getByLabel('Ubicación de notificaciones')).toBeVisible()
    await expect(page.getByText('Iniciar en modo oscuro')).toBeVisible()
  })

  test('Ubicación de notificaciones: muestra aviso en vivo directamente al cambiar la posición en el select', async ({
    page,
  }) => {
    // Cambiar la posición a "Arriba a la derecha"
    await selectGluOption(page, 'app-toast-position', 'Arriba a la derecha')

    // Verifica que aparezca el toast en el viewport superior derecho
    const toast = page.locator('.glb-toast')
    await expect(toast).toBeVisible({ timeout: 10_000 })
    await expect(toast).toContainText('Ubicación de notificaciones')
    await expect(toast).toContainText('Arriba a la derecha')

    const viewportTopRight = page.locator('.glb-toast-viewport--top-right')
    await expect(viewportTopRight).toBeVisible()

    // Cambiar nuevamente a "Abajo a la derecha"
    await selectGluOption(page, 'app-toast-position', 'Abajo a la derecha')
    await expect(page.locator('.glb-toast-viewport--bottom-right')).toBeVisible({ timeout: 10_000 })
  })
})

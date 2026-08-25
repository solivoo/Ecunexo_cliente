import { expect, test } from '@playwright/test'

test.describe('Login', () => {
  test('muestra el formulario de acceso', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#login-email')).toBeVisible()
    await expect(page.locator('#login-password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
  })

  test('credenciales inválidas muestran error', async ({ page }) => {
    await page.goto('/')
    await page.locator('#login-email').fill('nadie@ecunexo.local')
    await page.locator('#login-password').fill('clave-incorrecta')
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 })
  })
})

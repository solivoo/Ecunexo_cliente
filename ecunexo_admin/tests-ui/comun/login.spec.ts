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

  test('muestra cláusula de consentimiento click-wrap y abre modal legal', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Al ingresar, declaras conocer y aceptar')).toBeVisible()

    // Clic en Términos del Servicio desde el login card
    await page.getByRole('button', { name: 'Términos del Servicio' }).first().click()
    await expect(page.getByText('Marco Jurídico y Protección Normativa (Ecuador)')).toBeVisible()
    await expect(page.getByText('LOPDP R.O. 459')).toBeVisible()
    await expect(page.getByText('Ficha Técnica SRI v2.32')).toBeVisible()
    await expect(page.getByRole('button', { name: 'He leído y acepto' })).toBeVisible()

    // Cerrar modal
    await page.getByRole('button', { name: 'He leído y acepto' }).click()
    await expect(page.getByText('Marco Jurídico y Protección Normativa (Ecuador)')).not.toBeVisible()

    // Abrir Política de Privacidad desde el footer
    await page.locator('footer').getByRole('button', { name: 'Política de Privacidad (LOPDP)' }).click()
    await expect(page.getByText('Marco Jurídico y Protección Normativa (Ecuador)')).toBeVisible()
  })

  test('rutas públicas /terminos y /privacidad son accesibles sin login', async ({ page }) => {
    await page.goto('/terminos')
    await expect(page.getByText('Marco Legal y Blindaje Jurídico')).toBeVisible()
    await expect(page.getByRole('heading', { name: '3. Sujeto Pasivo Tributario' })).toBeVisible()

    await page.goto('/privacidad')
    await expect(page.getByText('Marco Legal y Blindaje Jurídico')).toBeVisible()
    await expect(page.getByRole('heading', { name: '2. Delimitación de Roles' })).toBeVisible()
  })
})

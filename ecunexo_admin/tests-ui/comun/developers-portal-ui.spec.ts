import { expect, test } from '@playwright/test'

test.describe('Portal de Desarrolladores y Documentación de APIs (/developers)', () => {
  test('Portal Público: renderiza sin autenticación, permite scroll y alterna modo oscuro', async ({
    page,
  }) => {
    await page.goto('/developers')

    // 1. Título y encabezado público
    await expect(page.locator('strong:has-text("EcuNexo Developers")')).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByRole('heading', { name: /Construye la infraestructura de tu empresa/i })
    ).toBeVisible()

    // 2. Acceso a enlaces de especificación Scalar y OpenAPI JSON
    const scalarLink = page.getByRole('link', { name: /Playground Scalar/i })
    const openApiJsonLink = page.getByRole('link', { name: /OpenAPI JSON/i })
    await expect(scalarLink).toBeVisible()
    await expect(scalarLink).toHaveAttribute('href', '/scalar/external-v1')
    await expect(openApiJsonLink).toBeVisible()
    await expect(openApiJsonLink).toHaveAttribute('href', '/openapi/external-v1.json')

    // 3. Verificación de scroll fluído
    const portalContainer = page.locator('.ecu-dev-portal')
    await expect(portalContainer).toBeVisible()
    const isScrollable = await portalContainer.evaluate((el) => el.scrollHeight > el.clientHeight)
    expect(isScrollable).toBe(true)

    // Scroll vertical efectivo
    await portalContainer.evaluate((el) => el.scrollTo({ top: 350 }))
    const scrollTop = await portalContainer.evaluate((el) => el.scrollTop)
    expect(scrollTop).toBeGreaterThan(0)

    // 4. Verificación de modo oscuro (Dark Mode)
    const themeBtn = page.locator('.ecu-theme-toggle')
    await expect(themeBtn).toBeVisible()
    await themeBtn.click()

    // Comprobar que se aplica la clase sf-dark-mode en el elemento raíz
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('sf-dark-mode')
    )
    expect(isDark).toBe(true)

    // 5. Navegación por pestañas de la documentación
    // Pestaña 2: Scopes y Módulos
    await page.getByRole('button', { name: /2\. Scopes y Módulos/i }).click()
    await expect(page.getByRole('heading', { name: /Catálogo de Scopes Permitidos/i })).toBeVisible()
    await expect(page.locator('code:has-text("catalog.item.read")').first()).toBeVisible()
    await expect(page.locator('code:has-text("inventory.stock.read")').first()).toBeVisible()

    // Pestaña 3: Arquitecturas y Recetas
    await page.getByRole('button', { name: /3\. Arquitecturas y Recetas/i }).click()
    await expect(page.getByRole('heading', { name: /Headless Storefront/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Integración con ERP/i })).toBeVisible()

    // Pestaña 4: Códigos de Error
    await page.getByRole('button', { name: /4\. Códigos de Error/i }).click()
    await expect(
      page.getByRole('heading', { name: /Manejo de Errores y Códigos de Diagnóstico/i })
    ).toBeVisible()
    await expect(page.locator('text=401 Unauthorized').first()).toBeVisible()
    await expect(page.locator('code:has-text("auth.tenant.mismatch")').first()).toBeVisible()

    // Pestaña 5: Referencia OpenAPI Interactiva
    await page.getByRole('button', { name: /5\. Referencia OpenAPI Interactiva/i }).click()
    await expect(page.locator('iframe[title*="Scalar"]')).toBeVisible()
  })
})

import { expect, test } from '@playwright/test'

test.describe('Portal Empresarial de Desarrolladores y Documentación de APIs (/developers)', () => {
  test('Portal Público: renderiza layout con sidebar, permite scroll, alterna modo oscuro y navega todas las secciones', async ({
    page,
  }) => {
    await page.goto('/developers')

    // 1. Título, encabezado público y sidebar de navegación
    await expect(page.locator('strong:has-text("EcuNexo Developers")')).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByRole('heading', { name: /Construye la infraestructura de tu empresa/i })
    ).toBeVisible()
    await expect(page.getByLabel('Navegación de documentación')).toBeVisible()

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

    await portalContainer.evaluate((el) => el.scrollTo({ top: 350 }))
    const scrollTop = await portalContainer.evaluate((el) => el.scrollTop)
    expect(scrollTop).toBeGreaterThan(0)

    // 4. Verificación de modo oscuro (Dark Mode)
    const themeBtn = page.locator('.ecu-theme-toggle')
    await expect(themeBtn).toBeVisible()
    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('sf-dark-mode')
    )
    await themeBtn.click()
    const toggledDark = await page.evaluate(() =>
      document.documentElement.classList.contains('sf-dark-mode')
    )
    expect(toggledDark).toBe(!initialDark)

    // 5. Generador de SDKs multi-lenguaje en pestaña inicial
    await expect(
      page.getByRole('heading', { name: /Generador de Cliente SDK y Ejemplos de Integración/i })
    ).toBeVisible()
    await page.getByRole('button', { name: /C# \/ \.NET 10/i }).click()
    await expect(page.locator('code:has-text("HttpClient")').first()).toBeVisible()

    // 6. Catálogo de Endpoints por Dominio
    await page.getByRole('button', { name: /Catálogo de Endpoints/i }).click()
    await expect(
      page.getByRole('heading', { name: /Catálogo de Endpoints Empresariales por Dominio/i })
    ).toBeVisible()
    await expect(page.locator('code:has-text("/catalog/items")').first()).toBeVisible()

    // 7. Scopes y Módulos
    await page.getByRole('button', { name: /2\. Scopes y Módulos/i }).click()
    await expect(page.getByRole('heading', { name: /Catálogo de Scopes Permitidos/i })).toBeVisible()
    await expect(page.locator('code:has-text("catalog.item.read")').first()).toBeVisible()
    await expect(page.locator('code:has-text("inventory.stock.read")').first()).toBeVisible()

    // 8. Arquitecturas y Recetas
    await page.getByRole('button', { name: /3\. Arquitecturas y Recetas/i }).click()
    await expect(page.getByRole('heading', { name: /Headless Storefront/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Integración con ERP/i })).toBeVisible()

    // 9. Simulador HTTP en Vivo
    await page.getByRole('button', { name: /Simulador HTTP en Vivo/i }).click()
    await expect(
      page.getByRole('heading', { name: /Simulador HTTP M2M en Vivo/i })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Ejecutar Petición Real/i })).toBeVisible()

    // 10. Códigos de Error
    await page.getByRole('button', { name: /4\. Códigos de Error/i }).click()
    await expect(
      page.getByRole('heading', { name: /Manejo de Errores y Códigos de Diagnóstico/i })
    ).toBeVisible()
    await expect(page.locator('text=401 Unauthorized').first()).toBeVisible()
    await expect(page.locator('code:has-text("auth.tenant.mismatch")').first()).toBeVisible()

    // 11. Referencia OpenAPI Interactiva
    await page.getByRole('button', { name: /5\. Referencia OpenAPI Interactiva/i }).click()
    await expect(page.locator('iframe[title*="Scalar"]')).toBeVisible()
  })
})

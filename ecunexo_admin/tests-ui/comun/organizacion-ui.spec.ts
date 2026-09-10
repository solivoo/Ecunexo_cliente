import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Organización & SRI UI — Empresas, Perfil, Plan y Facturación Electrónica', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
  })

  test('Empresas: carga PageHeader, métricas KPI y menú de acciones', async ({ page }) => {
    await page.goto('/organizacion/empresas')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Empresas del Inquilino/i })
    ).toBeVisible({ timeout: 20_000 })

    // Acciones de empresas
    await expect(page.getByRole('button', { name: /Acciones de empresas/i })).toBeVisible()

    // Tira de métricas
    await expect(page.getByLabel('Resumen de empresas')).toBeVisible()
  })

  test('Perfil: carga PageHeader y secciones de datos de organización', async ({ page }) => {
    await page.goto('/organizacion/perfil')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Perfil de la Organización/i })
    ).toBeVisible({ timeout: 20_000 })

    // Contenedores SectionCard
    const sectionCards = page.locator('.ecu-section-card')
    await expect(sectionCards.first()).toBeVisible({ timeout: 20_000 })
  })

  test('Plan: carga PageHeader y límites de suscripción contratada', async ({ page }) => {
    await page.goto('/organizacion/plan')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Plan y Suscripción/i })
    ).toBeVisible({ timeout: 20_000 })

    // Contenedor de plan
    await expect(page.locator('.ecu-section-card').first()).toBeVisible()
  })

  test('Facturación Electrónica: carga PageHeader y configuración de emisor SRI', async ({
    page,
  }) => {
    await page.goto('/organizacion/facturacion-electronica')
    await expect(page.locator('.app-shell')).toBeVisible()

    // PageHeader
    await expect(
      page.getByRole('heading', { name: /Facturación Electrónica SRI/i })
    ).toBeVisible({ timeout: 20_000 })

    // Sección de certificado o datos de emisor
    await expect(page.locator('.ecu-section-card').first()).toBeVisible({ timeout: 20_000 })
  })
})

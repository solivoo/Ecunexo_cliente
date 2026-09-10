import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Dashboard UI — Material Design 3 Layout & KPIs', () => {
  test.beforeEach(async ({ page }) => {
    requireFixedCredentials()
    await loginAsSeedUser(page)
    await page.goto('/inicio')
  })

  test('renderiza el contenedor principal con PageHeader y badge de estado', async ({ page }) => {
    const layout = page.locator('.ecu-dashboard-layout')
    await expect(layout).toBeVisible({ timeout: 20_000 })

    const header = page.locator('.page-header')
    await expect(header).toBeVisible()

    // Badge de estado (Empresa Activa o Titular de Licencia)
    const badge = header.locator('.status-badge')
    await expect(badge).toBeVisible()
  })

  test('muestra la cuadrícula de métricas KPI (StatCards)', async ({ page }) => {
    const statGrid = page.locator('.ecu-stat-grid')
    await expect(statGrid).toBeVisible({ timeout: 20_000 })

    const cards = statGrid.locator('.ecu-stat-card')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // Verifica que la primera tarjeta tenga etiqueta y valor
    const firstCard = cards.first()
    await expect(firstCard.locator('.ecu-stat-card__label')).toBeVisible()
    await expect(firstCard.locator('.ecu-stat-card__value')).toBeVisible()
  })

  test('las tarjetas de sección y accesos rápidos están presentes', async ({ page }) => {
    const sectionCard = page.locator('.ecu-section-card').first()
    await expect(sectionCard).toBeVisible({ timeout: 20_000 })
  })
})

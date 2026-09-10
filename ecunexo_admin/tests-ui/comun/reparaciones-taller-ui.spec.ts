import { expect, test } from '@playwright/test'
import { loginAsSeedUser } from '../helpers/loginAsSeedUser'
import { requireFixedCredentials } from '../helpers/requirePlan'

test.describe('Módulo Taller & Reparaciones B2B UI', () => {
  test('Pantalla Pública de Verificación QR: carga limpia y responsive sin login', async ({ page }) => {
    // La pantalla de verificación es pública para transportistas y guardias
    await page.goto('/verificar/despacho/demo-hash-12345')

    await expect(
      page.getByRole('heading', { name: /Acta de Despacho Certificada/i })
    ).toBeVisible({ timeout: 15_000 })

    await expect(
      page.getByText(/Verificación Oficial EcuNexo Taller/i)
    ).toBeVisible()
  })

  test.describe('Vistas autenticadas de Taller B2B', () => {
    test.beforeEach(async ({ page }) => {
      requireFixedCredentials()
      await loginAsSeedUser(page)
    })

    test('Lotes: carga PageHeader, métricas KPI y contenedor de datos', async ({ page }) => {
      await page.goto('/taller/lotes')
      await expect(page.locator('.app-shell')).toBeVisible()

      // PageHeader
      await expect(
        page.getByRole('heading', { name: /Lotes de Reparación B2B/i })
      ).toBeVisible({ timeout: 20_000 })

      // Acciones del header
      await expect(page.getByRole('button', { name: /Plantilla Excel/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Importar Lote/i })).toBeVisible()

      // Tira de StatCards
      const statCards = page.locator('.ecu-stat-card')
      expect(await statCards.count()).toBeGreaterThanOrEqual(3)
    })

    test('Nuevo Lote: carga asistente, tarifario N1/N2/N3 y zona de carga Excel', async ({ page }) => {
      await page.goto('/taller/lotes/nuevo')
      await expect(page.locator('.app-shell')).toBeVisible()

      await expect(
        page.getByRole('heading', { name: /Importar Lote de Reparación/i })
      ).toBeVisible({ timeout: 20_000 })

      // Secciones
      await expect(page.getByText(/Datos del Contrato y Cliente/i)).toBeVisible()
      await expect(page.getByText(/Tarifario Acordado de Servicio/i)).toBeVisible()
      await expect(page.getByText(/Planilla de Equipos \(Excel\)/i)).toBeVisible()

      // Tarifas N1, N2, N3
      await expect(page.getByText(/Nivel 1 \(Leve \/ Estético\)/i)).toBeVisible()
      await expect(page.getByText(/Nivel 2 \(Medio \/ Chapa\)/i)).toBeVisible()
      await expect(page.getByText(/Nivel 3 \(Grave \/ Estructural\)/i)).toBeVisible()

      // Botón de descargar plantilla
      await expect(
        page.getByRole('button', { name: /Descargar Plantilla Oficial/i })
      ).toBeVisible()
    })

    test('Actas y Despachos: carga historial y métricas de salida', async ({ page }) => {
      await page.goto('/taller/despachos')
      await expect(page.locator('.app-shell')).toBeVisible()

      await expect(
        page.getByRole('heading', { name: /Actas y Despachos de Salida/i })
      ).toBeVisible({ timeout: 20_000 })

      await expect(page.getByRole('button', { name: /Emitir Despacho/i })).toBeVisible()
    })

    test('Portal Corporativo Whirlpool: carga branding ejecutivo y buscador de serie', async ({ page }) => {
      await page.goto('/taller/portal')
      await expect(page.locator('.app-shell')).toBeVisible()

      // Branding corporativo
      await expect(page.getByText(/Whirlpool del Ecuador S\.A\./i)).toBeVisible({
        timeout: 20_000,
      })
      await expect(page.getByText(/Portal Exclusivo B2B/i)).toBeVisible()

      // Buscador instantáneo por serie
      await expect(
        page.getByText(/Rastreo Instantáneo por Número de Serie/i)
      ).toBeVisible()
    })
  })
})

import { expect, test } from '@playwright/test'

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
      // Mockear endpoints de autenticación y sesión para validar UI de forma aislada
      await page.route('**/api/v1/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'e2e-mock-token',
            expiresAt: '2030-01-01T00:00:00Z',
            userId: 'usr-e2e-1',
            tenantId: 'tnt-e2e-1',
            isSubscriptionHolder: false,
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'usr-e2e-1',
              email: 'e2e@ecunexo.test',
              name: 'Operador Taller E2E',
              department: 'Taller',
              phone: '0991234567',
              jobTitle: 'Supervisor Técnico',
              roleIds: ['role-admin'],
            },
            tenant: {
              id: 'tnt-e2e-1',
              name: 'Taller Central E2E',
              timeZoneId: 'America/Guayaquil',
              locale: 'es-EC',
              logoUrl: null,
              status: 1,
              servicePlanName: 'Taller Mixto',
              maxUsers: 10,
              maxWarehouses: 5,
              subscriptionMaxTenants: 1,
              enabledModules: ['repairs', 'taller'],
            },
            permissions: [
              'repairs.batches.read',
              'repairs.batches.import',
              'repairs.equipments.update.status',
              'repairs.equipments.upload.photo',
              'repairs.dispatches.read',
              'repairs.dispatches.create',
              'repairs.b2b.portal.view',
            ],
            navigation: [
              {
                id: 'taller',
                label: 'Reparaciones',
                icon: 'wrench',
                children: [
                  { id: 'batches', label: 'Lotes B2B', route: '/taller/lotes', children: [] },
                  { id: 'dispatches', label: 'Despachos', route: '/taller/despachos', children: [] },
                  { id: 'portal', label: 'Portal Whirlpool', route: '/taller/portal', children: [] },
                ],
              },
            ],
            settings: {},
            permVersion: '1',
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'batch-001',
              batchNumber: 'LOTE-WPH-2026-001',
              customerName: 'Whirlpool del Ecuador S.A.',
              contractReference: 'CT-WPH-2026-Q1',
              status: 1,
              receivedAt: '2026-09-01T10:00:00Z',
              totalCount: 15,
              receivedCount: 2,
              inRepairCount: 8,
              readyCount: 3,
              dispatchedCount: 2,
              progressPercentage: 33.3,
            },
          ]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/customers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'cust-001',
              name: 'Whirlpool del Ecuador S.A.',
              taxId: '1790012345001',
              contactEmail: 'servicio@whirlpool.ec',
              active: true,
            },
          ]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/dispatches', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/batch-001', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'batch-001',
            batchNumber: 'LOTE-WPH-2026-001',
            customerName: 'Whirlpool del Ecuador S.A.',
            customerTaxId: '1790012345001',
            contractReference: 'CT-WPH-2026-Q1',
            status: 1,
            receivedAt: '2026-09-01T10:00:00Z',
            totalCount: 15,
            receivedCount: 2,
            inRepairCount: 8,
            readyCount: 3,
            dispatchedCount: 2,
            rateN1: 45.0,
            rateN2: 85.0,
            rateN3: 150.0,
          }),
        })
      })

      await page.route('**/api/v1/tenants/*/repairs/batches/batch-001/equipments', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'eq-001',
              batchId: 'batch-001',
              serialNumber: 'WP-SN-998811',
              model: 'LAVADORA XPERT 19KG',
              brand: 'Whirlpool',
              damageLevel: 1,
              status: 1,
              photosCount: 2,
              notes: 'Filtro obstruido',
            },
          ]),
        })
      })

      await page.goto('/')
      await page.locator('#login-email').fill('e2e@ecunexo.test')
      await page.locator('#login-password').fill('TestPassword123!')
      await page.getByRole('button', { name: 'Iniciar sesión' }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })
      await expect
        .poll(() => page.evaluate(() => Boolean(localStorage.getItem('persist:ecunexo-tenant-auth'))))
        .toBeTruthy()
    })

    test('Lotes: carga PageHeader, métricas KPI y contenedor de datos', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })

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

      // Tabla DataGrid con lote mockeado
      await expect(page.getByText('LOTE-WPH-2026-001')).toBeVisible()
    })

    test('Nuevo Lote: carga asistente, tarifario N1/N2/N3 y zona de carga Excel', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await expect(
        page.getByRole('heading', { name: /Lotes de Reparación B2B/i })
      ).toBeVisible({ timeout: 20_000 })

      // Clic en Importar Lote
      await page.getByRole('button', { name: /Importar Lote/i }).click()

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
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Despachos/i }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })

      await expect(
        page.getByRole('heading', { name: /Actas y Despachos de Salida/i })
      ).toBeVisible({ timeout: 20_000 })

      await expect(page.getByRole('button', { name: /Emitir Despacho/i })).toBeVisible()
    })

    test('Portal Corporativo Whirlpool: carga branding ejecutivo y buscador de serie', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Portal Whirlpool/i }).click()
      await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 })

      // Branding corporativo y PageHeader M3
      await expect(
        page.getByRole('heading', { name: /Portal Corporativo Whirlpool/i })
      ).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText(/Auditoría B2B Certificada/i)).toBeVisible()

      // Buscador instantáneo por serie
      await expect(
        page.getByText(/Rastreo Instantáneo por Número de Serie/i)
      ).toBeVisible()
    })

    test('Detalle de Lote: abre modal Popup de cambio de fase técnica y evidencia', async ({ page }) => {
      await page.getByRole('button', { name: /Reparaciones/i }).click()
      await page.getByRole('button', { name: /Lotes B2B/i }).click()
      await expect(
        page.getByRole('heading', { name: /Lotes de Reparación B2B/i })
      ).toBeVisible({ timeout: 20_000 })

      // Clic en el lote
      await page.getByRole('button', { name: 'LOTE-WPH-2026-001' }).click()

      // Header del lote
      await expect(
        page.getByRole('heading', { name: /Lote LOTE-WPH-2026-001/i })
      ).toBeVisible({ timeout: 20_000 })

      // Equipo en la tabla
      await expect(page.getByText('WP-SN-998811')).toBeVisible()

      // Abrir modal Popup de cambio de estado
      const changeStatusBtn = page.getByRole('button', { name: /Cambiar estado \/ Fase técnica/i })
      await expect(changeStatusBtn).toBeVisible()
      await changeStatusBtn.click()

      // Verificar que el Popup de glubox abrió
      await expect(
        page.getByRole('heading', { name: /Fase Técnica — Serie WP-SN-998811/i })
      ).toBeVisible()

      // Cerrar modal
      await page.getByRole('button', { name: /Cancelar/i }).click()

      // Abrir modal Popup de fotos en S3
      const photosBtn = page.getByRole('button', { name: /Fotos de evidencia S3/i })
      await expect(photosBtn).toBeVisible()
      await photosBtn.click()

      // Verificar que el Popup de evidencia fotográfica abrió
      await expect(page.getByRole('heading', { name: /Evidencia Fotográfica/i })).toBeVisible()
    })
  })
})
